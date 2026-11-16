-- Asset screens: book value, acknowledgement deadline, repair board stage.

-- AlterTable
ALTER TABLE "public"."AssetCategory" ADD COLUMN     "usefulLifeMonths" INTEGER NOT NULL DEFAULT 48;

-- AlterTable
ALTER TABLE "public"."AssetAssignment" ADD COLUMN     "ackDueOn" DATE;

-- AlterTable
ALTER TABLE "public"."AssetMaintenance" ADD COLUMN     "stage" TEXT NOT NULL DEFAULT 'with_vendor';

-- Sensible depreciation periods for the default categories.
UPDATE "public"."AssetCategory" SET "usefulLifeMonths" = 36 WHERE "code" IN ('mobile', 'id_card', 'access_card');
UPDATE "public"."AssetCategory" SET "usefulLifeMonths" = 60 WHERE "code" = 'monitor';
UPDATE "public"."AssetCategory" SET "usefulLifeMonths" = 120 WHERE "code" = 'furniture';
UPDATE "public"."AssetCategory" SET "usefulLifeMonths" = 12 WHERE "code" = 'software_licence';
