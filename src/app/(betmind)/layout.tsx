"use client";

import { AppShell } from "@/components/betmind/AppShell";
import { BetMindDataProvider, useBetMindData } from "@/components/betmind/DataProvider";
import type { ReactNode } from "react";

function ShellWithStatus({ children }: { children: ReactNode }) {
  const { strip } = useBetMindData();
  const runtime =
    strip.brain === "ONLINE" && strip.worker === "ONLINE"
      ? "ONLINE"
      : strip.brain === "OFFLINE" && strip.worker === "OFFLINE"
        ? "OFFLINE"
        : strip.brain === "ONLINE" || strip.worker === "ONLINE" || strip.brain === "DEGRADED"
          ? "DEGRADED"
          : "UNKNOWN";
  return (
    <AppShell
      webOnline={strip.webApp === "ONLINE"}
      runtimeState={runtime}
      engineState={strip.predictiveEngine}
      brainState={strip.brain}
    >
      {children}
    </AppShell>
  );
}

export default function BetMindGroupLayout({ children }: { children: ReactNode }) {
  return (
    <BetMindDataProvider pollMs={5000}>
      <ShellWithStatus>{children}</ShellWithStatus>
    </BetMindDataProvider>
  );
}
