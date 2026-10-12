-- AlterTable
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "driver_updated_at" TIMESTAMP(3);
