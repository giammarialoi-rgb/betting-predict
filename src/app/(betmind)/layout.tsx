"use client";

import { AppShell } from "@/components/betmind/AppShell";
import { BetMindDataProvider, useBetMindData } from "@/components/betmind/DataProvider";
import type { ReactNode } from "react";

function ShellWithStatus({ children }: { children: ReactNode }) {
  const { strip } = useBetMindData();
  return (
    <AppShell webOnline={true} brainState={strip.brain}>
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
