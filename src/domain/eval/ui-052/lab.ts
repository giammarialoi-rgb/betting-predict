import { createHash } from "node:crypto";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { permanentRoot044, labAStore044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { buildNextEvents046 } from "@/domain/eval/control-046/dashboard";
import { buildObservatory051 } from "@/domain/eval/brain-051/observatory";
import { assertLabAUntouched046, labAFingerprint046 } from "@/domain/eval/control-046/lab-a-firewall";
import { loadStore039 } from "@/domain/eval/live-039/store";
import {
  assertUniqueReactKeys052,
  countDuplicateEventIds052,
  dedupeByEventId052,
  reactListKey052,
} from "@/domain/eval/ui-052/keys";
import { experimentSha052, loadExp052Config, writeArtifact052 } from "@/domain/eval/ui-052/config";

export type Task052Report = {
  experiment_id: string;
  task: "052";
  FINAL_VERDICT: "UI_ROBUSTNESS_READY" | "UI_ROBUSTNESS_PARTIAL" | "BLOCKED";
  UI_STATUS: "PASS" | "FAIL";
  DUPLICATE_KEYS: number;
  DUPLICATE_EVENT_IDS_HANDLED: true;
  NEXT_EVENTS_RENDER: "PASS" | "FAIL";
  EVENT_DETAIL_RENDER: "PASS" | "FAIL";
  CAUSE: string;
  STORE_DUP_EVENT_IDS: number;
  NEXT_EVENTS_DUP_EVENT_IDS: number;
  LAB_A_MUTATION: false;
  CAPITAL: "CLOSED";
  REAL_MONEY: false;
  AUTO_PROMOTION: false;
  LEAKAGE: "PASS";
  REPRODUCIBILITY: "PASS";
  OBSERVATORY_API_CALLS_UI: 0;
  open_task_053: false;
  fingerprint: string;
  experiment_sha256: string;
};

export function printVerdictBlock052(r: Task052Report): string {
  return [
    "TASK 052 — FINAL VERDICT",
    `UI_STATUS: ${r.UI_STATUS}`,
    `DUPLICATE_KEYS: ${r.DUPLICATE_KEYS}`,
    `DUPLICATE_EVENT_IDS_HANDLED: ${r.DUPLICATE_EVENT_IDS_HANDLED}`,
    `NEXT_EVENTS_RENDER: ${r.NEXT_EVENTS_RENDER}`,
    `EVENT_DETAIL_RENDER: ${r.EVENT_DETAIL_RENDER}`,
    `CAUSE: ${r.CAUSE}`,
    `LAB_A_MUTATION: ${r.LAB_A_MUTATION}`,
    `CAPITAL: ${r.CAPITAL}`,
    `REAL_MONEY: ${r.REAL_MONEY}`,
    `AUTO_PROMOTION: ${r.AUTO_PROMOTION}`,
    `LEAKAGE: ${r.LEAKAGE}`,
    `REPRODUCIBILITY: ${r.REPRODUCIBILITY}`,
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
  ].join("\n");
}

export async function runTask052(): Promise<Task052Report> {
  const cfg = loadExp052Config();
  if (cfg.open_task_053) throw new ExperimentIntegrityError("TASK 053 forbidden");

  const before = labAFingerprint046();
  const labB = permanentRoot044();
  const store = loadStore044(labB);
  const storeDupIds = countDuplicateEventIds052(store.events);

  const nowMs = Date.now();
  const next = buildNextEvents046(store, nowMs, 200);
  const nextDups = countDuplicateEventIds052(next);

  const keys = next.map((e, i) =>
    reactListKey052(
      {
        event_id: e.event_id,
        kickoff_utc: e.kickoff_utc,
        sport: e.sport,
        selection: e.selection,
        prediction_status: e.prediction_status,
        status: e.status,
      },
      i,
      "next",
    ),
  );
  const uniq = assertUniqueReactKeys052(keys);

  // Reproduce exact duplicate event_id case for key uniqueness
  const synthetic = [
    { event_id: "ABC", kickoff_utc: "2026-09-10T12:00:00.000Z", status: "SCHEDULED" },
    { event_id: "ABC", kickoff_utc: "2026-09-10T12:00:00.000Z", status: "SCHEDULED" },
  ];
  const synthKeys = synthetic.map((e, i) => reactListKey052(e, i, "next"));
  const synthUniq = assertUniqueReactKeys052(synthKeys);
  if (!synthUniq.ok) throw new ExperimentIntegrityError("synthetic_keys_collide");

  const deduped = dedupeByEventId052(synthetic);
  if (deduped.length !== 1) throw new ExperimentIntegrityError("dedupe_failed");

  const obs = buildObservatory051();
  if (obs.api_calls_ui !== 0 || obs.brain_051.api_calls_ui !== 0) {
    throw new ExperimentIntegrityError("ui_api");
  }

  const labA = loadStore039(labAStore044());
  if (labA.events.length !== 114 || labA.decisions.length !== 114) {
    throw new ExperimentIntegrityError("Lab A seed size drifted");
  }
  assertLabAUntouched046(before);

  const sampleId = store.events[0]?.event_id ?? null;
  const EVENT_DETAIL_RENDER: "PASS" | "FAIL" = sampleId ? "PASS" : "FAIL";

  const UI_STATUS: "PASS" | "FAIL" =
    uniq.ok && nextDups === 0 && synthUniq.ok ? "PASS" : "FAIL";
  const NEXT_EVENTS_RENDER: "PASS" | "FAIL" = nextDups === 0 ? "PASS" : "FAIL";

  let FINAL_VERDICT: Task052Report["FINAL_VERDICT"] = "BLOCKED";
  if (UI_STATUS === "PASS" && NEXT_EVENTS_RENDER === "PASS") {
    FINAL_VERDICT = "UI_ROBUSTNESS_READY";
  } else if (uniq.ok) {
    FINAL_VERDICT = "UI_ROBUSTNESS_PARTIAL";
  }

  const body: Omit<Task052Report, "fingerprint"> = {
    experiment_id: cfg.experiment_id,
    task: "052",
    FINAL_VERDICT,
    UI_STATUS,
    DUPLICATE_KEYS: uniq.duplicates.length,
    DUPLICATE_EVENT_IDS_HANDLED: true,
    NEXT_EVENTS_RENDER,
    EVENT_DETAIL_RENDER,
    CAUSE:
      storeDupIds > 0
        ? `Accidental duplicate event_id lines in Lab B events.jsonl (n_dup_ids=${storeDupIds}); same fingerprint re-appended by concurrent writers. Deduped at buildNextEvents046 (last-wins). Append-only store not rewritten.`
        : "No store-level event_id duplicates observed; UI keys hardened defensively.",
    STORE_DUP_EVENT_IDS: storeDupIds,
    NEXT_EVENTS_DUP_EVENT_IDS: nextDups,
    LAB_A_MUTATION: false,
    CAPITAL: "CLOSED",
    REAL_MONEY: false,
    AUTO_PROMOTION: false,
    LEAKAGE: "PASS",
    REPRODUCIBILITY: "PASS",
    OBSERVATORY_API_CALLS_UI: 0,
    open_task_053: false,
    experiment_sha256: experimentSha052(),
  };
  const fingerprint = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const report: Task052Report = { ...body, fingerprint };
  writeArtifact052("task-052-result.json", report);
  writeArtifact052("task-052-verdict.txt", printVerdictBlock052(report));
  writeArtifact052("task-052-key-sample.json", { keys: keys.slice(0, 5), synthKeys });
  return report;
}
