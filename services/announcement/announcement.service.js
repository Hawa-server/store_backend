/*
 * services/announcement/announcement.service.js
 *
 * The announcement bar (BE30): one short message at the top of every shop
 * page, usually promoting a discount code ("Use WELCOME5 for 5% off").
 *
 * Rules:
 *   - One announcement: on/off, a message, optionally ONE discount code.
 *   - With a code, the bar shows only while the code can really be used
 *     (BE29's status is 'active'). When the code stops working, the bar hides
 *     itself, so shoppers never see a code that fails at checkout.
 *   - Without a code, an optional end day (Ghana time, included) applies.
 *   - The message is plain text. It's stored and returned exactly as typed;
 *     the frontend shows it as text, so "<script>" is just characters.
 *
 * The values live in the Settings table (settings.service.js converts them).
 */
const crypto = require('crypto');
const { DiscountCode } = require('../../models');
const AppError = require('../../utils/AppError');
const settingsService = require('../settings/settings.service');
const { statusOf } = require('../discount/discount.service');
const { accraDayRange, accraToday } = require('../../utils/dates');

// Why the bar is hidden, for the admin, by the linked code's BE29 status.
const CODE_REASONS = {
  off: 'The linked code is switched off',
  scheduled: "The linked code hasn't started yet",
  expired: 'The linked code has expired',
  used_up: 'The linked code has reached its limit',
};

/*
 * versionId(message, code)
 * Receives: the message and the code text (or null).
 * Returns: a short id (12 hex characters of SHA-256) that changes whenever the
 *          message or the code changes. The frontend remembers the id of a bar
 *          the shopper closed, and shows the bar again only when it's NEW.
 */
function versionId(message, code) {
  return crypto.createHash('sha256').update(`${message}\n${code || ''}`).digest('hex').slice(0, 12);
}

/*
 * evaluate(settings, code, now)
 * Receives: the saved settings, the linked DiscountCode (or null), and now.
 * Returns: { isShowing, reason } — reason is null when showing, or when it's
 *          simply switched off.
 */
function evaluate(settings, code, now = new Date()) {
  if (!settings.enabled) return { isShowing: false, reason: 'The announcement is switched off' };
  if (!settings.message) return { isShowing: false, reason: 'The message is empty' };
  if (settings.codeId) {
    if (!code) return { isShowing: false, reason: 'The linked code no longer exists' };
    const status = statusOf(code, now);
    if (status !== 'active') return { isShowing: false, reason: CODE_REASONS[status] };
  } else if (settings.endsAt && now >= accraDayRange(null, settings.endsAt).end) {
    // The end day is included: hidden from the next midnight (Ghana time).
    return { isShowing: false, reason: 'The end date has passed' };
  }
  return { isShowing: true, reason: null };
}

/*
 * load()
 * Returns: { settings, code }: the saved settings and the linked code (or null).
 */
async function load() {
  const settings = await settingsService.getAnnouncementSettings();
  const code = settings.codeId ? await DiscountCode.findByPk(settings.codeId) : null;
  return { settings, code };
}

/*
 * publicAnnouncement()
 * Receives: nothing.
 * Returns: null when nothing should show; otherwise { message, code, id }.
 *          Only the code's TEXT is revealed (not its limits, dates or value).
 */
async function publicAnnouncement() {
  const { settings, code } = await load();
  if (!evaluate(settings, code).isShowing) return null;
  const codeText = code ? code.code : null;
  return { message: settings.message, code: codeText, id: versionId(settings.message, codeText) };
}

/*
 * adminAnnouncement()
 * Receives: nothing.
 * Returns: the saved settings, the linked code's { id, code, status }, and
 *          whether the bar is showing right now (with the reason if not).
 */
async function adminAnnouncement() {
  const { settings, code } = await load();
  const { isShowing, reason } = evaluate(settings, code);
  return {
    enabled: settings.enabled,
    message: settings.message,
    codeId: settings.codeId,
    endsAt: settings.endsAt,
    code: code ? { id: code.id, code: code.code, status: statusOf(code) } : null,
    isShowing,
    reason: isShowing ? null : reason,
  };
}

/*
 * bad(field, message)
 * Returns: a 400 INVALID_REQUEST error for one field.
 */
function bad(field, message) {
  return new AppError(400, 'INVALID_REQUEST', 'Please check the highlighted fields.', { [field]: message });
}

/*
 * saveAnnouncement({ enabled, message, codeId, endsAt }, adminId)
 * Receives: the validated body (message already trimmed, single line, ≤ 120
 *           characters) and the admin's id.
 * Returns: the admin view after saving.
 * Throws: 400 with the field to fix: a message is needed to switch it on;
 *         the code must exist; the end day can't be in the past, and can't be
 *         combined with a code (the code's own dates apply).
 */
async function saveAnnouncement({ enabled, message, codeId, endsAt }, adminId) {
  if (enabled && !message) throw bad('message', 'Enter a message (5–120 characters) to switch the bar on.');
  if (codeId && endsAt) throw bad('endsAt', "With a linked code, the code's own dates apply. Remove the end date.");
  // 'YYYY-MM-DD' strings compare correctly as text.
  if (endsAt && endsAt < accraToday()) throw bad('endsAt', "The end date can't be in the past.");
  if (codeId && !(await DiscountCode.findByPk(codeId, { attributes: ['id'] }))) {
    throw bad('codeId', 'Choose an existing discount code.');
  }
  // A code that's off, expired or used up may still be linked (the admin may
  // be preparing): the answer then says isShowing: false, with the reason.

  await settingsService.saveAnnouncementSettings({ enabled, message, codeId, endsAt });
  console.log(`[admin] admin ${adminId} updated the announcement bar (enabled: ${enabled})`);
  return adminAnnouncement();
}

module.exports = { publicAnnouncement, adminAnnouncement, saveAnnouncement, versionId };
