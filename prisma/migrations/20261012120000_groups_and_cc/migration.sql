-- AlterTable
ALTER TABLE "conversation" ADD COLUMN     "group_id" TEXT;

-- AlterTable
ALTER TABLE "message" ADD COLUMN     "bcc_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cc_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "to_emails" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "outbound_email" ADD COLUMN     "other_recipients" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "contact_group" (
    "id" TEXT NOT NULL,
    "source_site" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_group_member" (
    "group_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_group_member_pkey" PRIMARY KEY ("group_id","person_id")
);

-- CreateIndex
CREATE INDEX "contact_group_member_person_id_idx" ON "contact_group_member"("person_id");

-- CreateIndex
CREATE INDEX "conversation_group_id_idx" ON "conversation"("group_id");

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "contact_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_group_member" ADD CONSTRAINT "contact_group_member_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "contact_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_group_member" ADD CONSTRAINT "contact_group_member_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: outbound messages had a single recipient
UPDATE "message" SET "to_emails" = ARRAY["to_email"] WHERE "direction" = 'OUTBOUND';
