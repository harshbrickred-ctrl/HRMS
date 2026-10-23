-- CreateEnum
CREATE TYPE "public"."AssetCategory" AS ENUM ('laptop', 'monitor', 'phone', 'access_card', 'other');

-- CreateEnum
CREATE TYPE "public"."AssetStatus" AS ENUM ('in_stock', 'assigned', 'repair', 'retired', 'lost');

-- CreateEnum
CREATE TYPE "public"."AssetTicketType" AS ENUM ('Issue', 'Query', 'Request');

-- CreateEnum
CREATE TYPE "public"."AssetTicketStatus" AS ENUM ('Open', 'InProgress', 'Resolved', 'Closed');

-- CreateTable
CREATE TABLE "public"."Asset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "category" "public"."AssetCategory" NOT NULL,
    "makeModel" TEXT NOT NULL DEFAULT '',
    "serialNo" TEXT NOT NULL DEFAULT '',
    "status" "public"."AssetStatus" NOT NULL DEFAULT 'in_stock',
    "purchasedOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssetAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedOn" TIMESTAMP(3),
    "conditionNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssetTicket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assetId" TEXT,
    "type" "public"."AssetTicketType" NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "public"."AssetTicketStatus" NOT NULL DEFAULT 'Open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssetTicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetTicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_tenantId_assetTag_key" ON "public"."Asset"("tenantId", "assetTag");

-- CreateIndex
CREATE INDEX "Asset_tenantId_status_idx" ON "public"."Asset"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AssetAssignment_tenantId_employeeId_returnedOn_idx" ON "public"."AssetAssignment"("tenantId", "employeeId", "returnedOn");

-- CreateIndex
CREATE INDEX "AssetAssignment_assetId_returnedOn_idx" ON "public"."AssetAssignment"("assetId", "returnedOn");

-- One open assignment per asset
CREATE UNIQUE INDEX "AssetAssignment_one_open_per_asset" ON "public"."AssetAssignment"("assetId") WHERE "returnedOn" IS NULL;

-- CreateIndex
CREATE INDEX "AssetTicket_tenantId_employeeId_status_idx" ON "public"."AssetTicket"("tenantId", "employeeId", "status");

-- CreateIndex
CREATE INDEX "AssetTicket_tenantId_status_idx" ON "public"."AssetTicket"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AssetTicketComment_ticketId_createdAt_idx" ON "public"."AssetTicketComment"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetAssignment" ADD CONSTRAINT "AssetAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetAssignment" ADD CONSTRAINT "AssetAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetAssignment" ADD CONSTRAINT "AssetAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetTicket" ADD CONSTRAINT "AssetTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetTicket" ADD CONSTRAINT "AssetTicket_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetTicket" ADD CONSTRAINT "AssetTicket_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetTicketComment" ADD CONSTRAINT "AssetTicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."AssetTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
