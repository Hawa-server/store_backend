# Online Store Backend

The API for a small online fashion and beauty store (bags, makeup, skincare, jewellery, accessories and perfumes), built as a class final project.

Shoppers can:
- browse products (with prices in GHS and USD);
- keep a cart, as a guest or logged in;
- pay with **mobile money** through Paystack (test mode);
- get an order confirmation email;
- track and cancel their orders;
- review the products they've received.

Accounts use email verification, an optional emailed login code, and login alerts.

The admin can:
- manage orders (ship, deliver, cancel);
- give full or partial refunds;
- moderate reviews;
- see a sales and stock dashboard.

The frontend is a separate React project. **Everything the frontend needs is in [docs/api.md](docs/api.md).**

---

## Tech stack

| Area | Used |
|---|---|
| Server | Node.js (20+), Express 5 |
| Database | MySQL 8 with Sequelize (migrations and seeders with sequelize-cli) |
| Validation | Zod (every body, query and URL parameter) |
| Security | bcryptjs (cost 12), JWT in HTTP-only cookies, helmet, CORS, express-rate-limit, a CSRF header check |
| Payments | Paystack (test mode, mobile money): server-side verification and signed webhooks |
| Email | Brevo's transactional email **HTTP API** (called with Node's built-in `fetch`; real emails to real inboxes) |
| Images | ImageKit URLs |
| Hosting | Render (API) + Aiven MySQL with SSL (database) |

## Folder layout

```text
server.js          starts the server; graceful shutdown
app.js             Express setup: security middleware, JSON parsing, routes, errors
config/            database settings (shared by the app and sequelize-cli)
routes/            URLs → middleware → controller
middleware/        auth, admin, validation, rate limits, CSRF check, errors
validators/        Zod schemas
controllers/       HTTP in, JSON out (no business rules)
services/          the business rules (auth, cart, checkout, payment, order, refund, review, dashboard, email…)
models/            Sequelize models (one per table)
migrations/        the database structure, step by step
seeders/           starting data (categories, products + photos from docs/catalogue.md, settings, admin, demo data)
utils/             small helpers (money, dates, tokens, cookies, pagination…)
docs/              api.md (for the frontend), backend-guide.md (study guide), catalogue.md (products), postman_collection.json
```

---

## Running it locally

**You need:** Node.js 20 or newer, MySQL 8 (local), a free [Brevo](https://www.brevo.com) account (with a verified sender and an API key, see **Emails** below), and a [Paystack](https://paystack.com) account in **test mode**.

1. **Install:**
   ```bash
   npm install
   ```
2. **Create the database** in MySQL, for example `CREATE DATABASE store_db;`, plus a user that has access to it.
3. **Configure:** copy `.env.example` to `.env` and fill it in (see the table below). **Never commit `.env`**; it's already in `.gitignore`.
4. **Create the tables and starting data:**
   ```bash
   npx sequelize-cli db:migrate
   npx sequelize-cli db:seed:all
   ```
5. **Start:**
   ```bash
   npm run dev     # development, restarts on changes (type "rs" to restart by hand)
   npm start       # production
   ```
6. **Check:** open <http://localhost:5000/api/health>. You should see `{"status":"ok","database":"ok"}`.

Other commands:

```bash
npx sequelize-cli db:migrate:undo:all   # remove all tables
npx sequelize-cli db:seed:undo:all      # remove all seeded data
```

### Environment variables (`.env`)

| Variable | What it is |
|---|---|
| `PORT` | The port the API listens on (5000 locally; Render sets it automatically) |
| `NODE_ENV` | `development` locally, `production` on Render. Production turns on secure cookies and never prints login codes |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | The MySQL connection. Locally, `127.0.0.1` is more reliable than `localhost` |
| `DB_SSL` | `false` locally; `true` for Aiven |
| `DB_CA_CERT` | Aiven's CA certificate (the whole text). Only used when `DB_SSL=true`. Line breaks may be written as `\n` |
| `TRUST_PROXY_HOPS` | How many proxies sit in front of the API, so rate limits see each shopper's real IP. **Production: `4`** (Vercel's rewrite, then 3 proxies at Render, see "Frontend on Vercel" below). Leave it out locally (it defaults to 1) |
| `CLIENT_URL` | The frontend's address (the only origin CORS allows). It's also used in email links |
| `JWT_SECRET` | A long random secret for login tokens. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Use a **different** one in production |
| `JWT_EXPIRES_IN` | How long a login lasts (`1d`) |
| `PAYSTACK_SECRET_KEY` | Your Paystack **test** secret key (`sk_test_…`). It's also used to check webhook signatures |
| `IMAGEKIT_*` | Optional. Only needed for API image uploads, a stretch task that isn't built |
| `BREVO_API_KEY` | Your Brevo **API key** (starts with `xkeysib-`; not the SMTP key) |
| `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS` | The sender shown on emails, e.g. `"Adorn"` and an address **verified in Brevo** |
| `STORE_CONTACT_EMAIL`, `STORE_CONTACT_PHONE` | The store's contact details, shown at the bottom of order emails |
| `LOGIN_CODE_ENABLED` | `true` = after the password, a 6-digit code is emailed (and printed in the console in development only); `false` = password only. Restart after changing it |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The admin account the admin seeder creates (password at least 8 characters) |

---

## Demo data

The seeders create:
- **6 categories** and **41 products**, each with a price, stock, description and photo. They're read from **[docs/catalogue.md](docs/catalogue.md)**, the single product list: edit that file and re-seed to change the catalogue. **Makeup Setting Spray** (stock 2) is the low-stock demo product and **Pearl Stud Earrings** (stock 0) the out-of-stock one;
- the settings: USD rate 15.50, low-stock threshold 5 (and the old flat delivery fee GHS 20.00, no longer used since BE24);
- **delivery areas** *(BE24)*: Ghana's **16 regions** and **18 towns**, with starting fees from Kumasi, where the store ships from (for example Kumasi GH₵ 10, the rest of Ashanti GH₵ 15, Accra GH₵ 20, Tamale GH₵ 50). **These fees are examples:** the store owner should check them and change them in the admin;
- **the admin account**, from `ADMIN_EMAIL` and `ADMIN_PASSWORD`;
- **sample data (DEMO DATA, not real customers):** 3 sample shoppers, each with a Delivered order (numbered `ORD-DEMO-…`) and a few reviews, so product pages and the dashboard aren't empty.

| Sample shopper | Password |
|---|---|
| `ama.mensah@example.com` | `DemoShopper123` |
| `kwame.boateng@example.com` | `DemoShopper123` |
| `efua.owusu@example.com` | `DemoShopper123` |

The demo orders were never paid through Paystack, so trying to **refund** one is refused by Paystack. That's handy for seeing the "failed refund → retry" screens. They were also placed "before" delivery areas, so they show **"Delivery area: not recorded"** and the old flat GH₵ 20 fee.

---

### Managing products (admin)

The admin can list, add and edit products through the API (`/api/admin/products`, see [docs/api.md](docs/api.md)): name, description, category, price, stock, the main photo (an ImageKit address), and whether it's on sale. Products are never deleted, only **deactivated** (`isActive: false`), because past orders refer to them.

**These are live database changes.** `docs/catalogue.md` is only what the **seeders** use to build a new database. If the database is rebuilt from the seeders, it gets the catalogue again, and products added or changed through the admin are not kept. So after products have been edited in production, don't re-seed it, or update `docs/catalogue.md` to match first.

### Delivery fees (admin)

The delivery fee depends on the region and town the shopper chooses at checkout: **the town's own fee if it has one, otherwise the region's fee**. The admin can change any region or town fee, add towns, and hide or show regions and towns (`/api/admin/delivery-areas`, `/api/admin/delivery-regions/:id`, `/api/admin/delivery-towns`, see [docs/api.md](docs/api.md)). Nothing is deleted, because orders refer to them, and at least one region always stays active.

A fee change only affects **new** checkouts: every order keeps the fee and area it was charged, in its emails and refunds too.

### Wishlist

Logged-in shoppers can save up to **100 products** for later (`/api/wishlist`, see [docs/api.md](docs/api.md)). Saving twice keeps one copy; the list always shows the **current** price and stock; products removed from the shop stay in the list marked unavailable. Guests see the ♡ but are asked to log in. Deleting the account deletes its wishlist.

### Forgot password and deleting an account

- **Forgot password:** the shopper asks for a link (`POST /api/auth/forgot-password`); the answer is the same whether or not the email has an account. The emailed link works **once, for 30 minutes**, and a newer link cancels older ones. Setting a new password (`POST /api/auth/reset-password`) **logs the account out on every device** and sends a "password changed" email. In development, the reset link is also printed in the server console.
- **Delete account** (`DELETE /api/account`): needs the current password and the word `DELETE`. Refused for admins, and while an order is Pending or Shipped (or a payment is in progress).
- **Privacy note:** deleting an account removes the login, the reviews and the cart, and frees the email address (registering again creates a new, empty account). **Order records are kept** for the store's accounts (sales and refunds), no longer linked to any account the person can log in to; the admin sees them as "Deleted user".
- **Signing out everywhere:** each login token carries the account's `sessionVersion`; a reset or deletion raises it, so all older logins stop working at once.

### Guest orders and new accounts

Someone who pays **as a guest** and later creates an account with the **same email** finds those orders in **My Orders** (with cancelling while Pending, and reviews once Delivered), and what was left in the guest cart they paid from in their account cart. This happens only **after the email is verified** (right after verification, and again at every login), because orders contain a name, phone and address. Carts from checkouts that were never paid aren't moved. The verify and login responses report it in `linked` (see [docs/api.md](docs/api.md)).

## Testing

### Postman

Import [docs/postman_collection.json](docs/postman_collection.json) into Postman. It has every endpoint, grouped as Health, Auth, Account, Products, Cart, Wishlist, Delivery areas, Checkout, Orders, Reviews, Admin and Webhooks. The variables `deliveryRegionId` and `deliveryTownId` (both 1: Ashanti, Kumasi) are used by Checkout and the admin delivery requests.

- Set the collection variable **`baseUrl`**: `http://localhost:5000` locally, or your Render address.
- Run **Auth → Log in** first. Postman keeps the login cookie for the rest. For the Admin folder, change the `email` and `password` variables to your admin account.
- Copy ids into the variables as you go (`orderId`, `reference`, `reviewId`…). **`orderId` and `productId` are UUIDs** (the `id` from My Orders / the admin list, or from `GET /api/products`, e.g. `3f2a9c1e-…`), not numbers.
- When pasting URLs, make sure there's **no space at the end**: Postman shows it as a faint dot, and the API then answers "The requested resource was not found."

### Paystack test payments (mobile money)

- Paystack's official test page lists **one** Ghana mobile money test number: **0551234987** (MTN, no PIN or OTP). It always **succeeds**.
- There are **no** test numbers for "declined" (wrong PIN or not enough money), "timed out" or "reversed". So:
  - **success** is tested with real Paystack test payments;
  - **abandoned** (not completed) is tested with real Paystack: open the payment page, close it without paying, then verify;
  - **declined, reversed, pending rechecks, Paystack timeouts, network errors and late duplicate payments** are tested with an automated script that replaces Paystack's answers inside the test process only.
- **Refunds work in test mode.** These real test refunds were all accepted by Paystack (status `processed`, with a Paystack refund id):
  - the "paid but sold out" refund in a race for the last unit of a product;
  - a shopper's cancellation;
  - an admin's partial refund, then a full refund.

### Emails

Emails are sent through **[Brevo](https://www.brevo.com)'s transactional email API**: one HTTPS request per email (`POST https://api.brevo.com/v3/smtp/email`), so they reach **real inboxes**. The free plan allows 300 emails a day.

**Why an API and not SMTP:** Render's free plan blocks outgoing SMTP ports, so SMTP (Nodemailer, Ethereal, Mailtrap) can't send from the live API. HTTPS (port 443) always works. Node 22's built-in `fetch` sends the request, so no email library is needed.

**Setting it up:**
1. Create a free Brevo account.
2. **Verify the sender:** *Senders, domains & dedicated IPs → Senders → Add a sender*, and click the link Brevo emails you. Put that address in `EMAIL_FROM_ADDRESS`.
3. **Create an API key:** *SMTP & API → API Keys → Generate a new API key*. It starts with `xkeysib-`. (The **SMTP** key, `xsmtpsib-…`, doesn't work with the API.) Put it in `BREVO_API_KEY`, and never commit it.
4. Set the same three values on Render (**Environment**).

**Checking that an email was sent:** in Brevo, *Transactional → Logs* (or *Statistics*) lists every email, whether it was delivered, and why not. In development, the server prints `[email] "<subject>" accepted by Brevo (<message id>)`.

**Spam folder:** the sender is a `@gmail.com` address and the store has no domain of its own, so Gmail and others may put the emails in **Spam** (they can't be signed for gmail.com by Brevo). Tell testers to check Spam. The proper fix later is a domain of your own, authenticated in Brevo (SPF/DKIM/DMARC).

**If sending fails**, the log shows Brevo's reason, e.g. `[email] verification email failed: Brevo returned HTTP 401: unauthorized: Key not found` (wrong or deleted key) or `… 400: … sender … not valid` (sender not verified). A request that takes longer than 10 seconds is given up. If live emails fail with a 401 about an **unrecognised IP address**, turn off **Authorised IPs** in Brevo's security settings (Render's addresses change).

The emails are:
- verification;
- login alert and login code;
- order confirmation;
- shipped and delivered;
- cancellation;
- refund.

If an email fails, it's logged and never breaks the order or login. The one exception is the login code, where the user is asked to try again.

Only use real addresses you own (or testers who agreed): Brevo really delivers, so made-up addresses like `@example.com` just bounce.

---

## Deployment (Render + Aiven)

### 1. Database: Aiven MySQL
1. Create a free **MySQL** service on [Aiven](https://aiven.io).
2. From its **Overview** page, note the **host, port, user and password**, and **download the CA certificate**.
3. Use the default database (`defaultdb`), or create one (e.g. `store_db`) under **Databases**.

### 2. Code: GitHub
Commit and push the project. Check first that `.env` is **not** included: `git status` must not list it.

### 3. API: Render web service
1. On [Render](https://render.com): **New → Web Service**, connect the GitHub repository, runtime **Node**.
2. **Build command:**
   ```bash
   npm ci && npx sequelize-cli db:migrate
   ```
   This creates or updates the tables on every deploy. Render's free plan has no "pre-deploy" step, so the migrations run in the build.
3. **Start command:** `npm start`
4. **Health check path:** `/api/health`
5. **Environment variables:** everything from the table above, with production values:
   - `NODE_ENV=production`, `DB_SSL=true`, and `DB_CA_CERT` = the whole certificate text;
   - the Aiven `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` and `DB_PASSWORD`;
   - a **new** `JWT_SECRET`, and a strong `ADMIN_PASSWORD`;
   - `CLIENT_URL` = the frontend's **Vercel** address, e.g. `https://<your-app>.vercel.app` (no slash at the end). It's used for CORS, the Paystack return page and the links in emails;
   - `TRUST_PROXY_HOPS=4` (shoppers reach the API through Vercel, then Cloudflare and Render's own proxies; see step 7);
   - the Paystack test key, `BREVO_API_KEY`, `EMAIL_FROM_NAME` and `EMAIL_FROM_ADDRESS` (delete any old `SMTP_*` and `EMAIL_FROM` variables), the store contact details and `LOGIN_CODE_ENABLED`.

   Don't set `PORT`; Render provides it.

### 4. Starting data
Render's build only creates the **tables**. The starting data (categories, the 41 products with photos, settings, the admin and the demo data) is added **once**, from your computer:
1. Create **`.env.production`** in the project folder with the Aiven values: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL=true`, `DB_CA_CERT` (the whole certificate in double quotes; line breaks are fine), and the `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the live admin account. **It's git-ignored** (every `.env.*` file except `.env.example`), so it's never committed.
2. Run:
   ```bash
   npm run seed:production
   ```
   It first prints which database it's about to fill (host and name, never the password), and stops with a clear message if a setting is missing.
3. Check `https://<your-render-service>.onrender.com/api/products`: you should see 41 products with photos.

Run it only once: a second run fails on the unique rules (for example category slugs), which stops the data from being duplicated. Until it has run, `/api/health` is fine, but `/api/products` answers 500, because the settings (like the USD rate) don't exist yet.

**Adding one new seeder later** (a database that already has data): give the seeder's file name, and only that seeder runs (it's passed to sequelize-cli's `--seed` option):
```bash
npm run seed:production -- 20261012000001-delivery-areas.js
```
The delivery-areas seeder skips regions and towns that already exist, so running it twice does no harm, and it never overwrites fees the admin has changed.

### 5. Paystack webhook
In the Paystack dashboard (**test mode**), go to **Settings → API Keys & Webhooks** and set the **Test Webhook URL** to:
```text
https://<your-render-service>.onrender.com/api/webhooks/paystack
```

### 6. Check it
1. `https://<your-render-service>.onrender.com/api/health` → `{"status":"ok","database":"ok"}`.
2. Run the Postman collection with `baseUrl` set to the Render address.
3. **Real webhook test:** start a checkout, pay with 0551234987, and **close the page without calling verify**. The order should still appear (in the admin orders, and in the `PaymentEvents` table with outcome `fulfilled`). Paystack's webhook created it on its own.

**Render free plan:** the service sleeps after about 15 minutes without traffic, and the first request then takes up to a minute. Paystack retries webhooks that fail, and the verify endpoint is safe to call again, so no payment is lost.

### 7. Frontend on Vercel
The React frontend is deployed on **Vercel**. Its `vercel.json` **rewrites** every `/api/*` request to the Render API, so the browser only ever talks to the Vercel address:

```text
shopper's browser ──► https://<your-app>.vercel.app/api/products
                          │  Vercel rewrite (server-side, invisible to the browser)
                          ▼
                     https://<your-render-service>.onrender.com/api/products ──► Express
```

Why this matters:
- **Cookies are first-party.** The login and cart cookies belong to the Vercel domain, so they work in every browser. Safari and some privacy settings block cookies from a *different* site, which is what happens if the frontend calls `onrender.com` directly.
- **Rate limits need `TRUST_PROXY_HOPS=4` on Render.** Each shopper's request passes **four** proxies before Express: Vercel, then three at Render (Cloudflare, which Render uses in front of its services, and Render's own load balancers). Each one adds an address to the `X-Forwarded-For` header. Vercel puts the shopper's real IP first and **overwrites** any value the browser sends, so it can't be faked through Vercel (see [Vercel's request headers docs](https://vercel.com/docs/headers/request-headers)). With `4`, Express reads the shopper's IP; with fewer, it reads a proxy's address and every shopper shares **one** limit (for example 10 logins per 15 minutes for the whole shop).
- **How 4 was found (and how to re-check it):** the rate-limited endpoints send a `RateLimit-Policy` header whose `pk` value is a fingerprint (first 12 hex characters of SHA-256) of the key being counted. Calling `POST /api/auth/login` through the Vercel address and comparing `pk` with the fingerprint of your own IP shows whether the server sees you; adding a fake `X-Forwarded-For` header must not change it. With 1, 2 and 3 the key was a proxy's address; with 4 it was the real IP, and fake headers were ignored. If Render or Vercel ever change their setup, repeat this check.
- **Set `CLIENT_URL`** on Render to the Vercel address, so CORS accepts the frontend, Paystack returns shoppers to `/checkout/complete` on Vercel, and email links open the Vercel site.

After changing `TRUST_PROXY_HOPS` or `CLIENT_URL` on Render, save; Render redeploys.

**Known limit:** the Render address is still public, and with `4` trusted hops, someone who calls `onrender.com` **directly** (not through Vercel) could send their own `X-Forwarded-For` header and choose the IP the rate limiter sees. Shoppers always come through Vercel, so this only matters for deliberate abuse. Blocking direct access would need a secret header added by the proxy, which is beyond this project. Paystack's webhooks call Render directly and aren't affected: the webhook isn't rate-limited, and it's protected by its signature instead.

### 8. Releasing a change that needs the frontend too (BE24: delivery areas)
BE24 changes `POST /api/checkout`: it now **requires** `deliveryRegionId`. A frontend without the region and town picker would get a 400 at every checkout. So the backend and frontend go live together, in this order:

1. **Merge the backend** (`dev` → `main`) and push. Render redeploys, and its build runs the BE24 migrations on Aiven (the two new tables and the new order columns).
2. **Run the delivery seeder in production**, from your computer (`.env.production` as in step 4):
   ```bash
   npm run seed:production -- 20261012000001-delivery-areas.js
   ```
   Check `https://<your-render-service>.onrender.com/api/delivery-areas`: 16 regions.
3. **Merge the frontend** (with the region and town picker, FE12). Vercel redeploys.

Between steps 1 and 3 the live checkout is refused (no region is sent), so do the three steps one after another. Then test a real test payment to Tamale: the total should include GH₵ 50.00, and the email should say "Delivery to: Tamale, Northern — GHS 50.00".

**BE25 (guest linking)**, **BE26 (order UUIDs)** and **product UUIDs** go out in the same backend merge. Order and product addresses change from numbers (`/orders/9`, `/products/12`) to UUIDs, and the cart's `productId` must be the product's UUID, so the frontend must use `order.id` / `product.id` as strings, never numbers. The migrations change **every order and product row**, so **back up the production database first** (step 9).

### 9. Backing up the production database
Before a migration that changes existing rows (such as BE26's), take a copy of the Aiven database from your computer:

- **MySQL Workbench:** connect to Aiven (host, port, user, password, and the downloaded CA certificate under **SSL**), then **Server → Data Export**, choose the database, **Export to Self-Contained File**, and **Start Export**.
- **Or the command line** (`mysqldump` comes with MySQL; use the values from `.env.production`, and the CA certificate file you downloaded from Aiven):
  ```bash
  mysqldump --host=<DB_HOST> --port=<DB_PORT> --user=<DB_USER> -p \
    --ssl-mode=VERIFY_CA --ssl-ca=ca.pem \
    --single-transaction --set-gtid-purged=OFF <DB_NAME> > adorn-backup-$(date +%F).sql
  ```
  `-p` asks for the password, so it isn't saved in your shell history. Keep the `.sql` file **out of the project folder** (it contains customer details), and never commit it.

To restore, if ever needed: `mysql --host=… --port=… --user=… -p --ssl-mode=VERIFY_CA --ssl-ca=ca.pem <DB_NAME> < adorn-backup-YYYY-MM-DD.sql`.

---

## Documentation

- [docs/api.md](docs/api.md): every endpoint, for the frontend (requests, responses, errors).
- [docs/backend-guide.md](docs/backend-guide.md): a study guide explaining how and why each part was built.
- [docs/backend-plan.md](docs/backend-plan.md): the build plan (tasks BE1–BE22).
- The extra tasks added after the plan: [BE23 product management](docs/BE23-product-management.md), [BE24 delivery zones](docs/BE24-delivery-zones.md), [BE25 linking guest orders](docs/BE25-link-guest-orders.md), [BE26 order UUIDs](docs/BE26-order-public-ids.md).

## Image credits

All product photos are stored in the store's own **ImageKit** account (`https://ik.imagekit.io/ADORN`) and are used for this class project only. Each product's photo URL and description (alt text) are listed in [docs/catalogue.md](docs/catalogue.md). The originals are large, so the frontend requests smaller versions with ImageKit's width setting (e.g. `?tr=w-600`).
