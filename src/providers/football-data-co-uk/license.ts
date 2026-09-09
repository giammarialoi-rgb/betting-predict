/**
 * License / usage notes for football-data.co.uk (research only).
 *
 * Source URL: https://www.football-data.co.uk/
 * Notes: https://www.football-data.co.uk/notes.txt
 * CSV pattern: https://www.football-data.co.uk/mmz4281/{YYZZ}/{DIV}.csv
 *
 * Nature: free public CSV results + bookmaker odds for quantitative testing.
 * Auth: none. Scraping/crawling of HTML: not used.
 *
 * Attribution: acknowledge football-data.co.uk and sources listed in notes.txt
 * (results/stats/odds aggregators) in research documentation.
 *
 * We store: local research copies of CSV content in raw_payloads + canonical snapshots.
 * We do NOT redistribute the full archive as a commercial product.
 *
 * Temporal limitation: files classify pre-close vs close columns; they do not
 * provide exact quote timestamps. Treat as historical market baseline, not a tick feed.
 *
 * Pinnacle note (site, since 2025-07-23): public Pinnacle odds may be stale vs peers;
 * use with caution for analyses. Reliability remains unknown in this project.
 */
export const FOOTBALL_DATA_CO_UK_LICENSE = Object.freeze({
  sourceUrl: "https://www.football-data.co.uk/",
  notesUrl: "https://www.football-data.co.uk/notes.txt",
  nature: "free_public_csv_dataset",
  requiresAuth: false,
  scraping: false,
  redistribution: "local_research_copies_only",
  attribution: "football-data.co.uk + notes.txt acknowledgements",
  temporalClaim: "dataset_open_close_only_exact_clock_unknown",
});
