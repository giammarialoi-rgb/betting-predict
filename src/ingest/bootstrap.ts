import { registerProvider } from "@/ingest/registry";
import { ApiFootballProvider } from "@/providers/api-football/adapter";
import { FootballDataOrgProvider } from "@/providers/football-data-org/adapter";
import { MockSportsProvider } from "@/providers/mock/adapter";

export function bootstrapImplementedProviders(): void {
  registerProvider(new ApiFootballProvider());
  registerProvider(new FootballDataOrgProvider());
  registerProvider(new MockSportsProvider());
}
