import "dotenv/config";
import { chromium } from "playwright";

const REPORT_URL =
  process.env.POWERBI_REPORT_URL ||
  "https://app.powerbi.com/view?r=eyJrIjoiMmUwNDhmNjEtMGRhMS00OTlhLWE1NjQtM2VkZjFlYTg3MzNhIiwidCI6IjdkNzZkMzYxLTgyNzctNDcwOC1hNDc3LTY0ZTgzNjZjZDFiYyIsImMiOjN9&pageName=ReportSection";

const COLUMNS = [
  "postedDate",
  "workStudy",
  "department",
  "jobCode",
  "positionName",
  "startDate",
  "hourlyWage",
  "location",
  "jobId",
];

// The report can render directly in the page or inside a same-origin iframe
// depending on Power BI's embed mode — probe every frame for the grid role.
async function findGridContext(page) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const candidates = [page, ...page.frames()];
    for (const ctx of candidates) {
      try {
        const grid = ctx.getByRole("grid").first();
        if (await grid.isVisible({ timeout: 1000 })) {
          return ctx;
        }
      } catch {
        // role not present in this frame yet, keep trying
      }
    }
    await page.waitForTimeout(1000);
  }
  throw new Error("Timed out waiting for the jobs grid to appear.");
}

function normalizeWhitespace(str) {
  return str.replace(/\s+/g, " ").trim();
}

function rowToJob(cells) {
  if (cells.length < COLUMNS.length) return null;
  const job = {};
  COLUMNS.forEach((key, i) => {
    job[key] = normalizeWhitespace(cells[i] ?? "");
  });
  if (!job.jobId) return null;
  return job;
}

export async function scrapeJobs({ headless = true } = {}) {
  const browser = await chromium.launch({ headless });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(REPORT_URL, { waitUntil: "networkidle", timeout: 90_000 });

    const ctx = await findGridContext(page);
    await ctx.getByRole("grid").first().waitFor({ state: "visible", timeout: 30_000 });

    const scrollDownButton = ctx.getByRole("button", { name: "Scroll down" });

    const jobsById = new Map();
    let stableRounds = 0;
    let lastCount = -1;
    let iterations = 0;
    const MAX_ITERATIONS = 400;
    const STABLE_ROUNDS_TO_STOP = 3;

    while (stableRounds < STABLE_ROUNDS_TO_STOP && iterations < MAX_ITERATIONS) {
      iterations++;

      const rows = await ctx.getByRole("row").all();
      for (const row of rows) {
        const cells = await row.getByRole("gridcell").allTextContents();
        const job = rowToJob(cells);
        if (job) jobsById.set(job.jobId, job);
      }

      if (jobsById.size === lastCount) {
        stableRounds++;
      } else {
        stableRounds = 0;
      }
      lastCount = jobsById.size;

      const button = scrollDownButton.first();
      const disabled = await button.getAttribute("aria-disabled").catch(() => null);
      if (disabled === "true") break;

      try {
        await button.click({ timeout: 2000 });
      } catch {
        break; // no more scrolling possible
      }
      await page.waitForTimeout(350);
    }

    return [...jobsById.values()];
  } finally {
    await browser.close();
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  scrapeJobs({ headless: process.env.HEADLESS !== "false" })
    .then((jobs) => {
      console.log(JSON.stringify(jobs, null, 2));
      console.error(`\nScraped ${jobs.length} jobs.`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
