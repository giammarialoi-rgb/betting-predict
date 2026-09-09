/**
 * Minimal fixture derived from documented football-data.co.uk column layout
 * (notes.txt + public CSV schema). Not a live dump of the archive.
 *
 * Temporal clocks are intentionally absent — only Date + open/close columns.
 */
export const FOOTBALL_DATA_CO_UK_FIXTURE_CSV = `Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,B365H,B365D,B365A,B365CH,B365CD,B365CA,PSH,PSD,PSA,PSCH,PSCD,PSCA,MaxH,MaxD,MaxA,AvgH,AvgD,AvgA
E0,17/08/24,15:00,Man United,Liverpool,1,1,D,2.00,3.40,4.00,1.80,3.60,4.50,1.95,3.50,4.10,1.85,3.55,4.40,2.10,3.70,4.60,1.98,3.45,4.20
E0,17/08/24,17:30,Chelsea,Arsenal,0,2,A,3.20,3.30,2.25,3.40,3.40,2.10,,,,,,,,
E0,bad-date,15:00,Man City,Tottenham,1,0,H,1.70,3.80,5.00,1.65,3.90,5.20,,,,,,,,
E0,18/08/24,15:00,Unknown FC,Liverpool,0,0,D,2.10,3.20,3.60,2.00,3.30,3.80,,,,,,,,
`;

export const FOOTBALL_DATA_CO_UK_FIXTURE_SEASON = "2425";
export const FOOTBALL_DATA_CO_UK_FIXTURE_DIVISION = "E0" as const;
