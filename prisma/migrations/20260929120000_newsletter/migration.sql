-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT');

-- AlterTable — add nullable, backfill existing rows (all sent by this site), then constrain
ALTER TABLE "outbound_email" ADD COLUMN     "source_site" TEXT;
UPDATE "outbound_email" SET "source_site" = 'abundance-architecture';
ALTER TABLE "outbound_email" ALTER COLUMN "source_site" SET NOT NULL;

-- CreateTable
CREATE TABLE "newsletter_list" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "site_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_subscription" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "confirmed_at" TIMESTAMP(3),
    "subscribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed_at" TIMESTAMP(3),
    "unsubscribed_issue_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "list_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_issue" (
    "id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "preheader" TEXT,
    "markdown" TEXT NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'DRAFT',
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "send_started_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_issue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_list_key_key" ON "newsletter_list"("key");

-- CreateIndex
CREATE INDEX "list_subscription_list_id_active_idx" ON "list_subscription"("list_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "list_subscription_person_id_list_id_key" ON "list_subscription"("person_id", "list_id");

-- CreateIndex
CREATE INDEX "outbound_email_newsletter_issue_id_status_idx" ON "outbound_email"("newsletter_issue_id", "status");

-- AddForeignKey
ALTER TABLE "list_subscription" ADD CONSTRAINT "list_subscription_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_subscription" ADD CONSTRAINT "list_subscription_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "newsletter_list"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_issue" ADD CONSTRAINT "newsletter_issue_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "newsletter_list"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_email" ADD CONSTRAINT "outbound_email_newsletter_issue_id_fkey" FOREIGN KEY ("newsletter_issue_id") REFERENCES "newsletter_issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Seed the site's default list (matches brand.defaultListKey; code also upserts it at runtime)
INSERT INTO "newsletter_list" ("id", "key", "name", "description", "site_key", "updated_at")
VALUES (replace(gen_random_uuid()::text, '-', ''), 'aa', 'Abundance Architecture',
        'Updates on the Abundance Architecture inquiry and book', 'abundance-architecture', CURRENT_TIMESTAMP);

-- Every existing subscriber gets a list subscription mirroring their current state:
-- confirmed stays confirmed, pending stays pending, unsubscribed stays inactive.
INSERT INTO "list_subscription"
  ("id", "person_id", "list_id", "active", "confirmed_at", "subscribed_at", "unsubscribed_at", "updated_at")
SELECT replace(gen_random_uuid()::text, '-', ''), ns."person_id", l."id", ns."active", ns."confirmed_at",
       ns."subscribed_at", ns."unsubscribed_at", CURRENT_TIMESTAMP
FROM "newsletter_subscriber" ns
CROSS JOIN "newsletter_list" l
WHERE l."key" = 'aa';
