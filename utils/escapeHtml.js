/*
 * utils/escapeHtml.js
 *
 * Makes text safe to put inside an HTML email. Without this, a user who
 * registers with a name like <a href="...">Click me</a> could inject links or
 * markup into emails we send.
 */

/*
 * escapeHtml(value)
 * Receives: any value (turned into a string).
 * Returns: the string with & < > " ' replaced by HTML entities.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = escapeHtml;
