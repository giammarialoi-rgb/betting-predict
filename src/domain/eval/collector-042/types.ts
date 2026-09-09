export type CollectorStatus042 =
  | "RUNNING"
  | "PAUSED_BUDGET"
  | "PAUSED_ERROR"
  | "PAUSED_NO_EVENTS"
  | "READY_TO_SETTLE"
  | "COMPLETED"
  | "STOPPED"
  | "STALE"
  | "NOT_RUNNING";

export type CreditState042 = {
  monthlyLimit: number;
  observedRemaining: number | null;
  observedUsed: number | null;
  observedLastCost: number | null;
  estimatedRemaining: number | null;
  estimatedUsed: number;
  requests: number;
  estimatedCredits: number;
  lastUpdatedAt: string;
  resetAt: string;
  status: CollectorStatus042;
  safeRemaining: number;
  maxCreditsPerRun: number;
  sourceOfTruth: "provider_headers" | "local_estimate" | "mixed";
};

export type BudgetBlock042 = {
  monthlyLimit: number;
  used: number | null;
  remaining: number | null;
  estimatedRemaining: number | null;
  safeRemaining: number;
  maxCreditsPerRun: number;
  sourceOfTruth: CreditState042["sourceOfTruth"];
};

export type CollectorHeartbeat042 = {
  status: CollectorStatus042;
  pid: number | null;
  startedAt: string | null;
  lastPullAt: string | null;
  nextPullAt: string | null;
  eventsDiscovered: number;
  quoteObservations: number;
  lockedDecisions: number;
  settledEvents: number;
  remainingTo100: number;
  apiKeyConfigured: boolean;
  providerStatus: string;
  budget: BudgetBlock042;
  lastError: string | null;
  pausedReason: string | null;
  backoffMs: number;
  mode: "SETTLE_ONLY" | "DISCOVERY" | "MIXED" | "IDLE";
  updatedAt: string;
  heartbeatAt: string;
};

export type CreditHeaders042 = {
  remaining: number | null;
  used: number | null;
  last: number | null;
};

export type CyclePlan042 = {
  runDiscovery: boolean;
  runScores: boolean;
  scoreSports: string[];
  estimatedCredits: number;
  reason: string;
};
