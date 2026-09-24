-- CreateEnum
CREATE TYPE "EmailKind" AS ENUM ('SUBSCRIBE_CONFIRM', 'CONTACT_ACK', 'ADMIN_NOTIFY', 'REPLY', 'NEWSLETTER', 'NEWSLETTER_TEST');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'DELAYED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'SUPPRESSED');

-- AlterTable — columns added nullable, backfilled, then constrained (table has existing rows)
ALTER TABLE "newsletter_subscriber" ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "token" TEXT,
ADD COLUMN     "unsubscribed_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3);

-- Backfill: existing subscribers are grandfathered as confirmed (pre-double-opt-in signups).
-- Token = 64 hex chars from two v4 UUIDs (gen_random_uuid is built in on Postgres 13+).
UPDATE "newsletter_subscriber" SET
  "token" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  "confirmed_at" = CASE WHEN "active" THEN "subscribed_at" ELSE NULL END,
  "unsubscribed_at" = CASE WHEN "active" THEN NULL ELSE CURRENT_TIMESTAMP END,
  "updated_at" = CURRENT_TIMESTAMP;

ALTER TABLE "newsletter_subscriber" ALTER COLUMN "token" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- CreateTable
CREATE TABLE "outbound_email" (
    "id" TEXT NOT NULL,
    "person_id" TEXT,
    "to_email" TEXT NOT NULL,
    "from_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "kind" "EmailKind" NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "resend_id" TEXT,
    "error" TEXT,
    "newsletter_issue_id" TEXT,
    "conversation_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_event" (
    "id" TEXT NOT NULL,
    "svix_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "resend_id" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_suppression" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_suppression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbound_email_resend_id_key" ON "outbound_email"("resend_id");

-- CreateIndex
CREATE INDEX "outbound_email_status_created_at_idx" ON "outbound_email"("status", "created_at");

-- CreateIndex
CREATE INDEX "outbound_email_created_at_idx" ON "outbound_email"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_event_svix_id_key" ON "email_event"("svix_id");

-- CreateIndex
CREATE INDEX "email_event_resend_id_idx" ON "email_event"("resend_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_suppression_email_key" ON "email_suppression"("email");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscriber_token_key" ON "newsletter_subscriber"("token");

-- AddForeignKey
ALTER TABLE "outbound_email" ADD CONSTRAINT "outbound_email_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

