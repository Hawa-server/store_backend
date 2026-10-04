/*
 * services/payment/paystack.client.js
 *
 * The only file that talks to Paystack's API. Other services call these
 * functions and never build Paystack requests themselves.
 *
 * Endpoint and field names follow Paystack's official API specification
 * (github.com/PaystackOSS/openapi):
 *   POST https://api.paystack.co/transaction/initialize
 *   GET  https://api.paystack.co/transaction/verify/{reference}
 *   POST https://api.paystack.co/refund
 *   GET  https://api.paystack.co/refund   (list refunds)
 *   Authorization: Bearer <secret key>
 *
 * Rules:
 *   - Never call these inside a database transaction (commit first).
 *   - The secret key only ever goes in the Authorization header. It's never
 *     logged or sent to the browser.
 *   - Every call has a time limit, so a slow Paystack can't hang our server.
 */
const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const TIMEOUT_MS = 15000;
// Verify is called while the shopper waits, so it gets a shorter limit (BE10).
const VERIFY_TIMEOUT_MS = 8000;

/*
 * paystackRequest(method, path, body, { timeoutMs })
 * Receives: the HTTP method, the API path (e.g. '/transaction/initialize'),
 *           an optional JSON body, and an optional time limit in milliseconds.
 * Returns: the `data` part of Paystack's successful response.
 * Throws: an Error with a safe description if Paystack can't be reached, times
 *         out, or answers with an error. Callers decide what to tell the shopper.
 *         err.retryable is true for network errors, timeouts and Paystack
 *         server errors (5xx): trying again later might work. It's false when
 *         Paystack clearly refused the request (4xx): repeating won't help.
 */
async function paystackRequest(method, path, body, { timeoutMs = TIMEOUT_MS } = {}) {
  let response;
  try {
    response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // Network failure or timeout: we never got an answer.
    const error = new Error(`Paystack request failed (${err.name}): ${err.message}`);
    error.retryable = true;
    throw error;
  }

  const payload = await response.json().catch(() => null);
  // Paystack answers { status: true, message, data } on success.
  if (!response.ok || !payload || payload.status !== true) {
    const reason = payload && payload.message ? payload.message : 'no details';
    const error = new Error(`Paystack returned HTTP ${response.status}: ${reason}`);
    error.retryable = response.status >= 500;
    throw error;
  }
  return payload.data;
}

/*
 * initializeTransaction({ email, amount, reference, callbackUrl, metadata })
 * Starts a payment on Paystack.
 * Receives: the customer's email, the amount in PESEWAS (Paystack wants the
 *           "smallest denomination"), our unique reference, where to send the
 *           customer after paying, and extra data to attach.
 * Returns: { authorization_url, access_code, reference } from Paystack.
 * Always charges in GHS and offers mobile money only.
 */
async function initializeTransaction({ email, amount, reference, callbackUrl, metadata }) {
  return paystackRequest('POST', '/transaction/initialize', {
    email,
    amount,
    currency: 'GHS',
    reference,
    channels: ['mobile_money'],
    callback_url: callbackUrl,
    metadata,
  });
}

/*
 * verifyTransaction(reference)
 * Asks Paystack what happened to a payment. This is the SERVER-SIDE proof of
 * payment: we never trust the browser saying "I paid".
 * Receives: our payment reference, and optionally { timeoutMs } (at most 8
 *           seconds by default, so a slow Paystack can't keep the shopper waiting).
 * Returns: Paystack's transaction data, including `status` ("success" when
 *          paid), `amount` (pesewas), `currency`, `reference` and
 *          `gateway_response` (Paystack's own short explanation).
 * (GET https://api.paystack.co/transaction/verify/{reference})
 */
async function verifyTransaction(reference, { timeoutMs = VERIFY_TIMEOUT_MS } = {}) {
  return paystackRequest('GET', `/transaction/verify/${encodeURIComponent(reference)}`, undefined, {
    timeoutMs: Math.min(timeoutMs, VERIFY_TIMEOUT_MS),
  });
}

/*
 * createRefund({ reference, amount, note })
 * Asks Paystack to give money back for a completed payment.
 * Receives: the payment's reference, the amount to refund in PESEWAS (never
 *           more than was paid; Paystack refuses that too), and a short reason.
 * Returns: Paystack's refund data, including its refund `id` and `status`.
 * (POST https://api.paystack.co/refund)
 */
async function createRefund({ reference, amount, note }) {
  return paystackRequest('POST', '/refund', {
    transaction: reference,
    amount,
    currency: 'GHS',
    customer_note: note,
    merchant_note: note,
  });
}

/*
 * listRefunds({ from, page, perPage })
 * Lists refunds on our Paystack account (BE17: used before retrying a failed
 * refund, to check whether Paystack actually made it).
 * Receives: `from` (a Date: only refunds created since then), the page number
 *           (from 1) and how many per page.
 * Returns: an array of refunds. Each has `id`, `transaction` (Paystack's
 *          transaction id), `transaction_reference`, `amount` (pesewas) and
 *          `status`. Paystack's list has NO filter for one payment, so the
 *          caller picks out the ones it needs.
 * (GET https://api.paystack.co/refund?from=&page=&perPage=)
 */
async function listRefunds({ from, page = 1, perPage = 100 }) {
  const query = new URLSearchParams({ from: from.toISOString(), page: String(page), perPage: String(perPage) });
  const data = await paystackRequest('GET', `/refund?${query}`);
  return Array.isArray(data) ? data : [];
}

module.exports = { initializeTransaction, verifyTransaction, createRefund, listRefunds };
