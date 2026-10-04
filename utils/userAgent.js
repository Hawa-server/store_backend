/*
 * utils/userAgent.js
 *
 * Turns the browser's User-Agent header into a short description for the
 * login alert email, e.g. "Chrome on Windows". A few simple checks are enough
 * here; we don't need an extra library.
 */

/*
 * describeUserAgent(ua)
 * Receives: the User-Agent header string (may be missing).
 * Returns: a short "Browser on System" description, or "an unknown browser".
 */
function describeUserAgent(ua) {
  if (!ua) return 'an unknown browser';

  // Order matters: Edge and Opera also contain "Chrome", and Chrome contains "Safari".
  let browser = 'an unknown browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  else if (/Thunder Client|PostmanRuntime|curl\//i.test(ua)) browser = 'an API testing tool';

  let system = '';
  if (/Android/.test(ua)) system = 'Android';
  else if (/iPhone|iPad/.test(ua)) system = 'iOS';
  else if (/Windows/.test(ua)) system = 'Windows';
  else if (/Mac OS X/.test(ua)) system = 'macOS';
  else if (/Linux/.test(ua)) system = 'Linux';

  return system ? `${browser} on ${system}` : browser;
}

module.exports = { describeUserAgent };
