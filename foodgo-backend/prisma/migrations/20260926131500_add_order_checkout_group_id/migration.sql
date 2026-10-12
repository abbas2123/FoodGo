-- AlterTable
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "checkout_group_id" VARCHAR(50);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "orders_checkout_group_id_idx" ON "orders"("checkout_group_id");
