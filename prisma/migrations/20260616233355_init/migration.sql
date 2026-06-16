-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('SUBSCRIBED', 'UNSUBSCRIBED');

-- CreateTable
CREATE TABLE "people" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'SUBSCRIBED',
    "subscribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_site" TEXT NOT NULL DEFAULT 'abundance-architecture',

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "people_email_key" ON "people"("email");
