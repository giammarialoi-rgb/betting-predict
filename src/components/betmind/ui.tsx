import type { ReactNode } from "react";

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
        <div className="mb-3 flex items-center justify-between gap-2">
          {title ? <h2 className="text-sm font-semibold tracking-wide">{title}</h2> : <span />}
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
}: {
  children: ReactNode;
  accent?: boolean;
}) {
  return <span className={`bm-pill ${accent ? "bm-pill-accent" : ""}`}>{children}</span>;
}

export function StatusDot({
  state,
}: {
  state: "online" | "down" | "degraded" | "unknown";
}) {
  const cls =
    state === "online"
      ? "bm-dot-online"
      : state === "down"
        ? "bm-dot-down"
        : state === "degraded"
          ? "bm-dot-degraded"
          : "";
  return <span className={`bm-dot ${cls}`} />;
}

export function Unknown({ label = "UNKNOWN" }: { label?: string }) {
  return <span className="bm-muted text-xs font-medium tracking-wide">{label}</span>;
}

export function LiveBadge({ updating }: { updating?: boolean }) {
  return (
    <Pill accent>
      <StatusDot state="online" />
      {updating ? "UPDATING" : "LIVE"}
    </Pill>
  );
}

export function Metric({ label, value, accent = false }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className="bm-metric">
      <div className="bm-metric-label">{label}</div>
      <div className={`bm-metric-value ${accent ? "bm-accent" : ""}`}>{value}</div>
    </div>
  );
}

export function fmtN(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "N/A";
  return v.toFixed(digits);
}

export function fmtPct(v: number | null | undefined, alreadyPct = false): string {
  if (v == null || !Number.isFinite(v)) return "N/A";
  const x = alreadyPct ? v : v * 100;
  return `${x.toFixed(1)}%`;
}

export function fmtMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "N/A";
  return `€ ${v.toFixed(2)}`;
}

export function fmtKick(iso: string | null | undefined): string {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
  if (st === "UNKNOWN" || edge == null || !Number.isFinite(Number(edge))) return "EDGE UNKNOWN";
  return fmtN(Number(edge), 3);
}
