import { confirmSubscriberByToken } from "../lib/supabase.js";

export default async function handler(req, res) {
  const token = String(req.query?.token || "");
  if (!token) {
    res.redirect(302, "/invalid.html");
    return;
  }

  try {
    const confirmed = await confirmSubscriberByToken(token);
    res.redirect(302, confirmed ? "/confirmed.html" : "/invalid.html");
  } catch (err) {
    console.error(err);
    res.redirect(302, "/invalid.html");
  }
}
