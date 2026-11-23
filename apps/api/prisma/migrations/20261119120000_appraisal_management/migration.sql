CREATE TYPE "public"."AppraisalCycleStatus" AS ENUM ('Draft', 'Active', 'Closed');
CREATE TYPE "public"."AppraisalStatus" AS ENUM ('Draft', 'Self_Appraisal_Pending', 'Submitted', 'Manager_Review_Pending', 'Manager_Approved', 'HR_Review_Pending', 'HR_Approved', 'Management_Approval_Pending', 'Completed', 'Rejected', 'Revision_Requested');

INSERT INTO "public"."Permission" ("id", "code", "description", "createdAt") VALUES
('appraisal-self', 'appraisal.self', 'View and submit own appraisals', CURRENT_TIMESTAMP),
('appraisal-team-read', 'appraisal.team.read', 'View assigned team appraisals', CURRENT_TIMESTAMP),
('appraisal-manager-review', 'appraisal.manager.review', 'Review and decide assigned team appraisals', CURRENT_TIMESTAMP),
('appraisal-hr-read', 'appraisal.hr.read', 'View tenant appraisal records for HR review', CURRENT_TIMESTAMP),
('appraisal-hr-review', 'appraisal.hr.review', 'Review, return, reject, and approve appraisals as HR', CURRENT_TIMESTAMP),
('appraisal-cycle-manage', 'appraisal.cycle.manage', 'Create, configure, and launch appraisal cycles', CURRENT_TIMESTAMP),
('appraisal-management-review', 'appraisal.management.review', 'Approve or reject HR-approved appraisals', CURRENT_TIMESTAMP),
('appraisal-compensation-read', 'appraisal.compensation.read', 'View confidential compensation and promotion recommendations', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "public"."Role" ("id", "tenantId", "code", "name", "createdAt")
SELECT 'management-approver-' || "id", "id", 'MANAGEMENT_APPROVER', 'Management Appraisal Approver', CURRENT_TIMESTAMP
FROM "public"."Tenant"
ON CONFLICT ("tenantId", "code") DO NOTHING;

INSERT INTO "public"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "public"."Role" r
CROSS JOIN "public"."Permission" p
WHERE r."code" = 'MANAGEMENT_APPROVER'
  AND p."code" IN ('appraisal.management.review', 'appraisal.compensation.read')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

CREATE TABLE "public"."AppraisalCycle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "selfStart" DATE NOT NULL,
    "selfDeadline" DATE NOT NULL,
    "reviewDeadline" DATE NOT NULL,
    "status" "public"."AppraisalCycleStatus" NOT NULL DEFAULT 'Draft',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppraisalCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."CycleKpi" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'Performance',
    "weight" DECIMAL(6,3) NOT NULL DEFAULT 1,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CycleKpi_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."EmployeeAppraisal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "managerEmployeeId" TEXT,
    "status" "public"."AppraisalStatus" NOT NULL DEFAULT 'Self_Appraisal_Pending',
    "revisionReturnStage" TEXT NOT NULL DEFAULT '',
    "goals" JSONB NOT NULL DEFAULT '[]',
    "achievements" JSONB NOT NULL DEFAULT '[]',
    "selfFeedback" TEXT NOT NULL DEFAULT '',
    "managerFeedback" TEXT NOT NULL DEFAULT '',
    "managerStrengths" TEXT NOT NULL DEFAULT '',
    "managerImprovementAreas" TEXT NOT NULL DEFAULT '',
    "managerRating" DECIMAL(5,2),
    "hrFeedback" TEXT NOT NULL DEFAULT '',
    "hrRating" DECIMAL(5,2),
    "promotionRecommendation" TEXT NOT NULL DEFAULT '',
    "salaryIncreasePercent" DECIMAL(6,2),
    "salaryIncreaseAmount" DECIMAL(14,2),
    "managementFeedback" TEXT NOT NULL DEFAULT '',
    "finalRating" DECIMAL(5,2),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmployeeAppraisal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."AppraisalKpiResponse" (
    "id" TEXT NOT NULL,
    "appraisalId" TEXT NOT NULL,
    "cycleKpiId" TEXT NOT NULL,
    "selfRating" INTEGER,
    "selfComment" TEXT NOT NULL DEFAULT '',
    "managerRating" INTEGER,
    "managerComment" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "AppraisalKpiResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."AppraisalReview" (
    "id" TEXT NOT NULL,
    "appraisalId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL DEFAULT '',
    "toStatus" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppraisalReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppraisalCycle_tenantId_name_key" ON "public"."AppraisalCycle"("tenantId", "name");
CREATE INDEX "AppraisalCycle_tenantId_status_idx" ON "public"."AppraisalCycle"("tenantId", "status");
CREATE INDEX "CycleKpi_cycleId_sortOrder_idx" ON "public"."CycleKpi"("cycleId", "sortOrder");
CREATE UNIQUE INDEX "EmployeeAppraisal_cycleId_employeeId_key" ON "public"."EmployeeAppraisal"("cycleId", "employeeId");
CREATE INDEX "EmployeeAppraisal_tenantId_status_idx" ON "public"."EmployeeAppraisal"("tenantId", "status");
CREATE INDEX "EmployeeAppraisal_tenantId_cycleId_status_idx" ON "public"."EmployeeAppraisal"("tenantId", "cycleId", "status");
CREATE INDEX "EmployeeAppraisal_managerEmployeeId_status_idx" ON "public"."EmployeeAppraisal"("managerEmployeeId", "status");
CREATE INDEX "EmployeeAppraisal_employeeId_createdAt_idx" ON "public"."EmployeeAppraisal"("employeeId", "createdAt");
CREATE UNIQUE INDEX "AppraisalKpiResponse_appraisalId_cycleKpiId_key" ON "public"."AppraisalKpiResponse"("appraisalId", "cycleKpiId");
CREATE INDEX "AppraisalKpiResponse_cycleKpiId_idx" ON "public"."AppraisalKpiResponse"("cycleKpiId");
CREATE INDEX "AppraisalReview_appraisalId_createdAt_idx" ON "public"."AppraisalReview"("appraisalId", "createdAt");
CREATE INDEX "AppraisalReview_actorUserId_createdAt_idx" ON "public"."AppraisalReview"("actorUserId", "createdAt");

ALTER TABLE "public"."AppraisalCycle" ADD CONSTRAINT "AppraisalCycle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."AppraisalCycle" ADD CONSTRAINT "AppraisalCycle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."CycleKpi" ADD CONSTRAINT "CycleKpi_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "public"."AppraisalCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."EmployeeAppraisal" ADD CONSTRAINT "EmployeeAppraisal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."EmployeeAppraisal" ADD CONSTRAINT "EmployeeAppraisal_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "public"."AppraisalCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."EmployeeAppraisal" ADD CONSTRAINT "EmployeeAppraisal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."EmployeeAppraisal" ADD CONSTRAINT "EmployeeAppraisal_managerEmployeeId_fkey" FOREIGN KEY ("managerEmployeeId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."AppraisalKpiResponse" ADD CONSTRAINT "AppraisalKpiResponse_appraisalId_fkey" FOREIGN KEY ("appraisalId") REFERENCES "public"."EmployeeAppraisal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."AppraisalKpiResponse" ADD CONSTRAINT "AppraisalKpiResponse_cycleKpiId_fkey" FOREIGN KEY ("cycleKpiId") REFERENCES "public"."CycleKpi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."AppraisalReview" ADD CONSTRAINT "AppraisalReview_appraisalId_fkey" FOREIGN KEY ("appraisalId") REFERENCES "public"."EmployeeAppraisal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."AppraisalReview" ADD CONSTRAINT "AppraisalReview_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
