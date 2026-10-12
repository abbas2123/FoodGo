-- AlterTable: Make phone nullable on user_auth and add email columns
ALTER TABLE "user_auth" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "user_auth" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255);
ALTER TABLE "user_auth" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: Email unique and lookup index on user_auth
CREATE UNIQUE INDEX IF NOT EXISTS "user_auth_email_key" ON "user_auth"("email");
CREATE INDEX IF NOT EXISTS "user_auth_email_idx" ON "user_auth"("email");

-- AlterTable: Make phone nullable on otp_verifications and add email column
ALTER TABLE "otp_verifications" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "otp_verifications" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255);

-- CreateIndex: Email lookup indices on otp_verifications
CREATE INDEX IF NOT EXISTS "otp_verifications_email_idx" ON "otp_verifications"("email");
CREATE INDEX IF NOT EXISTS "otp_verifications_email_purpose_idx" ON "otp_verifications"("email", "purpose");

-- CreateIndex: Ensure cart_items compound unique index exists
CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_cart_id_menu_item_id_key" ON "cart_items"("cart_id", "menu_item_id");
