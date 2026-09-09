import { AS_OF_WINDOWS } from "@/domain/eval/temporal-023/types";
import type { TtkRow025 } from "@/domain/eval/turnaround-025/ttk";
import type { WindowAvailability026 } from "@/domain/eval/bottleneck-026/types";

const EMPTY: Omit<WindowAvailability026, "eventId"> = {
  "T-72h": false,
  "T-48h": false,
  "T-24h": false,
  "T-12h": false,
  "T-6h": false,
  "T-3h": false,
  "T-1h": false,
  "T-30m": false,
  "T-15m": false,
  "T-5m": false,
  "T-1m": false,
};

export function windowsFromTtk(eventId: string, ttk: readonly TtkRow025[]): WindowAvailability026 {
  const row: WindowAvailability026 = { eventId, ...EMPTY };
  for (const t of ttk) {
    if (t.bucket in row) {
      row[t.bucket as keyof Omit<WindowAvailability026, "eventId">] = t.observed;
    }
  }
  return row;
}

export function emptyWindows(eventId: string): WindowAvailability026 {
  return { eventId, ...EMPTY };
}

export function windowIds(): readonly string[] {
  return AS_OF_WINDOWS.map((w) => `T-${w.window}`);
}
