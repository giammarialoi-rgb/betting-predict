"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import {
  useBetMindSnapshot,
  type BetMindSnapshot,
  type BetMindHealth,
  type DataSourcesPayload,
  type CoveragePayload,
  type SystemStrip,
} from "@/components/betmind/useSnapshot";

type Ctx = {
  data: BetMindSnapshot | null;
  health: BetMindHealth | null;
  sources: DataSourcesPayload | null;
  coverage: CoveragePayload | null;
  strip: SystemStrip;
  error: string | null;
  updating: boolean;
  lastUpdate: string | null;
  reload: () => Promise<void>;
};

const BetMindDataCtx = createContext<Ctx | null>(null);

export function BetMindDataProvider({
  children,
  pollMs = 5000,
}: {
  children: ReactNode;
  pollMs?: number;
}) {
  const value = useBetMindSnapshot(pollMs);
  return <BetMindDataCtx.Provider value={value}>{children}</BetMindDataCtx.Provider>;
}

export function useBetMindData(): Ctx {
  const ctx = useContext(BetMindDataCtx);
  if (!ctx) {
    throw new Error("useBetMindData must be used within BetMindDataProvider");
  }
  return ctx;
}
