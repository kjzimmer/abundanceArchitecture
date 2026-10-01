-- AlterTable
ALTER TABLE "share" ADD COLUMN     "allow_download" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "watermark_text" TEXT;

