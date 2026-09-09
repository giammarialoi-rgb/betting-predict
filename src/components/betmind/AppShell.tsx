"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { StatusDot, type BmState } from "@/components/betmind/ui";

const DESKTOP_NAV = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/live", label: "Live" },
  { href: "/learn", label: "Learn" },
  { href: "/sources", label: "Sources" },
  { href: "/models", label: "Models" },
  { href: "/bankroll", label: "Bankroll" },
  { href: "/settings", label: "More" },
  { href: "/research", label: "Research" },
] as const;

const MOBILE_NAV = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/events", label: "Events", icon: "◎" },
  { href: "/live", label: "Live", icon: "◉" },
  { href: "/sources", label: "Sources", icon: "▦" },
  { href: "/settings", label: "More", icon: "☰" },
] as const;

function navActive(pathname: string, href: string): boolean {
  const base = href.split("?")[0]!;
  if (base === "/") return pathname === "/";
  if (base === "/learn") return pathname === "/learn" || pathname.startsWith("/learning");
  return pathname === base || pathname.startsWith(base + "/");
}

export function AppShell({
  children,
  webOnline = true,
  brainState = "UNKNOWN",
}: {
  children: ReactNode;
  /** Web app reachable — always true when shell renders client-side. */
  webOnline?: boolean;
  /** Honest Brain/predictive status — never faked ONLINE. */
  brainState?: BmState;
}) {
  const pathname = usePathname() ?? "/";
  const brainOnline = brainState === "ONLINE";

  return (
    <div className="bm-root flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--bm-border)] bg-[var(--bm-surface-2)] lg:flex">
        <div
          className="flex items-center gap-3 border-b border-[var(--bm-border)] px-4 py-4"
          style={{ paddingTop: "calc(1rem + var(--bm-safe-top))" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.jpg" alt="BetMind" className="h-10 w-10 rounded-xl object-cover" />
          <div>
            <div className="text-base font-bold tracking-tight">
              Bet<span className="bm-accent">Mind</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--bm-muted)]">
              Control Center
            </div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {DESKTOP_NAV.map((item) => {
            const active = navActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-[rgba(29,185,84,0.12)] text-[var(--bm-accent)]"
                    : "text-[var(--bm-muted)] hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--bm-border)] p-3">
          <div className="bm-card space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="bm-muted">Web app</span>
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <StatusDot state={webOnline ? "ONLINE" : "OFFLINE"} />
                {webOnline ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="bm-muted">Brain</span>
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <StatusDot state={brainState} />
                {brainState}
              </span>
            </div>
            <p className="bm-muted pt-1">Paper · REAL_MONEY=false</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--bm-border)] bg-[rgba(10,10,10,0.94)] px-4 py-3 backdrop-blur lg:px-6"
          style={{ paddingTop: "calc(0.75rem + var(--bm-safe-top))" }}
        >
          <div className="flex min-w-0 items-center gap-3 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.jpg" alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
            <span className="truncate font-bold">
              Bet<span className="bm-accent">Mind</span>
            </span>
          </div>
          <div className="hidden text-sm tracking-[0.12em] text-[var(--bm-muted)] lg:block">
            ANALYZE · LEARN · WIN
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="bm-pill hidden sm:inline-flex">
              <StatusDot state={webOnline ? "ONLINE" : "OFFLINE"} />
              WEB {webOnline ? "ONLINE" : "OFFLINE"}
            </span>
            <span
              className={`bm-pill ${
                brainOnline ? "bm-pill-accent" : brainState === "OFFLINE" ? "bm-pill-danger" : "bm-pill-warn"
              }`}
            >
              <StatusDot state={brainState} />
              BRAIN {brainState}
            </span>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 pb-[calc(var(--bm-nav-h)+var(--bm-safe-bottom)+1rem)] lg:px-6 lg:pb-6">
          {children}
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--bm-border)] bg-[rgba(10,10,10,0.96)] backdrop-blur lg:hidden"
          style={{ paddingBottom: "var(--bm-safe-bottom)" }}
          aria-label="Mobile"
        >
          {MOBILE_NAV.map((item) => {
            const active = navActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[var(--bm-nav-h)] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] ${
                  active ? "text-[var(--bm-accent)]" : "text-[var(--bm-muted)]"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
