/**
 * Evidence & Attribution Layer V1 — foundational types.
 *
 * Every future assessment must be temporally valid, attributable, and
 * evidence-backed. No naked probability. No invented source reliability.
 */

export type EvidenceCategory =
  | "statistical"
  | "market"
  | "historical"
  | "news"
  | "injury"
  | "lineup"
  | "weather"
  | "schedule"
  | "contextual"
  | "external_research";

/** Epistemic kind — never collapse these into one "confidence". */
export type EpistemicKind =
  | "FACT"
  | "QUANTITATIVE_EVIDENCE"
  | "INFERENCE"
  | "MODEL_JUDGMENT";

export type EvidencePolarity =
  | "SUPPORTS"
  | "CONTRADICTS"
  | "NEUTRAL"
  | "CONTEXT_ONLY";

export type TemporalPrecision =
  | "exact"
  | "date"
  | "dataset_window"
  | "unknown";

export type EvidenceStrength =
  | "weak"
  | "moderate"
  | "strong"
  | "insufficient";

export type EvidenceItem = {
  evidenceId: string;
  category: EvidenceCategory;
  epistemicKind: EpistemicKind;
  claim: string;
  entityRef: string | null;
  eventId: string;
  sourceId: string;
  sourceUrl: string | null;
  publishedAt: Date | null;
  availableAt: Date;
  observedAt: Date;
  temporalPrecision: TemporalPrecision;
  polarity: EvidencePolarity;
  /** Hypothesis this evidence relates to (e.g. HOME, OVER_2_5). */
  targetHypothesis: string;
  /** Estimated magnitude if quantified; null if not. */
  magnitude: number | null;
  /**
   * Strength of this specific claim — NOT source reliability.
   * null when unmeasured.
   */
  claimConfidence: number | null;
  /**
   * Source reliability — reserved. Always null until measured.
   * Never invent.
   */
  sourceReliability: null;
  confirmations: string[];
  rebuttals: string[];
};

export type EvidenceGraph = {
  eventId: string;
  asOf: Date;
  hypothesis: string;
  supporting: EvidenceItem[];
  contradicting: EvidenceItem[];
  contextual: EvidenceItem[];
  insufficient: string[];
};

export type AttributionCitation = {
  evidenceId: string;
  kind: "news" | "dataset" | "market" | "other";
  sourceId: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  availableAt: string;
  observedAt: string;
  claim: string;
  epistemicKind: EpistemicKind;
  polarity: EvidencePolarity;
  category: EvidenceCategory;
};

export type AssessmentReport = {
  eventId: string;
  asOf: Date;
  hypothesis: string;
  /** Model/quantification output — may be null when insufficient. */
  probability: number | null;
  evidenceStrength: EvidenceStrength;
  narrativeSummary: string;
  evidenceGraph: EvidenceGraph;
  attributions: AttributionCitation[];
  blockedByTemporal: EvidenceItem[];
};
