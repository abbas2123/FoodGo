-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('UPI', 'CARD', 'COD', 'WALLET', 'NET_BANKING');

-- CreateTable
CREATE TABLE "user_payment_methods" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "provider" VARCHAR(50),
    "provider_customer_id" VARCHAR(255),
    "masked_identifier" VARCHAR(100) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_payment_methods_user_id_idx" ON "user_payment_methods"("user_id");

-- AddForeignKey
ALTER TABLE "user_payment_methods" ADD CONSTRAINT "user_payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
