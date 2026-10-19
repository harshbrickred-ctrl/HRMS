-- CreateEnum
CREATE TYPE "public"."LeaveRequestStatus" AS ENUM ('Pending', 'Approved', 'Rejected', 'Withdrawn');

-- CreateEnum
CREATE TYPE "public"."HelpdeskTicketStatus" AS ENUM ('Open', 'InProgress', 'Resolved', 'Closed');

-- CreateTable
CREATE TABLE "public"."LeaveRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "halfDayStart" BOOLEAN NOT NULL DEFAULT false,
    "halfDayEnd" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "status" "public"."LeaveRequestStatus" NOT NULL DEFAULT 'Pending',
    "approverEmployeeId" TEXT,
    "decisionNote" TEXT NOT NULL DEFAULT '',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "href" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'info',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."HelpdeskTicket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "public"."HelpdeskTicketStatus" NOT NULL DEFAULT 'Open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpdeskTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."HelpdeskComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpdeskComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Payslip" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeaveRequest_tenantId_employeeId_status_idx" ON "public"."LeaveRequest"("tenantId", "employeeId", "status");
CREATE INDEX "LeaveRequest_tenantId_approverEmployeeId_status_idx" ON "public"."LeaveRequest"("tenantId", "approverEmployeeId", "status");
CREATE INDEX "LeaveRequest_tenantId_fromDate_toDate_idx" ON "public"."LeaveRequest"("tenantId", "fromDate", "toDate");
CREATE INDEX "Notification_tenantId_userId_createdAt_idx" ON "public"."Notification"("tenantId", "userId", "createdAt");
CREATE INDEX "Notification_userId_readAt_idx" ON "public"."Notification"("userId", "readAt");
CREATE INDEX "HelpdeskTicket_tenantId_employeeId_status_idx" ON "public"."HelpdeskTicket"("tenantId", "employeeId", "status");
CREATE INDEX "HelpdeskTicket_tenantId_status_idx" ON "public"."HelpdeskTicket"("tenantId", "status");
CREATE INDEX "HelpdeskComment_ticketId_createdAt_idx" ON "public"."HelpdeskComment"("ticketId", "createdAt");
CREATE INDEX "Payslip_tenantId_employeeId_idx" ON "public"."Payslip"("tenantId", "employeeId");
CREATE UNIQUE INDEX "Payslip_tenantId_employeeId_month_key" ON "public"."Payslip"("tenantId", "employeeId", "month");

ALTER TABLE "public"."LeaveRequest" ADD CONSTRAINT "LeaveRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."LeaveRequest" ADD CONSTRAINT "LeaveRequest_approverEmployeeId_fkey" FOREIGN KEY ("approverEmployeeId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."HelpdeskTicket" ADD CONSTRAINT "HelpdeskTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."HelpdeskTicket" ADD CONSTRAINT "HelpdeskTicket_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."HelpdeskComment" ADD CONSTRAINT "HelpdeskComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."HelpdeskTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Payslip" ADD CONSTRAINT "Payslip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
