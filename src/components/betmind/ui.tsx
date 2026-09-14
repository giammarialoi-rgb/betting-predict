import type { ReactNode } from "react";

export type BmState = "ONLINE" | "OFFLINE" | "DEGRADED" | "UNKNOWN";

export function normalizeState(raw: unknown): BmState {
  const s = String(raw ?? "UNKNOWN").toUpperCase();
  if (s === "ONLINE" || s === "OK" || s === "ACTIVE" || s === "HEALTHY") return "ONLINE";
  if (s === "OFFLINE" || s === "DOWN" || s === "DEAD" || s === "STOPPED") return "OFFLINE";
  if (s === "DEGRADED" || s === "PAUSED" || s === "RECOVER") return "DEGRADED";
  return "UNKNOWN";
}

export function stateFromBool(v: boolean | null | undefined): BmState {
  if (v === true) return "ONLINE";
  if (v === false) return "OFFLINE";
  return "UNKNOWN";
}

export function Card({
  children,
  className = "",
  glow = false,
  title,
  right,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  title?: string;
  right?: ReactNode;
}) {
  return (
    <section className={`bm-card ${glow ? "bm-card-glow" : ""} ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-start justify-between gap-2">
          {title ? <h2 className="bm-card-title">{title}</h2> : (
            <span />
          )}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Pill({
  children,
  accent = false,
  tone,
}: {
  children: ReactNode;
  accent?: boolean;
  tone?: "accent" | "danger" | "warn" | "neutral";
}) {
  const t = tone ?? (accent ? "accent" : "neutral");
  const cls =
    t === "accent"
      ? "bm-pill-accent"
      : t === "danger"
        ? "bm-pill-danger"
        : t === "warn"
          ? "bm-pill-warn"
          : "";
  return <span className={`bm-pill ${cls}`}>{children}</span>;
}

export function StatusDot({ state }: { state: BmState | "online" | "down" | "degraded" | "unknown" }) {
  const n =
    state === "online" || state === "ONLINE"
      ? "ONLINE"
      : state === "down" || state === "OFFLINE"
        ? "OFFLINE"
        : state === "degraded" || state === "DEGRADED"
          ? "DEGRADED"
          : "UNKNOWN";
  const cls =
    n === "ONLINE"
      ? "bm-dot-online"
      : n === "OFFLINE"
        ? "bm-dot-down"
        : n === "DEGRADED"
          ? "bm-dot-degraded"
          : "";
  return <span className={`bm-dot ${cls}`} title={n} />;
}

export function StatusPill({ state, label }: { state: BmState; label?: string }) {
  const tone =
    state === "ONLINE" ? "accent" : state === "OFFLINE" ? "danger" : state === "DEGRADED" ? "warn" : "neutral";
  return (
    <Pill tone={tone}>
      <StatusDot state={state} />
      {label ?? state}
    </Pill>
  );
}

export function Unknown({ label = "UNKNOWN" }: { label?: string }) {
  return <span className="bm-muted text-xs font-medium tracking-wide">{label}</span>;
}

/** Indicatore di polling UI — non implica Brain/predittivo LIVE. */
export function SnapshotBadge({ updating }: { updating?: boolean }) {
  return (
    <Pill>
      <StatusDot state="ONLINE" />
      {updating ? "Aggiorno" : "App web online"}
    </Pill>
  );
}

/** @deprecated use SnapshotBadge — kept alias to avoid silent LIVE implication */
export function LiveBadge({ updating }: { updating?: boolean }) {
  return <SnapshotBadge updating={updating} />;
}

export function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="bm-metric">
      <div className="bm-metric-label">{label}</div>
      <div className={`bm-metric-value ${accent ? "bm-accent" : ""}`}>{value}</div>
    </div>
  );
}

export function EmptyState({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="bm-empty">
      <h3>{title}</h3>
      <p>{reason}</p>
    </div>
  );
}

export function fmtN(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

export function fmtPct(v: number | null | undefined, alreadyPct = false): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const x = alreadyPct ? v : v * 100;
  return `${x.toFixed(1)}%`;
}

export function fmtMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `€ ${v.toFixed(2)}`;
}

export function fmtKick(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

export function sportBucket(sport: string | null | undefined): string {
  const s = String(sport ?? "").toLowerCase();
  if (!s) return "UNKNOWN";
  if (s.includes("soccer") || s.includes("football") || s === "soccer_epl") return "FOOTBALL";
  if (s.includes("tennis")) return "TENNIS";
  if (s.includes("basket")) return "BASKETBALL";
  if (s.includes("hockey") || s.includes("ice")) return "HOCKEY";
  if (s.includes("volley")) return "VOLLEYBALL";
  return s.toUpperCase();
}

export function edgeLabel(status: unknown, edge: unknown): string {
  const st = String(status ?? "UNKNOWN").toUpperCase();
  if (st === "UNKNOWN" || edge == null || !Number.isFinite(Number(edge))) return "SCONOSCIUTO";
  return fmtN(Number(edge), 3);
}

/** Map health.components.* strings to BmState. */
export function componentState(raw: unknown): BmState {
  return normalizeState(raw);
}
