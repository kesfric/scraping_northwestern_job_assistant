import { randomBytes } from "crypto";
import { findSubscriberByEmail, upsertPendingSubscriber } from "../lib/supabase.js";
import { sendConfirmationEmail } from "../lib/email.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  try {
    const existing = await findSubscriberByEmail(email);

    if (existing?.status === "confirmed") {
      res.status(200).json({ ok: true, message: "already-subscribed" });
      return;
    }

    const confirmToken = existing?.confirm_token ?? randomBytes(24).toString("hex");
    const unsubscribeToken = existing?.unsubscribe_token ?? randomBytes(24).toString("hex");

    await upsertPendingSubscriber({ email, confirmToken, unsubscribeToken });
    await sendConfirmationEmail(email, confirmToken);

    res.status(200).json({ ok: true, message: "confirmation-sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
