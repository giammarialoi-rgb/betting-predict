"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { StatusDot, type BmState } from "@/components/betmind/ui";
import { useBmLocale } from "@/components/betmind/useBmLocale";
import { statusWordIt } from "@/domain/eval/betmind-runtime/status-copy";

function navActive(pathname: string, href: string): boolean {
  const base = href.split("?")[0]!;
  if (base === "/") return pathname === "/";
  if (base === "/learn") return pathname === "/learn" || pathname.startsWith("/learning");
  return pathname === base || pathname.startsWith(base + "/");
}

export function AppShell({
  children,
  webOnline = true,
  runtimeState = "UNKNOWN",
  engineState = "UNKNOWN",
  brainState = "UNKNOWN",
}: {
  children: ReactNode;
  webOnline?: boolean;
  runtimeState?: BmState;
  engineState?: BmState;
  brainState?: BmState;
}) {
  void brainState;
  const pathname = usePathname() ?? "/";
  const { t, locale, setLocale } = useBmLocale();

  const DESKTOP_NAV = [
    { href: "/", label: t.nav_home },
    { href: "/events", label: t.nav_events },
    { href: "/live", label: t.nav_live },
    { href: "/learn", label: t.nav_learn },
    { href: "/sources", label: t.nav_sources },
    { href: "/models", label: t.nav_models },
    { href: "/bankroll", label: t.nav_bankroll },
    { href: "/settings", label: t.nav_settings },
    { href: "/research", label: t.nav_research },
  ] as const;

  const MOBILE_NAV = [
    { href: "/", label: t.nav_home, icon: "⌂" },
    { href: "/events", label: t.nav_events, icon: "◎" },
    { href: "/live", label: t.nav_live, icon: "◉" },
    { href: "/sources", label: t.nav_sources, icon: "▦" },
    { href: "/settings", label: t.nav_settings, icon: "☰" },
  ] as const;

  return (
    <div className="bm-root" lang={locale}>
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
            <div className="text-[11px] tracking-wide text-[var(--bm-muted)]">
              {t.control_center}
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
              <span className="bm-muted">{t.web_app}</span>
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <StatusDot state={webOnline ? "ONLINE" : "OFFLINE"} />
                {webOnline ? "Online" : "Offline"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="bm-muted">{t.runtime}</span>
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <StatusDot state={runtimeState} />
                {statusWordIt(runtimeState)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="bm-muted">{t.engine}</span>
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <StatusDot state={engineState} />
                {statusWordIt(engineState)}
              </span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                className={`bm-pill ${locale === "it" ? "bm-pill-accent" : ""}`}
                onClick={() => setLocale("it")}
              >
                IT
              </button>
              <button
                type="button"
                className={`bm-pill ${locale === "en" ? "bm-pill-accent" : ""}`}
                onClick={() => setLocale("en")}
              >
                EN
              </button>
            </div>
            <p className="bm-muted pt-1">{t.paper_only}</p>
          </div>
        </div>
      </aside>

      <div className="bm-shell">
        <header
          className="bm-header flex items-center justify-between gap-3 border-b border-[var(--bm-border)] bg-[#0a0a0a] px-4 py-3 lg:bg-[rgba(10,10,10,0.94)] lg:px-6 lg:backdrop-blur"
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
            {t.brand_tagline}
          </div>
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <span className="hidden sm:inline-flex">
              <span className="bm-pill">
                <StatusDot state={webOnline ? "ONLINE" : "OFFLINE"} />
                App web {webOnline ? "online" : "offline"}
              </span>
            </span>
            <span
              className={`bm-pill ${
                runtimeState === "ONLINE"
                  ? "bm-pill-accent"
                  : runtimeState === "OFFLINE"
                    ? "bm-pill-danger"
                    : "bm-pill-warn"
              }`}
            >
              <StatusDot state={runtimeState} />
              {t.runtime} {statusWordIt(runtimeState)}
            </span>
            <span className="hidden md:inline-flex">
              <span
                className={`bm-pill ${
                  engineState === "ONLINE"
                    ? "bm-pill-accent"
                    : engineState === "OFFLINE"
                      ? "bm-pill-danger"
                      : "bm-pill-warn"
                }`}
              >
                <StatusDot state={engineState} />
                {t.engine} {statusWordIt(engineState)}
              </span>
            </span>
          </div>
        </header>

        <main className="bm-main px-4 py-4 lg:px-6 lg:pb-6">
          {children}
        </main>

        <nav
          className="bm-tabbar flex border-t border-[var(--bm-border)] bg-[#0a0a0a] lg:hidden"
          style={{ paddingBottom: "var(--bm-safe-bottom)" }}
          aria-label="Navigazione"
        >
          {MOBILE_NAV.map((item) => {
            const active = navActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[var(--bm-nav-h)] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-tight ${
                  active ? "text-[var(--bm-accent)]" : "text-[var(--bm-muted)]"
                }`}
              >
                <span className="text-base leading-none" aria-hidden>
                  {item.icon}
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
