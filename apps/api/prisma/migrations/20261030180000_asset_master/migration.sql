-- Asset master (phase 1): configurable categories with custom fields, full asset record,
-- optional unique serial numbers, and asset history protected from deletion.

-- Categories move from an enum to a per-tenant table. Types and tables share a namespace,
-- so the enum steps aside until every asset points at the new table.
ALTER TYPE "public"."AssetCategory" RENAME TO "AssetCategory_old";

-- CreateTable
CREATE TABLE "public"."AssetCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagPrefix" TEXT NOT NULL,
    "nextTagNumber" INTEGER NOT NULL DEFAULT 1,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_tenantId_code_key" ON "public"."AssetCategory"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_tenantId_tagPrefix_key" ON "public"."AssetCategory"("tenantId", "tagPrefix");

-- Default categories for every existing tenant. New databases get the same list from the seed.
INSERT INTO "public"."AssetCategory" ("id", "tenantId", "code", "name", "tagPrefix", "fields", "updatedAt")
SELECT gen_random_uuid()::text, t."id", c.code, c.name, c.prefix, c.fields::jsonb, CURRENT_TIMESTAMP
FROM "public"."Tenant" t
CROSS JOIN (VALUES
  ('laptop', 'Laptop', 'LAP', '[{"key":"ram","label":"RAM","type":"text"},{"key":"storage","label":"Storage","type":"text"},{"key":"processor","label":"Processor","type":"text"}]'),
  ('mobile', 'Mobile', 'MOB', '[{"key":"imei","label":"IMEI","type":"text"},{"key":"device_number","label":"Device Number","type":"text"}]'),
  ('id_card', 'ID Card', 'IDC', '[]'),
  ('furniture', 'Furniture', 'FUR', '[]'),
  ('access_card', 'Access Card', 'ACC', '[]'),
  ('software_licence', 'Software Licence', 'SWL', '[{"key":"licence_key","label":"Licence Key","type":"text"},{"key":"seat_count","label":"Seat Count","type":"number"}]'),
  ('monitor', 'Monitor', 'MON', '[]'),
  ('other', 'Other', 'OTH', '[]')
) AS c(code, name, prefix, fields);

-- AlterTable
ALTER TABLE "public"."Asset"
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "cost" DECIMAL(12,2),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "make" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "model" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "name" TEXT,
ADD COLUMN     "photoPath" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "updatedById" TEXT,
ADD COLUMN     "vendor" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "warrantyExpiry" DATE,
ALTER COLUMN "serialNo" DROP NOT NULL,
ALTER COLUMN "serialNo" DROP DEFAULT;

-- Keep every existing asset: map the enum to its category, split makeModel, and blank serials become NULL.
UPDATE "public"."Asset" a SET
  "categoryId" = (
    SELECT c."id" FROM "public"."AssetCategory" c
    WHERE c."tenantId" = a."tenantId"
      AND c."code" = CASE a."category"::text WHEN 'phone' THEN 'mobile' ELSE a."category"::text END
  ),
  "name" = COALESCE(NULLIF(btrim(a."makeModel"), ''), a."assetTag"),
  "make" = split_part(btrim(a."makeModel"), ' ', 1),
  "model" = btrim(substr(btrim(a."makeModel"), length(split_part(btrim(a."makeModel"), ' ', 1)) + 1)),
  "serialNo" = NULLIF(upper(btrim(a."serialNo")), '');

ALTER TABLE "public"."Asset"
ALTER COLUMN "categoryId" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
DROP COLUMN "category",
DROP COLUMN "makeModel";

DROP TYPE "public"."AssetCategory_old";

-- Ticket requests store a category code; the one renamed code follows the new category.
UPDATE "public"."AssetTicket" SET "category" = 'mobile' WHERE "category" = 'phone';

-- CreateIndex
CREATE INDEX "Asset_tenantId_categoryId_idx" ON "public"."Asset"("tenantId", "categoryId");

-- CreateIndex
CREATE INDEX "Asset_tenantId_locationId_idx" ON "public"."Asset"("tenantId", "locationId");

-- CreateIndex (NULL serials never collide, so serial numbers stay optional)
CREATE UNIQUE INDEX "Asset_tenantId_serialNo_key" ON "public"."Asset"("tenantId", "serialNo");

-- AddForeignKey
ALTER TABLE "public"."AssetCategory" ADD CONSTRAINT "AssetCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetCategory" ADD CONSTRAINT "AssetCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetCategory" ADD CONSTRAINT "AssetCategory_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An asset's allocation history must outlive any attempt to delete the asset.
ALTER TABLE "public"."AssetAssignment" DROP CONSTRAINT "AssetAssignment_assetId_fkey";

-- AddForeignKey
ALTER TABLE "public"."AssetAssignment" ADD CONSTRAINT "AssetAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Permission rows left behind by the earlier rolled-back asset work. The role matrix never granted these.
DELETE FROM "public"."Permission" WHERE "code" IN ('assets.approve', 'assets.exit', 'assets.reports');

DELETE FROM "public"."RolePermission" rp
USING "public"."Role" r, "public"."Permission" p
WHERE r."id" = rp."roleId"
  AND p."id" = rp."permissionId"
  AND p."code" = 'assets.self'
  AND r."code" IN ('MANAGER', 'HR_EXEC');
