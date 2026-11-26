ALTER TABLE "public"."CycleKpi"
  ADD COLUMN "subKpiName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "subWeight" DECIMAL(6,3) NOT NULL DEFAULT 100;
ALTER TABLE "public"."EmployeeAppraisal" ADD COLUMN "selfRating" DECIMAL(5,2);

CREATE TABLE "public"."AppraisalImport" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL DEFAULT 'appraisal.csv',
  "status" TEXT NOT NULL DEFAULT 'Completed',
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "importedRows" INTEGER NOT NULL DEFAULT 0,
  "failedRows" INTEGER NOT NULL DEFAULT 0,
  "errors" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppraisalImport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AppraisalImport_tenantId_createdAt_idx" ON "public"."AppraisalImport"("tenantId", "createdAt");
ALTER TABLE "public"."AppraisalImport" ADD CONSTRAINT "AppraisalImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."AppraisalImport" ADD CONSTRAINT "AppraisalImport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."AppraisalImport" ADD CONSTRAINT "AppraisalImport_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "public"."AppraisalCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
