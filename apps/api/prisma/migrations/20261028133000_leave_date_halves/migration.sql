ALTER TABLE "LeaveRequest" ADD COLUMN "fromHalfStart" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LeaveRequest" ADD COLUMN "fromHalfEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LeaveRequest" ADD COLUMN "toHalfStart" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LeaveRequest" ADD COLUMN "toHalfEnd" BOOLEAN NOT NULL DEFAULT false;

UPDATE "LeaveRequest"
SET "fromHalfStart" = true
WHERE "halfDayStart" = true AND "fromDate" = "toDate";

UPDATE "LeaveRequest"
SET "fromHalfEnd" = true
WHERE "halfDayStart" = true AND "fromDate" <> "toDate";

UPDATE "LeaveRequest"
SET "toHalfStart" = true
WHERE "halfDayEnd" = true AND "fromDate" <> "toDate";

UPDATE "LeaveRequest"
SET "fromHalfEnd" = true
WHERE "halfDayEnd" = true AND "fromDate" = "toDate" AND "fromHalfStart" = false;
