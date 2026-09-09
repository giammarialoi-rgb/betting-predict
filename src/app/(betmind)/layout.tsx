"use client";

import { AppShell } from "@/components/betmind/AppShell";
import type { ReactNode } from "react";

export default function BetMindGroupLayout({ children }: { children: ReactNode }) {
  return <AppShell systemOnline={null}>{children}</AppShell>;
}
