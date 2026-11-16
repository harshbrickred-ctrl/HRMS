-- Asset requests (phase 4) and maintenance records (phase 5).

-- CreateEnum
CREATE TYPE "public"."AssetRequestStatus" AS ENUM ('pending_manager', 'pending_head', 'approved', 'rejected', 'fulfilled', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."AssetMaintenanceStatus" AS ENUM ('open', 'completed');

-- CreateEnum
CREATE TYPE "public"."AssetRepairOutcome" AS ENUM ('repaired', 'beyond_repair');

-- AlterTable
ALTER TABLE "public"."Department" ADD COLUMN     "headId" TEXT;

-- CreateTable
CREATE TABLE "public"."AssetRequest" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "public"."AssetRequestStatus" NOT NULL,
    "managerApproverId" TEXT,
    "headApproverId" TEXT,
    "fulfilledById" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "assignmentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssetRequestDecision" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetRequestDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssetMaintenance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "ticketId" TEXT,
    "issue" TEXT NOT NULL,
    "vendor" TEXT NOT NULL DEFAULT '',
    "vendorContact" TEXT NOT NULL DEFAULT '',
    "startedOn" DATE NOT NULL,
    "expectedOn" DATE,
    "completedOn" DATE,
    "cost" DECIMAL(12,2),
    "outcome" "public"."AssetRepairOutcome",
    "outcomeNotes" TEXT NOT NULL DEFAULT '',
    "status" "public"."AssetMaintenanceStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "AssetMaintenance_pkey" PRIMARY KEY ("id")
);

-- Assets already under maintenance get an open record so they can be completed normally.
INSERT INTO "public"."AssetMaintenance" ("id", "tenantId", "assetId", "issue", "startedOn", "updatedAt")
SELECT gen_random_uuid()::text, a."tenantId", a."id", 'Under maintenance before records began', CURRENT_DATE, CURRENT_TIMESTAMP
FROM "public"."Asset" a
WHERE a."status" = 'under_maintenance';

-- CreateIndex
CREATE UNIQUE INDEX "AssetRequest_number_key" ON "public"."AssetRequest"("number");

-- CreateIndex
CREATE UNIQUE INDEX "AssetRequest_assignmentId_key" ON "public"."AssetRequest"("assignmentId");

-- CreateIndex
CREATE INDEX "AssetRequest_tenantId_status_idx" ON "public"."AssetRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AssetRequest_managerApproverId_status_idx" ON "public"."AssetRequest"("managerApproverId", "status");

-- CreateIndex
CREATE INDEX "AssetRequest_headApproverId_status_idx" ON "public"."AssetRequest"("headApproverId", "status");

-- CreateIndex
CREATE INDEX "AssetRequest_employeeId_idx" ON "public"."AssetRequest"("employeeId");

-- CreateIndex
CREATE INDEX "AssetRequestDecision_requestId_idx" ON "public"."AssetRequestDecision"("requestId");

-- CreateIndex
CREATE INDEX "AssetMaintenance_tenantId_status_idx" ON "public"."AssetMaintenance"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AssetMaintenance_assetId_idx" ON "public"."AssetMaintenance"("assetId");

-- One open repair record per asset
CREATE UNIQUE INDEX "AssetMaintenance_one_open_per_asset" ON "public"."AssetMaintenance"("assetId") WHERE "status" = 'open';

-- AddForeignKey
ALTER TABLE "public"."Department" ADD CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetRequest" ADD CONSTRAINT "AssetRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetRequest" ADD CONSTRAINT "AssetRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetRequest" ADD CONSTRAINT "AssetRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetRequest" ADD CONSTRAINT "AssetRequest_managerApproverId_fkey" FOREIGN KEY ("managerApproverId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetRequest" ADD CONSTRAINT "AssetRequest_headApproverId_fkey" FOREIGN KEY ("headApproverId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetRequest" ADD CONSTRAINT "AssetRequest_fulfilledById_fkey" FOREIGN KEY ("fulfilledById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetRequest" ADD CONSTRAINT "AssetRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetRequest" ADD CONSTRAINT "AssetRequest_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."AssetAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetRequestDecision" ADD CONSTRAINT "AssetRequestDecision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."AssetRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetRequestDecision" ADD CONSTRAINT "AssetRequestDecision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetMaintenance" ADD CONSTRAINT "AssetMaintenance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetMaintenance" ADD CONSTRAINT "AssetMaintenance_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetMaintenance" ADD CONSTRAINT "AssetMaintenance_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."AssetTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetMaintenance" ADD CONSTRAINT "AssetMaintenance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetMaintenance" ADD CONSTRAINT "AssetMaintenance_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
