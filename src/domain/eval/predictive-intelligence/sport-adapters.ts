import type { PiSport } from "@/domain/eval/predictive-intelligence/types";

export type PiSportAdapterStatus = {
  sport: PiSport;
  status: "ACTIVE" | "INSUFFICIENT_DATA";
  reason: string;
};

/** Contract only — SOCCER may be ACTIVE after validated dataset; others never invent data. */
export function sportAdapterStatuses(soccerDatasetRows: number): PiSportAdapterStatus[] {
  const soccerOk = soccerDatasetRows >= 500;
  return [
    {
      sport: "SOCCER",
      status: soccerOk ? "ACTIVE" : "INSUFFICIENT_DATA",
      reason: soccerOk
        ? "Football-Data historical rows validated"
        : "Soccer dataset below minimum validated rows",
    },
    {
      sport: "TENNIS",
      status: "INSUFFICIENT_DATA",
      reason: "No validated historical dataset for this phase",
    },
    {
      sport: "BASKETBALL",
      status: "INSUFFICIENT_DATA",
      reason: "No validated historical dataset for this phase",
    },
    {
      sport: "HOCKEY",
      status: "INSUFFICIENT_DATA",
      reason: "No validated historical dataset for this phase",
    },
    {
      sport: "VOLLEYBALL",
      status: "INSUFFICIENT_DATA",
      reason: "No validated historical dataset for this phase",
    },
  ];
}
