# Store Backend — Engineering Implementation Plan

> **This is the only backend plan.** Claude Code builds from this file, one task at a time. `docs/backlog.md` is the full product plan, for reference only.

---

# 1. Project Goal

Build a secure, production-oriented REST API for an online fashion and beauty store using Node.js, Express, MySQL, Sequelize, JWT, Paystack, ImageKit, and transactional email. This is a class final project, so every task must also be understandable and explainable by its student developer.

## Current scope

- Customer registration, email verification, login, and login alerts
- JWT authentication
- Guest and authenticated carts
- Product and category browsing
- Checkout and Paystack mobile-money payments
- Server-side payment verification and Paystack webhooks
- Orders and order history
- Basic delivery status tracking
- Cancellations and refunds
- Product reviews and moderation
- Admin order, inventory, review, and sales management
- Transactional email
- Product images served through ImageKit (uploaded through ImageKit's website; API uploads are a stretch)
- API documentation and a study guide
- Manual testing (automated tests for critical rules as a stretch)
- GitHub version control and Render deployment

## Explicitly out of scope for this version

- Full logistics: no courier API, driver assignment, tracking numbers, real-time tracking, or shipping-provider integration. Delivery supports only an address, a flat delivery fee, `Pending → Shipped → Delivered`, admin status updates, and customer emails.
- Card payments (planned for later; the checkout is built so cards can be added).
- Charging in USD (USD is display-only).
- Refresh tokens (see Section 5).
- Product variants (sizes and shades).
- Thresholds per product and emailed stock alerts.
- Linking guest orders to accounts created later, and guest cancellation.
- Any frontend code (the frontend is a separate project).

## User stories covered

| # | User story | Tasks |
|---|---|---|
| 1 | Add products to my cart | BE4 |
| 2 | Change quantities or remove items | BE5 |
| 3 | Keep my cart saved | BE6 |
| 4 | Pay by card | **Postponed** |
| 5 | See prices in my currency | BE13 |
| 6 | Pay with mobile money | BE7–BE10 |
| 7 | Get an order confirmation | BE11 |
| 8 | Email confirmations for my account | BE2, BE12 |
| 9 | View order history and status | BE14, BE15 |
| 10 | Cancel an order before it ships | BE16 |
| 11 | Rate and review products I've bought | BE18 |
| 12 | Read other reviews | BE18 |
| 13 | View product details | BE3 |
| 14 | Browse by category | BE1, BE3 |
| 15 | Manage orders (admin) | BE14, BE15, BE17 |
| 16 | Moderate reviews (admin) | BE19 |
| 17 | Low-stock alerts and sales summary (admin) | BE20 |

---

# 2. Technology Stack

| Area | Technology |
|---|---|
| Runtime | Node.js |
| Backend | Express.js |
| Database | MySQL |
| ORM | Sequelize (with `sequelize-cli` for migrations and seeders) |
| MySQL driver | mysql2 |
| Authentication | jsonwebtoken (JWT) |
| Password hashing | bcryptjs |
| Validation | Zod |
| Cookies | cookie-parser |
| CORS | cors |
| Security headers | helmet |
| Rate limiting | express-rate-limit |
| Environment variables | dotenv |
| Development server | nodemon |
| Payments | Paystack (test mode, mobile money) |
| Images | ImageKit (official Node.js SDK) |
| Email | Nodemailer + Ethereal test SMTP (was Mailtrap until BE22) |
| Automated tests (stretch) | Jest + Supertest |
| Version control | Git + GitHub |
| API hosting | Render |
| Database hosting | Aiven for MySQL (free tier) |
| API testing | Thunder Client |
| Database inspection | MySQL Workbench |

Do not add technologies merely to make the stack look more enterprise. Keep the dependency set understandable and purposeful. Ask before adding anything not listed here.

**Hosting notes:** Render's own managed database is PostgreSQL, not MySQL, so production MySQL is hosted on **Aiven's free tier** (1 GB storage, 1 GB RAM, no credit card). The connection must use SSL with the CA certificate Aiven provides. Both Aiven's free database and Render's free web service go to sleep when idle, so wake them (open `/api/health`) well before any demo.

---

# 3. Engineering Principles

## Server is the source of truth

Never trust the client for: user identity, admin privileges, product price, cart totals, order totals, stock availability, payment status, refund amount, review eligibility, currency, or resource ownership.

A request is a request, not proof.

## Build one task at a time

```text
Task → Explain plan → Implement → Test → Fix → Review → Update docs → Next task
```

## Money

Store GHS as integer pesewas.

```text
GHS 350.00 → 35000
GHS 40.50  → 4050
```

Do not use floating-point values for authoritative financial calculations. GHS is the authoritative charged currency. USD is display-only.

## Time

Store timestamps in UTC. Business-date calculations (date filters, dashboard periods) use `Africa/Accra`. Ghana uses UTC all year with no daylight saving, but still use the time zone name so the intent is clear.

## External calls and transactions

Never hold a Paystack, ImageKit, or email call open inside a database transaction. Do the local database work in a short transaction, commit, then call the outside service, then record the result.

## Error format

Every error uses the same shape:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request is invalid.",
    "fields": { "email": "Enter a valid email address." }
  }
}
```

`fields` is included only for validation errors. Use a small, consistent set of codes, for example: `INVALID_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `OUT_OF_STOCK`, `RATE_LIMITED`, `PAYMENT_FAILED`, `PAYMENT_PENDING`, `SERVER_ERROR`.

Never expose SQL or Sequelize internals, stack traces, password hashes, tokens, or secrets.

## Pagination format

Paginated lists return:

```json
{ "items": [], "page": 1, "pageSize": 10, "totalItems": 0, "totalPages": 0 }
```

---

# 4. Project Architecture

```text
store-backend/
├── package.json
├── .env
├── .env.example
├── .gitignore
├── .sequelizerc
├── server.js            starts the server, handles graceful shutdown
├── app.js               Express setup, security middleware, routes
├── config/
│   └── database.js
├── models/
├── migrations/
├── seeders/
├── routes/
├── controllers/
├── middleware/          auth, admin, guest cart, validation, rate limits, errors
├── services/
│   ├── auth/
│   ├── cart/
│   ├── checkout/
│   ├── order/
│   ├── refund/
│   ├── review/
│   ├── payment/
│   ├── image/
│   ├── email/
│   ├── dashboard/
│   └── settings/
├── validators/          Zod schemas
├── utils/
└── docs/
    ├── backend-plan.md
    ├── backlog.md
    ├── api.md
    └── backend-guide.md
```

Routes map URLs. Controllers coordinate requests. Services contain business logic. Models handle persistence. Validators define request shapes. Middleware handles cross-cutting concerns.

---

# 5. Authentication

**Decision for this version:** one JWT access token in an HTTP-only cookie. **No refresh tokens** (they're listed for later).

## Access token

- Minimum claims only: `{ "sub": "<user id>", "role": "customer" | "admin" }`.
- Expiry from `JWT_EXPIRES_IN` (default `1d`), so users stay logged in for a day.
- Never place passwords, hashes, payment information, secrets, or large user objects in a JWT.
- On every protected request, check the token signature and expiry, then load the user to confirm they still exist and are verified. Admin checks use the database value of `isAdmin`, not only the token.

## Cookies

- Login cookie and guest cart cookie: `HttpOnly`, `Path=/`, `Secure` in production.
- `SameSite=Lax` in development. In production, if the frontend and API are on different sites, use `SameSite=None; Secure`.

## CSRF protection

CORS is not CSRF protection. Because login uses cookies:

- CORS allows only `CLIENT_URL`, with credentials.
- Every state-changing request (`POST`, `PATCH`, `DELETE`) must include the header `X-Requested-With: XMLHttpRequest`; the server rejects it with 403 otherwise. Browsers won't send this custom header across sites without passing CORS, which blocks cross-site form attacks.
- Only accept JSON request bodies (except the Paystack webhook, which is signature-checked).

## Passwords

Use bcryptjs with a cost factor of 12. Never store or return plaintext passwords. Passwords must be at least 8 characters.

## Authorization

Authentication answers "who are you?" Authorization answers "are you allowed to do this?" Every protected resource must enforce ownership or admin role server-side. Look up owned resources *through* the owner (for example, find the cart item inside the current user's cart), so IDs from other users can't be used (IDOR).

---

# 6. Database Models

All models have `id`, and `createdAt`/`updatedAt` unless noted. Use foreign keys for every relationship.

## User

```text
id, name, email UNIQUE, passwordHash, isAdmin, emailVerifiedAt, createdAt, updatedAt
```

## EmailToken

```text
id, userId, type (verify | loginCode), tokenHash, expiresAt, attempts, usedAt, createdAt
```

## Category

```text
id, name, slug UNIQUE, sortOrder, createdAt, updatedAt
```

## Product

```text
id, categoryId (required), name, description, priceGhs, stock, isActive, createdAt, updatedAt
```

`priceGhs` is in pesewas. Prefer deactivation over deletion once products have historical references. Stock can never go below 0.

## ProductImage

```text
id, productId, url, fileId nullable, altText, sortOrder, isMain, createdAt, updatedAt
```

`url` is the ImageKit address. `fileId` is ImageKit's file ID for uploaded images (empty for seeded images).

## Cart

```text
id, userId nullable, guestToken nullable UNIQUE, createdAt, updatedAt
```

## CartItem

```text
id, cartId, productId, quantity
```

Unique: `(cartId, productId)`.

## Checkout

```text
id, reference UNIQUE, cartId, userId nullable, email, name, phone, address,
subtotal, deliveryFee, total, status (open | paid | failed), orderId nullable UNIQUE,
createdAt, updatedAt
```

Stores a checkout between starting and verifying a payment. No order exists until payment succeeds.

## Order

```text
id, orderNumber UNIQUE, userId nullable, email, name, phone, address,
subtotal, deliveryFee, total, currency (GHS), paymentMethod (mobile_money),
paymentReference UNIQUE, confirmationToken UNIQUE,
status (Pending | Shipped | Delivered | Cancelled), createdAt, updatedAt
```

## OrderItem

```text
id, orderId, productId, productName, unitPrice, quantity
```

Stores the historical product name and price paid.

## OrderStatusChange

```text
id, orderId, fromStatus nullable, toStatus, changedByUserId nullable, createdAt
```

## Refund

```text
id, orderId, amount, type (cancellation | full | partial), reason,
status (requested | processed | failed), providerReference, failureReason,
issuedByUserId nullable, createdAt, updatedAt
```

## Review

```text
id, productId, userId, rating, text, editedAt, isHidden, hiddenReason, hiddenAt,
hiddenByUserId, createdAt, updatedAt
```

Constraints: rating 1–5, text up to 1,000 characters, unique `(userId, productId)`.

## ReviewModerationLog (stretch)

```text
id, reviewId nullable, productId, reviewerUserId, action (hide | unhide | delete),
reason, adminUserId, reviewCopy, createdAt
```

## PaymentEvent

```text
id, provider (paystack), eventType, reference, receivedAt, processedAt nullable, outcome
```

Records each webhook for troubleshooting and to skip duplicates. Never store full card or account details.

## Setting

Key/value settings, accessed only through the settings service:

```text
usdRate (GHS per 1 USD), deliveryFee (pesewas), lowStockThreshold (default 5)
```

---

# 7. Environment Variables

```env
PORT=5000
NODE_ENV=development
DB_HOST=
DB_PORT=3306
DB_NAME=
DB_USER=
DB_PASSWORD=
DB_SSL=false
DB_CA_CERT=
CLIENT_URL=
JWT_SECRET=
JWT_EXPIRES_IN=1d
PAYSTACK_SECRET_KEY=
IMAGEKIT_PUBLIC_KEY=
IMAGEKIT_PRIVATE_KEY=
IMAGEKIT_URL_ENDPOINT=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
LOGIN_CODE_ENABLED=false
```

`DB_SSL` is `false` locally and `true` in production; `DB_CA_CERT` holds Aiven's CA certificate. Paystack signs webhooks with `PAYSTACK_SECRET_KEY`, so no separate webhook secret is needed. Never commit `.env`. Configure production secrets through Render environment variables.

---

# 8. Seed Data

Categories, in this order: Bags (`bags`), Makeup (`makeup`), Skincare (`skincare`), Jewellery (`jewellery`), Accessories (`accessories`), Perfumes (`perfumes`).

**Products: [docs/catalogue.md](catalogue.md)** is the single list of everything the store sells: **41 products** (Bags 8, Makeup 8, Skincare 6, Jewellery 8, Accessories 7, Perfumes 4), each with its price (GH₵ and pesewas), stock, description, ImageKit photo URL and alt text. The products seeder **reads that file** at seed time and checks every row (pesewas = GH₵ × 100, whole-number stock, ImageKit URLs, unique names), so the docs and the database can't disagree. To change the catalogue, edit the file and re-seed.

Demo stock: **Makeup Setting Spray (2)** is the only low-stock product and **Pearl Stud Earrings (0)** the only out-of-stock product, so the dashboard has something to show.

No brand names, no variants.

**Images:** one photo per product, uploaded through the ImageKit dashboard (`https://ik.imagekit.io/ADORN`) and listed in docs/catalogue.md, seeded as the main `ProductImage`. Uploads through the API (BE21) are a stretch.

*(This replaced the original 24-product list in BE22, when the product photos were added.)*

**Also seed:** settings (`usdRate`, `deliveryFee`, `lowStockThreshold` = 5), an admin user (already verified), and a clearly named **sample-data seeder** with 2–3 verified sample shoppers, Delivered orders, and a few reviews (so product pages aren't empty in the demo; the README must say this is demo data).

Seed relationships by slugs and emails, never by assumed IDs. Seeders must be safe to run again after `db:seed:undo:all`.

---

# 9. Tasks

Each task: explain the plan, build it, test it in Thunder Client and MySQL Workbench, tick every **Done when** item, then update `docs/api.md` and `docs/backend-guide.md`.

## BE0 — Environment and External Services (done by the student)

- Install Node.js, MySQL, Git, and the Thunder Client VS Code extension. Create a local MySQL database.
- **Paystack:** create a test-mode account (Ghana). Copy the test secret key. Find the test mobile money numbers. Make a test payment, then try a full and a partial refund, to learn whether test refunds work (BE16, BE17). Set the test-mode webhook URL later, in BE22.
- **Ethereal** (was Mailtrap): create a free test account at ethereal.email and copy its SMTP details.
- **ImageKit:** create an account; copy the public key, private key, and URL endpoint; upload the product photos.
- **GitHub:** create a repository.
- **Hosting:** create a Render web service, and a free Aiven for MySQL service for production. Save Aiven's host, port, user, password, database name, and CA certificate.

**Done when:** every account works, and all values are ready for `.env`.

## BE1 — Project Setup

Install: `express`, `sequelize`, `sequelize-cli`, `mysql2`, `bcryptjs`, `jsonwebtoken`, `zod`, `cookie-parser`, `cors`, `helmet`, `express-rate-limit`, `dotenv`, `nodemailer`, and `nodemon` (dev).

Configure: Express, JSON parsing with a request size limit (for example, 100 kb), `helmet`, strict CORS (only `CLIENT_URL`, with credentials), cookie parsing, the CSRF header check (Section 5), the standard error handler and error format, Sequelize and MySQL, all migrations, all seeders, `GET /api/health`, graceful shutdown (close the server and database on `SIGTERM`/`SIGINT`), `.env.example`, `.gitignore`, and the first sections of `docs/api.md` and `docs/backend-guide.md`.

**Done when:**
- [ ] Migrations and seeders run, and all tables, keys, and unique constraints are visible in MySQL Workbench.
- [ ] `GET /api/health` returns OK, and an unknown route returns the standard 404 error.
- [ ] A `POST` without `X-Requested-With` is rejected with 403.

## BE2 — Authentication Endpoints

```text
POST /api/auth/register
POST /api/auth/verify
POST /api/auth/resend-verification
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

- Registration validates input with Zod, hashes the password, creates a secure random verification token (stored hashed, one use, 24-hour expiry), and emails the link.
- Resend is limited to 3 per hour per account.
- Unverified login is rejected with a clear message.
- Successful login sets the login cookie and sends a **login alert email** (date, time in Ghana time, browser, and advice if it wasn't them). If the alert fails, login still succeeds and the failure is logged.
- Login, register, verify, and resend are rate-limited.
- `/me` returns safe fields only. Logout clears the login cookie.

**Done when:**
- [ ] Register → verification email in Mailtrap → verify → login → login alert in Mailtrap.
- [ ] Unverified login, wrong password, expired token, and too many attempts are all rejected correctly.

## BE3 — Categories and Products

```text
GET /api/categories
GET /api/products?category=<slug>
GET /api/products/:id
```

- Active products only, alphabetical by name. Categories in display order, with product counts.
- Unknown category → 404; known empty category → 200 with an empty list.
- Product details include name, description, GHS price, category (name and slug), stock, images (URL, alt text, order), stock label, review average, and review count.
- Stock labels: `0 → Out of stock`, `1–5 → Only X left`, `>5 → In stock`. (This shopper label always uses 5; it isn't linked to the admin low-stock threshold.)
- Inactive or unknown products → 404.
- If logged in, product details also say whether the shopper can review the product, and include their review (filled in by BE18).

**Done when:**
- [ ] `?category=bags` returns only the four bags; the stock labels are correct for the low-stock and out-of-stock products.

## BE4 — Cart

```text
GET  /api/cart
POST /api/cart/items
```

- Resolve the cart from the logged-in user or the guest cookie (HTTP-only, 30 days), creating one if needed. Never accept a cart ID from the client.
- Validate active product, positive whole-number quantity, and available stock. Adding the same product increases the existing line.
- Totals and item count are calculated on the server.

**Done when:**
- [ ] Adding a product twice gives quantity 2; adding the out-of-stock product is refused.

## BE5 — Cart Modification

```text
PATCH  /api/cart/items/:id
DELETE /api/cart/items/:id
```

- Reject negative, decimal, and non-numeric quantities. Quantity 0 deletes the line. Quantities above stock are capped, with the message "Only X available."
- Find the item through the current owner's cart (prevents IDOR).

**Done when:**
- [ ] Totals are correct after each change, and another cart's item can't be changed.

## BE6 — Cart Persistence

Guest carts last about 30 days. Logged-in carts belong to the user.

On login (after the login code step, if enabled), in one transaction: find the guest cart, find the account cart, merge items (adding quantities for duplicates), cap by current stock, delete the guest cart, commit. On logout, clear the login and guest cookies.

**Done when:**
- [ ] Guest items appear in the account cart after login; the cart is empty after logout.

## BE7 — Checkout

```text
POST /api/checkout
```

- Validate name, email, phone, and address with Zod. Recalculate subtotal, delivery fee, and total on the server. Recheck stock.
- Create a unique reference, save the `Checkout` (status `open`), then (outside any transaction) initialize a Paystack transaction in GHS for that amount, with mobile money as the only channel. Return the reference, Paystack's access code, and Paystack's checkout URL.
- The client-provided total is never used. Checkout is rate-limited.

**Done when:**
- [ ] Checkout returns a Paystack checkout URL that opens in a browser, and a `Checkout` row exists with the right total.

## BE8 — Paystack Payment Processing

```text
POST /api/checkout/verify
POST /api/webhooks/paystack
```

Three layers: (1) the client starts checkout; (2) the server verifies with Paystack; (3) Paystack's webhook confirms independently.

- **Verify:** ask Paystack for the transaction by reference and check status, amount, currency, and that it matches an `open` or `paid` checkout.
- **Webhook:** keep the **raw request body** for this route (the signature is calculated over the raw bytes, so JSON parsing must not change them first). Compute an HMAC SHA512 of the raw body with `PAYSTACK_SECRET_KEY`, compare it to the `x-paystack-signature` header using a timing-safe comparison, and reject mismatches before trusting anything. Record a `PaymentEvent`, respond 200 quickly, and fulfil through the same service as verify. Paystack retries failed deliveries, so duplicates are expected and must be harmless.
- Fulfilment is idempotent: repeated verify calls or webhook events return the existing order.
- **Testing:** verify can be tested locally. Webhooks need a public URL, so test them after deploying to Render (BE22), or with a tunnel tool.

**Done when:**
- [ ] Pay with a test number in the browser → verify → exactly one order; verifying again returns the same order.
- [ ] A webhook with a bad signature is rejected (and, once deployed, a real test webhook is processed once).

## BE9 — Atomic Payment Fulfillment

After Paystack confirms success (never inside the Paystack call), one local transaction:

1. Lock the checkout row and the relevant product rows.
2. If the checkout is already paid, return the existing order.
3. Recheck stock.
4. Create the Order (status `Pending`, long random `confirmationToken`, readable `orderNumber`).
5. Create OrderItems with historical names and prices.
6. Create the first OrderStatusChange.
7. Reduce stock.
8. Mark the Checkout `paid` and link it to the Order.
9. Clear the cart.

Roll back everything if any step fails. If stock ran out after payment, mark the checkout `failed`, refund the payment through the refund service (after the transaction), and email the shopper.

**Done when:**
- [ ] Two purchases racing for the last unit never make stock negative; one succeeds and the other is refunded.

## BE10 — Payment Edge Cases

Handle: success, rejection, wrong PIN, insufficient funds, timeout, pending, duplicate webhook, duplicate verification, Paystack timeout, and network interruption.

- Pending or failed payments never create orders or reduce stock. Pending is rechecked a few times before returning `PAYMENT_PENDING`.
- A failed payment can be retried with a new reference (a new checkout for the same cart).
- Each case returns a clear status and message.

**Done when:**
- [ ] Every Paystack test mobile money number returns the right result, and retrying after failure works.

## BE11 — Order Confirmation

```text
GET /api/orders/confirmation/:token
```

- Found only by the long random token; a wrong token → 404.
- The confirmation email is sent after the order is committed: order number, items, historical prices, delivery fee, total, payment method, and store contact details, in HTML and plain text.
- Email failure never invalidates the order; it's logged.

**Done when:**
- [ ] The email appears in Mailtrap straight after payment; a wrong token returns 404.

## BE12 — Login Code

Controlled by `LOGIN_CODE_ENABLED` (off until this task).

```text
POST /api/auth/login/verify-code
POST /api/auth/login/resend-code
```

When enabled, `POST /api/auth/login` sends a code instead of logging in. 6 digits, securely random, stored hashed, 10-minute expiry, 5 wrong attempts maximum, resend cancels the old code, at least 60 seconds between resends, and no more than 5 sends per hour. The login cookie, guest-cart merge, and login alert happen only after the correct code. In development only, print the code to the console; never log real codes in production.

**Done when:**
- [ ] Login requires the emailed code, and switching the setting off returns to direct login.

## BE13 — Currency

```text
GET /api/settings/currency
```

GHS is authoritative; USD is display-only. Product, cart, and checkout responses include USD amounts (in cents) converted on the server with `usdRate`: convert and round each unit price first, then multiply and add, so totals always add up. Checkout responses state clearly that GHS is charged.

**Done when:**
- [ ] GHS and USD amounts match and add up exactly in product, cart, and checkout responses.

## BE14 — Shopper and Admin Orders

Shopper:

```text
GET  /api/orders
GET  /api/orders/:id
POST /api/orders/:id/cancel   (built in BE16)
```

Admin:

```text
GET /api/admin/orders?status=&from=&to=&page=
GET /api/admin/orders/:id
```

- Shoppers see only their own orders: paginated (10), newest first, with date, number, items, total, and status; details include status history and refunds. Another user's order → 404.
- Admin list: paginated (20), newest first, with customer, total, status, and refund status (none, partial, or full, **calculated from refunds**, not stored). Filters: status, and Ghana-time dates (both included); an end date before the start date is rejected.
- Admin details: items, contact details, address, payment reference, status history, and refunds. Non-admins → 403.

**Done when:**
- [ ] Filters by status, dates, and both return the right orders; shoppers can't see each other's orders.

## BE15 — Admin Order Status

```text
PATCH /api/admin/orders/:id/status
```

Allowed: `Pending → Shipped`, `Pending → Cancelled` (through the BE16 cancellation service), `Shipped → Delivered`. One shared transition service. Every change creates an OrderStatusChange with the admin's ID. Shipped and Delivered send emails after commit; email failure doesn't undo the change. Non-admins → 403.

**Done when:**
- [ ] Pending → Shipped → Delivered works, sends both emails, and records history; invalid changes are refused.

## BE16 — Cancellation

Shopper and admin cancellation use the same service. Shoppers need ownership and `Pending` status.

In one transaction: lock the order, verify its status, lock the product rows, restore stock, set Cancelled, create the OrderStatusChange, create a Refund (`cancellation`, full amount including delivery, status `requested`), commit. **After commit,** call Paystack's refund API and update the Refund. If test refunds don't work (BE0), leave it `requested` and note this in the README.

If the refund fails, the order stays Cancelled and the Refund becomes `failed` (retryable). Cancellation is idempotent: no double stock restoration and no duplicate refund. Send a cancellation email with the refund amount and "Refunds usually take a few business days to reach your mobile money wallet."

**Done when:**
- [ ] Cancelling a Pending order restores stock, creates one refund, and sends the email; cancelling twice changes nothing more.
- [ ] Cancelling a Shipped order, or someone else's, is refused.

## BE17 — Admin Refunds

```text
POST /api/admin/orders/:id/refunds
```

Admin only. Full (everything left) or partial (an amount in pesewas), with a required reason of up to 200 characters. The amount must be positive and no more than the remaining refundable amount (paid minus all refunds not `failed`). Lock the order while creating the refund record, commit, then call Paystack outside the transaction. A failed refund can be retried without creating a duplicate provider refund. Refunds never change order status or restore stock. The shopper is emailed the amount, reason, and timing.

**Done when:**
- [ ] A partial refund, then a full refund of the rest, both work; refunding more than what's left is refused; both emails arrive.

## BE18 — Reviews

```text
GET    /api/products/:id/reviews?sort=recent|highest|lowest&page=
POST   /api/products/:id/reviews
PATCH  /api/reviews/:id
DELETE /api/reviews/:id
```

- Eligibility: the user owns a `Delivered` order with the product in its OrderItems.
- Rating 1–5, optional text up to 1,000 characters, one review per user and product. Users edit and delete only their own; `editedAt` updates on edit. If a hidden review is edited, it stays hidden.
- Public lists: 5 per page, sorted (default `recent`), with average, count, star breakdown, reviewer first name and last initial, and "Verified purchase."
- Hidden reviews are excluded from public results and all aggregates; the reviewer still sees theirs marked hidden.

**Done when:**
- [ ] A sample shopper can write, edit, and delete a review; an ineligible user is refused; sorting and the breakdown are correct.

## BE19 — Review Moderation

```text
GET    /api/admin/reviews?status=visible|hidden&page=
PATCH  /api/admin/reviews/:id/hide
PATCH  /api/admin/reviews/:id/unhide
DELETE /api/admin/reviews/:id
```

Admin only. The list shows 20 per page, newest first, with product, reviewer, rating, text, date, and status. Hiding needs a reason (up to 200 characters) and records the time and admin. Deleting needs a reason and is permanent; averages update. **Stretch:** `ReviewModerationLog`.

**Done when:**
- [ ] Hiding removes a review from public results and the average; unhiding restores it; deleting removes it.

## BE20 — Dashboard and Settings

```text
GET   /api/admin/dashboard?period=today|7d|30d|all
PATCH /api/admin/settings/low-stock-threshold
```

Default period `7d`, in Ghana time. The dashboard returns:

- **Sales:** revenue = paid order totals − refunds not `failed`; order count (Cancelled excluded); average order value = revenue ÷ order count, rounded to the nearest pesewa, or `null` with no orders. All in pesewas.
- **Refunds:** total refunded in the period, and the number of failed refunds needing attention.
- **Recent orders:** the latest 5, with links.
- **Counts:** Pending orders and hidden reviews.
- **Stock:** low-stock products (active, stock ≤ threshold, lowest first) and out-of-stock products, calculated live. The low-stock count is used for the admin menu badge.

The threshold is a whole number from 0 to 1,000 (default 5). Admin only.

**Done when:**
- [ ] The sales figures match MySQL Workbench for each period; the low-stock list changes with the threshold and after a cancellation.

## BE21 — Product Image Uploads (ImageKit) — Stretch

**Stretch: build only if I ask.** The frontend has no upload page in this project; product photos are uploaded through ImageKit's website and added to the seed data.

```text
GET    /api/admin/images/auth
POST   /api/admin/products/:id/images
DELETE /api/admin/products/:id/images/:imageId
```

- `GET /api/admin/images/auth` returns short-lived ImageKit upload authorization parameters, generated on the server. `IMAGEKIT_PRIVATE_KEY` never leaves the server.
- The frontend uploads directly to ImageKit, then calls `POST .../images` with the returned URL and file ID, alt text, and whether it's the main image. The server checks the URL comes from `IMAGEKIT_URL_ENDPOINT`.
- Allowed formats: JPEG, PNG, and WebP, up to 2 MB (enforced in the upload parameters where ImageKit allows it, and checked again when saving).
- Admin only. A product always has at most one main image.

**Done when:**
- [ ] An image uploaded with the auth parameters is saved to a product and appears in product details; a non-admin is refused.

## BE22 — Deployment, Final Review, and README

- Deploy to Render with production environment variables, the production MySQL database, migrations and seeders run, and production `NODE_ENV`. Set Paystack's webhook URL to the Render address and test a real test-mode webhook.
- Run the Final Production Review (Section 21).
- Make sure `docs/api.md` is complete and matches the code.
- Write `README.md`: what the backend does, setup, `.env` example, migrations and seeders, test numbers, image credits, deployment steps, and a note that sample shoppers and reviews are demo data.
- **Stretch:** Jest + Supertest tests for the most important rules: money calculations, status transitions, refund limits, stock never going negative, and ownership checks.

**Done when:**
- [ ] The deployed API passes the health check and the full Thunder Client collection.

---

# 10. Email Architecture

Keep SMTP inside an email service:

```text
services/email/
├── email.service.js
└── templates/
    ├── verification.js
    ├── loginAlert.js
    ├── loginCode.js
    ├── orderConfirmation.js
    ├── orderShipped.js
    ├── orderDelivered.js
    ├── cancellation.js
    └── refund.js
```

Send emails after the database transaction commits. Failures are logged and never roll back business operations (except the login code, where the user is told to try again). Never log SMTP passwords, tokens, login codes, or other secrets.

# 11. API Security

Implement and test: JWT validation and expiry, cookie settings, the CSRF header check, ownership authorization, admin authorization, Zod validation on every body, query, and parameter, rate limiting (login, register, verify, resend, login codes, checkout, verify payment), request size limits, strict CORS, `helmet` headers, safe error handling, mass-assignment protection (only copy allowed fields from requests), and redaction of sensitive data in logs.

# 12. Database Integrity

Use foreign keys, unique constraints, indexes on common filters (for example, `Order.status`, `Order.createdAt`, `Product.categoryId`), transactions, and row locks where required.

Unique constraints: `User.email`, `Category.slug`, `Cart.guestToken`, `CartItem(cartId, productId)`, `Checkout.reference`, `Checkout.orderId`, `Order.orderNumber`, `Order.paymentReference`, `Order.confirmationToken`, `Review(userId, productId)`.

# 13. Concurrency

Critical operations must handle concurrent requests: two customers buying the last unit must never drive stock below zero. Use transactions, row locks, and a final stock recheck in checkout fulfilment, cancellation, refunds, cart merges, and admin state changes. If a deadlock occurs, retry the transaction once, then return a safe error.

# 14. Paystack Webhook Reliability

For every webhook: (1) verify the signature over the raw body (HMAC SHA512 with the secret key, timing-safe comparison; optionally also allow only Paystack's published webhook IPs); (2) parse safely; (3) identify the reference; (4) confirm it belongs to a known checkout; (5) verify amount, currency, and state; (6) fulfil only once, through the same service as verify; (7) record a `PaymentEvent`; (8) return a quick 200. Never trust webhook data blindly, and never fulfil the same payment twice.

# 15. Render Deployment

```text
Local development → Git → GitHub → Render → Express API (+ managed MySQL)
```

Production needs the correct environment variables, CORS origin, database configuration (Aiven, with SSL), Paystack keys and webhook URL, ImageKit credentials, SMTP credentials, JWT secret, and `NODE_ENV=production`. The app exposes `/api/health` and shuts down gracefully. Never commit `.env`.

# 16. Testing Strategy

Test every endpoint for:

- **Happy path:** valid requests succeed.
- **Validation:** missing fields, wrong types, invalid IDs and enums, negative or decimal values, and excessive lengths.
- **Authentication:** missing, invalid, and expired tokens.
- **Authorization:** wrong-user access, non-admin access, and ownership violations.
- **Business rules:** out-of-stock and inactive products, invalid status transitions, ineligible and duplicate reviews, invalid refund amounts, and invalid cancellations.
- **Concurrency:** final-stock races, duplicate verification and webhooks, repeated cancellation, and repeated refunds.
- **External failures:** Paystack failures and timeouts, refund failures, ImageKit failures, and email failures.

# 17. Thunder Client Collections

Organize requests into: Auth, Products, Cart, Checkout, Orders, Reviews, Admin, and Webhooks. Save success, validation, authorization, and edge-case requests.

# 18. MySQL Workbench Verification

After critical operations, check the real database: tables, keys, constraints, indexes, cart, order, review, and refund relationships, stock changes, and transaction results.

# 19. API Documentation

`docs/api.md` documents every endpoint: method, URL, authentication, admin requirement, parameters, query parameters, request body, success response, error responses, and examples. It must match the implementation, because the frontend is built from it alone.

# 20. Study Guide

`docs/backend-guide.md` gets a short section after each task, for a beginner: what was built and why, the files involved, endpoints, tables, how one request flows (route → middleware → validator → controller → service → model → response), and key concepts.

# 21. Final Production Review

**Code:** no duplicated business logic, clear service boundaries, no unnecessary dependencies, no dead code, no debug logging.

**Security:** secrets absent from Git; JWT, cookies, and CSRF check reviewed; password hashing reviewed; authorization and IDOR tested; validation and rate limits tested; CORS and headers reviewed; no error leakage; mass assignment reviewed.

**Database:** migrations, seeders, and constraints work; transactions reviewed; stock concurrency tested; indexes reviewed.

**Payments:** verification, webhook signature, duplicate events, amount and currency checks, idempotency, refund failures, and cancellation/refund state tested.

**Email:** verification, login alert, login code, order confirmation, status, cancellation, and refund emails tested; email failures don't corrupt business state.

**Deployment:** repository clean, `.env` ignored, Render variables configured, health endpoint works, production database configured, logs don't expose secrets.

---

# 22. If Time Runs Out

Finish tasks in this order and cut from the end, leaving time for the frontend:

BE1, BE2, BE3, BE4, BE5, BE7, BE8 (verify only), BE9, BE11, BE14, BE15, BE16, BE6, BE18, BE20, BE17, BE19, BE13, BE10, BE12, BE21, BE22 (webhook testing and deployment).
