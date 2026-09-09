/**
 * Polite request queue for Directa — never used to bypass rate limits.
 * Defaults are conservative; circuit opens after consecutive failures.
 */

export type DirectaQueueConfig054 = {
  min_interval_ms: number;
  max_concurrency: number;
  max_retries: number;
  timeout_ms: number;
};

export type DirectaQueueState054 = {
  consecutive_failures: number;
  circuit_open: boolean;
  last_request_at: number | null;
  in_flight: number;
};

export function createDirectaQueue054(cfg: DirectaQueueConfig054) {
  const state: DirectaQueueState054 = {
    consecutive_failures: 0,
    circuit_open: false,
    last_request_at: null,
    in_flight: 0,
  };

  async function waitTurn(): Promise<void> {
    while (state.in_flight >= cfg.max_concurrency) {
      await sleep(50);
    }
    if (state.last_request_at != null) {
      const elapsed = Date.now() - state.last_request_at;
      if (elapsed < cfg.min_interval_ms) {
        await sleep(cfg.min_interval_ms - elapsed);
      }
    }
  }

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (state.circuit_open) {
      throw new Error("DIRECTA_CIRCUIT_OPEN");
    }
    await waitTurn();
    state.in_flight += 1;
    state.last_request_at = Date.now();
    let attempt = 0;
    try {
      while (true) {
        attempt += 1;
        try {
          const result = await withTimeout(fn(), cfg.timeout_ms);
          state.consecutive_failures = 0;
          return result;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const retryable = /429|5\d\d|timeout|ECONNRESET/i.test(msg);
          if (!retryable || attempt > cfg.max_retries) {
            state.consecutive_failures += 1;
            if (state.consecutive_failures >= 5) state.circuit_open = true;
            throw e;
          }
          const backoff = Math.min(30_000, cfg.min_interval_ms * 2 ** (attempt - 1));
          await sleep(backoff);
        }
      }
    } finally {
      state.in_flight = Math.max(0, state.in_flight - 1);
    }
  }

  return {
    state,
    run,
    resetCircuit() {
      state.circuit_open = false;
      state.consecutive_failures = 0;
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout_${ms}`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
