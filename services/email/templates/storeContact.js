/*
 * services/email/templates/storeContact.js
 *
 * The store's contact details for the bottom of order emails, read from
 * STORE_CONTACT_EMAIL and STORE_CONTACT_PHONE in .env. Shared by the order
 * confirmation, shipped and delivered emails so they always match.
 */

/*
 * contactLines()
 * Receives: nothing.
 * Returns: a list like ['Email: help@…', 'Phone: 024…']. Missing values are
 *          left out rather than showing an empty line.
 */
function contactLines() {
  const lines = [];
  if (process.env.STORE_CONTACT_EMAIL) lines.push(`Email: ${process.env.STORE_CONTACT_EMAIL}`);
  if (process.env.STORE_CONTACT_PHONE) lines.push(`Phone: ${process.env.STORE_CONTACT_PHONE}`);
  return lines;
}

module.exports = { contactLines };
