/**
 * Aggregate data-quality report for an evaluation run.
 */

export type EvaluationDataQualityReport = {
  eventsTotal: number;
  eventsEvaluated: number;
  eventsRejected: number;
  featuresAvailable: number;
  featuresMissing: number;
  featuresForbidden: number;
  marketsAvailable: number;
  marketsRejected: number;
  temporalViolations: number;
  entityResolutionFailures: number;
};

export function emptyDataQualityReport(
  eventsTotal = 0,
): EvaluationDataQualityReport {
  return {
    eventsTotal,
    eventsEvaluated: 0,
    eventsRejected: 0,
    featuresAvailable: 0,
    featuresMissing: 0,
    featuresForbidden: 0,
    marketsAvailable: 0,
    marketsRejected: 0,
    temporalViolations: 0,
    entityResolutionFailures: 0,
  };
}

export function mergeSampleQuality(
  report: EvaluationDataQualityReport,
  sample: {
    dataQuality: EvaluationDataQualityReport;
  },
  rejected = false,
): EvaluationDataQualityReport {
  const q = sample.dataQuality;
  return {
    eventsTotal: report.eventsTotal || q.eventsTotal,
    eventsEvaluated: report.eventsEvaluated + (rejected ? 0 : 1),
    eventsRejected: report.eventsRejected + (rejected ? 1 : 0),
    featuresAvailable: report.featuresAvailable + q.featuresAvailable,
    featuresMissing: report.featuresMissing + q.featuresMissing,
    featuresForbidden: report.featuresForbidden + q.featuresForbidden,
    marketsAvailable: report.marketsAvailable + q.marketsAvailable,
    marketsRejected: report.marketsRejected + q.marketsRejected,
    temporalViolations: report.temporalViolations + q.temporalViolations,
    entityResolutionFailures:
      report.entityResolutionFailures + q.entityResolutionFailures,
  };
}
