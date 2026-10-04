/*
 * utils/pagination.js
 *
 * The standard paginated list format (backend-plan Section 3):
 *   { items, page, pageSize, totalItems, totalPages }
 * Used by My Orders and the admin order list (BE14), and later by reviews.
 */

/*
 * toLimitOffset(page, pageSize)
 * Receives: the 1-based page number and how many items per page.
 * Returns: { limit, offset } for a Sequelize query (page 3 of 10 → skip 20).
 */
function toLimitOffset(page, pageSize) {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}

/*
 * toPage(items, { page, pageSize, totalItems })
 * Receives: the items on this page, and the numbers used to get them.
 * Returns: the standard pagination object. A page past the end simply has
 *          no items (not an error), and totalPages is 0 for an empty list.
 */
function toPage(items, { page, pageSize, totalItems }) {
  return { items, page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) };
}

module.exports = { toLimitOffset, toPage };
