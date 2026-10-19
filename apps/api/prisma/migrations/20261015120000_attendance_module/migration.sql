
-- CreateEnum
CREATE TYPE "public"."AttendanceStatus" AS ENUM ('present', 'absent', 'half_day', 'holiday', 'leave', 'weekend', 
'missing_punch');

-- CreateEnum
CREATE TYPE "public"."PunchSource" AS ENUM ('web', 'device', 'correction', 'hr');

-- CreateEnum
CREATE TYPE "public"."PunchDirection" AS ENUM ('IN', 'OUT', 'BREAK_OUT', 'BREAK_IN', 'OT_IN', 'OT_OUT');

-- CreateEnum
CREATE TYPE "public"."DeviceDirectionMode" AS ENUM ('device', 'inferred');

-- CreateEnum
CREATE TYPE "public"."CorrectionStatus" AS ENUM ('Pending', 'Approved', 'Rejected');

-- CreateEnum
CREATE TYPE "public"."AttendancePeriodStatus" AS ENUM ('open', 'locked');

-- CreateEnum
CREATE TYPE "public"."EnrollmentStatus" AS ENUM ('pending', 'active', 'revoked');

-- CreateEnum
CREATE TYPE "public"."DeviceCommandState" AS ENUM ('queued', 'sent', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "public"."Shift" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "overnight" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShiftAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Holiday" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT,
    "holidayDate" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttendancePolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "graceMinutes" INTEGER NOT NULL DEFAULT 10,
    "halfDayMaxMinutes" INTEGER NOT NULL DEFAULT 300,
    "duplicateWindowMinutes" INTEGER NOT NULL DEFAULT 5,
    "webPunchEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttendanceDevice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT,
    "serial" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT '',
    "firmware" TEXT NOT NULL DEFAULT '',
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "commKeyHash" TEXT,
    "lastStamp" TEXT NOT NULL DEFAULT '0',
    "lastSeenAt" TIMESTAMP(3),
    "directionMode" "public"."DeviceDirectionMode" NOT NULL DEFAULT 'inferred',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeviceEnrollment" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "status" "public"."EnrollmentStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeviceCommand" (
    "id" SERIAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "state" "public"."DeviceCommandState" NOT NULL DEFAULT 'queued',
    "returnCode" INTEGER,
    "enrollmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeviceOperationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deviceId" TEXT,
    "kind" TEXT NOT NULL,
    "raw" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceOperationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttendancePunch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT,
    "deviceId" TEXT,
    "serial" TEXT NOT NULL DEFAULT '',
    "pin" TEXT NOT NULL,
    "rawTimestamp" TEXT NOT NULL,
    "punchedAt" TIMESTAMP(3) NOT NULL,
    "businessDate" DATE NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "verifyMode" INTEGER NOT NULL DEFAULT 0,
    "direction" "public"."PunchDirection",
    "source" "public"."PunchSource" NOT NULL,
    "workCode" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL,
    "rawLine" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendancePunch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttendanceDay" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "shiftId" TEXT,
    "status" "public"."AttendanceStatus" NOT NULL,
    "firstInAt" TIMESTAMP(3),
    "lastOutAt" TIMESTAMP(3),
    "workMinutes" INTEGER,
    "lateMinutes" INTEGER,
    "earlyMinutes" INTEGER,
    "breakMinutes" INTEGER,
    "missingPunch" BOOLEAN NOT NULL DEFAULT false,
    "overrideStatus" "public"."AttendanceStatus",
    "note" TEXT NOT NULL DEFAULT '',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "rebuiltAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttendanceCorrection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "requestedStatus" "public"."AttendanceStatus" NOT NULL,
    "proposedCheckIn" TEXT,
    "proposedCheckOut" TEXT,
    "reason" TEXT NOT NULL,
    "status" "public"."CorrectionStatus" NOT NULL DEFAULT 'Pending',
    "approverEmployeeId" TEXT,
    "decisionNote" TEXT NOT NULL DEFAULT '',
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttendancePeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "public"."AttendancePeriodStatus" NOT NULL DEFAULT 'open',
    "lockedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendancePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shift_tenantId_idx" ON "public"."Shift"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_tenantId_code_key" ON "public"."Shift"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ShiftAssignment_tenantId_employeeId_effectiveFrom_idx" ON "public"."ShiftAssignment"("tenantId", 
"employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ShiftAssignment_shiftId_idx" ON "public"."ShiftAssignment"("shiftId");

-- CreateIndex
CREATE INDEX "Holiday_tenantId_holidayDate_idx" ON "public"."Holiday"("tenantId", "holidayDate");

-- CreateIndex
CREATE INDEX "Holiday_locationId_idx" ON "public"."Holiday"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendancePolicy_tenantId_key" ON "public"."AttendancePolicy"("tenantId");

-- CreateIndex
CREATE INDEX "AttendanceDevice_serial_idx" ON "public"."AttendanceDevice"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDevice_tenantId_serial_key" ON "public"."AttendanceDevice"("tenantId", "serial");

-- CreateIndex
CREATE INDEX "DeviceEnrollment_employeeId_idx" ON "public"."DeviceEnrollment"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceEnrollment_deviceId_pin_key" ON "public"."DeviceEnrollment"("deviceId", "pin");

-- CreateIndex
CREATE INDEX "DeviceCommand_deviceId_state_idx" ON "public"."DeviceCommand"("deviceId", "state");

-- CreateIndex
CREATE INDEX "DeviceOperationLog_tenantId_createdAt_idx" ON "public"."DeviceOperationLog"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendancePunch_idempotencyKey_key" ON "public"."AttendancePunch"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AttendancePunch_tenantId_employeeId_businessDate_idx" ON "public"."AttendancePunch"("tenantId", 
"employeeId", "businessDate");

-- CreateIndex
CREATE INDEX "AttendancePunch_tenantId_businessDate_idx" ON "public"."AttendancePunch"("tenantId", "businessDate");

-- CreateIndex
CREATE INDEX "AttendancePunch_deviceId_idx" ON "public"."AttendancePunch"("deviceId");

-- CreateIndex
CREATE INDEX "AttendanceDay_tenantId_attendanceDate_idx" ON "public"."AttendanceDay"("tenantId", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDay_tenantId_employeeId_attendanceDate_key" ON "public"."AttendanceDay"("tenantId", 
"employeeId", "attendanceDate");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_tenantId_employeeId_attendanceDate_idx" ON 
"public"."AttendanceCorrection"("tenantId", "employeeId", "attendanceDate");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_tenantId_status_idx" ON "public"."AttendanceCorrection"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AttendancePeriod_tenantId_year_month_key" ON "public"."AttendancePeriod"("tenantId", "year", 
"month");

-- AddForeignKey
ALTER TABLE "public"."Shift" ADD CONSTRAINT "Shift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES 
"public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") 
REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") 
REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") 
REFERENCES "public"."Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Holiday" ADD CONSTRAINT "Holiday_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES 
"public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Holiday" ADD CONSTRAINT "Holiday_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES 
"public"."Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttendancePolicy" ADD CONSTRAINT "AttendancePolicy_tenantId_fkey" FOREIGN KEY ("tenantId") 
REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttendanceDevice" ADD CONSTRAINT "AttendanceDevice_tenantId_fkey" FOREIGN KEY ("tenantId") 
REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttendanceDevice" ADD CONSTRAINT "AttendanceDevice_locationId_fkey" FOREIGN KEY ("locationId") 
REFERENCES "public"."Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceEnrollment" ADD CONSTRAINT "DeviceEnrollment_deviceId_fkey" FOREIGN KEY ("deviceId") 
REFERENCES "public"."AttendanceDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceEnrollment" ADD CONSTRAINT "DeviceEnrollment_employeeId_fkey" FOREIGN KEY ("employeeId") 
REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceCommand" ADD CONSTRAINT "DeviceCommand_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES 
"public"."AttendanceDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceOperationLog" ADD CONSTRAINT "DeviceOperationLog_tenantId_fkey" FOREIGN KEY ("tenantId") 
REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceOperationLog" ADD CONSTRAINT "DeviceOperationLog_deviceId_fkey" FOREIGN KEY ("deviceId") 
REFERENCES "public"."AttendanceDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttendancePunch" ADD CONSTRAINT "AttendancePunch_tenantId_fkey" FOREIGN KEY ("tenantId") 
REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttendancePunch" ADD CONSTRAINT "AttendancePunch_employeeId_fkey" FOREIGN KEY ("employeeId") 
REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttendancePunch" ADD CONSTRAINT "AttendancePunch_deviceId_fkey" FOREIGN KEY ("deviceId") 
REFERENCES "public"."AttendanceDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttendanceDay" ADD CONSTRAINT "AttendanceDay_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES 
"public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttendanceDay" ADD CONSTRAINT "AttendanceDay_employeeId_fkey" FOREIGN KEY ("employeeId") 
REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttendanceDay" ADD CONSTRAINT "AttendanceDay_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES 
"public"."Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_tenantId_fkey" FOREIGN KEY 
("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_employeeId_fkey" FOREIGN KEY 
("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttendancePeriod" ADD CONSTRAINT "AttendancePeriod_tenantId_fkey" FOREIGN KEY ("tenantId") 
REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ShiftAssignment_one_open_per_employee"
  ON "public"."ShiftAssignment" ("employeeId")
  WHERE "effectiveTo" IS NULL;

