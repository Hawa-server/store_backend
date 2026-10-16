/*
 * services/discount/adminDiscount.service.js
 *
 * Admin management of discount codes (BE29): list (with a status), view
 * (with the latest redemptions), create and edit. Reached only through
 * /api/admin (requireAuth + requireAdmin).
 *
 * Rules:
 *   - No deletes: orders point at codes. A code is switched off instead.
 *   - A code that has been used can't change its code, type or value (409):
 *     orders and redemptions describe it, so changing it would rewrite
 *     history. Its dates, limits and on/off can still change.
 *   - Codes are unique, ignoring case (a UNIQUE index backs this up).
 *   - Dates are Ghana calendar days: startsOn from the START of that day,
 *     endsOn until the END of that day (both included). Ghana time is UTC+0
 *     all year, so these are simply midnights in UTC.
 */
const { Op, UniqueConstraintError, col, where: sqlWhere } = require('sequelize');
const { sequelize, DiscountCode, DiscountRedemption, Order } = require('../../models');
const AppError = require('../../utils/AppError');
const { accraDayRange } = require('../../utils/dates');
// The status rule lives in discount.service.js (shared with the announcement bar, BE30).
const { statusOf } = require('./discount.service');
const { toLimitOffset, toPage } = require('../../utils/pagination');

const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

/*
 * statusWhere(status, now)
 * Receives: a status name and the current time.
 * Returns: the SQL conditions that select exactly the codes statusOf() gives
 *          that status, so the list can be filtered (and paged) in the database.
 */
function statusWhere(status, now) {
  const started = { [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }] };
  const notEnded = { [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: now } }] };
  const usedUp = { [Op.and]: [{ usageLimit: { [Op.ne]: null } }, sqlWhere(col('timesUsed'), Op.gte, col('usageLimit'))] };
  switch (status) {
    case 'off': return { isActive: false };
    case 'scheduled': return { isActive: true, startsAt: { [Op.gt]: now } };
    case 'expired': return { isActive: true, [Op.and]: [started, { endsAt: { [Op.lte]: now } }] };
    case 'used_up': return { isActive: true, [Op.and]: [started, notEnded, usedUp] };
    default: // 'active'
      return {
        isActive: true,
        [Op.and]: [started, notEnded, { [Op.or]: [{ usageLimit: null }, sqlWhere(col('timesUsed'), Op.lt, col('usageLimit'))] }],
      };
  }
}

/*
 * toDay(date, isEnd)
 * Receives: a stored start or end moment (or null).
 * Returns: the Ghana calendar day 'YYYY-MM-DD' the admin chose. The end is
 *          stored as the next midnight, so its day is the one just before.
 */
function toDay(date, isEnd) {
  if (!date) return null;
  return new Date(date.getTime() - (isEnd ? DAY_MS : 0)).toISOString().slice(0, 10);
}

/*
 * toView(code)
 * Receives: a DiscountCode. Returns: the admin view, with its status.
 *           overLimit is true in the rare case two payments raced for the
 *           last use (both orders keep their discount: they paid it).
 */
function toView(code) {
  return {
    id: code.id,
    code: code.code,
    type: code.type,
    value: code.value,
    maxDiscountPesewas: code.maxDiscountPesewas,
    minSubtotalPesewas: code.minSubtotalPesewas,
    startsOn: toDay(code.startsAt, false),
    endsOn: toDay(code.endsAt, true),
    startsAt: code.startsAt,
    endsAt: code.endsAt,
    usageLimit: code.usageLimit,
    oncePerCustomer: code.oncePerCustomer,
    isActive: code.isActive,
    timesUsed: code.timesUsed,
    overLimit: code.usageLimit !== null && code.timesUsed > code.usageLimit,
    status: statusOf(code),
    createdAt: code.createdAt,
    updatedAt: code.updatedAt,
  };
}

/*
 * listCodes({ status, page })
 * Receives: an optional status filter and the page number.
 * Returns: the standard page object, newest codes first, 20 per page.
 */
async function listCodes({ status, page }) {
  const where = status ? statusWhere(status, new Date()) : {};
  const { count, rows } = await DiscountCode.findAndCountAll({
    where,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    ...toLimitOffset(page, PAGE_SIZE),
  });
  return toPage(rows.map(toView), { page, pageSize: PAGE_SIZE, totalItems: count });
}

/*
 * getCode(id)
 * Receives: a code id. Returns: the admin view plus its 20 latest redemptions
 *           (order number and UUID, email, discount, date). 404 if unknown.
 */
async function getCode(id) {
  const code = await DiscountCode.findByPk(id);
  if (!code) throw new AppError(404, 'NOT_FOUND', 'Discount code not found.');
  const redemptions = await DiscountRedemption.findAll({
    where: { discountCodeId: id },
    include: [{ model: Order, attributes: ['publicId', 'orderNumber'] }],
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: 20,
  });
  return {
    ...toView(code),
    redemptions: redemptions.map((r) => ({
      orderId: r.Order.publicId, // the order's UUID (for the link), never its counting number
      orderNumber: r.Order.orderNumber,
      email: r.email,
      discountGhs: r.discountPesewas,
      redeemedAt: r.createdAt,
    })),
  };
}

/*
 * toStored(fields)
 * Receives: validated fields (startsOn / endsOn as 'YYYY-MM-DD' or null).
 * Returns: the same with startsAt / endsAt as moments: the start of the first
 *          day and the end (next midnight) of the last day, Ghana time.
 */
function toStored(fields) {
  const { startsOn, endsOn, ...rest } = fields;
  const out = { ...rest };
  if (startsOn !== undefined) out.startsAt = startsOn ? accraDayRange(startsOn, null).start : null;
  if (endsOn !== undefined) out.endsAt = endsOn ? accraDayRange(null, endsOn).end : null;
  return out;
}

/*
 * checkCombination(code)
 * Receives: the code's values after the change (merged).
 * Returns: nothing. Throws 400 with the field to fix when fields don't fit
 *          together: percent 1–90; fixed GHS 1–1,000 (100–100,000 pesewas);
 *          a maximum discount only for percent codes; the end on or after the start.
 */
function checkCombination(code) {
  const bad = (field, message) => new AppError(400, 'INVALID_REQUEST', 'Please check the highlighted fields.', { [field]: message });
  if (code.type === 'percent' && (code.value < 1 || code.value > 90)) throw bad('value', 'A percent discount must be from 1 to 90.');
  if (code.type === 'fixed' && (code.value < 100 || code.value > 100000)) {
    throw bad('value', 'A fixed discount must be from 100 to 100000 pesewas (GHS 1–1,000).');
  }
  if (code.type === 'fixed' && code.maxDiscountPesewas !== null && code.maxDiscountPesewas !== undefined) {
    throw bad('maxDiscountPesewas', 'A maximum discount only applies to percent codes.');
  }
  if (code.startsAt && code.endsAt && code.endsAt <= code.startsAt) throw bad('endsOn', 'The end date must be on or after the start date.');
}

/*
 * duplicateCode()
 * Returns: the 409 for a code that already exists (with fields.code).
 */
function duplicateCode() {
  return new AppError(409, 'CONFLICT', 'Please check the highlighted fields.', { code: 'A discount code with this name already exists.' });
}

/*
 * duplicateAware(work)
 * Receives: an async function that saves a code.
 * Returns: its result; a duplicate code (also two admins at the same instant,
 *          caught by the UNIQUE index) becomes 409 with fields.code, never a 500.
 */
async function duplicateAware(work) {
  try {
    return await work();
  } catch (err) {
    if (err instanceof UniqueConstraintError) throw duplicateCode();
    throw err;
  }
}

/*
 * createCode(fields, adminId)
 * Receives: the validated body and the admin's id. Returns: the new code's admin view.
 */
async function createCode(fields, adminId) {
  const values = toStored(fields);
  checkCombination(values);
  const code = await duplicateAware(async () => {
    if (await DiscountCode.findOne({ where: { code: values.code }, attributes: ['id'] })) {
      throw duplicateCode();
    }
    return DiscountCode.create({ ...values, createdByUserId: adminId });
  });
  console.log(`[admin] admin ${adminId} created discount code ${code.id}`);
  return getCode(code.id);
}

/*
 * updateCode(id, changes, adminId)
 * Receives: the code id, the validated changes and the admin's id.
 * Returns: the code's admin view (with redemptions).
 * Throws: 404; 409 if a USED code's code, type or value would change;
 *         409 duplicate code; 400 when the fields don't fit together.
 */
async function updateCode(id, changes, adminId) {
  const update = toStored(changes);
  await duplicateAware(() =>
    sequelize.transaction(async (transaction) => {
      // Lock the row: a payment counting a use (fulfilment) waits for this edit.
      const code = await DiscountCode.findByPk(id, { lock: transaction.LOCK.UPDATE, transaction });
      if (!code) throw new AppError(404, 'NOT_FOUND', 'Discount code not found.');

      const changesMeaning = ['code', 'type', 'value'].some((key) => update[key] !== undefined && update[key] !== code[key]);
      if (code.timesUsed > 0 && changesMeaning) {
        throw new AppError(409, 'CONFLICT', "This code has been used, so its code, type and value can't change. Create a new code instead.");
      }

      checkCombination({ ...code.get(), ...update });
      if (update.code && update.code !== code.code) {
        const other = await DiscountCode.findOne({ where: { code: update.code, id: { [Op.ne]: id } }, attributes: ['id'], transaction });
        if (other) throw duplicateCode();
      }
      await code.update(update, { transaction });
    })
  );
  console.log(`[admin] admin ${adminId} updated discount code ${id} (fields: ${Object.keys(changes).join(', ')})`);
  return getCode(id);
}

module.exports = { listCodes, getCode, createCode, updateCode, statusOf };
