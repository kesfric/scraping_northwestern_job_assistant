# Northwestern Student Job Board Alerts

Watches the [Northwestern Student Job Board](https://app.powerbi.com/view?r=eyJrIjoiMmUwNDhmNjEtMGRhMS00OTlhLWE1NjQtM2VkZjFlYTg3MzNhIiwidCI6IjdkNzZkMzYxLTgyNzctNDcwOC1hNDc3LTY0ZTgzNjZjZDFiYyIsImMiOjN9&pageName=ReportSection)
(a Power BI report) and emails subscribers whenever a new job is posted.

## How it works

- `scraper/scrapeJobs.js` opens the Power BI report in a headless browser
  (Playwright), scrolls through the virtualized results grid, and reads every
  row via its accessibility roles (grid/row/gridcell) — the same tree a
  screen reader would use. Each job has a stable **Job ID**, which is what we
  diff against.
- `scraper/checkAndNotify.js` runs the scraper, compares the scraped Job IDs
  against what's stored in Supabase, inserts any new ones, and emails every
  **confirmed** subscriber the new listings via Resend.
- `.github/workflows/check-jobs.yml` runs `checkAndNotify.js` every 30
  minutes on GitHub Actions — no server to keep running yourself.
- `public/index.html` + `api/subscribe.js` + `api/confirm.js` +
  `api/unsubscribe.js` are a small double-opt-in signup flow, meant to be
  deployed as a Vercel project (static page + serverless functions, zero
  build config needed).
- Supabase (Postgres) is the shared database: the GitHub Action writes to it,
  the Vercel-hosted signup form reads/writes to it. Both only ever use the
  **service role key**, server-side — the browser never talks to Supabase
  directly.

## One-time setup

### 1. Supabase

1. Create a new (free) project at [supabase.com](https://supabase.com) —
   use a fresh project rather than reusing an unrelated one.
2. In the SQL Editor, run [`db/schema.sql`](db/schema.sql).
3. Settings -> API: copy the **Project URL** and the **service_role** key
   (not the anon/public key — this app needs write access and never runs in
   the browser).

### 2. Resend (email sending)

1. Create a free account at [resend.com](https://resend.com).
2. For real use, verify a sending domain (Resend walks you through adding a
   couple of DNS records) and set `EMAIL_FROM` to an address on that domain,
   e.g. `Job Alerts <jobs@yourdomain.com>`.
3. Until you verify a domain, Resend's sandbox `onboarding@resend.dev`
   sender only delivers to the email address on your own Resend account —
   fine for testing, not for real subscribers.
4. Copy the API key from the Resend dashboard.

### 3. Deploy the signup form (Vercel)

1. Push this project to a GitHub repo.
2. Import it into [Vercel](https://vercel.com) (framework preset: "Other" —
   no build step needed, it just serves `public/` and `api/`).
3. Add environment variables in the Vercel project settings:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
   `EMAIL_FROM`, `SITE_URL` (your Vercel deployment URL, no trailing slash).
4. Deploy. The signup form is now live at your Vercel URL.

### 4. Schedule the scraper (GitHub Actions)

In the GitHub repo -> Settings -> Secrets and variables -> Actions, add:
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`,
`SITE_URL` (same values as above), and optionally `POWERBI_REPORT_URL` if
you ever point this at a different report.

The workflow in `.github/workflows/check-jobs.yml` runs every 30 minutes.
Adjust the cron expression if you want a different cadence. You can also
trigger it manually from the Actions tab (`workflow_dispatch`).

## Local development

```bash
npm install
npx playwright install chromium

# Try the scraper alone, no DB/email needed — prints scraped jobs as JSON
npm run scrape:test

# Full run: scrape, diff against Supabase, email confirmed subscribers
# (needs a .env file — copy .env.example to .env and fill it in)
npm run check
```

To test the signup form locally, use the Vercel CLI: `npx vercel dev`
(it reads the same env vars from `.env.local`).

## Notes

- The scraper has no login step — the Power BI `/view` link is a public
  share link, so no credentials are needed or stored.
- Subscribers go through double opt-in (confirm-by-email) before being
  notified, and every alert includes an unsubscribe link, to avoid signing
  up people who didn't ask for it.
- If Power BI changes the report's column order or layout, update the
  `COLUMNS` array in `scraper/scrapeJobs.js` to match.
