package repository

import (
	"context"
	"errors"
	"fmt"

	"ems-thermal-lstm/backend-go/internal/model"

	"github.com/jackc/pgx/v5"
)

func (r *Repository) ActiveLayout(ctx context.Context) (*model.ActiveLayout, error) {
	settings, err := r.PredictionSettings(ctx)
	if err != nil {
		return nil, err
	}
	var layout model.Layout
	err = r.db.QueryRow(ctx, `
		SELECT id, name, image_path, COALESCE(image_width, 0), COALESCE(image_height, 0), created_at, updated_at
		FROM layouts
		WHERE is_active = TRUE
		LIMIT 1`,
	).Scan(
		&layout.ID,
		&layout.Name,
		&layout.ImageURL,
		&layout.ImageWidth,
		&layout.ImageHeight,
		&layout.CreatedAt,
		&layout.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get active layout: %w", err)
	}

	rows, err := r.db.Query(ctx, `
		SELECT
			sensors.sensor_code,
			sensors.sensor_role,
			COALESCE(layout_devices.label, sensors.name),
			layout_devices.position_x::FLOAT8,
			layout_devices.position_y::FLOAT8,
			latest.temperature::FLOAT8,
			latest.humidity::FLOAT8,
			sensors.last_seen_at,
			sensors.sensor_health_status
		FROM layout_devices
		JOIN sensors ON sensors.id = layout_devices.sensor_id
		LEFT JOIN LATERAL (
			SELECT temperature, humidity
			FROM sensor_readings
			WHERE sensor_readings.sensor_id = sensors.id
			ORDER BY recorded_at DESC
			LIMIT 1
		) latest ON TRUE
		WHERE layout_devices.layout_id = $1
		ORDER BY sensors.sensor_code`,
		layout.ID,
	)
	if err != nil {
		return nil, fmt.Errorf("list layout devices: %w", err)
	}
	defer rows.Close()

	devices := make([]model.LayoutDevice, 0)
	for rows.Next() {
		var device model.LayoutDevice
		if err := rows.Scan(
			&device.SensorCode,
			&device.SensorRole,
			&device.Label,
			&device.PositionX,
			&device.PositionY,
			&device.Temperature,
			&device.Humidity,
			&device.LastSeenAt,
			&device.SensorHealthStatus,
		); err != nil {
			return nil, fmt.Errorf("scan layout device: %w", err)
		}
		device.FinalStatus = layoutDeviceStatus(device.SensorHealthStatus, device.Temperature, settings)
		devices = append(devices, device)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate layout devices: %w", err)
	}
	return &model.ActiveLayout{Layout: layout, Devices: devices}, nil
}

func layoutDeviceStatus(healthStatus string, temperature *float64, settings model.PredictionSettings) string {
	if healthStatus != "normal" || temperature == nil {
		return "trouble"
	}
	return classifyCurrentThermalStatus(*temperature, settings)
}

func (r *Repository) CreateLayout(ctx context.Context, name, imageURL string, width, height int) (model.Layout, model.SystemLog, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return model.Layout{}, model.SystemLog{}, fmt.Errorf("begin layout upload: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `UPDATE layouts SET is_active = FALSE, updated_at = NOW() WHERE is_active = TRUE`); err != nil {
		return model.Layout{}, model.SystemLog{}, fmt.Errorf("deactivate prior layout: %w", err)
	}
	var layout model.Layout
	err = tx.QueryRow(ctx, `
		INSERT INTO layouts (name, image_path, image_width, image_height, is_active)
		VALUES ($1, $2, $3, $4, TRUE)
		RETURNING id, name, image_path, image_width, image_height, created_at, updated_at`,
		name,
		imageURL,
		width,
		height,
	).Scan(
		&layout.ID,
		&layout.Name,
		&layout.ImageURL,
		&layout.ImageWidth,
		&layout.ImageHeight,
		&layout.CreatedAt,
		&layout.UpdatedAt,
	)
	if err != nil {
		return model.Layout{}, model.SystemLog{}, fmt.Errorf("insert layout: %w", err)
	}
	systemLog, err := insertSystemLogTx(ctx, tx, "backend", "info", "Active layout image updated", map[string]any{
		"layout_id": layout.ID,
		"name":      layout.Name,
	})
	if err != nil {
		return model.Layout{}, model.SystemLog{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return model.Layout{}, model.SystemLog{}, fmt.Errorf("commit layout upload: %w", err)
	}
	return layout, systemLog, nil
}

func (r *Repository) UpsertLayoutDevice(ctx context.Context, sensorCode string, input model.LayoutDeviceInput) (model.SystemLog, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return model.SystemLog{}, fmt.Errorf("begin layout marker update: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	commandTag, err := tx.Exec(ctx, `
		INSERT INTO layout_devices (layout_id, sensor_id, label, position_x, position_y)
		SELECT layouts.id, sensors.id, NULLIF($2, ''), $3, $4
		FROM layouts
		CROSS JOIN sensors
		WHERE layouts.is_active = TRUE
		  AND sensors.sensor_code = $1
		ON CONFLICT (layout_id, sensor_id) DO UPDATE
		SET label = EXCLUDED.label,
		    position_x = EXCLUDED.position_x,
		    position_y = EXCLUDED.position_y,
		    updated_at = NOW()`,
		sensorCode,
		input.Label,
		*input.PositionX,
		*input.PositionY,
	)
	if err != nil {
		return model.SystemLog{}, fmt.Errorf("upsert layout marker: %w", err)
	}
	if commandTag.RowsAffected() == 0 {
		return model.SystemLog{}, ErrNotFound
	}
	systemLog, err := insertSystemLogTx(ctx, tx, "backend", "info", "Layout sensor marker updated", map[string]any{
		"sensor_code": sensorCode,
		"position_x":  *input.PositionX,
		"position_y":  *input.PositionY,
	})
	if err != nil {
		return model.SystemLog{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return model.SystemLog{}, fmt.Errorf("commit layout marker update: %w", err)
	}
	return systemLog, nil
}

func (r *Repository) DeleteLayoutDevice(ctx context.Context, sensorCode string) (model.SystemLog, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return model.SystemLog{}, fmt.Errorf("begin layout marker delete: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	commandTag, err := tx.Exec(ctx, `
		DELETE FROM layout_devices
		USING layouts, sensors
		WHERE layout_devices.layout_id = layouts.id
		  AND layout_devices.sensor_id = sensors.id
		  AND layouts.is_active = TRUE
		  AND sensors.sensor_code = $1`,
		sensorCode,
	)
	if err != nil {
		return model.SystemLog{}, fmt.Errorf("delete layout marker: %w", err)
	}
	if commandTag.RowsAffected() == 0 {
		return model.SystemLog{}, ErrNotFound
	}
	systemLog, err := insertSystemLogTx(ctx, tx, "backend", "info", "Layout sensor marker removed", map[string]any{
		"sensor_code": sensorCode,
	})
	if err != nil {
		return model.SystemLog{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return model.SystemLog{}, fmt.Errorf("commit layout marker delete: %w", err)
	}
	return systemLog, nil
}
