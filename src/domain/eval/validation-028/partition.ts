import type { Exp028Config, Partition028 } from "@/domain/eval/validation-028/types";

export function corpusPartition(kickoffIso: string, cfg: Exp028Config): Partition028 {
  const t = Date.parse(kickoffIso);
  const order: Partition028[] = ["TRAIN", "VALIDATION", "TEST", "HOLDOUT"];
  for (const p of order) {
    const w = cfg.corpus_partitions[p];
    const a = Date.parse(w.start);
    const b = Date.parse(w.end);
    if (t >= a && t <= b) return p;
  }
  if (t < Date.parse(cfg.corpus_partitions.TRAIN.start)) return "TRAIN";
  return "HOLDOUT";
}

export function projectCalendarPartition(
  year: number,
  cfg: Exp028Config,
): Partition028 | "OUTSIDE" {
  if (cfg.project_calendar_holdout_years.includes(year)) return "HOLDOUT";
  if (cfg.project_calendar_test_years.includes(year)) return "TEST";
  if (cfg.project_calendar_val_years.includes(year)) return "VALIDATION";
  if (cfg.project_calendar_train_years.includes(year)) return "TRAIN";
  return "OUTSIDE";
}

export function partitionCounts(
  kickoffs: readonly string[],
  cfg: Exp028Config,
): Record<Partition028, number> {
  const out: Record<Partition028, number> = {
    TRAIN: 0,
    VALIDATION: 0,
    TEST: 0,
    HOLDOUT: 0,
  };
  for (const k of kickoffs) out[corpusPartition(k, cfg)] += 1;
  return out;
}
