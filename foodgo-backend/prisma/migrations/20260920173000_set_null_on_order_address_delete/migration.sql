-- AlterForeignKey
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_address_id_fkey";

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
