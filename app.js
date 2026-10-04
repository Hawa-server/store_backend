/*
 * app.js
 *
 * Builds the Express application: security middleware, body parsing, routes,
 * and error handling. It does NOT start listening — server.js does that — so
 * the app can also be loaded by tests later without opening a port.
 *
 * The ORDER of middleware matters. Each request passes through them top to bottom:
 *   helmet → cors → CSRF header check → JSON-only check → JSON parser →
 *   cookie parser → routes → 404 → error handler
 */
require('dotenv').config({ quiet: true });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const csrfCheck = require('./middleware/csrfCheck');
const requireJson = require('./middleware/requireJson');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const categoriesRoutes = require('./routes/categories.routes');
const productsRoutes = require('./routes/products.routes');
const cartRoutes = require('./routes/cart.routes');
const checkoutRoutes = require('./routes/checkout.routes');
const webhooksRoutes = require('./routes/webhooks.routes');
const ordersRoutes = require('./routes/orders.routes');
const settingsRoutes = require('./routes/settings.routes');
const adminRoutes = require('./routes/admin.routes');
const reviewsRoutes = require('./routes/reviews.routes');

const app = express();

// Requests reach us through proxies: Render's load balancer (1 hop), plus the
// frontend host if it forwards /api to us (2 hops). Trusting exactly that many
// lets req.ip be the real visitor's IP, which rate limiting needs (otherwise
// everyone shares one IP and one limit). Trusting MORE hops than really exist
// would let visitors fake their IP, so it's set per deployment (default 1).
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 1);

// Security headers (e.g. stop browsers guessing content types, block framing).
app.use(helmet());

// CORS: only our own frontend may call the API from a browser, and it may send
// cookies (credentials) because login uses an HTTP-only cookie.
// If CLIENT_URL is missing, `false` means "allow no other origin" — the cors
// package would otherwise default to allowing every site.
app.use(cors({ origin: process.env.CLIENT_URL || false, credentials: true }));

// Block cross-site form attacks: state-changing requests need X-Requested-With.
app.use(csrfCheck);

// Only JSON bodies are accepted.
app.use(requireJson);

// Parse JSON bodies, max 100 kb so huge bodies can't tie up the server.
// `verify` runs before parsing and gets the exact raw bytes. The Paystack
// webhook signature (BE8) is calculated over those exact bytes, so for that one
// route we keep a copy in req.rawBody. Re-encoding the parsed JSON would not
// give back identical bytes, and the signature check would fail.
app.use(
  express.json({
    limit: '100kb',
    verify: (req, res, buf) => {
      if (req.originalUrl.startsWith('/api/webhooks/paystack')) {
        req.rawBody = buf;
      }
    },
  })
);

app.use(cookieParser());

// --- Routes ---
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/webhooks', webhooksRoutes);

// --- Nothing matched: standard 404, then the single error handler ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;
