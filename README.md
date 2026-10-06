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
| Email | Nodemailer + Ethereal (a free test SMTP service: emails are caught, never delivered) |
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

**You need:** Node.js 20 or newer, MySQL 8 (local), a free [Ethereal](https://ethereal.email) test account (click **Create Ethereal Account** and copy the SMTP details), and a [Paystack](https://paystack.com) account in **test mode**.

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
| `TRUST_PROXY_HOPS` | How many proxies sit in front of the API: `1` = Render only; `2` = the frontend host also forwards `/api` (see "Frontend and cookies" below). Needed so rate limits see each visitor's real IP |
| `CLIENT_URL` | The frontend's address (the only origin CORS allows). It's also used in email links |
| `JWT_SECRET` | A long random secret for login tokens. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Use a **different** one in production |
| `JWT_EXPIRES_IN` | How long a login lasts (`1d`) |
| `PAYSTACK_SECRET_KEY` | Your Paystack **test** secret key (`sk_test_…`). It's also used to check webhook signatures |
| `IMAGEKIT_*` | Optional. Only needed for API image uploads, a stretch task that isn't built |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | The Ethereal SMTP details: `smtp.ethereal.email`, port `587`, and your Ethereal username and password |
| `EMAIL_FROM` | The sender shown on emails, e.g. `"Store <no-reply@store.test>"` |
| `STORE_CONTACT_EMAIL`, `STORE_CONTACT_PHONE` | The store's contact details, shown at the bottom of order emails |
| `LOGIN_CODE_ENABLED` | `true` = after the password, a 6-digit code is emailed (and printed in the console in development only); `false` = password only. Restart after changing it |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The admin account the admin seeder creates (password at least 8 characters) |

---

## Demo data

The seeders create:
- **6 categories** and **41 products**, each with a price, stock, description and photo. They're read from **[docs/catalogue.md](docs/catalogue.md)**, the single product list: edit that file and re-seed to change the catalogue. **Makeup Setting Spray** (stock 2) is the low-stock demo product and **Pearl Stud Earrings** (stock 0) the out-of-stock one;
- the settings: delivery fee GHS 20.00, USD rate 15.50, low-stock threshold 5;
- **the admin account**, from `ADMIN_EMAIL` and `ADMIN_PASSWORD`;
- **sample data (DEMO DATA, not real customers):** 3 sample shoppers, each with a Delivered order (numbered `ORD-DEMO-…`) and a few reviews, so product pages and the dashboard aren't empty.

| Sample shopper | Password |
|---|---|
| `ama.mensah@example.com` | `DemoShopper123` |
| `kwame.boateng@example.com` | `DemoShopper123` |
| `efua.owusu@example.com` | `DemoShopper123` |

The demo orders were never paid through Paystack, so trying to **refund** one is refused by Paystack. That's handy for seeing the "failed refund → retry" screens.

---

## Testing

### Postman

Import [docs/postman_collection.json](docs/postman_collection.json) into Postman. It has every endpoint, grouped as Health, Auth, Products, Cart, Checkout, Orders, Reviews, Admin and Webhooks.

- Set the collection variable **`baseUrl`**: `http://localhost:5000` locally, or your Render address.
- Run **Auth → Log in** first. Postman keeps the login cookie for the rest. For the Admin folder, change the `email` and `password` variables to your admin account.
- Copy ids into the variables as you go (`orderId`, `reference`, `reviewId`…).
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

All emails go to **Ethereal**, a test service that catches them instead of delivering them, so no real inbox ever gets one. To read them, log in at [ethereal.email](https://ethereal.email/login) with the `SMTP_USER` and `SMTP_PASS` from `.env`, then open **Messages**. In development, the server also prints a **preview link** for every email it sends, e.g. `[email] "Your login code" → preview: https://ethereal.email/message/…`.

The emails are:
- verification;
- login alert and login code;
- order confirmation;
- shipped and delivered;
- cancellation;
- refund.

If an email fails, it's logged and never breaks the order or login. The one exception is the login code, where the user is asked to try again.

Ethereal is free and needs no sign-up, but it's **for testing only**, and its accounts and messages don't last forever. If sending starts failing with a login error, create a new Ethereal account and update `SMTP_USER` and `SMTP_PASS` (locally and on Render). To send real emails later, only the four `SMTP_*` values and `EMAIL_FROM` need to change; no code changes.

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
   - `CLIENT_URL` = the frontend's address (a placeholder until the frontend is deployed);
   - `TRUST_PROXY_HOPS=1`, or `2` if the frontend forwards `/api`;
   - the Paystack test key, the Ethereal SMTP details, the store contact details and `LOGIN_CODE_ENABLED`.

   Don't set `PORT`; Render provides it.

### 4. Starting data (once)
Render's build only creates the **tables**. The starting data (categories, the 41 products with photos, settings, the admin and the demo data) is added **once**, from your computer:
1. Create **`.env.production`** in the project folder with the Aiven values: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL=true`, `DB_CA_CERT` (the whole certificate in double quotes; line breaks are fine), and the `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the live admin account. **It's git-ignored** (every `.env.*` file except `.env.example`), so it's never committed.
2. Run:
   ```bash
   npm run seed:production
   ```
   It first prints which database it's about to fill (host and name, never the password), and stops with a clear message if a setting is missing.
3. Check `https://<your-render-service>.onrender.com/api/products`: you should see 41 products with photos.

Run it only once: a second run fails on the unique rules (for example category slugs), which stops the data from being duplicated. Until it has run, `/api/health` is fine, but `/api/products` answers 500, because the settings (like the USD rate) don't exist yet.

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

### Frontend and cookies
In production the frontend and the API are on **different sites**, so the login and cart cookies are "third-party" cookies, which **Safari and some privacy settings block**. Recommended: let the frontend host forward `/api/*` to the Render address (a rewrite on Vercel, or a proxy/redirect on Netlify), and set `TRUST_PROXY_HOPS=2`. The cookies then belong to the frontend's own domain. Details are in [docs/api.md](docs/api.md) ("Base URL").

---

## Documentation

- [docs/api.md](docs/api.md): every endpoint, for the frontend (requests, responses, errors).
- [docs/backend-guide.md](docs/backend-guide.md): a study guide explaining how and why each part was built.
- [docs/backend-plan.md](docs/backend-plan.md): the build plan (tasks BE1–BE22).

## Image credits

All product photos are stored in the store's own **ImageKit** account (`https://ik.imagekit.io/ADORN`) and are used for this class project only. Each product's photo URL and description (alt text) are listed in [docs/catalogue.md](docs/catalogue.md). The originals are large, so the frontend requests smaller versions with ImageKit's width setting (e.g. `?tr=w-600`).
