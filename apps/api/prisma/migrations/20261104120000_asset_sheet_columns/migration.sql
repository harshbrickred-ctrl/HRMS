-- Asset register sheet: columns the import and export carry that had nowhere to live.

-- AlterTable
ALTER TABLE "public"."Asset" ADD COLUMN     "owner" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "condition" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "public"."AssetAssignment" ADD COLUMN     "project" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "contactMobile" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "employmentType" TEXT NOT NULL DEFAULT '';

-- The sheet records the operating system of each laptop.
UPDATE "public"."AssetCategory"
SET "fields" = "fields" || '[{"key": "os", "label": "OS", "type": "text", "required": false}]'::jsonb
WHERE "code" = 'laptop'
  AND jsonb_typeof("fields") = 'array'
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements("fields") AS field WHERE field->>'key' = 'os');
