/**
 * Append-only bankroll ledger with reconciliation invariants.
 */

import { BankrollAccountingError } from "@/domain/eval/bankroll/leakage";

export type BankrollLedgerEntry = {
  decisionId: string;
  experimentId: string;
  year: number;
  eventId: string;
  market: string;
  selection: string;
  policy: string;
  bankrollBefore: number;
  stake: number;
  odds: number;
  lockedAt: string;
  outcomeRevealAt: string | null;
  won: boolean | null;
  voided: boolean;
  pnl: number | null;
  bankrollAfter: number | null;
  probability: number;
  edge: number | null;
  asOf: string;
  oddsAvailableAt: string;
};

export class BankrollLedger {
  readonly entries: BankrollLedgerEntry[] = [];

  append(entry: BankrollLedgerEntry): void {
    this.entries.push(entry);
  }

  settle(input: {
    decisionId: string;
    won: boolean;
    voided?: boolean;
    outcomeRevealAt: string;
  }): BankrollLedgerEntry {
    const e = this.entries.find((x) => x.decisionId === input.decisionId);
    if (!e) throw new BankrollAccountingError(`Unknown decision ${input.decisionId}`);
    if (e.pnl !== null) {
      throw new BankrollAccountingError(`Already settled ${input.decisionId}`);
    }
    e.outcomeRevealAt = input.outcomeRevealAt;
    e.won = input.voided ? null : input.won;
    e.voided = input.voided ?? false;
    if (e.voided) {
      e.pnl = 0;
    } else if (input.won) {
      e.pnl = e.stake * (e.odds - 1);
    } else {
      e.pnl = -e.stake;
    }
    e.bankrollAfter = e.bankrollBefore + e.pnl;
    this.assertEntryInvariant(e);
    return e;
  }

  assertEntryInvariant(e: BankrollLedgerEntry): void {
    if (e.pnl === null || e.bankrollAfter === null) return;
    const expected = e.bankrollBefore + e.pnl;
    if (Math.abs(expected - e.bankrollAfter) > 1e-9) {
      throw new BankrollAccountingError(
        `Invariant fail ${e.decisionId}: after=${e.bankrollAfter} != before+pnl=${expected}`,
      );
    }
  }

  reconcileYear(year: number, initialBankroll: number, policy: string): {
    finalBankroll: number;
    sumPnl: number;
  } {
    const rows = this.entries.filter(
      (e) => e.year === year && e.policy === policy && e.pnl !== null,
    );
    const sumPnl = rows.reduce((a, e) => a + (e.pnl ?? 0), 0);
    const finalBankroll = initialBankroll + sumPnl;
    const last = rows[rows.length - 1];
    if (last?.bankrollAfter != null) {
      if (Math.abs(last.bankrollAfter - finalBankroll) > 1e-6) {
        throw new BankrollAccountingError(
          `Year ${year} ${policy}: last.after=${last.bankrollAfter} != initial+Σpnl=${finalBankroll}`,
        );
      }
    }
    return { finalBankroll, sumPnl };
  }
}
