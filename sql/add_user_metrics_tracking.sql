ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE "User"
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION set_user_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_updated_at_trigger ON "User";
CREATE TRIGGER user_updated_at_trigger
BEFORE UPDATE ON "User"
FOR EACH ROW
EXECUTE FUNCTION set_user_updated_at();

CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  pathname TEXT,
  title TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_event_name_createdAt_idx"
  ON "AnalyticsEvent" (event_name, "createdAt");