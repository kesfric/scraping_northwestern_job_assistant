import "dotenv/config";
import { scrapeJobs } from "./scrapeJobs.js";
import { getKnownJobIds, insertNewJobs, getConfirmedSubscribers } from "../lib/supabase.js";
import { sendNewJobsEmail } from "../lib/email.js";

async function main() {
  console.log("Scraping the job board...");
  const scraped = await scrapeJobs();
  console.log(`Found ${scraped.length} jobs currently listed.`);

  const known = await getKnownJobIds();
  const newJobs = scraped.filter((job) => !known.has(job.jobId));

  if (newJobs.length === 0) {
    console.log("No new jobs since last check.");
    return;
  }

  console.log(`${newJobs.length} new job(s) found. Saving to Supabase...`);
  await insertNewJobs(newJobs);

  const subscribers = await getConfirmedSubscribers();
  if (subscribers.length === 0) {
    console.log("No confirmed subscribers to notify.");
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const subscriber of subscribers) {
    try {
      await sendNewJobsEmail(subscriber, newJobs);
      sent++;
    } catch (err) {
      failed++;
      console.error(`Failed to email ${subscriber.email}:`, err);
    }
  }

  console.log(`Notified ${sent} subscriber(s) about ${newJobs.length} new job(s).${failed ? ` ${failed} email(s) failed.` : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
