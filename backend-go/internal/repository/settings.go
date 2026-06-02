package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"ems-thermal-lstm/backend-go/internal/model"

	"github.com/jackc/pgx/v5"
)

func (r *Repository) ListSettings(ctx context.Context) ([]model.Setting, error) {
	rows, err := r.db.Query(ctx, `
		SELECT key, value, value_type, description, is_sensitive, updated_at
		FROM settings
		ORDER BY key`)
	if err != nil {
		return nil, fmt.Errorf("list settings: %w", err)
	}
	defer rows.Close()

	items := make([]model.Setting, 0)
	for rows.Next() {
		item, err := scanSetting(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) CurrentThresholdSettings(ctx context.Context) (map[string]string, error) {
	return r.settings(ctx, []string{"threshold_normal_max", "threshold_anomaly_min"})
}

func (r *Repository) UpdateSetting(ctx context.Context, key, value string) (model.Setting, model.SystemLog, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return model.Setting{}, model.SystemLog{}, fmt.Errorf("begin setting update: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var item model.Setting
	err = tx.QueryRow(ctx, `
		UPDATE settings
		SET value = $2, updated_at = NOW()
		WHERE key = $1
		RETURNING key, value, value_type, description, is_sensitive, updated_at`,
		key, value,
	).Scan(&item.Key, &item.Value, &item.ValueType, &item.Description, &item.IsSensitive, &item.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.Setting{}, model.SystemLog{}, ErrNotFound
	}
	if err != nil {
		return model.Setting{}, model.SystemLog{}, fmt.Errorf("update setting: %w", err)
	}
	systemLog, err := insertSystemLogTx(ctx, tx, "backend", "info", "Setting updated", map[string]any{
		"setting_key": key,
		"sensitive":   item.IsSensitive,
	})
	if err != nil {
		return model.Setting{}, model.SystemLog{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return model.Setting{}, model.SystemLog{}, fmt.Errorf("commit setting update: %w", err)
	}
	maskSetting(&item)
	return item, systemLog, nil
}

func (r *Repository) SystemLogs(ctx context.Context, filters model.SystemLogFilters) ([]model.SystemLog, int64, error) {
	conditions := []string{"TRUE"}
	args := make([]any, 0)
	add := func(condition string, value any) {
		args = append(args, value)
		conditions = append(conditions, fmt.Sprintf(condition, len(args)))
	}
	if filters.Source != "" {
		add("source = $%d", filters.Source)
	}
	if filters.Level != "" {
		add("level = $%d", filters.Level)
	}
	if filters.From != nil {
		add("created_at >= $%d", *filters.From)
	}
	if filters.To != nil {
		add("created_at <= $%d", *filters.To)
	}
	where := strings.Join(conditions, " AND ")

	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM system_logs WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count system logs: %w", err)
	}
	args = append(args, filters.Limit, filters.Offset)
	rows, err := r.db.Query(ctx, `
		SELECT id, source, level, message, context, created_at
		FROM system_logs
		WHERE `+where+`
		ORDER BY created_at DESC
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)), args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list system logs: %w", err)
	}
	defer rows.Close()

	items := make([]model.SystemLog, 0)
	for rows.Next() {
		var item model.SystemLog
		var contextData []byte
		if err := rows.Scan(&item.ID, &item.Source, &item.Level, &item.Message, &contextData, &item.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan system log: %w", err)
		}
		_ = json.Unmarshal(contextData, &item.Context)
		items = append(items, item)
	}
	return items, total, rows.Err()
}

func scanSetting(scanner rowScanner) (model.Setting, error) {
	var item model.Setting
	if err := scanner.Scan(&item.Key, &item.Value, &item.ValueType, &item.Description, &item.IsSensitive, &item.UpdatedAt); err != nil {
		return model.Setting{}, err
	}
	maskSetting(&item)
	return item, nil
}

func maskSetting(item *model.Setting) {
	if item.IsSensitive && item.Value != "" {
		item.Value = model.MaskedSettingValue
	}
}
