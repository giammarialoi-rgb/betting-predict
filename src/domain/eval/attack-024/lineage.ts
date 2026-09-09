/**
 * Source lineage: GitHub/Kaggle/HF/Dropbox copies of the same upstream are one cluster.
 */

import type { IndependenceClass024, SourceLineage024 } from "@/domain/eval/attack-024/types";

export const LINEAGE: readonly SourceLineage024[] = [
  {
    sourceId: "football-data-co-uk",
    lineageRoot: "football-data.co.uk",
    upstreamSources: ["football-data.co.uk"],
    distributionChannel: "publisher CSV (mmz4281)",
    independenceClass: "OFFICIAL",
  },
  {
    sourceId: "beatthebookie-closing",
    lineageRoot: "Lisandro79/BeatTheBookie",
    upstreamSources: ["Lisandro79/BeatTheBookie"],
    distributionChannel: "Kaggle austro / TilenKopac GitHub CSV",
    independenceClass: "REDISTRIBUTION",
  },
  {
    sourceId: "beatthebookie-series",
    lineageRoot: "Lisandro79/BeatTheBookie",
    upstreamSources: ["Lisandro79/BeatTheBookie"],
    distributionChannel: "Dropbox odds_series.zip (NOT_ACQUIRED)",
    independenceClass: "OFFICIAL",
  },
  {
    sourceId: "beatthebookie-kaggle",
    lineageRoot: "Lisandro79/BeatTheBookie",
    upstreamSources: ["Lisandro79/BeatTheBookie"],
    distributionChannel: "Kaggle austro dataset v2",
    independenceClass: "MIRROR",
  },
  {
    sourceId: "soccer-dataset-hf",
    lineageRoot: "eatpizzanot/soccer-dataset",
    upstreamSources: ["API-Football", "football-data.co.uk", "The-Odds-API"],
    distributionChannel: "Hugging Face parquet (CC BY 4.0)",
    independenceClass: "DERIVED",
  },
  {
    sourceId: "soccer-dataset-github",
    lineageRoot: "eatpizzanot/soccer-dataset",
    upstreamSources: ["API-Football", "football-data.co.uk", "The-Odds-API"],
    distributionChannel: "GitHub eatpizzanot/soccer-dataset",
    independenceClass: "MIRROR",
  },
  {
    sourceId: "zenodo-tale-of-two-markets",
    lineageRoot: "football-data.co.uk",
    upstreamSources: ["football-data.co.uk"],
    distributionChannel: "Zenodo 10.5281/zenodo.12673394 (collected 2022-05-22)",
    independenceClass: "REDISTRIBUTION",
  },
  {
    sourceId: "betfair-historic-official",
    lineageRoot: "historicdata.betfair.com",
    upstreamSources: ["historicdata.betfair.com"],
    distributionChannel: "Betfair Historic portal (login-gated BASIC £0)",
    independenceClass: "OFFICIAL",
  },
  {
    sourceId: "betfair-historic-petermclagan",
    lineageRoot: "historicdata.betfair.com",
    upstreamSources: ["historicdata.betfair.com"],
    distributionChannel: "GitHub petermclagan/betfair-historical tests/sample_data",
    independenceClass: "MIRROR",
  },
];

export function lineageClusters(rows: readonly SourceLineage024[] = LINEAGE): {
  root: string;
  members: string[];
  independence: IndependenceClass024[];
}[] {
  const map = new Map<string, SourceLineage024[]>();
  for (const row of rows) {
    const list = map.get(row.lineageRoot) ?? [];
    list.push(row);
    map.set(row.lineageRoot, list);
  }
  return [...map.entries()].map(([root, members]) => ({
    root,
    members: members.map((m) => m.sourceId),
    independence: members.map((m) => m.independenceClass),
  }));
}

export function clusterCount(rows: readonly SourceLineage024[] = LINEAGE): number {
  return lineageClusters(rows).length;
}

/** GitHub + Kaggle copies of the same dataset must not increment the cluster count. */
export function duplicateDoesNotSplitCluster(input: {
  github: SourceLineage024;
  kaggle: SourceLineage024;
}): boolean {
  return (
    input.github.lineageRoot === input.kaggle.lineageRoot &&
    clusterCount([input.github, input.kaggle]) === 1
  );
}
