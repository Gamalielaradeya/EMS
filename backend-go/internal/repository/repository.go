package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"ems-thermal-lstm/backend-go/internal/model"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("record not found")

type Repository struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Ping(ctx context.Context) error {
	return r.db.Ping(ctx)
}

func (r *Repository) BootstrapGatewayToken(ctx context.Context, gatewayCode, tokenHash string) error {
	commandTag, err := r.db.Exec(ctx, `
		INSERT INTO api_tokens (gateway_id, token_hash, name)
		SELECT gateways.id, $2, 'Gateway bootstrap token'
		FROM gateways
		WHERE gateways.gateway_code = $1
		  AND NOT EXISTS (
			  SELECT 1
			  FROM api_tokens
			  WHERE api_tokens.gateway_id = gateways.id
			    AND api_tokens.token_hash = $2
			    AND api_tokens.is_active = TRUE
		  )`,
		gatewayCode,
		tokenHash,
	)
	if err != nil {
		return fmt.Errorf("bootstrap gateway token: %w", err)
	}
	if commandTag.RowsAffected() == 0 {
		var gatewayExists bool
		if err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM gateways WHERE gateway_code = $1)`, gatewayCode).Scan(&gatewayExists); err != nil {
			return fmt.Errorf("check gateway existence: %w", err)
		}
		if !gatewayExists {
			return fmt.Errorf("%w: gateway %s", ErrNotFound, gatewayCode)
		}
	}
	return nil
}

func (r *Repository) GatewayTokenValid(ctx context.Context, tokenHash string) (bool, error) {
	var valid bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM api_tokens
			JOIN gateways ON gateways.id = api_tokens.gateway_id
			WHERE api_tokens.token_hash = $1
			  AND api_tokens.is_active = TRUE
			  AND api_tokens.revoked_at IS NULL
		)`,
		tokenHash,
	).Scan(&valid)
	if err != nil {
		return false, fmt.Errorf("validate gateway token: %w", err)
	}
	if valid {
		if _, err := r.db.Exec(ctx, `
			UPDATE api_tokens
			SET last_used_at = NOW()
			WHERE token_hash = $1 AND is_active = TRUE AND revoked_at IS NULL`,
			tokenHash,
		); err != nil {
			return false, fmt.Errorf("update token usage: %w", err)
		}
	}
	return valid, nil
}

func (r *Repository) InsertReadings(
	ctx context.Context,
	gatewayCode string,
	recordedAt time.Time,
	source string,
	readings []model.ReadingInsert,
	rawPayload []byte,
) (int64, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin readings transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	gatewayID, err := lookupGatewayID(ctx, tx, gatewayCode)
	if err != nil {
		return 0, err
	}

	var storedCount int64
	for _, reading := range readings {
		var sensorID int64
		err := tx.QueryRow(ctx, `
			SELECT id
			FROM sensors
			WHERE gateway_id = $1 AND sensor_code = $2`,
			gatewayID,
			reading.SensorCode,
		).Scan(&sensorID)
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, fmt.Errorf("%w: sensor %s", ErrNotFound, reading.SensorCode)
		}
		if err != nil {
			return 0, fmt.Errorf("find sensor %s: %w", reading.SensorCode, err)
		}

		commandTag, err := tx.Exec(ctx, `
			INSERT INTO sensor_readings (
				gateway_id, sensor_id, temperature, humidity, recorded_at,
				quality_status, source, raw_payload
			)
			VALUES ($1, $2, $3, $4, $5, 'valid', $6, $7)
			ON CONFLICT (gateway_id, sensor_id, recorded_at) DO NOTHING`,
			gatewayID,
			sensorID,
			reading.Temperature,
			reading.Humidity,
			recordedAt,
			source,
			rawPayload,
		)
		if err != nil {
			return 0, fmt.Errorf("insert sensor reading: %w", err)
		}
		storedCount += commandTag.RowsAffected()

		if _, err := tx.Exec(ctx, `
			UPDATE sensors
			SET last_seen_at = GREATEST(COALESCE(last_seen_at, $2), $2),
			    sensor_health_status = 'normal',
			    updated_at = NOW()
			WHERE id = $1`,
			sensorID,
			recordedAt,
		); err != nil {
			return 0, fmt.Errorf("update sensor last seen: %w", err)
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE gateways
		SET last_seen_at = GREATEST(COALESCE(last_seen_at, $2), $2),
		    status = 'active',
		    updated_at = NOW()
		WHERE id = $1`,
		gatewayID,
		recordedAt,
	); err != nil {
		return 0, fmt.Errorf("update gateway last seen: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("commit readings transaction: %w", err)
	}
	return storedCount, nil
}

func (r *Repository) RecordGatewayStatus(ctx context.Context, input model.GatewayStatusInput, reportedAt time.Time) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin gateway status transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	gatewayID, err := lookupGatewayID(ctx, tx, input.GatewayID)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE gateways
		SET status = $2,
		    last_seen_at = GREATEST(COALESCE(last_seen_at, $3), $3),
		    updated_at = NOW()
		WHERE id = $1`,
		gatewayID,
		input.Status,
		reportedAt,
	); err != nil {
		return fmt.Errorf("update gateway status: %w", err)
	}

	payload, err := json.Marshal(input)
	if err != nil {
		return fmt.Errorf("marshal gateway status payload: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO gateway_status_logs (gateway_id, status, message, payload, reported_at)
		VALUES ($1, $2, $3, $4, $5)`,
		gatewayID,
		input.Status,
		input.Message,
		payload,
		reportedAt,
	); err != nil {
		return fmt.Errorf("insert gateway status log: %w", err)
	}

	for _, sensor := range input.Sensors {
		commandTag, err := tx.Exec(ctx, `
			UPDATE sensors
			SET sensor_health_status = $3,
			    updated_at = NOW()
			WHERE gateway_id = $1 AND sensor_code = $2`,
			gatewayID,
			sensor.SensorCode,
			sensor.Status,
		)
		if err != nil {
			return fmt.Errorf("update sensor status: %w", err)
		}
		if commandTag.RowsAffected() == 0 {
			return fmt.Errorf("%w: sensor %s", ErrNotFound, sensor.SensorCode)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit gateway status transaction: %w", err)
	}
	return nil
}

func (r *Repository) ListSensors(ctx context.Context) ([]model.Sensor, error) {
	rows, err := r.db.Query(ctx, sensorSelect+` ORDER BY sensors.sensor_code`)
	if err != nil {
		return nil, fmt.Errorf("list sensors: %w", err)
	}
	defer rows.Close()

	sensors := make([]model.Sensor, 0)
	for rows.Next() {
		sensor, err := scanSensor(rows)
		if err != nil {
			return nil, err
		}
		sensors = append(sensors, sensor)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate sensors: %w", err)
	}
	return sensors, nil
}

func (r *Repository) GetSensor(ctx context.Context, gatewayCode, sensorCode string) (model.Sensor, error) {
	row := r.db.QueryRow(ctx, sensorSelect+` WHERE gateways.gateway_code = $1 AND sensors.sensor_code = $2`, gatewayCode, sensorCode)
	sensor, err := scanSensor(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.Sensor{}, ErrNotFound
	}
	return sensor, err
}

func (r *Repository) UpdateSensor(ctx context.Context, gatewayCode, sensorCode string, input model.SensorUpdateInput) (model.Sensor, error) {
	row := r.db.QueryRow(ctx, `
		UPDATE sensors
		SET name = COALESCE($3, name),
		    location = COALESCE($4, location),
		    modbus_slave_id = COALESCE($5, modbus_slave_id),
		    sensor_health_status = COALESCE($6, sensor_health_status),
		    updated_at = NOW()
		WHERE sensor_code = $1
		  AND gateway_id = (SELECT id FROM gateways WHERE gateway_code = $2)
		RETURNING id`,
		sensorCode,
		gatewayCode,
		input.Name,
		input.Location,
		input.ModbusSlaveID,
		input.SensorHealthStatus,
	)
	var sensorID int64
	if err := row.Scan(&sensorID); errors.Is(err, pgx.ErrNoRows) {
		return model.Sensor{}, ErrNotFound
	} else if err != nil {
		return model.Sensor{}, fmt.Errorf("update sensor: %w", err)
	}
	return r.GetSensor(ctx, gatewayCode, sensorCode)
}

func (r *Repository) LatestReadings(ctx context.Context) (map[string]model.Reading, error) {
	rows, err := r.db.Query(ctx, `
		SELECT DISTINCT ON (sensors.sensor_code)
			sensor_readings.id,
			gateways.gateway_code,
			sensors.sensor_code,
			sensors.sensor_role,
			sensor_readings.temperature::FLOAT8,
			sensor_readings.humidity::FLOAT8,
			sensor_readings.recorded_at,
			sensor_readings.quality_status,
			sensor_readings.source
		FROM sensor_readings
		JOIN gateways ON gateways.id = sensor_readings.gateway_id
		JOIN sensors ON sensors.id = sensor_readings.sensor_id
		ORDER BY sensors.sensor_code, sensor_readings.recorded_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("latest readings: %w", err)
	}
	defer rows.Close()

	readings := map[string]model.Reading{}
	for rows.Next() {
		reading, err := scanReading(rows)
		if err != nil {
			return nil, err
		}
		readings[reading.SensorCode] = reading
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate latest readings: %w", err)
	}
	return readings, nil
}

func (r *Repository) ReadingHistory(ctx context.Context, filters model.ReadingFilters) ([]model.Reading, int64, error) {
	conditions := []string{"TRUE"}
	args := make([]any, 0)
	addCondition := func(condition string, value any) {
		args = append(args, value)
		conditions = append(conditions, fmt.Sprintf(condition, len(args)))
	}
	if filters.SensorCode != "" {
		addCondition("sensors.sensor_code = $%d", filters.SensorCode)
	}
	if filters.QualityStatus != "" {
		addCondition("sensor_readings.quality_status = $%d", filters.QualityStatus)
	}
	if filters.From != nil {
		addCondition("sensor_readings.recorded_at >= $%d", *filters.From)
	}
	if filters.To != nil {
		addCondition("sensor_readings.recorded_at <= $%d", *filters.To)
	}

	where := strings.Join(conditions, " AND ")
	var total int64
	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM sensor_readings
		JOIN sensors ON sensors.id = sensor_readings.sensor_id
		WHERE `+where,
		args...,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count reading history: %w", err)
	}

	args = append(args, filters.Limit, filters.Offset)
	rows, err := r.db.Query(ctx, `
		SELECT
			sensor_readings.id,
			gateways.gateway_code,
			sensors.sensor_code,
			sensors.sensor_role,
			sensor_readings.temperature::FLOAT8,
			sensor_readings.humidity::FLOAT8,
			sensor_readings.recorded_at,
			sensor_readings.quality_status,
			sensor_readings.source
		FROM sensor_readings
		JOIN gateways ON gateways.id = sensor_readings.gateway_id
		JOIN sensors ON sensors.id = sensor_readings.sensor_id
		WHERE `+where+`
		ORDER BY sensor_readings.recorded_at DESC, sensor_readings.id DESC
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)),
		args...,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("reading history: %w", err)
	}
	defer rows.Close()

	readings := make([]model.Reading, 0)
	for rows.Next() {
		reading, err := scanReading(rows)
		if err != nil {
			return nil, 0, err
		}
		readings = append(readings, reading)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate reading history: %w", err)
	}
	return readings, total, nil
}

func lookupGatewayID(ctx context.Context, tx pgx.Tx, gatewayCode string) (int64, error) {
	var gatewayID int64
	err := tx.QueryRow(ctx, `SELECT id FROM gateways WHERE gateway_code = $1`, gatewayCode).Scan(&gatewayID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, fmt.Errorf("%w: gateway %s", ErrNotFound, gatewayCode)
	}
	if err != nil {
		return 0, fmt.Errorf("find gateway: %w", err)
	}
	return gatewayID, nil
}

const sensorSelect = `
	SELECT
		sensors.id,
		gateways.gateway_code,
		sensors.sensor_code,
		sensors.sensor_role,
		sensors.name,
		sensors.type,
		sensors.location,
		sensors.modbus_slave_id,
		sensors.sensor_health_status,
		sensors.last_seen_at,
		sensors.created_at,
		sensors.updated_at
	FROM sensors
	LEFT JOIN gateways ON gateways.id = sensors.gateway_id`

type rowScanner interface {
	Scan(dest ...any) error
}

func scanSensor(scanner rowScanner) (model.Sensor, error) {
	var sensor model.Sensor
	if err := scanner.Scan(
		&sensor.ID,
		&sensor.GatewayCode,
		&sensor.SensorCode,
		&sensor.SensorRole,
		&sensor.Name,
		&sensor.Type,
		&sensor.Location,
		&sensor.ModbusSlaveID,
		&sensor.SensorHealthStatus,
		&sensor.LastSeenAt,
		&sensor.CreatedAt,
		&sensor.UpdatedAt,
	); err != nil {
		return model.Sensor{}, err
	}
	return sensor, nil
}

func scanReading(scanner rowScanner) (model.Reading, error) {
	var reading model.Reading
	if err := scanner.Scan(
		&reading.ID,
		&reading.GatewayCode,
		&reading.SensorCode,
		&reading.SensorRole,
		&reading.Temperature,
		&reading.Humidity,
		&reading.RecordedAt,
		&reading.QualityStatus,
		&reading.Source,
	); err != nil {
		return model.Reading{}, err
	}
	return reading, nil
}
