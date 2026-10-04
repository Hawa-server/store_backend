/*
 * utils/orderNumber.js
 *
 * Makes the order number shoppers see and quote to support, e.g.
 * "ORD-20260930-7K2QXM". It's readable, NOT secret: the confirmation page is
 * protected by a separate long random token (Orders.confirmationToken).
 */
const crypto = require('crypto');
const { BUSINESS_TIME_ZONE } = require('./dates');

// No 0/O, 1/I/L: characters that are easy to confuse when read out on the phone.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/*
 * createOrderNumber(date)
 * Receives: the order date (defaults to now).
 * Returns: "ORD-YYYYMMDD-XXXXXX". The date is the Ghana business date, and the
 *          6 characters are securely random (about a billion combinations).
 *          Orders.orderNumber is UNIQUE, so the database refuses a repeat.
 */
function createOrderNumber(date = new Date()) {
  // 'en-CA' formats dates as YYYY-MM-DD, which we then squash to YYYYMMDD.
  const ghanaDate = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE }).format(date).replace(/-/g, '');
  let suffix = '';
  for (let i = 0; i < 6; i += 1) suffix += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `ORD-${ghanaDate}-${suffix}`;
}

module.exports = { createOrderNumber };
