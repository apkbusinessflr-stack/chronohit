CREATE INDEX IF NOT EXISTS idx_scores_daily_game_day_avg ON scores_daily (game, day, avg_ms ASC);
CREATE INDEX IF NOT EXISTS idx_scores_daily_created ON scores_daily (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_daily_user ON scores_daily (user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases (user_id);
