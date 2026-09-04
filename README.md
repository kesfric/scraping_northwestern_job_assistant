# Northwestern Student Job Board Alerts

A small automation that watches the [Northwestern Student Job Board](https://app.powerbi.com/view?r=eyJrIjoiMmUwNDhmNjEtMGRhMS00OTlhLWE1NjQtM2VkZjFlYTg3MzNhIiwidCI6IjdkNzZkMzYxLTgyNzctNDcwOC1hNDc3LTY0ZTgzNjZjZDFiYyIsImMiOjN9&pageName=ReportSection) — a Power BI report listing on-campus student jobs — and emails subscribers the moment a new position is posted.

## What it does

Northwestern publishes its on-campus student job listings through an embedded Power BI report rather than a normal webpage or API. This project scrapes that report on a schedule, keeps track of which postings have already been seen, and sends an email to every subscribed student as soon as a new one shows up — so nobody has to keep the board open and refresh it by hand.

## How it works

- **The scraper** (`scraper/scrapeJobs.js`) opens the Power BI report in a headless browser (Playwright) and reads the listings through the grid's accessibility tree — the same structure a screen reader would use — instead of reverse-engineering Power BI's internal query API. Since the results grid is virtualized, the scraper scrolls through it programmatically until every row has been collected. Each job carries a stable **Job ID**, which is what the diff logic keys off of.
- **The database** is a Supabase (Postgres) project shared between the two moving parts below. It stores every job ID seen so far, along with the subscriber list and each subscriber's confirmation status.
- **The notifier** (`scraper/checkAndNotify.js`) runs the scraper, compares the results against what's already in Supabase, saves any new postings, and emails every confirmed subscriber through Resend.
- **The schedule**: a GitHub Actions workflow (`.github/workflows/check-jobs.yml`) runs the notifier automatically every 30 minutes, so nothing needs to run continuously on a server.
- **The signup form** (`public/index.html`, backed by `api/subscribe.js`, `api/confirm.js`, and `api/unsubscribe.js`) is a small double opt-in flow deployed as a Vercel project: a visitor enters their email, confirms it through a link sent to their inbox, and can unsubscribe at any time through a link included in every alert.

## Architecture at a glance

```
Power BI report → Playwright scraper → Supabase (jobs + subscribers) → Resend → subscriber inboxes
                        ▲ triggered every 30 min by GitHub Actions

Visitor → Vercel-hosted signup form → Supabase (subscribers)
```

## Project layout

| Path | Purpose |
|---|---|
| `scraper/` | The Playwright scraper and the scrape → diff → notify script |
| `lib/` | Shared Supabase and Resend clients |
| `api/` | Vercel serverless functions behind the signup form |
| `public/` | The signup page and its confirmation/unsubscribe result pages |
| `db/schema.sql` | The two Supabase tables (`jobs`, `subscribers`) this project relies on |
| `.github/workflows/` | The scheduled job that keeps the whole thing running |

## Design notes

- The scraper doesn't authenticate against anything — the Power BI `/view` link is a public share link, so no credentials are needed to read it.
- Subscribers go through double opt-in, and every alert includes an unsubscribe link, so nobody ends up subscribed without asking to be.
- Every write to Supabase — from both the scheduled scraper and the signup form — goes through a server-side secret key. The browser never talks to the database directly, and Row Level Security is enabled with no public policies.
- If Power BI ever changes the report's column order, the `COLUMNS` array in `scraper/scrapeJobs.js` needs to be updated to match.

## Running it locally

```bash
npm install
npx playwright install chromium

# Scraper only, no database or email needed — prints the current listings as JSON
npm run scrape:test

# Full run: scrape, diff against Supabase, email confirmed subscribers
npm run check
```

Both commands read configuration from a local `.env` file (see `.env.example` for the required variables). The signup form can be run locally with the Vercel CLI (`npx vercel dev`), which reads the same variables from `.env.local`.
