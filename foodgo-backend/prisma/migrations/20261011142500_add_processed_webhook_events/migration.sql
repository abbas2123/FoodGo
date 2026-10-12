-- CreateTable
CREATE TABLE IF NOT EXISTS "processed_webhook_events" (
    "id" BIGSERIAL NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'RAZORPAY',
    "event_id" VARCHAR(100) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "processed_webhook_events_processed_at_idx" ON "processed_webhook_events"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "processed_webhook_events_provider_event_id_key" ON "processed_webhook_events"("provider", "event_id");
