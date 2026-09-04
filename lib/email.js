import { Resend } from "resend";

let client;

function getResend() {
  if (client) return client;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY env var.");
  client = new Resend(key);
  return client;
}

const FROM = process.env.EMAIL_FROM || "Job Alerts <onboarding@resend.dev>";
const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const REPORT_URL =
  process.env.POWERBI_REPORT_URL ||
  "https://app.powerbi.com/view?r=eyJrIjoiMmUwNDhmNjEtMGRhMS00OTlhLWE1NjQtM2VkZjFlYTg3MzNhIiwidCI6IjdkNzZkMzYxLTgyNzctNDcwOC1hNDc3LTY0ZTgzNjZjZDFiYyIsImMiOjN9&pageName=ReportSection";

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendConfirmationEmail(email, confirmToken) {
  const confirmUrl = `${SITE_URL}/api/confirm?token=${confirmToken}`;
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Confirm your Northwestern Student Job Alerts subscription",
    html: `
      <p>Someone (hopefully you) subscribed this address to alerts for new postings
      on the Northwestern Student Job Board.</p>
      <p><a href="${confirmUrl}">Confirm your subscription</a></p>
      <p>If you didn't request this, just ignore this email — you won't be
      subscribed unless you click the link above.</p>
    `,
  });
  if (error) throw error;
}

export async function sendNewJobsEmail(subscriber, jobs) {
  const unsubscribeUrl = `${SITE_URL}/api/unsubscribe?token=${subscriber.unsubscribe_token}`;
  const resend = getResend();

  const items = jobs
    .map(
      (job) => `
      <li style="margin-bottom:12px">
        <strong>${escapeHtml(job.positionName)}</strong> — ${escapeHtml(job.department)}<br/>
        ${escapeHtml(job.hourlyWage)} · ${escapeHtml(job.location)} · Starts ${escapeHtml(job.startDate)}
        ${job.workStudy ? `<br/><span style="color:#666">${escapeHtml(job.workStudy)}</span>` : ""}
      </li>`
    )
    .join("");

  const subject =
    jobs.length === 1
      ? "1 new student job posted at Northwestern"
      : `${jobs.length} new student jobs posted at Northwestern`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: subscriber.email,
    subject,
    html: `
      <p>New postings on the Northwestern Student Job Board:</p>
      <ul style="padding-left:18px">${items}</ul>
      <p><a href="${REPORT_URL}">View the full job board</a></p>
      <p style="font-size:12px;color:#888;margin-top:24px">
        Don't want these emails? <a href="${unsubscribeUrl}">Unsubscribe</a>
      </p>
    `,
  });
  if (error) throw error;
}
