/*
 * services/email/email.service.js
 *
 * The only place that sends email. It uses Brevo's transactional email HTTP
 * API (POST https://api.brevo.com/v3/smtp/email), which delivers to real
 * inboxes. Other services build an email with a template from ./templates/
 * and call sendEmail().
 *
 * Why an HTTP API instead of SMTP: Render's free plan blocks outgoing SMTP
 * ports, so an SMTP connection from the live API never gets through. An HTTPS
 * request on port 443 always does. Node 22's built-in fetch is used, so no
 * email library is needed.
 *
 * Settings (.env): BREVO_API_KEY (an API key, "xkeysib-…", not an SMTP key),
 * EMAIL_FROM_NAME, and EMAIL_FROM_ADDRESS (a sender verified in Brevo).
 *
 * Rules:
 *   - Call this only AFTER the database transaction has committed.
 *   - It throws if sending fails; each caller decides what that means.
 *     Most emails are "log and carry on" (see sendEmailSafely); only the login
 *     code (BE12) tells the user to try again.
 *   - Never log the email body (it may contain links, codes or tokens), and
 *     never the API key: it only ever goes in the request header.
 */
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10000;

/*
 * readSettings()
 * Receives: nothing (reads .env).
 * Returns: { apiKey, sender: { name, email } }.
 * Throws: a clear error naming the MISSING settings (never their values), so
 *         a setup mistake is obvious in the logs.
 */
function readSettings() {
  const apiKey = process.env.BREVO_API_KEY;
  const name = process.env.EMAIL_FROM_NAME;
  const email = process.env.EMAIL_FROM_ADDRESS;
  const missing = [['BREVO_API_KEY', apiKey], ['EMAIL_FROM_NAME', name], ['EMAIL_FROM_ADDRESS', email]]
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) throw new Error(`Email isn't configured (missing ${missing.join(', ')}).`);
  return { apiKey, sender: { name, email } };
}

/*
 * brevoErrorMessage(response)
 * Receives: a non-2xx fetch Response from Brevo.
 * Returns: Brevo's own explanation, e.g. "Key not found" or "sender is not
 *          valid". Brevo answers errors as { code, message }; if the body
 *          isn't that, the status text is used instead.
 */
async function brevoErrorMessage(response) {
  try {
    const body = await response.json();
    return [body.code, body.message].filter(Boolean).join(': ') || response.statusText;
  } catch {
    return response.statusText || 'no details';
  }
}

/*
 * sendEmail({ to, subject, html, text })
 * Receives: the recipient's address, the subject, and HTML and plain-text versions.
 * Returns: a promise that resolves when Brevo ACCEPTS the email (HTTP 2xx),
 *          or rejects with a short reason (timeout, network error, or
 *          "Brevo returned HTTP 401: …"). The key is never part of the reason.
 */
async function sendEmail({ to, subject, html, text }) {
  const { apiKey, sender } = readSettings();

  let response;
  try {
    response = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
      // Give up after 10 seconds, so a slow email service can't hold a
      // request (or the login code step) open for long.
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') throw new Error(`Brevo did not answer within ${TIMEOUT_MS / 1000} seconds.`);
    throw new Error(`Could not reach Brevo: ${err.message}`);
  }

  // Anything other than 2xx means the email was NOT accepted.
  if (!response.ok) {
    throw new Error(`Brevo returned HTTP ${response.status}: ${await brevoErrorMessage(response)}`);
  }

  // Development only: Brevo's id for this email, to find it in Brevo's logs
  // (Transactional → Logs). It identifies the message, not its contents.
  if (process.env.NODE_ENV === 'development') {
    const { messageId } = await response.json().catch(() => ({}));
    console.log(`[email] "${subject}" accepted by Brevo${messageId ? ` (${messageId})` : ''}`);
  }
}

/*
 * sendEmailSafely(message, label)
 * Receives: the same message object as sendEmail, and a short label for logs
 *           (e.g. 'verification').
 * Returns: a promise that always resolves: true if sent, false if it failed.
 * Used for emails that must never break the business action (registration,
 * login alerts, orders). A failure is logged with only the label and the
 * error message: no recipient data, links or tokens.
 */
async function sendEmailSafely(message, label) {
  try {
    await sendEmail(message);
    return true;
  } catch (err) {
    console.error(`[email] ${label} email failed:`, err.message);
    return false;
  }
}

module.exports = { sendEmail, sendEmailSafely };
