/*
 * utils/withDeadlockRetry.js
 *
 * A deadlock happens when two transactions each hold a lock the other needs,
 * so neither can continue. MySQL detects this, cancels one of them, and
 * reports ER_LOCK_DEADLOCK. The cancelled work is safe to simply run again.
 *
 * The plan (Section 13) says: retry the transaction once, then return a safe
 * error. Used for critical transactions such as the cart merge (BE6), and
 * later payment fulfilment (BE9) and cancellation (BE16).
 */

/*
 * isDeadlock(err)
 * Receives: an error thrown by Sequelize.
 * Returns: true if MySQL cancelled the transaction because of a deadlock.
 */
function isDeadlock(err) {
  const code = (err.parent && err.parent.code) || (err.original && err.original.code);
  return code === 'ER_LOCK_DEADLOCK';
}

/*
 * withDeadlockRetry(fn)
 * Receives: a function that runs a whole transaction (e.g. () => sequelize.transaction(...)).
 * Returns: whatever fn returns. If the first attempt hits a deadlock, it runs
 *          fn once more; any other error, or a second deadlock, is thrown.
 * fn must run the COMPLETE transaction, so a retry starts from scratch.
 */
async function withDeadlockRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    if (!isDeadlock(err)) throw err;
    return fn();
  }
}

module.exports = withDeadlockRetry;
