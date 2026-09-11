/**
 * Verify Understat is registered in Neon data_sources and xG keys exist in
 * feature_observations (CONTEXT / NOT_ELIGIBLE, available_at null).
 *
 * Does not invent values. Skips writes when DATABASE_URL is unset.
 *
 *   pnpm phase8:xg-neon
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
config({ path: ".env" });

const XG_KEYS = [
  "home_xg_l5",
  "away_xg_l5",
  "home_xga_l5",
  "away_xga_l5",
  "home_xg_prematch",
  "away_xg_prematch",
  "home_xga_prematch",
  "away_xga_prematch",
];

async function main() {
  const url = process.env.DATABASE_URL;
  console.log(
    JSON.stringify(
      {
        has_database_url: Boolean(url),
        verify_sql: {
          data_sources:
            "SELECT slug, name, license_class, reliability_score FROM data_sources WHERE slug = 'understat';",
          feature_observations: `SELECT feature_key, feature_value_numeric, feature_status, temporal_precision, available_at, source_id
FROM feature_observations
WHERE feature_key IN (${XG_KEYS.map((k) => `'${k}'`).join(", ")})
ORDER BY ingested_at DESC
LIMIT 40;`,
          join: `SELECT ds.slug, fo.feature_key, fo.feature_value_numeric, fo.feature_status, fo.available_at, fo.feature_value_json->>'enters_independent_model' AS entered_model
FROM feature_observations fo
JOIN data_sources ds ON ds.id = fo.source_id
WHERE ds.slug = 'understat'
LIMIT 40;`,
        },
      },
      null,
      2,
    ),
  );
  if (!url) {
    console.log(JSON.stringify({ ok: false, reason: "DATABASE_URL not set — mapping tests still cover the write path" }));
    process.exit(0);
    return;
  }

  const sql = neon(url);
  const sources = (await sql`
    SELECT slug, name, license_class, reliability_score
    FROM data_sources
    WHERE slug = 'understat'
  `) as Array<{
    slug: string;
    name: string;
    license_class: string;
    reliability_score: number | null;
  }>;
  const features = (await sql`
    SELECT fo.feature_key,
           fo.feature_value_numeric,
           fo.feature_status,
           fo.temporal_precision,
           fo.available_at,
           fo.feature_value_json->>'enters_independent_model' AS entered_model,
           ds.slug AS source_slug
    FROM feature_observations fo
    LEFT JOIN data_sources ds ON ds.id = fo.source_id
    WHERE fo.feature_key IN (
      'home_xg_l5','away_xg_l5','home_xga_l5','away_xga_l5',
      'home_xg_prematch','away_xg_prematch','home_xga_prematch','away_xga_prematch'
    )
    ORDER BY fo.ingested_at DESC
    LIMIT 80
  `) as Array<{
    feature_key: string;
    feature_value_numeric: string | null;
    feature_status: string;
    temporal_precision: string;
    available_at: string | null;
    entered_model: string | null;
    source_slug: string | null;
  }>;

  const understat = sources[0] ?? null;
  const numeric = features.filter((f) => f.feature_value_numeric != null && Number.isFinite(Number(f.feature_value_numeric)));
  const eligibleLeak = features.filter((f) => f.feature_status === "VALID" || f.entered_model === "true");
  const availableInvented = features.filter((f) => f.available_at != null);

  console.log(
    JSON.stringify(
      {
        data_sources_understat: understat,
        xg_feature_rows: features.length,
        numeric_xg_rows: numeric.length,
        sample: features.slice(0, 8),
        leaks_into_model: eligibleLeak.length,
        available_at_non_null: availableInvented.length,
        ok: Boolean(understat && understat.license_class !== "unknown" && numeric.length > 0 && eligibleLeak.length === 0),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
