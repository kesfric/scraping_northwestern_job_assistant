import { createClient } from "@supabase/supabase-js";

let client;

export function getSupabase() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  }

  client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return client;
}

export async function getKnownJobIds() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("jobs").select("job_id");
  if (error) throw error;
  return new Set(data.map((row) => row.job_id));
}

function toRow(job) {
  return {
    job_id: job.jobId,
    posted_date: job.postedDate,
    work_study: job.workStudy,
    department: job.department,
    job_code: job.jobCode,
    position_name: job.positionName,
    start_date: job.startDate,
    hourly_wage: job.hourlyWage,
    location: job.location,
  };
}

export async function insertNewJobs(jobs) {
  if (jobs.length === 0) return;
  const supabase = getSupabase();
  const { error } = await supabase.from("jobs").insert(jobs.map(toRow));
  if (error) throw error;
}

export async function getConfirmedSubscribers() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("subscribers")
    .select("email, unsubscribe_token")
    .eq("status", "confirmed");
  if (error) throw error;
  return data;
}

export async function findSubscriberByEmail(email) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("subscribers")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertPendingSubscriber({ email, confirmToken, unsubscribeToken }) {
  const supabase = getSupabase();
  const { error } = await supabase.from("subscribers").upsert(
    {
      email,
      status: "pending",
      confirm_token: confirmToken,
      unsubscribe_token: unsubscribeToken,
    },
    { onConflict: "email" }
  );
  if (error) throw error;
}

export async function confirmSubscriberByToken(token) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("subscribers")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("confirm_token", token)
    .eq("status", "pending")
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function unsubscribeByToken(token) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("subscribers")
    .update({ status: "unsubscribed" })
    .eq("unsubscribe_token", token)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}
