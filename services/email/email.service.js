/*
 * services/email/email.service.js
 *
 * The only place that talks to the SMTP server. For this project that's
 * Ethereal (smtp.ethereal.email), Nodemailer's free test service: it accepts
 * every email but never delivers it to a real inbox; you read the emails on
 * ethereal.email instead. Other services build an email with a template from
 * ./templates/ and call sendEmail().
 *
 * Rules:
 *   - Call this only AFTER the database transaction has committed.
 *   - It throws if sending fails; each caller decides what that means.
 *     Most emails are "log and carry on" (see sendEmailSafely); only the login
 *     code (BE12) tells the user to try again.
 *   - Never log the email body: it may contain links, codes or tokens.
 *     (Exception, development only: with Ethereal, the PREVIEW link of each
 *     email is printed so you can open it. Ethereal is a test service, and
 *     nothing is printed in production.)
 */
const nodemailer = require('nodemailer');

// One reusable connection setup, created the first time an email is sent.
let transporter;

/*
 * getTransporter()
 * Receives: nothing (reads SMTP_* from .env).
 * Returns: the Nodemailer transporter.
 */
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

/*
 * sendEmail({ to, subject, html, text })
 * Receives: the recipient, subject, and HTML and plain-text versions.
 * Returns: a promise that resolves when the SMTP server accepts the email,
 *          or rejects if sending fails.
 */
async function sendEmail({ to, subject, html, text }) {
  const info = await getTransporter().sendMail({ from: process.env.EMAIL_FROM, to, subject, html, text });

  // Development + Ethereal only: print the link where this email can be read.
  // getTestMessageUrl() returns a link only for Ethereal messages (false otherwise).
  if (process.env.NODE_ENV === 'development') {
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log(`[email] "${subject}" → preview: ${preview}`);
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
