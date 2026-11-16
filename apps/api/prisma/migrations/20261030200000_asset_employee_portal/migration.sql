-- Employee asset portal (phase 3): fault and loss reports built on AssetTicket, with
-- report references, priority, and attachments.

-- AlterEnum
ALTER TYPE "public"."AssetTicketType" ADD VALUE 'Loss';

-- CreateEnum
CREATE TYPE "public"."AssetTicketPriority" AS ENUM ('low', 'medium', 'high');

-- AlterTable
ALTER TABLE "public"."AssetTicket"
ADD COLUMN     "lostLocation" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lostOn" DATE,
ADD COLUMN     "number" SERIAL NOT NULL,
ADD COLUMN     "priority" "public"."AssetTicketPriority" NOT NULL DEFAULT 'medium';

-- CreateTable
CREATE TABLE "public"."AssetTicketFile" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetTicketFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetTicket_number_key" ON "public"."AssetTicket"("number");

-- CreateIndex
CREATE INDEX "AssetTicketFile_ticketId_idx" ON "public"."AssetTicketFile"("ticketId");

-- AddForeignKey
ALTER TABLE "public"."AssetTicketFile" ADD CONSTRAINT "AssetTicketFile_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."AssetTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetTicketFile" ADD CONSTRAINT "AssetTicketFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
