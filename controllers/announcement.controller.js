/*
 * controllers/announcement.controller.js
 *
 * Handles the HTTP side of GET /api/announcement (BE30): the bar shoppers see
 * at the top of every page.
 */
const announcementService = require('../services/announcement/announcement.service');

/*
 * GET /api/announcement
 * Receives: nothing.
 * Returns: 200 { announcement: { message, code, id } } or { announcement: null }.
 */
async function get(req, res) {
  const announcement = await announcementService.publicAnnouncement();
  // Every page asks for this, so browsers (and any cache in between) may keep
  // it for 60 seconds instead of asking the database each time. The cost: an
  // admin change can take up to a minute to appear.
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ announcement });
}

module.exports = { get };
