import type { SportsDataProvider } from "@/providers/types";

const providers = new Map<string, SportsDataProvider>();

export function registerProvider(provider: SportsDataProvider): void {
  providers.set(provider.id, provider);
}

export function getProvider(id: string): SportsDataProvider {
  const provider = providers.get(id);
  if (!provider) {
    throw new Error(`Unknown provider: ${id}`);
  }
  return provider;
}

export function listProviders(): SportsDataProvider[] {
  return [...providers.values()];
}

export function resetRegistry(): void {
  providers.clear();
}
