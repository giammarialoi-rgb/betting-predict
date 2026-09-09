import { createHash } from "node:crypto";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { freezeStrict027 } from "@/domain/eval/validation-028/freeze";
import { fromStrict027, unionCanonical } from "@/domain/eval/breakthrough-031/canonical";
import { FROZEN_028_SHA256_031 } from "@/domain/eval/breakthrough-031/types";
import type { CanonicalEvent031 } from "@/domain/eval/breakthrough-031/types";

export function freezeDataset031Base(input: { skipHeavy: boolean }): {
  fixture: boolean;
  sha256: string;
  bytes: number;
  events: CanonicalEvent031[];
  period_start: string | null;
  period_end: string | null;
} {
  const { freeze, events } = freezeStrict027({ skipHeavy: input.skipHeavy });
  if (!input.skipHeavy && !freeze.fixture && freeze.sha256 !== FROZEN_028_SHA256_031) {
    throw new ExperimentIntegrityError(`DATASET_031_BASE SHA mismatch ${freeze.sha256}`);
  }
  const canonical = events.map(fromStrict027);
  return {
    fixture: freeze.fixture,
    sha256: freeze.sha256,
    bytes: freeze.bytes,
    events: canonical,
    period_start: freeze.period_start,
    period_end: freeze.period_end,
  };
}

export function freezeUnion031(input: {
  base: CanonicalEvent031[];
  added: CanonicalEvent031[];
  baseSha: string;
}): { events: CanonicalEvent031[]; fingerprint: string; added_kept: number } {
  const events = unionCanonical(input.base, input.added);
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        base: input.baseSha,
        added: input.added.map((e) => e.event_id).sort(),
        n: events.length,
      }),
    )
    .digest("hex");
  return { events, fingerprint, added_kept: events.length - input.base.length };
}
