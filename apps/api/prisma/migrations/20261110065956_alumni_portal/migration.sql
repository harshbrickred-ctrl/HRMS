-- CreateEnum
CREATE TYPE "public"."AlumniEligibility" AS ENUM ('eligible', 'not_eligible', 'do_not_contact');

-- CreateEnum
CREATE TYPE "public"."AlumniAccountStatus" AS ENUM ('active', 'revoked', 'withdrawn');

-- CreateEnum
CREATE TYPE "public"."AlumniConsentType" AS ENUM ('terms', 'data_processing', 'communications', 'directory');

-- CreateEnum
CREATE TYPE "public"."AlumniOtpPurpose" AS ENUM ('password_reset', 'email_change');

-- CreateEnum
CREATE TYPE "public"."AlumniDocumentType" AS ENUM ('experience_letter', 'relieving_letter', 'payslip', 'form16', 'fnf_statement', 'pf_details', 'other');

-- CreateEnum
CREATE TYPE "public"."AlumniDocumentRequestStatus" AS ENUM ('submitted', 'under_review', 'approved', 'rejected', 'issued', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."AlumniPostKind" AS ENUM ('announcement', 'newsletter');

-- CreateEnum
CREATE TYPE "public"."AlumniPostStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "public"."AlumniEventStatus" AS ENUM ('draft', 'published', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."AlumniRsvpResponse" AS ENUM ('going', 'maybe', 'declined');

-- CreateEnum
CREATE TYPE "public"."AlumniJobStatus" AS ENUM ('draft', 'open', 'closed');

-- CreateEnum
CREATE TYPE "public"."AlumniApplicationStatus" AS ENUM ('applied', 'shortlisted', 'interviewing', 'offered', 'rehired', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "public"."AlumniRehireStatus" AS ENUM ('initiated', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."AlumniReferralStatus" AS ENUM ('submitted', 'screening', 'interviewing', 'offered', 'hired', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "public"."AlumniRewardStatus" AS ENUM ('not_applicable', 'pending', 'approved', 'paid', 'cancelled');

-- CreateTable
CREATE TABLE "public"."AlumniExitClosure" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "joiningDate" DATE NOT NULL,
    "lastWorkingDay" DATE NOT NULL,
    "personalEmail" TEXT NOT NULL,
    "exitCompletedOn" DATE,
    "fnfSettledOn" DATE,
    "fnfReference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "recordedById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlumniExitClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Alumni" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "exitClosureId" TEXT,
    "employeeCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "personalEmail" TEXT NOT NULL,
    "designation" TEXT NOT NULL DEFAULT '',
    "departmentId" TEXT,
    "departmentName" TEXT NOT NULL DEFAULT '',
    "locationName" TEXT NOT NULL DEFAULT '',
    "joiningDate" DATE NOT NULL,
    "lastWorkingDay" DATE NOT NULL,
    "tenureMonths" INTEGER NOT NULL,
    "eligibility" "public"."AlumniEligibility" NOT NULL DEFAULT 'eligible',
    "eligibilityReason" TEXT NOT NULL DEFAULT '',
    "eligibilityUpdatedById" TEXT,
    "eligibilityUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alumni_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlumniAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "public"."AlumniAccountStatus" NOT NULL DEFAULT 'active',
    "statusReason" TEXT NOT NULL DEFAULT '',
    "emailVerifiedAt" TIMESTAMP(3) NOT NULL,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "communicationsConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlumniAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlumniSession" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlumniSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlumniOtp" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "purpose" "public"."AlumniOtpPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "resetSessionHash" TEXT,
    "resetSessionExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlumniOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlumniInvitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AlumniInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlumniConsent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "type" "public"."AlumniConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlumniConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlumniProfile" (
    "id" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "currentEmployer" TEXT NOT NULL DEFAULT '',
    "currentDesignation" TEXT NOT NULL DEFAULT '',
    "industry" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photoPath" TEXT NOT NULL DEFAULT '',
    "linkedinUrl" TEXT NOT NULL DEFAULT '',
    "visibility" JSONB NOT NULL DEFAULT '{}',
    "directoryOptIn" BOOLEAN NOT NULL DEFAULT false,
    "directoryOptInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlumniProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlumniDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "type" "public"."AlumniDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT '',
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'hr_upload',
    "requestId" TEXT,
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "lastDownloadedAt" TIMESTAMP(3),

    CONSTRAINT "AlumniDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlumniDocumentRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "type" "public"."AlumniDocumentType" NOT NULL,
    "period" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL,
    "status" "public"."AlumniDocumentRequestStatus" NOT NULL DEFAULT 'submitted',
    "decisionNote" TEXT NOT NULL DEFAULT '',
    "reviewedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlumniDocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlumniAnnouncement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "public"."AlumniPostKind" NOT NULL DEFAULT 'announcement',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" JSONB NOT NULL DEFAULT '{}',
    "status" "public"."AlumniPostStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlumniAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlumniEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "venue" TEXT NOT NULL DEFAULT '',
    "meetingUrl" TEXT NOT NULL DEFAULT '',
    "capacity" INTEGER,
    "rsvpBy" TIMESTAMP(3),
    "audience" JSONB NOT NULL DEFAULT '{}',
    "status" "public"."AlumniEventStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlumniEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlumniEventRsvp" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "response" "public"."AlumniRsvpResponse" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlumniEventRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlumniJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "employmentType" TEXT NOT NULL DEFAULT 'Full-time',
    "experience" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "status" "public"."AlumniJobStatus" NOT NULL DEFAULT 'draft',
    "openedAt" TIMESTAMP(3),
    "closesOn" DATE,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlumniJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlumniJobApplication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" "public"."AlumniApplicationStatus" NOT NULL DEFAULT 'applied',
    "fastTrack" BOOLEAN NOT NULL DEFAULT false,
    "hrNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlumniJobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlumniRehire" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "applicationId" TEXT,
    "previousEmployeeId" TEXT NOT NULL,
    "newEmployeeId" TEXT,
    "status" "public"."AlumniRehireStatus" NOT NULL DEFAULT 'initiated',
    "designation" TEXT NOT NULL,
    "departmentId" TEXT,
    "locationId" TEXT,
    "joiningDate" DATE NOT NULL,
    "workEmail" TEXT NOT NULL,
    "previousEmployment" JSONB NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlumniRehire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlumniReferral" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "jobId" TEXT,
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "candidatePhone" TEXT NOT NULL DEFAULT '',
    "relationship" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "resumeFileName" TEXT NOT NULL DEFAULT '',
    "resumePath" TEXT NOT NULL DEFAULT '',
    "status" "public"."AlumniReferralStatus" NOT NULL DEFAULT 'submitted',
    "hrNote" TEXT NOT NULL DEFAULT '',
    "rewardAmount" DECIMAL(12,2),
    "rewardCurrency" TEXT NOT NULL DEFAULT 'INR',
    "rewardStatus" "public"."AlumniRewardStatus" NOT NULL DEFAULT 'not_applicable',
    "rewardPaidOn" DATE,
    "rewardReference" TEXT NOT NULL DEFAULT '',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlumniReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlumniStatusHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL DEFAULT '',
    "toStatus" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlumniStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlumniExitClosure_tenantId_idx" ON "public"."AlumniExitClosure"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniExitClosure_tenantId_employeeId_key" ON "public"."AlumniExitClosure"("tenantId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Alumni_exitClosureId_key" ON "public"."Alumni"("exitClosureId");

-- CreateIndex
CREATE INDEX "Alumni_tenantId_eligibility_idx" ON "public"."Alumni"("tenantId", "eligibility");

-- CreateIndex
CREATE INDEX "Alumni_tenantId_personalEmail_idx" ON "public"."Alumni"("tenantId", "personalEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Alumni_tenantId_employeeId_key" ON "public"."Alumni"("tenantId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniAccount_alumniId_key" ON "public"."AlumniAccount"("alumniId");

-- CreateIndex
CREATE INDEX "AlumniAccount_email_idx" ON "public"."AlumniAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniAccount_tenantId_email_key" ON "public"."AlumniAccount"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniSession_tokenHash_key" ON "public"."AlumniSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AlumniSession_accountId_idx" ON "public"."AlumniSession"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniOtp_resetSessionHash_key" ON "public"."AlumniOtp"("resetSessionHash");

-- CreateIndex
CREATE INDEX "AlumniOtp_accountId_purpose_idx" ON "public"."AlumniOtp"("accountId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniInvitation_tokenHash_key" ON "public"."AlumniInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "AlumniInvitation_alumniId_idx" ON "public"."AlumniInvitation"("alumniId");

-- CreateIndex
CREATE INDEX "AlumniConsent_alumniId_type_recordedAt_idx" ON "public"."AlumniConsent"("alumniId", "type", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniProfile_alumniId_key" ON "public"."AlumniProfile"("alumniId");

-- CreateIndex
CREATE INDEX "AlumniProfile_directoryOptIn_idx" ON "public"."AlumniProfile"("directoryOptIn");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniDocument_requestId_key" ON "public"."AlumniDocument"("requestId");

-- CreateIndex
CREATE INDEX "AlumniDocument_tenantId_alumniId_idx" ON "public"."AlumniDocument"("tenantId", "alumniId");

-- CreateIndex
CREATE INDEX "AlumniDocumentRequest_tenantId_status_idx" ON "public"."AlumniDocumentRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AlumniDocumentRequest_alumniId_idx" ON "public"."AlumniDocumentRequest"("alumniId");

-- CreateIndex
CREATE INDEX "AlumniAnnouncement_tenantId_status_publishedAt_idx" ON "public"."AlumniAnnouncement"("tenantId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "AlumniEvent_tenantId_status_startsAt_idx" ON "public"."AlumniEvent"("tenantId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "AlumniEventRsvp_alumniId_idx" ON "public"."AlumniEventRsvp"("alumniId");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniEventRsvp_eventId_alumniId_key" ON "public"."AlumniEventRsvp"("eventId", "alumniId");

-- CreateIndex
CREATE INDEX "AlumniJob_tenantId_status_idx" ON "public"."AlumniJob"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AlumniJobApplication_tenantId_status_idx" ON "public"."AlumniJobApplication"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniJobApplication_jobId_alumniId_key" ON "public"."AlumniJobApplication"("jobId", "alumniId");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniRehire_applicationId_key" ON "public"."AlumniRehire"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniRehire_newEmployeeId_key" ON "public"."AlumniRehire"("newEmployeeId");

-- CreateIndex
CREATE INDEX "AlumniRehire_tenantId_status_idx" ON "public"."AlumniRehire"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AlumniRehire_alumniId_idx" ON "public"."AlumniRehire"("alumniId");

-- CreateIndex
CREATE INDEX "AlumniReferral_tenantId_status_idx" ON "public"."AlumniReferral"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AlumniReferral_alumniId_idx" ON "public"."AlumniReferral"("alumniId");

-- CreateIndex
CREATE INDEX "AlumniStatusHistory_entityType_entityId_createdAt_idx" ON "public"."AlumniStatusHistory"("entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Alumni" ADD CONSTRAINT "Alumni_exitClosureId_fkey" FOREIGN KEY ("exitClosureId") REFERENCES "public"."AlumniExitClosure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlumniAccount" ADD CONSTRAINT "AlumniAccount_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "public"."Alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlumniSession" ADD CONSTRAINT "AlumniSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."AlumniAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlumniOtp" ADD CONSTRAINT "AlumniOtp_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."AlumniAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlumniInvitation" ADD CONSTRAINT "AlumniInvitation_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "public"."Alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlumniConsent" ADD CONSTRAINT "AlumniConsent_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "public"."Alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlumniProfile" ADD CONSTRAINT "AlumniProfile_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "public"."Alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlumniDocument" ADD CONSTRAINT "AlumniDocument_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "public"."Alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlumniDocument" ADD CONSTRAINT "AlumniDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."AlumniDocumentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlumniDocumentRequest" ADD CONSTRAINT "AlumniDocumentRequest_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "public"."Alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlumniEventRsvp" ADD CONSTRAINT "AlumniEventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."AlumniEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlumniEventRsvp" ADD CONSTRAINT "AlumniEventRsvp_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "public"."Alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlumniJobApplication" ADD CONSTRAINT "AlumniJobApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."AlumniJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlumniJobApplication" ADD CONSTRAINT "AlumniJobApplication_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "public"."Alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlumniRehire" ADD CONSTRAINT "AlumniRehire_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "public"."Alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlumniRehire" ADD CONSTRAINT "AlumniRehire_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "public"."AlumniJobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlumniReferral" ADD CONSTRAINT "AlumniReferral_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "public"."Alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlumniReferral" ADD CONSTRAINT "AlumniReferral_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."AlumniJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
