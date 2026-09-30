-- CreateTable
CREATE TABLE "share" (
    "id" TEXT NOT NULL,
    "source_site" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_access_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_folder" (
    "id" TEXT NOT NULL,
    "share_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_file" (
    "id" TEXT NOT NULL,
    "share_id" TEXT NOT NULL,
    "folder_id" TEXT,
    "name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "share_token_key" ON "share"("token");

-- CreateIndex
CREATE INDEX "shared_folder_share_id_parent_id_idx" ON "shared_folder"("share_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "shared_file_storage_key_key" ON "shared_file"("storage_key");

-- CreateIndex
CREATE INDEX "shared_file_share_id_folder_id_idx" ON "shared_file"("share_id", "folder_id");

-- AddForeignKey
ALTER TABLE "shared_folder" ADD CONSTRAINT "shared_folder_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "share"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_folder" ADD CONSTRAINT "shared_folder_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "shared_folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_file" ADD CONSTRAINT "shared_file_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "share"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_file" ADD CONSTRAINT "shared_file_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "shared_folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

