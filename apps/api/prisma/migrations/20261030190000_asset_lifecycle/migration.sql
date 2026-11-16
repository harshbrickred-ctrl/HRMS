-- Asset lifecycle (phase 2): the seven statuses, controlled allocation, return and transfer,
-- acknowledgements, and a permanent status history.

-- AlterEnum: rename the two old statuses and add Disposed and Written Off, keeping every row.
CREATE TYPE "public"."AssetStatus_new" AS ENUM ('in_stock', 'allocated', 'under_maintenance', 'lost', 'retired', 'disposed', 'written_off');
ALTER TABLE "public"."Asset" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Asset" ALTER COLUMN "status" TYPE "public"."AssetStatus_new" USING (
  CASE "status"::text
    WHEN 'assigned' THEN 'allocated'
    WHEN 'repair' THEN 'under_maintenance'
    ELSE "status"::text
  END
)::"public"."AssetStatus_new";
ALTER TYPE "public"."AssetStatus" RENAME TO "AssetStatus_old";
ALTER TYPE "public"."AssetStatus_new" RENAME TO "AssetStatus";
DROP TYPE "public"."AssetStatus_old";
ALTER TABLE "public"."Asset" ALTER COLUMN "status" SET DEFAULT 'in_stock';

-- CreateEnum
CREATE TYPE "public"."AssetAckStatus" AS ENUM ('pending', 'acknowledged', 'not_recorded');

-- CreateEnum
CREATE TYPE "public"."AssetReturnCondition" AS ENUM ('good', 'damaged', 'requires_repair', 'missing_components');

-- CreateEnum
CREATE TYPE "public"."AssetAssignmentEnd" AS ENUM ('returned', 'transferred', 'lost');

-- AlterTable
ALTER TABLE "public"."AssetAssignment"
ADD COLUMN     "accessories" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ackAt" TIMESTAMP(3),
ADD COLUMN     "ackById" TEXT,
ADD COLUMN     "ackMethod" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ackStatus" "public"."AssetAckStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "damageNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "endReason" "public"."AssetAssignmentEnd",
ADD COLUMN     "expectedReturnOn" DATE,
ADD COLUMN     "handoverAckAt" TIMESTAMP(3),
ADD COLUMN     "handoverAckById" TEXT,
ADD COLUMN     "handoverAckMethod" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "handoverAckStatus" "public"."AssetAckStatus",
ADD COLUMN     "inspectionNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "issueCondition" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "issuedById" TEXT,
ADD COLUMN     "returnCondition" "public"."AssetReturnCondition",
ADD COLUMN     "returnedById" TEXT,
ADD COLUMN     "transferReason" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "transferredFromId" TEXT;

-- Allocations from before acknowledgements existed are not chased for one.
UPDATE "public"."AssetAssignment" SET "ackStatus" = 'not_recorded';
UPDATE "public"."AssetAssignment" SET "endReason" = 'returned' WHERE "returnedOn" IS NOT NULL;

-- CreateTable
CREATE TABLE "public"."AssetStatusHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fromStatus" "public"."AssetStatus" NOT NULL,
    "toStatus" "public"."AssetStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'status',
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssetAssignmentFile" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetAssignmentFile_pkey" PRIMARY KEY ("id")
);

-- The allocations that already exist are the only status changes we can reconstruct.
INSERT INTO "public"."AssetStatusHistory" ("id", "tenantId", "assetId", "fromStatus", "toStatus", "reason", "source", "changedAt")
SELECT gen_random_uuid()::text, aa."tenantId", aa."assetId", 'in_stock', 'allocated', 'Allocation recorded before status history', 'allocation', aa."assignedOn"
FROM "public"."AssetAssignment" aa;

INSERT INTO "public"."AssetStatusHistory" ("id", "tenantId", "assetId", "fromStatus", "toStatus", "reason", "source", "changedAt")
SELECT gen_random_uuid()::text, aa."tenantId", aa."assetId", 'allocated', a."status", 'Return recorded before status history', 'return', aa."returnedOn"
FROM "public"."AssetAssignment" aa
JOIN "public"."Asset" a ON a."id" = aa."assetId"
WHERE aa."returnedOn" IS NOT NULL AND a."status" <> 'allocated';

-- CreateIndex
CREATE UNIQUE INDEX "AssetAssignment_transferredFromId_key" ON "public"."AssetAssignment"("transferredFromId");

-- CreateIndex
CREATE INDEX "AssetStatusHistory_assetId_changedAt_idx" ON "public"."AssetStatusHistory"("assetId", "changedAt");

-- CreateIndex
CREATE INDEX "AssetStatusHistory_tenantId_changedAt_idx" ON "public"."AssetStatusHistory"("tenantId", "changedAt");

-- CreateIndex
CREATE INDEX "AssetAssignmentFile_assignmentId_idx" ON "public"."AssetAssignmentFile"("assignmentId");

-- AddForeignKey
ALTER TABLE "public"."AssetAssignment" ADD CONSTRAINT "AssetAssignment_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetAssignment" ADD CONSTRAINT "AssetAssignment_ackById_fkey" FOREIGN KEY ("ackById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetAssignment" ADD CONSTRAINT "AssetAssignment_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetAssignment" ADD CONSTRAINT "AssetAssignment_handoverAckById_fkey" FOREIGN KEY ("handoverAckById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetAssignment" ADD CONSTRAINT "AssetAssignment_transferredFromId_fkey" FOREIGN KEY ("transferredFromId") REFERENCES "public"."AssetAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Allocation history must survive an attempt to delete the employee.
ALTER TABLE "public"."AssetAssignment" DROP CONSTRAINT "AssetAssignment_employeeId_fkey";

-- AddForeignKey
ALTER TABLE "public"."AssetAssignment" ADD CONSTRAINT "AssetAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetStatusHistory" ADD CONSTRAINT "AssetStatusHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetStatusHistory" ADD CONSTRAINT "AssetStatusHistory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetStatusHistory" ADD CONSTRAINT "AssetStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetAssignmentFile" ADD CONSTRAINT "AssetAssignmentFile_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."AssetAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetAssignmentFile" ADD CONSTRAINT "AssetAssignmentFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
