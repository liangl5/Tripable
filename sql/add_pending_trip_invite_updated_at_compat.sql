ALTER TABLE "PendingTripInvite"
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE "PendingTripInvite"
SET updated_at = COALESCE(updated_at, "canceledAt", "acceptedAt", "createdAt", NOW())
WHERE updated_at IS NULL;
