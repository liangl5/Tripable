-- Remove photo-based avatars; keep color-only avatars
ALTER TABLE "User" DROP COLUMN IF EXISTS "photoUrl";
ALTER TABLE "User" DROP COLUMN IF EXISTS "avatarCrop";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarColor" TEXT;
