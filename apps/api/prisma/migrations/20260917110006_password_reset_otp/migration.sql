-- CreateTable
CREATE TABLE "public"."PasswordResetOtp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "resetSessionHash" TEXT,
    "resetSessionExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordResetOtp_userId_idx" ON "public"."PasswordResetOtp"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetOtp_resetSessionHash_idx" ON "public"."PasswordResetOtp"("resetSessionHash");

-- AddForeignKey
ALTER TABLE "public"."PasswordResetOtp" ADD CONSTRAINT "PasswordResetOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
