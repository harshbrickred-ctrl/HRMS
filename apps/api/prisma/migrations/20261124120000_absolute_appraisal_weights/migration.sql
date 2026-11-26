CREATE TEMP TABLE "AppraisalParentWeightNormalization" AS
WITH parent_groups AS (
  SELECT
    "cycleId",
    LOWER("category") AS "categoryKey",
    LOWER("title") AS "titleKey",
    MAX("weight") AS "oldWeight"
  FROM "public"."CycleKpi"
  GROUP BY "cycleId", LOWER("category"), LOWER("title")
  HAVING COUNT(DISTINCT "weight") = 1
),
cycle_totals AS (
  SELECT "cycleId", SUM("oldWeight") AS "totalWeight"
  FROM parent_groups
  GROUP BY "cycleId"
),
ranked_parents AS (
  SELECT
    parent_groups.*,
    FLOOR("oldWeight") AS "baseWeight",
    SUM(FLOOR("oldWeight")) OVER (PARTITION BY parent_groups."cycleId") AS "floorTotal",
    ROW_NUMBER() OVER (
      PARTITION BY parent_groups."cycleId"
      ORDER BY "oldWeight" - FLOOR("oldWeight") DESC, "categoryKey", "titleKey"
    ) AS "fractionRank"
  FROM parent_groups
  JOIN cycle_totals USING ("cycleId")
  WHERE ABS(cycle_totals."totalWeight" - 100) <= 0.01
)
SELECT
  "cycleId",
  "categoryKey",
  "titleKey",
  (
    "baseWeight"
    + CASE WHEN "fractionRank" <= 100 - "floorTotal" THEN 1 ELSE 0 END
  )::DECIMAL(6,3) AS "normalizedWeight"
FROM ranked_parents;

UPDATE "public"."CycleKpi" AS kpi
SET "weight" = normalized."normalizedWeight"
FROM "AppraisalParentWeightNormalization" AS normalized
WHERE kpi."cycleId" = normalized."cycleId"
  AND LOWER(kpi."category") = normalized."categoryKey"
  AND LOWER(kpi."title") = normalized."titleKey";

CREATE TEMP TABLE "AppraisalSubWeightNormalization" AS
WITH child_groups AS (
  SELECT
    kpi."id",
    kpi."cycleId",
    kpi."category",
    kpi."title",
    kpi."subWeight",
    kpi."sortOrder",
    parent."normalizedWeight",
    SUM(kpi."subWeight") OVER (
      PARTITION BY kpi."cycleId", LOWER(kpi."category"), LOWER(kpi."title")
    ) AS "oldSubTotal"
  FROM "public"."CycleKpi" AS kpi
  JOIN "AppraisalParentWeightNormalization" AS parent
    ON parent."cycleId" = kpi."cycleId"
    AND parent."categoryKey" = LOWER(kpi."category")
    AND parent."titleKey" = LOWER(kpi."title")
  WHERE BTRIM(kpi."subKpiName") <> ''
),
scaled_children AS (
  SELECT
    *,
    "normalizedWeight" * "subWeight" / NULLIF("oldSubTotal", 0) AS "scaledWeight"
  FROM child_groups
  WHERE ABS("oldSubTotal" - 100) <= 0.01
    AND "normalizedWeight" <> 100
),
ranked_children AS (
  SELECT
    *,
    FLOOR("scaledWeight") AS "baseWeight",
    SUM(FLOOR("scaledWeight")) OVER (
      PARTITION BY "cycleId", LOWER("category"), LOWER("title")
    ) AS "floorTotal",
    ROW_NUMBER() OVER (
      PARTITION BY "cycleId", LOWER("category"), LOWER("title")
      ORDER BY "scaledWeight" - FLOOR("scaledWeight") DESC, "sortOrder", "id"
    ) AS "fractionRank"
  FROM scaled_children
)
SELECT
  "id",
  (
    "baseWeight"
    + CASE WHEN "fractionRank" <= "normalizedWeight" - "floorTotal" THEN 1 ELSE 0 END
  )::DECIMAL(6,3) AS "normalizedSubWeight"
FROM ranked_children;

UPDATE "public"."CycleKpi" AS kpi
SET "subWeight" = normalized."normalizedSubWeight"
FROM "AppraisalSubWeightNormalization" AS normalized
WHERE kpi."id" = normalized."id";

DROP TABLE "AppraisalSubWeightNormalization";
DROP TABLE "AppraisalParentWeightNormalization";
