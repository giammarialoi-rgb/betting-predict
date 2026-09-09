export function computeTemporalFields(input: {
  fetchedAt: Date;
  ingestedAt: Date;
  sourcePublishedAt: Date | null;
}): {
  observedAt: Date;
  ingestedAt: Date;
  availableAt: Date;
} {
  const observedAt = input.sourcePublishedAt ?? input.fetchedAt;
  const availableAt = input.sourcePublishedAt ?? input.ingestedAt;
  return {
    observedAt,
    ingestedAt: input.ingestedAt,
    availableAt,
  };
}
