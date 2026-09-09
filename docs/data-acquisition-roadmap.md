# Data acquisition roadmap

## Cost target

**€0 for TASK 011.** No paid APIs, no scraping, no premium plans.

## FREE (priority)

| Source | Use | Status |
| --- | --- | --- |
| football-data.co.uk | Historical 1X2 + selected OU | PRIMARY; live download BLOCKED while HTTP 503 |
| football-data.org | Fixtures / results (PL, SA) | PRIMARY free-tier |
| ClubElo | Team ratings | PRIMARY |
| Open-Meteo | Weather (future feature) | Catalogued, not wired |
| Local offline packs | Real Truth Lab | In-repo |

## FREEMIUM (evaluate later)

| Source | Gate |
| --- | --- |
| API-Football | Only if free tier proves insufficient **and** incremental info > cost |

## PAID

Blocked unless a written proposal shows:

```text
informational gain > monetary cost
```

Never buy a provider only because it has “many markets”.

## Scraping

**Default = DENY.** No Cloudflare / CAPTCHA / login / paywall / robots bypass.
