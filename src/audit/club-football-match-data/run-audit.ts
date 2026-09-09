import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import {
  AGGREGATE_ODDS_COLUMNS,
  BET365_ODDS_COLUMNS,
  CLUBELO_OFFICIAL_CUTOFF,
  MATCHES_COLUMNS,
  classifyBookmakerColumn,
  classifyFeature,
  classifyOddsTemporal,
  eventIdentityKey,
  forbiddenPrematchFeatures,
  isProvisionalEloDate,
  parseMatchDate,
  parseMatchTime,
  provenanceForColumn,
  teamPerspectiveResult,
  temporalMatrixRow,
  usageModeForColumn,
  validateDecimalOdds,
} from "./classifiers";
import {
  CLUB_FOOTBALL_AUDIT_OUT_DIR,
  CLUB_FOOTBALL_ELO_CSV,
  CLUB_FOOTBALL_MATCHES_CSV,
  CLUB_FOOTBALL_MATCH_DATA_ROOT,
} from "./paths";

type ColStats = {
  column_name: string;
  type: string;
  non_null_count: number;
  null_count: number;
  null_percentage: number;
  unique_count: number;
  min: string | number | null;
  max: string | number | null;
  sample_values: string[];
};

function detectDelimiter(headerLine: string): "," | ";" | "\t" {
  const counts = {
    ",": (headerLine.match(/,/g) ?? []).length,
    ";": (headerLine.match(/;/g) ?? []).length,
    "\t": (headerLine.match(/\t/g) ?? []).length,
  };
  const best = (Object.entries(counts) as Array<["," | ";" | "\t", number]>).sort(
    (a, b) => b[1] - a[1],
  )[0];
  return best[0];
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function isBlank(v: string | undefined): boolean {
  return v === undefined || v.trim() === "";
}

function inferType(samples: string[]): string {
  let num = 0;
  let date = 0;
  let time = 0;
  let nonEmpty = 0;
  for (const s of samples) {
    if (isBlank(s)) continue;
    nonEmpty++;
    if (parseMatchDate(s)) date++;
    else if (parseMatchTime(s)) time++;
    else if (Number.isFinite(Number(s))) num++;
  }
  if (nonEmpty === 0) return "empty";
  if (date / nonEmpty > 0.8) return "date";
  if (time / nonEmpty > 0.8) return "time";
  if (num / nonEmpty > 0.8) return "number";
  return "string";
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeCsv(filePath: string, headers: string[], rows: Array<Record<string, unknown>>) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => esc(row[h])).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

async function profileCsv(
  filePath: string,
  options?: { maxUniqueTrack?: number },
): Promise<{
  filename: string;
  format: string;
  size_bytes: number;
  encoding: string;
  delimiter: string;
  header: string[];
  row_count: number;
  column_count: number;
  columns: ColStats[];
}> {
  const maxUniqueTrack = options?.maxUniqueTrack ?? 50_000;
  const size = fs.statSync(filePath).size;
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let delimiter: "," | ";" | "\t" = ",";
  let header: string[] = [];
  let rowCount = 0;
  const nonNull: number[] = [];
  const nullCount: number[] = [];
  const uniques: Array<Set<string> | null> = [];
  const uniqueOverflow: boolean[] = [];
  const mins: Array<string | number | null> = [];
  const maxs: Array<string | number | null> = [];
  const samples: string[][] = [];
  const sampleSeen: Array<Set<string>> = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (header.length === 0) {
      delimiter = detectDelimiter(line);
      header = splitCsvLine(line, delimiter).map((h) => h.trim());
      for (let i = 0; i < header.length; i++) {
        nonNull[i] = 0;
        nullCount[i] = 0;
        uniques[i] = new Set();
        uniqueOverflow[i] = false;
        mins[i] = null;
        maxs[i] = null;
        samples[i] = [];
        sampleSeen[i] = new Set();
      }
      continue;
    }

    const cells = splitCsvLine(line, delimiter);
    rowCount++;
    for (let i = 0; i < header.length; i++) {
      const raw = cells[i] ?? "";
      if (isBlank(raw)) {
        nullCount[i]++;
        continue;
      }
      nonNull[i]++;
      const v = raw.trim();
      const set = uniques[i];
      if (set && set.size < maxUniqueTrack) set.add(v);
      else if (set && set.size >= maxUniqueTrack) {
        uniqueOverflow[i] = true;
        uniques[i] = null;
      }
      const num = Number(v);
      if (Number.isFinite(num) && v !== "") {
        if (mins[i] === null || (typeof mins[i] === "number" && num < (mins[i] as number))) {
          mins[i] = num;
        }
        if (maxs[i] === null || (typeof maxs[i] === "number" && num > (maxs[i] as number))) {
          maxs[i] = num;
        }
      } else {
        if (mins[i] === null || (typeof mins[i] === "string" && v < (mins[i] as string))) {
          mins[i] = v;
        }
        if (maxs[i] === null || (typeof maxs[i] === "string" && v > (maxs[i] as string))) {
          maxs[i] = v;
        }
      }
      if (samples[i].length < 5 && !sampleSeen[i].has(v)) {
        sampleSeen[i].add(v);
        samples[i].push(v);
      }
    }
  }

  const columns: ColStats[] = header.map((name, i) => {
    const total = rowCount;
    const nn = nonNull[i] ?? 0;
    const nu = nullCount[i] ?? 0;
    return {
      column_name: name,
      type: inferType(samples[i] ?? []),
      non_null_count: nn,
      null_count: nu,
      null_percentage: total === 0 ? 0 : Number(((nu / total) * 100).toFixed(3)),
      unique_count: uniqueOverflow[i]
        ? maxUniqueTrack
        : (uniques[i]?.size ?? 0),
      min: mins[i],
      max: maxs[i],
      sample_values: samples[i] ?? [],
    };
  });

  return {
    filename: path.basename(filePath),
    format: "csv",
    size_bytes: size,
    encoding: "utf8",
    delimiter,
    header,
    row_count: rowCount,
    column_count: header.length,
    columns,
  };
}

type MatchCoverage = {
  matches: number;
  odds_b365: number;
  odds_max: number;
  stats_shots: number;
  elo: number;
  form: number;
  clusters: number;
};

async function forensicMatchesPass(filePath: string) {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let delimiter: "," | ";" | "\t" = ",";
  let header: string[] = [];
  let idx: Record<string, number> = {};

  const identityCounts = new Map<string, number>();
  const divisions = new Map<string, number>();
  const seasonsBuckets = {
    "2000-2005": 0,
    "2005-2010": 0,
    "2010-2015": 0,
    "2015-2020": 0,
    "2020-2025": 0,
    "2025+": 0,
    invalid_date: 0,
  };
  const coverageByBucket: Record<string, MatchCoverage> = {};
  for (const b of Object.keys(seasonsBuckets)) {
    coverageByBucket[b] = {
      matches: 0,
      odds_b365: 0,
      odds_max: 0,
      stats_shots: 0,
      elo: 0,
      form: 0,
      clusters: 0,
    };
  }

  const teamNames = new Map<string, number>();
  let dateMin: string | null = null;
  let dateMax: string | null = null;
  let invalidOdds = 0;
  let validOdds = 0;
  let formMismatchSample = 0;
  let formChecked = 0;
  let formExact = 0;
  let eloMissing = 0;
  let rows = 0;

  // Rolling team history for form reconstruction (global, all competitions)
  const teamHistory: Map<string, string[]> = new Map();
  const formCheckLimit = 5000;

  const decadeCoverage = {
    "2000s": { matches: 0, odds: 0, stats: 0, elo: 0, form: 0, clusters: 0 },
    "2010s": { matches: 0, odds: 0, stats: 0, elo: 0, form: 0, clusters: 0 },
    "2020s": { matches: 0, odds: 0, stats: 0, elo: 0, form: 0, clusters: 0 },
    current: { matches: 0, odds: 0, stats: 0, elo: 0, form: 0, clusters: 0 },
    overall: { matches: 0, odds: 0, stats: 0, elo: 0, form: 0, clusters: 0 },
  };

  function bucketForDate(iso: string): keyof typeof seasonsBuckets {
    const y = Number(iso.slice(0, 4));
    if (!Number.isFinite(y)) return "invalid_date";
    if (y < 2005) return "2000-2005";
    if (y < 2010) return "2005-2010";
    if (y < 2015) return "2010-2015";
    if (y < 2020) return "2015-2020";
    if (y < 2025) return "2020-2025";
    return "2025+";
  }

  function decadeKey(iso: string): keyof typeof decadeCoverage {
    const y = Number(iso.slice(0, 4));
    if (y >= 2025) return "current";
    if (y >= 2020) return "2020s";
    if (y >= 2010) return "2010s";
    return "2000s";
  }

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (header.length === 0) {
      delimiter = detectDelimiter(line);
      header = splitCsvLine(line, delimiter).map((h) => h.trim());
      idx = Object.fromEntries(header.map((h, i) => [h, i]));
      continue;
    }

    const cells = splitCsvLine(line, delimiter);
    const get = (c: string) => (cells[idx[c]] ?? "").trim();
    rows++;

    const division = get("Division");
    const matchDate = get("MatchDate");
    const home = get("HomeTeam");
    const away = get("AwayTeam");
    const ft = get("FTResult");

    divisions.set(division, (divisions.get(division) ?? 0) + 1);
    teamNames.set(home, (teamNames.get(home) ?? 0) + 1);
    teamNames.set(away, (teamNames.get(away) ?? 0) + 1);

    const id = eventIdentityKey({
      division,
      matchDate,
      homeTeam: home,
      awayTeam: away,
    });
    identityCounts.set(id, (identityCounts.get(id) ?? 0) + 1);

    const parsedDate = parseMatchDate(matchDate);
    if (!parsedDate) {
      seasonsBuckets.invalid_date++;
      coverageByBucket.invalid_date.matches++;
    } else {
      if (!dateMin || matchDate < dateMin) dateMin = matchDate;
      if (!dateMax || matchDate > dateMax) dateMax = matchDate;
      const b = bucketForDate(matchDate);
      seasonsBuckets[b]++;
      const cov = coverageByBucket[b];
      cov.matches++;

      const hasB365 =
        !isBlank(get("OddHome")) &&
        !isBlank(get("OddDraw")) &&
        !isBlank(get("OddAway"));
      const hasMax =
        !isBlank(get("MaxHome")) &&
        !isBlank(get("MaxDraw")) &&
        !isBlank(get("MaxAway"));
      const hasShots = !isBlank(get("HomeShots")) && !isBlank(get("AwayShots"));
      const hasElo = !isBlank(get("HomeElo")) && !isBlank(get("AwayElo"));
      const hasForm =
        !isBlank(get("Form3Home")) &&
        !isBlank(get("Form5Home")) &&
        !isBlank(get("Form3Away")) &&
        !isBlank(get("Form5Away"));
      const hasCluster = !isBlank(get("C_LTH"));

      if (hasB365) cov.odds_b365++;
      if (hasMax) cov.odds_max++;
      if (hasShots) cov.stats_shots++;
      if (hasElo) cov.elo++;
      if (hasForm) cov.form++;
      if (hasCluster) cov.clusters++;

      const dKey = decadeKey(matchDate);
      for (const key of [dKey, "overall"] as const) {
        decadeCoverage[key].matches++;
        if (hasB365) decadeCoverage[key].odds++;
        if (hasShots) decadeCoverage[key].stats++;
        if (hasElo) decadeCoverage[key].elo++;
        if (hasForm) decadeCoverage[key].form++;
        if (hasCluster) decadeCoverage[key].clusters++;
      }
    }

    for (const col of BET365_ODDS_COLUMNS) {
      const raw = get(col);
      if (isBlank(raw)) continue;
      const n = Number(raw);
      if (col === "HandiSize") continue;
      if (validateDecimalOdds(n)) validOdds++;
      else invalidOdds++;
    }

    if (isBlank(get("HomeElo")) || isBlank(get("AwayElo"))) eloMissing++;

    // Form reconstruction check (first N rows chronologically — file claimed ordered by date)
    if (formChecked < formCheckLimit && !isBlank(get("Form3Home")) && ft) {
      const homeHist = teamHistory.get(home) ?? [];
      const awayHist = teamHistory.get(away) ?? [];
      const recon3H = homeHist.slice(-3).reduce((acc, r) => {
        if (r === "H") return acc + 3;
        if (r === "D") return acc + 1;
        return acc;
      }, 0);
      const recon5H = homeHist.slice(-5).reduce((acc, r) => {
        if (r === "H") return acc + 3;
        if (r === "D") return acc + 1;
        return acc;
      }, 0);
      const recon3A = awayHist.slice(-3).reduce((acc, r) => {
        if (r === "H") return acc + 3;
        if (r === "D") return acc + 1;
        return acc;
      }, 0);
      const recon5A = awayHist.slice(-5).reduce((acc, r) => {
        if (r === "H") return acc + 3;
        if (r === "D") return acc + 1;
        return acc;
      }, 0);

      const f3h = Number(get("Form3Home"));
      const f5h = Number(get("Form5Home"));
      const f3a = Number(get("Form3Away"));
      const f5a = Number(get("Form5Away"));
      formChecked++;
      if (
        f3h === recon3H &&
        f5h === recon5H &&
        f3a === recon3A &&
        f5a === recon5A
      ) {
        formExact++;
      } else {
        formMismatchSample++;
      }
    }

    // Update histories AFTER form check (correct lag)
    if (ft === "H" || ft === "D" || ft === "A") {
      const homePersp = teamPerspectiveResult(true, ft);
      const awayPersp = teamPerspectiveResult(false, ft);
      if (homePersp) {
        const h = teamHistory.get(home) ?? [];
        h.push(homePersp);
        teamHistory.set(home, h);
      }
      if (awayPersp) {
        const a = teamHistory.get(away) ?? [];
        a.push(awayPersp);
        teamHistory.set(away, a);
      }
    }
  }

  const duplicateIdentities = [...identityCounts.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([key, count]) => ({ identity: key, count }));

  const duplicateTotal = [...identityCounts.values()].filter((n) => n > 1).length;

  // Alias candidates: shared prefixes / known patterns
  const names = [...teamNames.keys()].sort();
  const aliasCandidates: Array<{
    name_a: string;
    name_b: string;
    reason: string;
  }> = [];
  const lowerMap = new Map<string, string[]>();
  for (const n of names) {
    const k = n.toLowerCase();
    const arr = lowerMap.get(k) ?? [];
    arr.push(n);
    lowerMap.set(k, arr);
  }
  for (const [k, arr] of lowerMap) {
    if (arr.length > 1) {
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          aliasCandidates.push({
            name_a: arr[i],
            name_b: arr[j],
            reason: "case_variant",
          });
        }
      }
    }
    if (/\bu21\b|\bu23\b|\bii\b|\b b\b|reserves?/i.test(k)) {
      aliasCandidates.push({
        name_a: names.find((x) => x.toLowerCase() === k)!,
        name_b: "",
        reason: "youth_or_reserve_marker",
      });
    }
  }

  // Heuristic near-duplicates: one name is prefix of another (length>=6)
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < Math.min(names.length, i + 40); j++) {
      const a = names[i];
      const b = names[j];
      const al = a.toLowerCase();
      const bl = b.toLowerCase();
      if (al.length >= 6 && bl.startsWith(al) && bl !== al) {
        aliasCandidates.push({ name_a: a, name_b: b, reason: "prefix_candidate" });
      } else if (bl.length >= 6 && al.startsWith(bl) && bl !== al) {
        aliasCandidates.push({ name_a: a, name_b: b, reason: "prefix_candidate" });
      }
    }
  }

  return {
    rows,
    dateMin,
    dateMax,
    divisions: Object.fromEntries(
      [...divisions.entries()].sort((a, b) => b[1] - a[1]),
    ),
    division_count: divisions.size,
    team_count: teamNames.size,
    seasonsBuckets,
    coverageByBucket,
    decadeCoverage,
    duplicateIdentities,
    duplicateIdentityKeys: duplicateTotal,
    invalidOdds,
    validOdds,
    eloMissing,
    formChecked,
    formExact,
    formMismatchSample,
    formExactRate:
      formChecked === 0 ? null : Number((formExact / formChecked).toFixed(4)),
    aliasCandidates: aliasCandidates.slice(0, 500),
    teamNamesTop: [...teamNames.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([name, count]) => ({ name, count })),
  };
}

async function forensicEloPass(filePath: string) {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let header: string[] = [];
  let delimiter: "," | ";" | "\t" = ",";
  let rows = 0;
  let official = 0;
  let provisional = 0;
  let dateMin: string | null = null;
  let dateMax: string | null = null;
  const clubs = new Set<string>();
  const countries = new Set<string>();
  const dates = new Set<string>();

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (header.length === 0) {
      delimiter = detectDelimiter(line);
      header = splitCsvLine(line, delimiter).map((h) => h.trim());
      continue;
    }
    const cells = splitCsvLine(line, delimiter);
    const date = (cells[0] ?? "").trim();
    const club = (cells[1] ?? "").trim();
    const country = (cells[2] ?? "").trim();
    rows++;
    if (date) {
      if (!dateMin || date < dateMin) dateMin = date;
      if (!dateMax || date > dateMax) dateMax = date;
      dates.add(date);
      if (isProvisionalEloDate(date)) provisional++;
      else if (date <= CLUBELO_OFFICIAL_CUTOFF) official++;
      else official++; // between cutoff and provisional start
    }
    if (club) clubs.add(club);
    if (country) countries.add(country);
  }

  return {
    rows,
    dateMin,
    dateMax,
    club_count: clubs.size,
    country_count: countries.size,
    snapshot_dates: dates.size,
    official_or_pre_provisional_rows: official,
    provisional_rows: provisional,
    clubelo_official_cutoff: CLUBELO_OFFICIAL_CUTOFF,
    provisional_elo_start: PROVISIONAL_ELO_START,
  };
}

function pctBucket(rate: number): string {
  if (rate <= 0) return "0%";
  if (rate < 0.25) return "1-25%";
  if (rate < 0.5) return "25-50%";
  if (rate < 0.75) return "50-75%";
  if (rate < 0.9) return "75-90%";
  if (rate < 0.99) return "90-99%";
  return "99%+";
}

async function main() {
  const retrievedAt = new Date().toISOString();
  if (!fs.existsSync(CLUB_FOOTBALL_MATCHES_CSV) || !fs.existsSync(CLUB_FOOTBALL_ELO_CSV)) {
    console.error(
      JSON.stringify({
        status: "DATASET_DOWNLOAD_BLOCKED",
        reason: "Expected CSV files missing under audit/external/Club-Football-Match-Data",
      }),
    );
    process.exit(2);
  }

  const commitSha = fs
    .readFileSync(
      path.join(CLUB_FOOTBALL_MATCH_DATA_ROOT, ".git", "HEAD"),
      "utf8",
    )
    .trim();
  let resolvedSha = commitSha;
  if (commitSha.startsWith("ref:")) {
    const ref = commitSha.slice(5).trim();
    resolvedSha = fs
      .readFileSync(path.join(CLUB_FOOTBALL_MATCH_DATA_ROOT, ".git", ref), "utf8")
      .trim();
  }

  console.log("Profiling Matches.csv...");
  const matchesProfile = await profileCsv(CLUB_FOOTBALL_MATCHES_CSV);
  console.log("Forensic pass Matches.csv...");
  const matchesForensics = await forensicMatchesPass(CLUB_FOOTBALL_MATCHES_CSV);
  console.log("Profiling EloRatings.csv...");
  const eloProfile = await profileCsv(CLUB_FOOTBALL_ELO_CSV);
  console.log("Forensic pass EloRatings.csv...");
  const eloForensics = await forensicEloPass(CLUB_FOOTBALL_ELO_CSV);

  ensureDir(CLUB_FOOTBALL_AUDIT_OUT_DIR);
  ensureDir(path.join(process.cwd(), "docs"));

  const columnRows = matchesProfile.columns.map((c) => {
    const feature = classifyFeature(c.column_name);
    const book = classifyBookmakerColumn(c.column_name);
    const oddsTemp = classifyOddsTemporal(c.column_name);
    const prov = provenanceForColumn(c.column_name);
    const temp = temporalMatrixRow(c.column_name);
    return {
      column_name: c.column_name,
      type: c.type,
      non_null_count: c.non_null_count,
      null_count: c.null_count,
      null_percentage: c.null_percentage,
      unique_count: c.unique_count,
      min: c.min,
      max: c.max,
      sample_values: c.sample_values.join("|"),
      feature_class: feature,
      bookmaker_kind: book,
      odds_temporal_class: oddsTemp,
      usage_mode: usageModeForColumn(c.column_name),
      original_source: prov.originalSource,
      source_type: prov.sourceType,
      provenance_confidence: prov.confidence,
      event_time: temp.eventTime,
      observation_time: temp.observationTime,
      availability_time: temp.availabilityTime,
      temporal_precision: temp.precision,
    };
  });

  writeCsv(
    path.join(CLUB_FOOTBALL_AUDIT_OUT_DIR, "columns.csv"),
    [
      "column_name",
      "type",
      "non_null_count",
      "null_count",
      "null_percentage",
      "unique_count",
      "min",
      "max",
      "sample_values",
      "feature_class",
      "bookmaker_kind",
      "odds_temporal_class",
      "usage_mode",
      "original_source",
      "source_type",
      "provenance_confidence",
      "event_time",
      "observation_time",
      "availability_time",
      "temporal_precision",
    ],
    columnRows,
  );

  const coverageRows = Object.entries(matchesForensics.coverageByBucket).map(
    ([bucket, v]) => ({
      bucket,
      matches: v.matches,
      odds_b365_pct:
        v.matches === 0 ? 0 : Number(((v.odds_b365 / v.matches) * 100).toFixed(2)),
      odds_max_pct:
        v.matches === 0 ? 0 : Number(((v.odds_max / v.matches) * 100).toFixed(2)),
      stats_shots_pct:
        v.matches === 0 ? 0 : Number(((v.stats_shots / v.matches) * 100).toFixed(2)),
      elo_pct: v.matches === 0 ? 0 : Number(((v.elo / v.matches) * 100).toFixed(2)),
      form_pct:
        v.matches === 0 ? 0 : Number(((v.form / v.matches) * 100).toFixed(2)),
      clusters_pct:
        v.matches === 0 ? 0 : Number(((v.clusters / v.matches) * 100).toFixed(2)),
      odds_b365_bucket: pctBucket(v.matches ? v.odds_b365 / v.matches : 0),
      stats_bucket: pctBucket(v.matches ? v.stats_shots / v.matches : 0),
      elo_bucket: pctBucket(v.matches ? v.elo / v.matches : 0),
      form_bucket: pctBucket(v.matches ? v.form / v.matches : 0),
    }),
  );

  writeCsv(
    path.join(CLUB_FOOTBALL_AUDIT_OUT_DIR, "coverage.csv"),
    [
      "bucket",
      "matches",
      "odds_b365_pct",
      "odds_max_pct",
      "stats_shots_pct",
      "elo_pct",
      "form_pct",
      "clusters_pct",
      "odds_b365_bucket",
      "stats_bucket",
      "elo_bucket",
      "form_bucket",
    ],
    coverageRows,
  );

  const leakage = forbiddenPrematchFeatures().map((f) => ({
    field: f.field,
    reason: f.reason,
    leakage_mechanism: f.leakageMechanism,
    safe_reconstruction_method: f.safeReconstructionMethod,
    feature_class: classifyFeature(f.field),
  }));
  writeCsv(
    path.join(CLUB_FOOTBALL_AUDIT_OUT_DIR, "leakage.csv"),
    [
      "field",
      "reason",
      "leakage_mechanism",
      "safe_reconstruction_method",
      "feature_class",
    ],
    leakage,
  );

  const provenance = MATCHES_COLUMNS.map((c) => {
    const p = provenanceForColumn(c);
    return {
      repository_field: p.repositoryField,
      original_source: p.originalSource,
      source_type: p.sourceType,
      license_status: p.licenseStatus,
      confidence: p.confidence,
      notes: p.notes,
    };
  });
  writeCsv(
    path.join(CLUB_FOOTBALL_AUDIT_OUT_DIR, "provenance.csv"),
    [
      "repository_field",
      "original_source",
      "source_type",
      "license_status",
      "confidence",
      "notes",
    ],
    provenance,
  );

  fs.writeFileSync(
    path.join(CLUB_FOOTBALL_AUDIT_OUT_DIR, "team_alias_candidates.json"),
    JSON.stringify(
      {
        generated_at: retrievedAt,
        note: "Candidates only — no fuzzy matching applied; human verification required",
        candidates: matchesForensics.aliasCandidates,
      },
      null,
      2,
    ),
    "utf8",
  );

  const summary = {
    dataset_version: "main@shallow",
    commit_sha: resolvedSha,
    retrieved_at: retrievedAt,
    repository_url: "https://github.com/xgabora/Club-Football-Match-Data.git",
    branch: "main",
    license_repo: "MIT",
    declared_sources: ["football-data.co.uk", "clubelo.com"],
    files: [matchesProfile, eloProfile],
    matches_forensics: {
      ...matchesForensics,
      aliasCandidates: undefined,
      teamNamesTop: matchesForensics.teamNamesTop,
    },
    elo_forensics: eloForensics,
    header_matches_expected:
      JSON.stringify(matchesProfile.header) === JSON.stringify([...MATCHES_COLUMNS]),
    bookmakers_present: ["bet365 (Odd*/Over25/Under25/Handi*)"],
    bookmakers_absent_as_columns: [
      "pinnacle",
      "william_hill",
      "betvictor",
      "interwetten",
    ],
    aggregates_present: [...AGGREGATE_ODDS_COLUMNS],
    decision_gate: "YELLOW",
    recommended_source_role: [
      "benchmark",
      "validation_source",
      "secondary_feature_candidate_after_reconstruction",
    ],
    import_readiness: {
      matches: "READY_WITH_TRANSFORMATIONS",
      results: "READY_WITH_TRANSFORMATIONS",
      stats: "BLOCKED_PENDING_TEMPORAL_VALIDATION",
      odds: "BLOCKED_PENDING_TEMPORAL_VALIDATION",
      Elo: "BLOCKED_PENDING_PROVENANCE",
      form: "BLOCKED_PENDING_TEMPORAL_VALIDATION",
      derived_features: "BLOCKED_PENDING_TEMPORAL_VALIDATION",
    },
    critical_question: {
      contains_post_decision_info: true,
      examples: [
        "FT*/HT*/shots/fouls/corners/cards",
        "C_* cluster probabilities",
        "Odd*/Max* without open/close labels",
        "HomeElo/AwayElo after ClubElo cutoff (provisional continuation)",
      ],
    },
  };

  fs.writeFileSync(
    path.join(CLUB_FOOTBALL_AUDIT_OUT_DIR, "summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8",
  );

  // Also copy-friendly names requested by brief
  fs.copyFileSync(
    path.join(CLUB_FOOTBALL_AUDIT_OUT_DIR, "summary.json"),
    path.join(process.cwd(), "audit", "club-football-match-data-summary.json"),
  );
  fs.copyFileSync(
    path.join(CLUB_FOOTBALL_AUDIT_OUT_DIR, "columns.csv"),
    path.join(process.cwd(), "audit", "club-football-match-data-columns.csv"),
  );
  fs.copyFileSync(
    path.join(CLUB_FOOTBALL_AUDIT_OUT_DIR, "coverage.csv"),
    path.join(process.cwd(), "audit", "club-football-match-data-coverage.csv"),
  );
  fs.copyFileSync(
    path.join(CLUB_FOOTBALL_AUDIT_OUT_DIR, "leakage.csv"),
    path.join(process.cwd(), "audit", "club-football-match-data-leakage.csv"),
  );
  fs.copyFileSync(
    path.join(CLUB_FOOTBALL_AUDIT_OUT_DIR, "provenance.csv"),
    path.join(process.cwd(), "audit", "club-football-match-data-provenance.csv"),
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        commit_sha: resolvedSha,
        matches: matchesProfile.row_count,
        columns: matchesProfile.column_count,
        elo_rows: eloProfile.row_count,
        date_min: matchesForensics.dateMin,
        date_max: matchesForensics.dateMax,
        divisions: matchesForensics.division_count,
        formExactRate: matchesForensics.formExactRate,
        duplicateIdentityKeys: matchesForensics.duplicateIdentityKeys,
        out: CLUB_FOOTBALL_AUDIT_OUT_DIR,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
