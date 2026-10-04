/*
 * utils/tokens.js
 *
 * Helpers for one-time secrets sent by email (verification links now, login
 * codes in BE12) and other random values (e.g. guest cart tokens later).
 *
 * The raw token goes in the email; only its SHA-256 hash is stored. If the
 * database ever leaked, the hashes couldn't be turned back into working links.
 */
const crypto = require('crypto');

/*
 * createRandomToken()
 * Receives: nothing.
 * Returns: 64 hex characters (32 bytes from the operating system's secure
 *          random generator), far too many possibilities to guess.
 */
function createRandomToken() {
  return crypto.randomBytes(32).toString('hex');
}

/*
 * hashToken(raw)
 * Receives: the raw token string.
 * Returns: its SHA-256 hash as 64 hex characters.
 * Why SHA-256 and not bcrypt? bcrypt is deliberately slow to protect short,
 * guessable passwords. These tokens are long and random, so a fast hash is
 * already safe, and it lets us look the token up directly by its hash.
 */
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

module.exports = { createRandomToken, hashToken };
