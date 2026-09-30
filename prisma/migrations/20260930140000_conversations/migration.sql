-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'WAITING', 'CLOSED');

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('CONTACT_FORM', 'EMAIL', 'NEWSLETTER_REPLY', 'COMPOSED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateTable
CREATE TABLE "conversation" (
    "id" TEXT NOT NULL,
    "source_site" TEXT NOT NULL,
    "person_id" TEXT,
    "subject" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "channel" "ConversationChannel" NOT NULL,
    "unread" BOOLEAN NOT NULL DEFAULT true,
    "newsletter_issue_id" TEXT,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "from_email" TEXT NOT NULL,
    "from_name" TEXT,
    "to_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "html" TEXT,
    "message_id_header" TEXT,
    "in_reply_to" TEXT,
    "references" TEXT,
    "outbound_email_id" TEXT,
    "attachments" JSONB,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_status_last_message_at_idx" ON "conversation"("status", "last_message_at");

-- CreateIndex
CREATE INDEX "conversation_person_id_idx" ON "conversation"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_message_id_header_key" ON "message"("message_id_header");

-- CreateIndex
CREATE UNIQUE INDEX "message_outbound_email_id_key" ON "message"("outbound_email_id");

-- CreateIndex
CREATE INDEX "message_conversation_id_created_at_idx" ON "message"("conversation_id", "created_at");

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_outbound_email_id_fkey" FOREIGN KEY ("outbound_email_id") REFERENCES "outbound_email"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_email" ADD CONSTRAINT "outbound_email_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Data: every legacy contact_message becomes a CONTACT_FORM conversation with one inbound message.
-- Deterministic ids ('conv_'/'msg_' + original id) keep this idempotent and traceable.
INSERT INTO "conversation"
  ("id", "source_site", "person_id", "subject", "status", "channel", "unread", "last_message_at", "created_at", "updated_at")
SELECT 'conv_' || cm."id", cm."source_site", cm."person_id", cm."subject", 'OPEN', 'CONTACT_FORM',
       NOT cm."read", cm."created_at", cm."created_at", CURRENT_TIMESTAMP
FROM "contact_message" cm;

INSERT INTO "message"
  ("id", "conversation_id", "direction", "from_email", "from_name", "to_email", "subject", "text", "meta", "created_at")
SELECT 'msg_' || cm."id", 'conv_' || cm."id", 'INBOUND', cm."email", cm."name", 'hello@abundancearchitecture.world',
       cm."subject", cm."message",
       CASE WHEN cm."phone" IS NOT NULL THEN jsonb_build_object('phone', cm."phone") ELSE NULL END,
       cm."created_at"
FROM "contact_message" cm;
