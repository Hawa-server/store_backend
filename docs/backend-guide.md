# Backend Study Guide

A beginner-friendly explanation of how this backend works, written one task at a time. Read it top to bottom: each section builds on the ones before it.

---

## How the project is organised

```text
server.js      starts the server; shuts down cleanly
app.js         builds the Express app: security middleware → routes → errors
config/        database connection settings
models/        one file per table: what the data looks like in JavaScript
migrations/    step-by-step instructions that create the tables in MySQL
seeders/       starting data (categories, products, settings, admin, demo data)
routes/        map a URL + method to the code that handles it
controllers/   read the request, call a service, send the response
services/      the business rules (cart totals, payments, refunds...)
validators/    Zod schemas: what a valid request body/query looks like
middleware/    code that runs on many requests (CSRF check, login check, errors)
utils/         small shared helpers (e.g. AppError)
docs/          the plan, API reference and this guide
```

Each layer has one job, which makes the code easier to find, test and explain:

- **Routes** only map URLs.
- **Controllers** only coordinate.
- **Services** hold the rules.
- **Models** talk to the database.

---

## BE1: Project setup

### What was built and why

BE1 builds the foundation that every later task sits on. Nothing here is visible to shoppers yet, but it decides how every request is handled:

- an Express server with security middleware,
- a MySQL database with all the tables the store will ever need,
- starting data,
- one consistent error format,
- a health check.

### New files

| File | Purpose |
|---|---|
| `package.json` | Lists the packages and the `npm run dev` / `npm start` scripts |
| `.env` / `.env.example` | Secrets and settings. `.env` is private; `.env.example` is the committed template |
| `.gitignore` | Stops `.env`, `node_modules` and certificates from being committed |
| `.sequelizerc` | Tells `sequelize-cli` where the config, models, migrations and seeders are |
| `config/database.js` | Database connection settings (UTC, SSL for Aiven in production) |
| `server.js` | Connects to the database, starts listening, shuts down gracefully |
| `app.js` | Express app and middleware order |
| `middleware/csrfCheck.js` | Rejects POST/PATCH/DELETE without `X-Requested-With` |
| `middleware/requireJson.js` | Rejects bodies that aren't JSON |
| `middleware/notFound.js` | Standard 404 for unknown routes |
| `middleware/errorHandler.js` | Turns every error into the standard JSON error shape |
| `utils/AppError.js` | An error type that carries a status, code, message and optional fields |
| `routes/health.routes.js` | `GET /api/health` |
| `models/*.js` | 15 models, one per table, with relationships |
| `migrations/*.js` | 15 migrations that create the tables |
| `seeders/*.js` | Categories, products, settings, admin user, sample data |

### New endpoint

- `GET /api/health` returns `{ "status": "ok", "database": "ok" }`, or 503 if the database is down.

### The middleware order (`app.js`)

Every request passes through these steps, top to bottom. If a step finds a problem, it skips straight to the error handler.

```text
request
  → helmet            adds security headers to every response
  → cors              only our frontend (CLIENT_URL) may call us, with cookies
  → csrfCheck         POST/PATCH/DELETE must have X-Requested-With: XMLHttpRequest
  → requireJson       bodies must be JSON
  → express.json      parses the JSON (max 100 kb); keeps the raw bytes for the Paystack webhook
  → cookieParser      reads cookies (login token, guest cart) into req.cookies
  → routes            e.g. /api/health
  → notFound          nothing matched → 404
  → errorHandler      every error → { error: { code, message, fields? } }
response
```

### How one request flows

Example 1: `GET /api/health`.

1. The request passes helmet, cors and cookieParser. It is a GET, so the CSRF and JSON checks let it through.
2. `app.js` sends `/api/health` to `routes/health.routes.js`.
3. The route asks Sequelize to ping MySQL (`sequelize.authenticate()`).
4. It responds `200 { status: 'ok', database: 'ok' }`.

Example 2: `POST /api/anything` **without** the header.

1. `csrfCheck` sees a POST without `X-Requested-With` and calls `next(new AppError(403, 'FORBIDDEN', ...))`.
2. Express skips every remaining middleware and route, and jumps to `errorHandler`.
3. `errorHandler` sends `403 { error: { code: 'FORBIDDEN', message: '...' } }`.

### The tables and how they relate

```text
Users ─┬─< EmailTokens              (verification links, login codes)
       ├── Carts (one per user) ─< CartItems >── Products
       ├─< Orders ─┬─< OrderItems >── Products
       │           ├─< OrderStatusChanges
       │           ├─< Refunds
       │           └── Checkouts (one checkout → at most one order)
       └─< Reviews >── Products

Categories ─< Products ─< ProductImages
PaymentEvents   (webhook log, linked by payment reference)
Settings        (key/value: usdRate, deliveryFee, lowStockThreshold)
```

`A ─< B` means "one A has many B". For example, one Order has many OrderItems.

- **Cart vs Checkout vs Order.**
  - A **Cart** is what you're thinking of buying.
  - A **Checkout** is created when you click "Pay". It saves the server-calculated total and a payment reference.
  - An **Order** is created only after Paystack confirms payment.
- **Historical copies.**
  - OrderItems store `productName` and `unitPrice` as they were at purchase time.
  - Orders store the shopper's contact details as they were at purchase time.
  - Later product or account changes never rewrite history.
- **Guest carts.** A cart has *either* a `userId` (logged in) *or* a `guestToken` (a random value in the guest's cookie).
- **Checkout → Cart link.** `Checkouts.cartId` is nullable with `ON DELETE SET NULL`. When a guest cart is merged into an account cart and deleted (BE6), old checkouts just lose the link instead of blocking the delete.

### Constraints that protect the data

The database itself refuses bad data, even if a bug slips past the code:

| Rule | How it's enforced |
|---|---|
| One account per email | `Users.email` UNIQUE |
| A product appears once per cart | `CartItems (cartId, productId)` UNIQUE |
| One cart per user | `Carts.userId` UNIQUE |
| One review per user per product | `Reviews (userId, productId)` UNIQUE |
| Rating is 1–5 | `CHECK` constraint on `Reviews.rating` |
| One payment → at most one order | `Orders.paymentReference` UNIQUE, `Checkouts.orderId` UNIQUE |
| Stock and money can't be negative | `UNSIGNED` integer columns |
| Links always point to real rows | Foreign keys on every relationship |

The **foreign-key delete rules** say what happens to linked rows when a row is deleted:

- **CASCADE:** delete the children too. Used for cart items, product images, email tokens, order items and status history.
- **SET NULL:** keep the row but clear the link. Used for an order's user, a checkout's cart, and "changed by" admin fields.
- **RESTRICT:** refuse the delete. Used for ordered products, categories with products, and orders with refunds.

**Indexes** speed up common searches: `Orders.status`, `Orders.createdAt`, `Products.categoryId`, `EmailTokens.tokenHash` and `PaymentEvents.reference`.

### Seed data

Seeders run in filename order:

1. **Categories** (6), in display order: Bags, Makeup, Skincare, Jewellery, Accessories, Perfumes.
2. **Products** (24, four per category). Each is linked to its category by looking up the category's slug, never by assuming an ID.
3. **Settings:** `usdRate` 15.50, `deliveryFee` 2000 (GHS 20.00), `lowStockThreshold` 5.
4. **Admin user**, using the email and password from `.env`. The password is hashed with bcrypt, cost 12.
5. **Sample data (demo only):**
   - 3 verified shoppers, who share the password `DemoShopper123`;
   - one Delivered order each, with items and status history;
   - 6 reviews.

   Efua (`efua.owusu@example.com`) bought the brush set but hasn't reviewed it, so you can use her account to test writing a review in BE18.

`db:seed:undo:all` removes the seed data by slug, name and email, so you can reset with `db:seed:undo:all` followed by `db:seed:all`.

### Key concepts

- **Migrations vs models.** A *migration* is a one-time instruction that changes the database ("create the Orders table"). A *model* is how JavaScript code reads and writes that table. Both must describe the same columns. Migrations are kept forever, so a new computer can rebuild the database from scratch.
- **Money in pesewas.** Computers store decimals like 0.1 inexactly, so `0.1 + 0.2` isn't exactly `0.3`. Storing whole pesewas (GHS 40.50 → `4050`) keeps every sum exact.
- **UTC time.** The database stores every time in UTC (`timezone: '+00:00'`). Ghana-time business rules are applied later, when calculating dates.
- **CSRF and the `X-Requested-With` header.** Because the login cookie is sent automatically, another website could try to submit a hidden form to our API. HTML forms can't add custom headers, and browsers only let other websites' scripts add them if CORS allows those sites. Requiring the header therefore blocks those attacks. The Paystack webhook is exempt because it's protected by a signature instead.
- **Raw body for the webhook.** In BE8, Paystack signs the *exact bytes* it sends. If we parsed the JSON and turned it back into text, spacing and key order could change and the signature wouldn't match. So `express.json()` has a `verify` function that keeps a copy of the raw bytes in `req.rawBody`, only for `/api/webhooks/paystack`.
- **One error handler.** Code anywhere can `throw new AppError(404, 'NOT_FOUND', '...')`. Express 5 passes errors (even from `async` functions) to `errorHandler`. Unexpected errors are logged on the server, and the user sees only "Something went wrong", never SQL or stack traces.
- **Graceful shutdown.** When Render restarts the app, it sends `SIGTERM`. We stop taking new requests, let current ones finish (so a payment isn't cut off halfway), close the database, then exit.
- **`trust proxy`.** On Render, requests pass through a proxy. Without this setting every visitor would appear to have the proxy's IP address, and rate limits would block everyone at once.
- **Secrets in `.env`.** Passwords and keys live only in `.env`, which is git-ignored. `.env.example` shows which variables exist, without their values.

---

## BE2: Authentication

### What was built and why

BE2 lets people create an account, prove they own the email address, log in and log out. A logged-in user is recognised on later requests by a **JWT** (JSON Web Token) stored in an **HTTP-only cookie**. Every login also sends an email alert, so users notice if someone else gets in.

### New endpoints

| Method and path | What it does |
|---|---|
| `POST /api/auth/register` | Creates an unverified account and emails a verification link |
| `POST /api/auth/verify` | Marks the email as verified, using the token from the link |
| `POST /api/auth/resend-verification` | Emails a new link (at most 3 per hour) |
| `POST /api/auth/login` | Checks the password, sets the login cookie, emails a login alert |
| `POST /api/auth/logout` | Clears the login cookie |
| `GET /api/auth/me` | Returns the logged-in user (safe fields only) |

### New files

| File | Purpose |
|---|---|
| `routes/auth.routes.js` | Maps the six URLs to: rate limit → validate → controller |
| `controllers/auth.controller.js` | Reads `req.valid`, calls the service, sets or clears the cookie, sends JSON |
| `services/auth/auth.service.js` | The rules: register, verify, resend, login, `completeLogin` |
| `validators/auth.validators.js` | Zod schemas for each request body |
| `middleware/validate.js` | Runs a Zod schema; puts clean data in `req.valid` or returns 400 with `fields` |
| `middleware/rateLimits.js` | Per-IP limits for login, register, verify and resend |
| `middleware/requireAuth.js` | Protects routes: checks the cookie's JWT, loads the user, sets `req.user` |
| `services/email/email.service.js` | Sends email through Nodemailer (Mailtrap). `sendEmailSafely` logs failures instead of throwing |
| `services/email/templates/verification.js` | The verification email, in HTML and plain text |
| `services/email/templates/loginAlert.js` | The login alert email, in HTML and plain text |
| `utils/tokens.js` | Makes random tokens and hashes them with SHA-256 |
| `utils/authCookie.js` | Sets and clears the login cookie with safe options |
| `utils/dates.js` | Formats dates in Ghana time |
| `utils/userAgent.js` | Turns the User-Agent header into a description like "Chrome on Windows" |
| `utils/escapeHtml.js` | Makes user text safe inside HTML emails |

Changed: `app.js` now mounts `/api/auth`.

### Tables used

No new tables; BE1 already created them.

- **Users:** `emailVerifiedAt` is empty until the user clicks the link.
- **EmailTokens:** one row per verification link sent.
  - `tokenHash` is the SHA-256 of the link's token.
  - `expiresAt` is 24 hours after sending.
  - `usedAt` is set when the link is used, or when a newer link replaces it.
  - It links to Users through `userId` (one user has many tokens).

### How one request flows: logging in

```text
POST /api/auth/login  { email, password }
  → csrfCheck           header X-Requested-With present? (else 403)
  → express.json        parse the body
  → loginLimiter        more than 10 tries from this IP in 15 min? (else 429)
  → validate(loginSchema)
                        email trimmed + lowercased; unknown fields dropped (else 400)
  → authController.login
  → authService.login
      → User.scope('withPassword').findOne({ email })
      → bcrypt.compare(password, hash)             wrong → 401
      → emailVerifiedAt empty?                     → 403 EMAIL_NOT_VERIFIED
      → completeLogin: sign JWT { sub, role }; start the login alert email (not awaited)
  → setAuthCookie       Set-Cookie: token=<JWT>; HttpOnly; SameSite=Lax
  → 200 { user }
```

And a protected request, `GET /api/auth/me`:

```text
  → requireAuth
      → read the `token` cookie                    missing → 401
      → jwt.verify (signature + expiry, HS256)      bad/expired → 401
      → User.findByPk(sub)                          deleted or unverified → 401
      → req.user = the fresh database row
  → authController.me → 200 { user: safe fields }
```

### Key concepts

- **Authentication vs authorization.** Authentication asks "who are you?" (login and `requireAuth`). Authorization asks "are you allowed to do this?" (ownership and admin checks, in later tasks).
- **Password hashing with bcrypt (cost 12).**
  - We never store passwords, only a bcrypt hash. It's one-way: you can check a password against it, but you can't turn it back into the password.
  - "Cost 12" makes each check take about a quarter of a second. That's fine for one login, but it makes guessing millions of passwords impractical.
  - bcrypt only uses the first 72 bytes of a password, so longer ones are refused.
- **Tokens hashed with SHA-256, not bcrypt.** Verification tokens are 64 random hex characters (32 random bytes), which is impossible to guess, so a fast hash is enough. It also lets us find the token by its hash in one query. If the database leaked, the stored hashes wouldn't work as links.
- **JWT.** A small signed note saying `{ sub: "5", role: "customer" }` plus an expiry. The server signs it with `JWT_SECRET`, so any change breaks the signature. It holds no personal data or secrets. We still load the user from the database on every protected request, so a deleted account stops working immediately, and admin rights come from the database.
- **Why an HTTP-only cookie?** JavaScript on the page can't read it, so an XSS bug can't steal the login. The browser sends it automatically, which is why BE1's CSRF header check matters.
- **Account enumeration.** Attackers like learning which emails have accounts. Three things make that harder:
  - Login gives the **same message** for an unknown email and a wrong password.
  - For an unknown email, login still runs a bcrypt check against a dummy hash, so the timing is the same.
  - Resend always gives the same answer, and it sends email in the background so real accounts don't answer slower.

  Register does say "already exists", which is a deliberate trade-off for clearer UX.
- **Unverified is checked after the password.** Only someone who knows the password learns that the account isn't verified.
- **Rate limiting.** There are two layers:
  - **Per IP**, in `rateLimits.js`: slows down password guessing and spam.
  - **Per account**, in the service: 3 resends per hour, counted in the `EmailTokens` table, so it holds even when the attacker changes IP address.
- **Emails never break the action.** Registration, resend and login commit first, then start the email **without waiting for it**. `sendEmailSafely` catches and logs any failure (never the token), so a broken email server can't break or slow down sign-up or login.
- **Transactions and row locks.**
  - Register creates the user and the token in one transaction, so both are saved or neither is.
  - Verify locks the token row (`SELECT ... FOR UPDATE`), so two clicks at once can't both use it.
  - Resend locks the user row, so two requests at once can't both slip under the limit.
- **Mass-assignment protection.** Zod drops unknown fields, so sending `"isAdmin": true` when registering does nothing. The service also copies only `name`, `email` and `passwordHash` into the new user.
- **`completeLogin`.** The final step of every login lives in one function, so later tasks can plug in: BE6 merges the guest cart there, and BE12 calls it only after the correct login code.

---

## BE3: Categories and products

### What was built and why

BE3 lets shoppers browse the store: see the categories, list products (all of them or one category), and open a product's details page. These endpoints only read data and are public, but they still follow the rules: only active products are shown, prices stay in pesewas, and hidden reviews never count.

### New endpoints

| Method and path | What it does |
|---|---|
| `GET /api/categories` | Categories in display order, each with its number of active products |
| `GET /api/products?category=<slug>` | Active products A–Z, optionally for one category |
| `GET /api/products/:id` | One product's details: description, images, rating, stock label |

### New files

| File | Purpose |
|---|---|
| `routes/categories.routes.js`, `routes/products.routes.js` | Map the URLs; mounted in `app.js` |
| `controllers/catalog.controller.js` | Reads `req.valid`, calls the service, sends JSON |
| `services/catalog/catalog.service.js` | The browsing rules: active only, sort order, 404s, response shapes |
| `services/review/reviewStats.js` | Average rating and count per product, ignoring hidden reviews (reused later by BE18 and BE19) |
| `validators/catalog.validators.js` | Checks `?category=` and `:id` |
| `utils/stockLabel.js` | "Out of stock" / "Only X left" / "In stock" |
| `middleware/optionalAuth.js` | Sets `req.user` if logged in, but never blocks guests |
| `services/auth/currentUser.js` | "Who sent this request?" from the login cookie, shared by `requireAuth` and `optionalAuth` |

Changed:
- `middleware/requireAuth.js` now uses `currentUser.js`, so both login checks follow exactly the same rules.
- `app.js` mounts the two new routers.

### Tables used and how they relate

No new tables.

```text
Categories ─< Products ─< ProductImages
                  └──< Reviews   (only isHidden = false reviews are counted)
```

- `Products.categoryId` points to `Categories`. Each product response includes the category's `name` and `slug`.
- `ProductImages.productId` points to `Products`. `sortOrder` decides the order, and `isMain` marks the main photo.

### How one request flows: `GET /api/products/1`

```text
  → validate({ params: productIdParams })   "1" → the number 1 (else 400)
  → optionalAuth                            valid login cookie? req.user = user : null
  → catalogController.getProduct
  → catalogService.getProductDetails(1, req.user)
      → Product.findOne({ id: 1, isActive: true }, include Category + images)
                                            not found or inactive → 404
      → getRatingStats([1])                 AVG + COUNT of visible reviews
      → build the response: stockLabel, mainImage, viewer
  → 200 { product }
```

### Key concepts

- **Soft delete (`isActive`).** Old orders point to products, so a product is switched off (`isActive = false`) rather than deleted. Every shopper query adds `isActive: true`, so an inactive product returns the same 404 as one that never existed. Category counts only count active products, so the numbers match what shoppers see.
- **404 vs empty list.** `?category=shoes` returns 404 because that category doesn't exist, which is a mistake in the request. A real category with no products returns 200 with `[]`, which is a correct answer that just happens to be empty. The frontend can then show "No products in this category" instead of an error page.
- **Validating URL parameters.** Everything in a URL is text. Zod's `z.coerce.number()` turns `"12"` into `12`, then `.int().positive()` rejects `abc`, `1.5` and `-3` with a 400, before any database query runs.
- **The N+1 query problem.** Getting each product's rating with its own query would take 1 query for the list plus 16 more for the ratings. `getRatingStats` gets every rating in **one** grouped query (`GROUP BY productId`). With 1,000 products that's 2 queries instead of 1,001.
- **Hidden reviews don't count.** When an admin hides a review (BE19), it should stop affecting the product. So `getRatingStats` always filters `isHidden = false`. Because it's the only place ratings are calculated, the rule can't be forgotten elsewhere.
- **Optional authentication.** Product pages are public, but a logged-in shopper will see extra information (whether they can review the product). `optionalAuth` sets `req.user` when the cookie is valid, and treats a missing or broken cookie as a guest instead of failing. `requireAuth` does the same check but rejects with 401.
- **Averages are rounded; money never is.** The rating average (for example `4.5`) is a display value, so rounding to 1 decimal is fine. Prices stay whole pesewas exactly as stored.

---

## BE4: Cart

### What was built and why

Shoppers can now view a cart and add products to it, whether or not they're logged in. The server decides which cart to use, checks the product and its stock, and calculates every price and total. The client only says "this product, this many".

### New endpoints

| Method and path | What it does |
|---|---|
| `GET /api/cart` | Shows the current cart, or an empty cart without creating anything |
| `POST /api/cart/items` | Adds a product (or increases its quantity); creates the cart on the first add |

### New files

| File | Purpose |
|---|---|
| `routes/cart.routes.js` | Maps the URLs: `optionalAuth` → validate → controller |
| `controllers/cart.controller.js` | Calls the service, and sets, renews or clears the guest cookie |
| `services/cart/cart.service.js` | Finds or creates the cart, adds items, builds the cart response |
| `validators/cart.validators.js` | `productId` and `quantity` must be whole numbers; quantity 1–99 |
| `utils/guestCartCookie.js` | Reads, sets and clears the 30-day HTTP-only `guestCart` cookie |

Changed:
- `services/catalog/catalog.service.js` now also exports `pickMainImage`, so the cart picks the main photo the same way product pages do.
- `app.js` mounts `/api/cart`.

### Tables used and how they relate

```text
Users ── Carts (one per user, or one per guest token) ─< CartItems >── Products
```

- A **Cart** has *either* `userId` (logged in) *or* `guestToken` (guest).
- A **CartItem** is one line: `cartId`, `productId` and `quantity`. The unique rule on `(cartId, productId)` means a product can appear only once per cart.
- There's **no price column** in CartItems. Prices are always read from Products when the cart is shown.

### How one request flows: `POST /api/cart/items`

```text
{ "productId": 17, "quantity": 1 }
  → csrfCheck, express.json
  → optionalAuth                 logged in? req.user = user : null
  → validate(addItemBody)        whole numbers, quantity 1–99 (else 400)
  → cartController.addItem       reads the guestCart cookie (if any)
  → cartService.addItem
      → findOrCreateCart         user's cart / guest's cart / create a new one
      → transaction:
          lock the cart row      (double clicks wait their turn)
          product active?        else 404
          stock 0?               409 OUT_OF_STOCK
          existing + new > 99?   400
          existing + new > stock? 409 "Only X available."
          update the line, or create it
      → toCartView               prices and totals from the Products table
  → set or renew the guestCart cookie (guests only)
  → 200 { cart }
```

### Key concepts

- **Never trust a cart ID from the client.** If the API accepted `cartId: 5`, anyone could change the number and edit someone else's cart. That kind of bug is called IDOR, or "insecure direct object reference". Instead, the cart is found from who is asking: the login cookie or the guest cookie. The guest token is 64 random hex characters (32 bytes), which is impossible to guess.
- **Server-calculated totals.** `lineTotalGhs = unitPriceGhs × quantity` and `subtotalGhs` are worked out on every request from the **current** product price, in whole pesewas, so there is never any rounding. Any `price` the client sends is dropped by Zod before the code sees it.
- **Don't create what isn't needed.** Viewing an empty cart creates nothing and sets no cookie. A cart row and cookie appear only when the first item is added. Otherwise every visitor, including search-engine bots, would fill the database with empty carts.
- **Race conditions and row locks.** Two "Add to cart" clicks at the same moment could both read quantity 1 and both write quantity 2, losing one add. Locking the cart row (`SELECT ... FOR UPDATE`) inside a transaction makes the second request wait until the first commits, so it sees the new quantity.
- **Catching a unique-rule violation.** If two first requests from the same user try to create their cart at the same time, the database's UNIQUE rule on `Carts.userId` accepts one and rejects the other. The code catches that specific error (`UniqueConstraintError`) and simply loads the cart that was created, so the user never sees an error.
- **Check stock, don't reserve it.** Adding to the cart only checks that enough stock exists. Stock is reduced when an order is paid (BE9), with a final check then. If stock drops after something was added, the line shows `isAvailable: false`, it's left out of the subtotal, and `hasUnavailableItems` tells the frontend to warn the shopper.
- **Rolling expiry.** The guest cookie's 30 days restart every time the cart is used, so an active shopper's cart doesn't vanish.

---

## BE5: Changing and removing cart items

### What was built and why

Shoppers can now change how many of a product they want, or remove it. The important part is **security**: a shopper must only be able to change lines in *their own* cart, even if they type someone else's line number into the URL.

### New endpoints

| Method and path | What it does |
|---|---|
| `PATCH /api/cart/items/:id` | Sets a line's quantity (0 removes it; more than the stock is capped) |
| `DELETE /api/cart/items/:id` | Removes a line |

`:id` is the cart **line** ID, not the product ID.

### Changed files

| File | Change |
|---|---|
| `validators/cart.validators.js` | New `cartItemParams` (`:id`) and `updateItemBody` (quantity 0–99). Quantity rules are shared with "add" through a `quantity(min)` helper |
| `services/cart/cart.service.js` | New `updateItemQuantity`, `removeItem`, `findOwnedItem` and `touchCart` (the last is now also used by `addItem`) |
| `controllers/cart.controller.js` | New `updateItem` and `removeItem` |
| `routes/cart.routes.js` | The PATCH and DELETE routes |

No new tables. These endpoints change `CartItems` rows, and only rows whose `cartId` is the current shopper's cart.

### How one request flows: `PATCH /api/cart/items/8` with `{ "quantity": 5 }`

```text
  → csrfCheck, express.json
  → optionalAuth                 logged in? req.user = user : null
  → validate                     :id → 8, quantity whole 0–99 (else 400)
  → cartController.updateItem
  → cartService.updateItemQuantity
      → findCart(user or guest cookie)      never creates a cart
      → transaction:
          lock the cart row
          findOwnedItem: CartItem WHERE id = 8 AND cartId = <my cart>
                                            not mine / not found → 404
          quantity 0?          delete the line
          product inactive?    409 CONFLICT
          stock 0?             delete the line + message
          5 > stock (2)?       set to 2 + "Only 2 available."
      → toCartView             recalculated totals
  → 200 { cart, message }
```

### Key concepts

- **IDOR (insecure direct object reference).** Cart line IDs are simple numbers (7, 8, 9…), so anyone can guess them. If the code ran `CartItem.findByPk(req.params.id)`, a shopper could change `/items/8` to `/items/9` and edit a stranger's cart. Instead, `findOwnedItem` searches with **both** the ID and the current shopper's cart: `WHERE id = 9 AND cartId = <my cart>`. Someone else's line simply isn't found.
- **The same 404 for "not yours" and "doesn't exist".** Answering "403 Forbidden" for someone else's line would confirm that line 9 exists. Returning the identical 404 reveals nothing. I tested this: a guest trying to PATCH or DELETE Kwame's line got 404, and his line was unchanged in MySQL.
- **Cap vs refuse.**
  - When **adding** (BE4), asking for more than the stock is refused (409), because the shopper is asking for something new.
  - When **changing** a line (BE5), the plan says to cap. The quantity is set to what's available, and a `message` explains why. The shopper keeps as many as they can actually buy.
- **Quantity 0 means remove.** The frontend can use a quantity stepper that goes down to 0, with no special case.
- **Don't create what isn't needed.** PATCH and DELETE use `findCart`, which never creates a cart. You can't change an item in a cart that doesn't exist, so the answer is simply 404.
- **Locking again.** Every change locks the cart row inside a transaction (the same pattern as "add"). Two quick changes to the same cart then happen one after the other, never tangled together.

---

## BE6: Cart persistence (merging the guest cart on login)

### What was built and why

Shoppers often fill a cart *before* logging in. Without BE6, logging in switched them to their (maybe empty) account cart, and their items seemed to vanish. Now, at login, the guest cart's items move into the account cart, and logging out gives a fresh, empty cart. Guest carts also expire after 30 days without use.

No new endpoints or tables: this changes what `POST /api/auth/login` and `POST /api/auth/logout` do behind the scenes.

### New and changed files

| File | Change |
|---|---|
| `services/cart/cart.service.js` | New `mergeGuestCart(userId, guestToken)`; guest carts now expire 30 days after their last change (`guestCartWhere`) |
| `utils/withDeadlockRetry.js` | **New.** Runs a transaction again once if MySQL cancels it because of a deadlock |
| `services/auth/auth.service.js` | `completeLogin` now merges the guest cart first; a failed merge is logged and login carries on |
| `controllers/auth.controller.js` | Login passes the guest cookie in, and clears it only if the merge didn't fail. Logout clears both cookies |

### How one request flows: logging in with a guest cart

```text
POST /api/auth/login   (Cookie: guestCart=<token>)
  → … same checks as BE2 (CSRF, rate limit, Zod, password, verified) …
  → authService.completeLogin(user, { userAgent, guestToken })
      → cartService.mergeGuestCart(user.id, guestToken)   ONE transaction:
          1. lock the guest cart          (none or expired → nothing to do)
          2. find or create the account cart, and lock it
          3. load the guest lines; lock their products (in id order)
          4. for each guest line:
               product off or sold out → skip
               quantity = min(account + guest, stock, 99)
               update the account line, or create it
          5. delete the guest cart (its lines go too: ON DELETE CASCADE)
          commit            (a deadlock → run the whole transaction once more)
         failed? → log it, cartMergeFailed = true, carry on
      → sign the JWT, send the login alert
  → set the login cookie
  → merge OK or nothing to merge? clear the guestCart cookie
    merge failed?                 keep it (the items are still safe)
  → 200 { user }
```

### Tables used and how they relate

```text
before login:  Carts(guestToken=abc) ─< CartItems        Carts(userId=2) ─< CartItems
after login:                                             Carts(userId=2) ─< CartItems (combined)
```

### Key concepts

- **All-or-nothing merge.** Moving items is several separate writes (update some lines, create others, delete the guest cart). If it stopped halfway, items could be doubled or lost. Doing it in **one transaction** means either every change is saved, or none are.
- **Why a failed merge doesn't stop login.** The cart is less important than letting someone into their account. So the merge error is caught, logged, and login continues. Because the transaction rolled back, the guest cart is exactly as it was. The controller **keeps the guest cookie** in that case, so the next login can try again and nothing is lost. (I tested this by forcing the merge to fail.)
- **Capping when combining.** 9 totes in the account plus 2 in the guest cart makes 11, but only 10 are in stock, so the line becomes 10. Sold-out or removed products are dropped, since they couldn't be bought anyway.
- **Row locks and lock order.** The merge locks the guest cart, then the account cart, then the products, always in that order and with products sorted by id. When every transaction takes locks in the same order, two of them can't each be waiting for the other. If two logins with the same cookie arrive at once, the second waits for the guest cart lock, then finds the guest cart already deleted and merges nothing. I tested this: 3 wallets stayed 3, not 6.
- **Deadlocks and retrying.** Even with a careful lock order, MySQL may occasionally cancel a transaction to break a deadlock (error `ER_LOCK_DEADLOCK`). The work was rolled back, so it's safe to run it again. `withDeadlockRetry` does that once, then gives up, as the plan's Section 13 asks. BE9 and BE16 will reuse it.
- **Rolling expiry.** A guest cart counts as expired 30 days after its last change. Every add, change and remove "touches" the cart's `updatedAt`, so an active cart keeps renewing itself. An expired cart is simply ignored: it isn't shown and isn't merged.
- **Logout starts fresh.** Logout clears both the login cookie and the guest cookie. On a shared computer, the next person then doesn't see the previous shopper's cart. The account cart isn't deleted; it's still in the database for the next login.

---

## BE7: Checkout

### What was built and why

Checkout starts a payment. The server prices the cart itself, saves a **Checkout** record, and asks **Paystack** (in test mode) to create a GHS mobile-money payment for exactly that amount. The frontend then opens Paystack's popup, or its payment page, where the shopper pays.

An order is **not** created yet: that waits until the payment is confirmed (BE8/BE9).

### New endpoint

| Method and path | What it does |
|---|---|
| `POST /api/checkout` | Rechecks the cart, calculates the total, saves a Checkout, starts a Paystack payment, and returns the reference, access code and payment URL |

### New files

| File | Purpose |
|---|---|
| `routes/checkout.routes.js` | rate limit → `optionalAuth` → validate → controller |
| `controllers/checkout.controller.js` | Passes who is checking out and the details to the service; answers 201 |
| `services/checkout/checkout.service.js` | Prices the cart, saves the Checkout, calls Paystack, handles failure |
| `services/payment/paystack.client.js` | **The only file that talks to Paystack.** Adds the secret key header and a 15-second time limit, and checks Paystack's answer |
| `services/settings/settings.service.js` | **The only place that reads Settings** (here: the delivery fee), turning the stored text into a checked whole number |
| `validators/checkout.validators.js` | Name, email, Ghana phone (converted to `0XXXXXXXXX`) and address |

Changed: `middleware/rateLimits.js` (new `checkoutLimiter`, 10 per 15 minutes) and `app.js` (mounts `/api/checkout`).

### Tables used and how they relate

```text
Carts ─< CartItems >── Products        (read to price the cart)
Carts ──< Checkouts >── Users (optional)
Settings (deliveryFee)
```

A **Checkout** row stores:
- `reference`, a unique ID shared with Paystack;
- the contact details;
- `subtotal`, `deliveryFee` and `total` in pesewas;
- `status`: `open`, then `paid` in BE9, or `failed`;
- links to the cart and the user (none for guests).

One cart can have several checkouts, one per payment attempt.

### How one request flows: `POST /api/checkout`

```text
  → csrfCheck, express.json
  → checkoutLimiter             more than 10 checkouts from this IP in 15 min? 429
  → optionalAuth                logged in? req.user
  → validate(checkoutBody)      details OK; "total" etc. dropped (else 400)
  → checkoutController.startCheckout
  → checkoutService.startCheckout
      → cartService.findCart               the shopper's own cart
      → priceCart                          empty? 400 | inactive/short stock? 409
                                           subtotal = Σ current price × quantity
      → settingsService.getDeliveryFee()   2000
      → Checkout.create({ status: 'open', reference, totals … })   SAVED
      → paystack.initializeTransaction(…)  (outside any transaction)
            failed? → checkout.status = 'failed' → 502 PAYMENT_FAILED
  → 201 { checkout: { reference, accessCode, authorizationUrl, amounts } }
```

### Key concepts

- **The server decides the price.** A shopper could edit the request and send `"total": 1`. Zod drops it, and the total is recalculated from the database: current price × quantity, plus the delivery fee from Settings. I tested this: sending `total: 1` still created a checkout for 45500.
- **Save first, then call the outside service.** The Checkout row is saved (committed) *before* Paystack is contacted, and no database transaction stays open while we wait for Paystack. Paystack can take seconds, and holding database locks that long would block other shoppers. If Paystack fails, we still have a record of the attempt, and we mark it `failed`.
- **Why a reference?** Our `reference` (for example `STORE-muntz37d-3cac4c5999ce`) is the ID shared between our Checkout row and Paystack's transaction. In BE8 we'll ask Paystack "what happened to this reference?", and Paystack's webhook will mention it too. It contains 6 random bytes, so it can't be guessed.
- **Amounts in the smallest unit.** Paystack's spec says `amount` is in the "smallest denomination", which is exactly our pesewas. So `45500` is sent as-is, with no multiplying by 100 and no decimals.
- **Mobile money only.** `channels: ["mobile_money"]` tells Paystack to show only mobile money. The other fields (`currency: "GHS"`, `callback_url`, `metadata`) come from Paystack's official API specification, not from guessing.
- **Nothing is taken yet.** Checkout doesn't reduce stock or empty the cart. If the shopper abandons the payment, nothing is lost. Stock is checked again, under a lock, when the payment is confirmed (BE9), because someone else may have bought the last one meanwhile.
- **Time limits on outside calls.** Every Paystack request gives up after 15 seconds (`AbortSignal.timeout`), so a slow Paystack can't leave our server waiting forever.
- **Secrets stay secret.** The secret key is used only in the `Authorization` header sent to Paystack. It's never logged, never sent to the browser, and never included in errors. I tested this with a wrong key: the shopper got a friendly 502, and the log shows only "Invalid key".
- **One place per outside service.** All Paystack code lives in `paystack.client.js`, and all settings access in `settings.service.js`. If Paystack's API changes, only one file needs to change.

---

## BE8: Paystack payment processing

### What was built and why

After the shopper pays on Paystack, we must be **sure** the money arrived before creating an order. BE8 adds three layers:

1. **The client starts checkout** (BE7). Paystack takes the payment.
2. **The server verifies**: `POST /api/checkout/verify` asks Paystack's API directly: "did reference X succeed, and for how much?"
3. **Paystack's webhook confirms independently**: Paystack calls our `/api/webhooks/paystack`, so the order is created even if the shopper closes the browser straight after paying.

Both 2 and 3 use **the same function** (`confirmPayment`), and fulfilment is **idempotent**, so it doesn't matter which arrives first or how often.

BE8 also creates the **order** itself (the core of BE9: order, items, history, stock, cart). BE9 will add the case where stock ran out after payment.

### New endpoints

| Method and path | Who calls it | What it does |
|---|---|---|
| `POST /api/checkout/verify` | The frontend | Verifies with Paystack; returns the order (the same one every time) |
| `POST /api/webhooks/paystack` | Paystack's servers | Checks the signature, records the event, replies 200, then confirms and fulfils |

### New table: CheckoutItems

```text
Checkouts ─< CheckoutItems >── Products
Checkouts ── Orders (one checkout → at most one order)
Orders ─< OrderItems, Orders ─< OrderStatusChanges
PaymentEvents   (one row per webhook received)
```

At checkout time, the lines being paid for (product, name, unit price, quantity) are saved as **CheckoutItems**, in the same transaction as the Checkout. The order is built from these rows, **never from the cart**. The cart can change while the shopper pays (another tab), or even disappear (a guest cart merged at login). Without the snapshot, the order could contain items that weren't paid for.

### New and changed files

| File | Purpose |
|---|---|
| `migrations/…-create-checkout-items.js`, `models/CheckoutItem.js` | The snapshot table |
| `services/checkout/checkout.service.js` | *(changed)* Saves the Checkout and its items together |
| `services/payment/paystack.client.js` | *(changed)* New `verifyTransaction(reference)` |
| `services/payment/payment.service.js` | `confirmPayment(reference)`: the single "is it paid?" decision |
| `services/order/fulfilment.service.js` | `fulfilCheckout(checkoutId)`: creates the order in one transaction |
| `utils/orderNumber.js` | Readable order numbers like `ORD-20260930-DF96W8` |
| `controllers/checkout.controller.js` | *(changed)* `verifyPayment` turns outcomes into HTTP answers |
| `controllers/webhook.controller.js`, `routes/webhooks.routes.js` | The webhook, with its signature check |
| `validators/checkout.validators.js`, `middleware/rateLimits.js`, `routes/checkout.routes.js`, `app.js` | *(changed)* Verify body, 30 per 15 minutes limit, routes |

### How one request flows: `POST /api/checkout/verify`

```text
{ "reference": "STORE-…" }
  → csrfCheck, express.json, verifyPaymentLimiter (30 per 15 min), validate
  → checkoutController.verifyPayment
  → paymentService.confirmPayment(reference)
      → Checkout by reference            unknown → 404
      → already paid?                    → the same order (idempotent)
      → paystack.verifyTransaction()     GET /transaction/verify/{reference}
      → status "success" AND amount = our total AND currency GHS AND same reference?
            yes → fulfilCheckout(checkout.id)
            no (mismatch) → logged, NOT fulfilled → 402
      → failed/abandoned → 402 | anything else → 202 PAYMENT_PENDING
  → 200 { order: { orderNumber, confirmationToken, status, totalGhs } }
```

### The fulfilment transaction (`fulfilCheckout`)

```text
BEGIN
 1. lock the checkout row               (verify and webhook at once? the 2nd waits)
    already paid? → return that order
 2. read the CheckoutItems; lock their products (in id order)
 3. recheck stock                       (short → error; refund comes in BE9)
 4. create the Order                    Pending, order number, 64-char confirmation token,
                                        paymentReference (UNIQUE), details and amounts copied
 5. create the OrderItems               historical names and prices
 6. create the OrderStatusChange        null → Pending
 7. reduce stock
 8. checkout → paid, orderId            (UNIQUE)
 9. remove the purchased quantities from the cart (later additions stay)
COMMIT   (any error → ROLLBACK: nothing at all is saved)
```

### The webhook, step by step

```text
POST /api/webhooks/paystack   header x-paystack-signature: <hex>
  → (CSRF check skipped for this path; express.json kept req.rawBody)
  → HMAC-SHA512(rawBody, secret key) === header?   (timing-safe compare)
        no  → 401, nothing recorded
  → save a PaymentEvent (type, reference, receivedAt)
  → reply 200 { received: true }                   (right away)
  → then, in the background:
        charge.success → confirmPayment(reference)  (asks Paystack's API again)
        other events   → "ignored"
        → PaymentEvent.processedAt, outcome
```

### Key concepts

- **Never trust the client about payment.** The browser saying "I paid" proves nothing, since anyone can send that request. Only Paystack's own API, asked by *our server* with *our secret key*, counts.
- **Check the amount, not just "success".** A "success" for a different amount or currency must not create an order, or someone could reuse a tiny payment. `confirmPayment` compares Paystack's `amount` (pesewas), `currency` and `reference` with the saved checkout.
- **HMAC signatures.** Paystack computes `HMAC-SHA512(body, secretKey)` and sends it in a header. Without the secret key nobody can produce a valid signature, and changing even one character of the body changes it completely. I tested three attacks: no signature, a fake signature, and a genuine signature with a changed body. All got 401, and nothing was recorded.
- **Why the raw body?** The signature is calculated over the exact bytes Paystack sent. If we parsed the JSON and turned it back into text, spaces or key order might differ, and the check would fail. That's why BE1's `express.json({ verify })` keeps `req.rawBody` for this one path. It's the same approach as Paystack's own Express example.
- **Timing-safe comparison.** A normal `===` stops at the first different character, so it answers slightly faster the more wrong the guess is. An attacker could measure that and guess a signature piece by piece. `crypto.timingSafeEqual` always takes the same time.
- **Don't trust the webhook's data, either.** Even with a valid signature, the webhook only tells us *which reference* to check. We then ask Paystack's API, the same as verify does.
- **Reply fast, work after.** Paystack retries if we don't answer quickly. So we record the event, reply 200, and only then do the slower work. The `PaymentEvents` table shows what happened to each webhook (`processedAt`, `outcome`), which helps troubleshooting.
- **Idempotency.** "Doing it twice has the same effect as once." Several things work together:
  - the checkout row lock;
  - the "already paid? return that order" check;
  - the database's UNIQUE rules on `Orders.paymentReference` and `Checkouts.orderId`.

  I tested it: fulfilling again, verifying again, and a duplicate webhook all returned the same order, and stock was only reduced once.
- **All or nothing.** The order and its 8 related changes are one transaction. If the stock update failed, there would be no order without items or status, and no stock taken without an order.

---

## BE9: Atomic payment fulfilment (and "paid, but sold out")

### What was built and why

BE8 built the fulfilment transaction: lock, recheck stock, create the order, reduce stock, all or nothing. BE9 handles the hardest case:

**Two shoppers pay for the last unit at the same time.** Checkout doesn't reserve stock, so both can pay. Only one can get the item. The other has paid for something we can't send, so they must get their money back **automatically**, and be told.

### Changed tables: Refunds

```text
Refunds.orderId     now NULLABLE
Refunds.checkoutId  NEW, nullable → Checkouts.id
CHECK: exactly one of orderId / checkoutId is set
```

A refund belongs to **either**:
- an **order**: cancellations (BE16) and admin refunds (BE17); **or**
- a **paid checkout that never became an order**: sold out after payment (BE9).

The database's `CHECK ((orderId IS NULL) <> (checkoutId IS NULL))` refuses a refund with no owner, or with two.

A MySQL detail: a CHECK can't use a column whose foreign key has an action like `ON UPDATE CASCADE`, so both foreign keys use `RESTRICT`.

### New and changed files

| File | Purpose |
|---|---|
| `migrations/…-refunds-for-checkouts.js` | The nullable `orderId`, the new `checkoutId`, and the CHECK |
| `models/Refund.js`, `models/Checkout.js` | *(changed)* The new column and associations |
| `services/refund/refund.service.js` | **New.** `createRefund` (inside a transaction) and `sendRefundToPaystack` (after commit); BE16/BE17 reuse them |
| `services/payment/paystack.client.js` | *(changed)* `createRefund` → `POST /refund` |
| `services/payment/payment.service.js` | *(changed)* Catches "sold out" from fulfilment → `handleSoldOut` |
| `services/email/templates/refund.js` | **New.** The refund email (HTML and text) |
| `utils/money.js` | **New.** `formatGhs(317000)` → `"GHS 3,170.00"`, for messages only |
| `controllers/checkout.controller.js` | *(changed)* The new `refunded` outcome → 409 with a clear message |

### How it flows: two payments, one tote bag left

```text
Shopper A: verify ──┐                        Shopper B: verify ──┐
                    ▼                                            ▼
     fulfilCheckout(A): lock products          fulfilCheckout(B): WAITS for the lock…
       stock 1 ≥ 1 ✓ → order, stock 0
       COMMIT (lock released) ──────────────►   …now reads stock 0 < 1 ✗
                                                throws OUT_OF_STOCK (rolled back)
                                                   ▼
                                           handleSoldOut(B):
                                             transaction: lock checkout B,
                                               no refund yet? → status 'failed',
                                               Refund { checkoutId: B, full amount, 'requested' }
                                             COMMIT
                                             → sendRefundToPaystack  (POST /refund)
                                                 accepted → 'processed' + Paystack's id
                                                 refused  → 'failed' + reason (retry later)
                                             → email "sorry… refunded GHS X"
                                           → verify answers 409 OUT_OF_STOCK
```

### Key concepts

- **Why can two people pay for one item?** Checkout only *checks* stock; it doesn't reserve it. Reserving would lock items for shoppers who never finish paying. So the **final** check happens at fulfilment, under a row lock, and whoever is second is refunded. I tested it with 2, and then 5, payments at exactly the same moment: always exactly 1 order, the rest refunded, and stock ending at 0.
- **Row locks make "check then take" safe.** Without the lock, both transactions could read "stock = 1", both pass the check, and both take one, leaving stock at -1 (the UNSIGNED column would then error). With `SELECT … FOR UPDATE`, the second transaction waits until the first commits, then reads the new stock (0).
- **Transaction first, outside call after.** Marking the checkout failed and creating the Refund row happen in one transaction. **Then**, after the commit, we call Paystack's refund API, and **then** send the email. We never hold database locks while waiting for Paystack (the plan's rule). If the server crashed between the steps, the Refund row still says "requested", so nothing is forgotten.
- **Refunding exactly once.**
  - The checkout row is locked, and an existing refund is reused, so a verify and a webhook arriving together create **one** refund.
  - Only the request that *created* it contacts Paystack and emails the shopper.
  - A refund that Paystack has accepted (it has a `providerReference`) is never sent again.
- **A failed refund is recorded, not lost.** If Paystack refuses (for example, a network error or an unsupported transaction), the Refund becomes `failed` with Paystack's reason. An admin can retry it later (BE17), and the dashboard counts it (BE20). The shopper still gets the honest message: "will be refunded".
- **Tested with real test payments:** two mobile money payments raced for the last tote bag. One became an order, and the other was refunded. Paystack test mode **does** accept refunds: the Refund row became `processed` with a Paystack refund id.
- **Full amount means including delivery.** The shopper receives nothing, so everything they paid goes back: `checkout.total`.
- **Emails never break the flow.** In the stress test, Mailtrap's free plan refused several emails for "too many per second". That was logged, and every refund and order was still correct.

---

## BE10 — Payment Edge Cases

### What was built and why

Real payments don't always go smoothly. The phone prompt might wait, the PIN might be wrong, the wallet might be empty, the shopper might close the popup, Paystack might be slow, or the network might drop. BE10 makes sure that **every case gets a clear answer**, and that **only a confirmed success ever creates an order or reduces stock**. There were no new tables or endpoints: the changes are inside the verify flow.

| Case | What happens | Verify answers |
|---|---|---|
| Success | Order created (BE8/BE9) | 200 + order |
| Still waiting (phone prompt) | Rechecked up to 3 times, 2 seconds apart | 202 `PAYMENT_PENDING` if still waiting |
| Wrong PIN / not enough money (`failed`) | Nothing changes | 402, `reason: declined` |
| Popup closed / timed out (`abandoned`) | Nothing changes | 402, `reason: not_completed` |
| `reversed` | Nothing changes | 402, `reason: reversed` |
| Paystack slow or network dropped | Retried once; 8 s limit per call | 503 if it still fails |
| Duplicate verify / duplicate webhook | Same order returned | 200 (same order) |
| Late duplicate payment (older checkout, same cart) | Refunded in full + email | 409 `CONFLICT` |
| Retry after a failure | New `POST /api/checkout` → new reference | — |

### Changed files

| File | What changed |
|---|---|
| `services/payment/payment.service.js` | `verifyWithRechecks` (rechecks and one retry, at most ~20 s in total); a `reason` for each failure; `handleSoldOut` became `refundPaidCheckout(checkoutId, reason)`, used for both "sold out" and "duplicate" |
| `services/payment/paystack.client.js` | Verify has an **8-second** limit; errors say whether they're `retryable` (network, timeout, 5xx) or not (4xx) |
| `services/order/fulfilment.service.js` | Step 1b: lock the cart, and if a **newer** checkout for the same cart is already paid, return `{ duplicate: true }` without saving anything |
| `controllers/checkout.controller.js` | A message per failure reason; 409 `CONFLICT` for duplicates |
| `controllers/webhook.controller.js` | Records e.g. `refunded (duplicate)` as the event outcome |
| `utils/AppError.js`, `middleware/errorHandler.js` | Errors can carry a small extra field such as `reason` |

### How it flows: verify with a slow phone approval

```text
POST /api/checkout/verify { reference }
  → confirmPayment(reference)
      checkout open? yes
      → verifyWithRechecks            (no database transaction open while waiting)
          ask Paystack → "ongoing"     wait 2 s
          ask Paystack → "ongoing"     wait 2 s
          ask Paystack → "success"
      → amount/currency/reference match? → fulfilCheckout → order
  ← 200 { order }
```

If the third answer were still "ongoing", the shopper gets 202 and the frontend calls again a few seconds later.

### Key concepts

- **Final and non-final statuses.**
  - `success`, `failed`, `abandoned` and `reversed` are final answers from Paystack.
  - Anything else (`ongoing`, `pending`, …) means "not finished yet", so we ask again.
  - Only `success`, with a matching amount, currency and reference, creates an order.
- **Wait outside transactions.** The rechecks and their 2-second pauses happen *before* any database transaction. Holding row locks while sleeping would block every other shopper buying the same product.
- **Time limits.** Each Paystack verify call is cut off after 8 seconds, and the whole verify request after about 20 seconds. A slow Paystack can never hang our server or leave the shopper staring at a spinner forever.
- **Retry only what's safe to repeat.**
  - Verify only *reads*, so repeating it after a network error is harmless.
  - Initialize and refund *create* things, so they're never retried automatically: a blind retry could start two payments or send two refunds.
  - A 4xx answer means Paystack refused the request itself, so repeating won't help. A timeout or 5xx might be temporary.
- **Failed checkouts stay open.** A mobile money approval can arrive late, after we said "not completed". Keeping the checkout open means a later verify, or Paystack's webhook, still turns that success into an order. Nothing was reserved, so an open checkout costs nothing.
- **Late duplicate payments.**
  - A shopper whose first payment seemed to fail starts a new checkout and pays. Then the first payment is approved late.
  - Both are for the same cart. So when a payment succeeds and a **newer** checkout for the same cart is already paid, it's refunded in full instead of becoming a second order (reason: "Duplicate payment: your order was already placed.").
  - The cart row is locked during this check, so two payments for the same cart take turns and always see each other's result.
  - If the cart no longer exists (for example, a guest cart merged at login), there's nothing to compare with, and the payment is fulfilled normally.
  - **Limitation (by design):** if the *older* payment is confirmed first and the newer one afterwards, both become orders. The rule only looks for *newer* paid checkouts, because a newer checkout can be a genuine second purchase.
- **Paystack's `gateway_response`** (its own short explanation) is only logged. Its wording isn't documented, so the shopper sees our own clear messages instead.

### Testing limits (also in the README)

Paystack's test page lists **one** Ghana mobile money number: **0551234987** (MTN, no PIN/OTP), which **succeeds**. There are no test numbers for "declined" or "timeout". So:
- success and "abandoned" (open the payment page, then close it without paying) are tested with real Paystack;
- declined, reversed, pending rechecks, Paystack timeouts and network errors are tested by an automated script that replaces Paystack's answers inside the test process. All 20 checks passed.

---

## BE11 — Order Confirmation

### What was built and why

After paying, the shopper needs proof that the order went through: a **confirmation page** and a **confirmation email**. Guests buy too, so the page can't depend on logging in. Instead it's opened with a long random **confirmation token**, which verify returns and the email links to.

### New endpoint

| Method and path | Login | What it does |
|---|---|---|
| `GET /api/orders/confirmation/:token` | No | Returns the order for the confirmation page, or 404 |

The frontend page is `/order/confirmation/<token>`. The email links there, and that page calls the endpoint above.

### New or changed files

| File | Purpose |
|---|---|
| `routes/orders.routes.js` | **New.** `/api/orders` routes (My Orders is added in BE14) |
| `controllers/order.controller.js` | **New.** Returns 404 or `{ order }`, with `Cache-Control: no-store` |
| `services/order/order.service.js` | **New.** Loads an order with its items and images; `getOrderByConfirmationToken` (format check, 30-day limit); `getConfirmationEmailData` |
| `validators/order.validators.js` | **New.** The token format: 64 lowercase hex characters |
| `services/email/templates/orderConfirmation.js` | **New.** The email in HTML and plain text |
| `services/payment/payment.service.js` | *(changed)* Sends the email once, after the order is created |
| `app.js` | *(changed)* Mounts `/api/orders` |
| `.env.example` | *(changed)* `STORE_CONTACT_EMAIL`, `STORE_CONTACT_PHONE` (shown in the email) |

There are no new tables. The token is the `Orders.confirmationToken` column created in BE1, filled by fulfilment in BE8.

### How a request flows

```text
GET /api/orders/confirmation/7ccc…
  → routes/orders.routes.js            (no login middleware)
  → order.controller.getConfirmation
      → order.service.getOrderByConfirmationToken(token)
          format OK? (64 hex)          no → null
          Order + OrderItems + Product images from the database
          found? less than 30 days old? no → null
          → confirmation view (historical names and prices)
  ← 200 { order } with Cache-Control: no-store,  or 404 "Order not found."
```

The email:

```text
confirmPayment → fulfilCheckout COMMITS the order
  → outcome 'fulfilled' (only the request that created it)
  → sendConfirmationEmail(orderId)       not awaited, never throws
      load the same confirmation view → orderConfirmation template → sendEmailSafely
```

### Key concepts

- **A capability link.** Anyone who has the link can see the order, like a password. That's safe because the token is 32 random bytes (64 hex characters): guessing one is practically impossible. So:
  - it only appears in the verify answer and the email;
  - the response isn't cached (`no-store`);
  - the link **expires after 30 days**, which limits the damage if an email is ever forwarded or an inbox is exposed.
- **One 404 for everything.** A badly formed token, an unknown token and an expired one all get the same "Order not found." A stranger can't learn whether a token ever existed or what the format is. The format is checked *before* the database query, so junk never reaches MySQL.
- **Historical prices.** The page and email use the names and prices stored in `OrderItems` when the order was created, not today's product data. If a price changes tomorrow, the receipt still shows what was paid.
- **Emails exactly once, after the commit.**
  - The email is sent only for the `fulfilled` outcome, which only the request that actually created the order gets. Repeated verifies and duplicate webhooks get `already_fulfilled` and send nothing.
  - It's sent after the transaction has committed, so we never email about an order that was rolled back.
  - Because verify and the webhook share `confirmPayment`, a shopper who closed the page still gets the email when the webhook creates the order.
- **Emails never break orders.** `sendConfirmationEmail` isn't awaited and catches every error, so the shopper's verify answer doesn't wait for the mail server. A failed email is only logged, and the order stays valid.
- **Readable everywhere.** The email has no images and a plain-text version, and every shopper-typed value is HTML-escaped. So a name like `<b>Ama</b>` shows as text instead of changing the email.

---

## BE12 — Login Code

### What was built and why

A password can be stolen or guessed. With **login codes** switched on (`LOGIN_CODE_ENABLED=true`), the right password is no longer enough: we email a 6-digit code, and the user is only logged in after typing it. Someone with the password but without access to the inbox can't get in. Switching the setting off returns to password-only login, with no code changes.

### New endpoints

| Method and path | What it does |
|---|---|
| `POST /api/auth/login` *(changed)* | Codes on: checks the password, emails a code, answers `{ requiresCode: true }` (not logged in yet) |
| `POST /api/auth/login/verify-code` | Checks the code; if right, logs in (cookie, cart merge, login alert) |
| `POST /api/auth/login/resend-code` | Emails a new code (the old one stops working) |

### New or changed files

| File | Purpose |
|---|---|
| `services/auth/loginCode.service.js` | **New.** Creating, sending and checking codes, and every limit |
| `utils/loginChallengeCookie.js` | **New.** The 15-minute `loginChallenge` cookie, signed with its own key |
| `services/email/templates/loginCode.js` | **New.** The code email |
| `services/auth/auth.service.js` | *(changed)* `login()` sends a code instead of logging in when codes are on |
| `controllers/auth.controller.js` | *(changed)* `verifyCode`, `resendCode`; `finishLogin` is shared by both login paths; logout clears the challenge |
| `services/auth/currentUser.js` | *(changed)* Only accepts real login tokens (with a `role`, no `purpose`) |
| `validators/auth.validators.js`, `middleware/rateLimits.js`, `routes/auth.routes.js` | The new schema, limits and routes |

**Tables:** none new. Codes use the `EmailTokens` table from BE1 (`type = 'loginCode'`), which already had `attempts` for counting wrong tries.

### How a request flows

```text
POST /api/auth/login {email, password}
  → password right, email verified, codes ON
  → loginCode.service.sendLoginCode
      transaction: lock the user row → check 60 s / 5 per hour → cancel old codes
                   → save hashToken(code), expires in 10 min
      COMMIT → print the code (development only) → AWAIT the email (fails → 503)
  ← 200 { requiresCode: true }  + Set-Cookie: loginChallenge (15 min)   (no token cookie!)

POST /api/auth/login/verify-code {code}   (browser sends the loginChallenge cookie)
  → readLoginChallenge → userId            (missing or expired → 401)
  → verifyLoginCode: lock the newest unused code
      expired? wrong? (attempts + 1; at 5 → cancelled)  right? → mark used
  → authService.completeLogin → cart merge, JWT, login alert
  ← 200 { user } + Set-Cookie: token, and loginChallenge cleared
```

### Key concepts

- **Two-step login needs "half logged in" state.** Between the password and the code, the server must remember *who* passed the password step, without logging them in. That's the `loginChallenge` cookie. We never take the user's email from the verify-code body: otherwise a code would work from any browser, and the password step would be pointless.
- **One key per purpose.** The challenge cookie is a JWT too, so if it were signed with `JWT_SECRET` it would look like a valid login token: `requireAuth` would accept it and skip the code entirely! So it's signed with a different key (an HMAC of a fixed label with `JWT_SECRET`). As a second lock, `currentUser.js` also rejects tokens without a `role` or with a `purpose`. The test script checks this: using the challenge as a login cookie gives 401.
- **Hashed codes.** Like passwords and verification links, the code is stored only as a SHA-256 hash, and compared in constant time. The 10-minute life and the 5-attempt limit are what really protect it: there are only a million possible codes, but you get 5 guesses.
- **Counting wrong guesses must survive the error.** An error thrown inside a Sequelize transaction rolls it back, and that would undo `attempts + 1`, giving unlimited guesses. So the transaction *returns* the result ("wrong, 3 left"), commits, and the error is thrown afterwards.
- **Locks stop limit races.** Sending a code locks the user's row, so two "resend" clicks at the same moment take turns, and both see the 60-second rule. Checking a code locks the code row, so two guesses at once are both counted.
- **The one email that is awaited.** Other emails are fire-and-forget. Without the code, though, the user is stuck, so we wait for the mail server. If it fails, the code is cancelled (so the 60-second wait doesn't block a retry) and the user sees "please try again" (503).
- **Friendly with double clicks.** Pressing **Log in** twice within 60 seconds doesn't send a second email; the first code still works. Pressing **Resend** within 60 seconds gets "Please wait N seconds".
- **Development only: the code in the console.** `[login code] ama@example.com: 048213` makes testing quick. It's printed only when `NODE_ENV=development`, because production logs can be read by other people or services.
- **The flag is read on every request**, so changing `LOGIN_CODE_ENABLED` needs only a restart (`rs` in nodemon).

---

## BE13 — Currency

### What was built and why

Some shoppers think in US dollars, so every price now also comes with a **USD amount**, but only as a guide. Paystack always charges **Ghana cedis (GHS)**, so GHS stays the real price everywhere. The USD amounts are calculated on the server, in whole **cents**, using the `usdRate` setting (GHS per 1 US dollar, seeded as `15.50`).

### New endpoint

| Method and path | Login | What it does |
|---|---|---|
| `GET /api/settings/currency` | No | The charged currency (GHS), the display currencies, and the rate |

### New or changed files

| File | What changed |
|---|---|
| `utils/currency.js` | **New.** `toUsdCents(pesewas, pesewasPerUsd)`, integer-only rounding |
| `services/settings/settings.service.js` | `getUsdRate()` reads and checks the rate, returned as `pesewasPerUsd` (15.50 → 1550) |
| `services/catalog/catalog.service.js` | Products get `priceUsd` |
| `services/cart/cart.service.js` | Lines get `unitPriceUsd` and `lineTotalUsd`; the cart gets `subtotalUsd` |
| `services/checkout/checkout.service.js` | `subtotalUsd`, `deliveryFeeUsd`, `totalUsd`, `usdRate`, and `chargeNote` ("You will be charged GHS …") |
| `routes/settings.routes.js`, `controllers/settings.controller.js`, `app.js` | The new endpoint |

There are no new tables: `usdRate` has been in `Settings` since BE1.

### How it flows (the cart)

```text
GET /api/cart
  → cart.service.toCartView
      getUsdRate()        "15.50" → pesewasPerUsd 1550   (read once per request)
      for each line:
        unitPriceUsd = toUsdCents(unitPriceGhs)          ← convert the UNIT price
        lineTotalUsd = unitPriceUsd × quantity           ← then multiply
      subtotalUsd  = sum of lineTotalUsd                 ← then add
  ← { cart: { …Ghs fields, …Usd fields } }
```

### Key concepts

- **Display currency vs charged currency.** GHS is *charged* (Paystack, orders, refunds, emails). USD is only *displayed*. That's why orders and the confirmation page stay GHS-only, and why checkout includes a `chargeNote` saying exactly how many cedis will be charged.
- **Convert the unit price first, then multiply and add.** A real example from the tests:

  | Line | GHS (pesewas) | Unit price in USD cents | Line in USD cents |
  |---|---|---|---|
  | Clear Lip Gloss × 3 | 4000 each | 258 | 774 |
  | Vitamin C Face Serum × 2 | 12000 each | 774 | 1548 |
  | Satin Scrunchie Set × 7 | 3500 each | 226 | 1582 |
  | **Subtotal** | 60500 | | **3904** |

  Converting the GHS subtotal (60500) directly gives **3903** cents, one cent different, because each conversion rounds. If we showed 3903 under lines that add up to 3904, the shopper would see a total that doesn't add up. Converting unit prices first and only multiplying and adding afterwards means **the numbers on screen always add up exactly**. The tiny difference from "true" conversion doesn't matter, because USD is only a guide.
- **Integer-only rounding.** `cents = pesewas × 100 / pesewasPerUsd`, rounded to the nearest cent with `Math.floor((pesewas × 200 + rate) / (2 × rate))`. That's the same as adding half the divisor and then dropping the remainder. No floating-point money anywhere. The rate itself is read from the text `"15.50"` by splitting at the dot, so it's exact too (15.50 → 1550).
- **Read the rate before anything is saved.** In checkout, `getUsdRate()` runs before the Checkout row is created and before Paystack is contacted. If the setting were broken, the shopper gets an error before a half-finished payment exists.
- **A bad setting fails loudly, not wrongly.** If `usdRate` isn't a number like `15.50`, the request becomes a logged 500 with a generic message, rather than showing wrong prices. The test sets it to `"abc"` to prove this, then restores it.

---

## BE14 — Shopper and Admin Orders

### What was built and why

Shoppers need a **My Orders** page to see what they bought and where it's up to. Staff need an **admin order list** they can filter, plus the full details of any order (including the Paystack reference and refunds) to handle problems. This task is read-only: changing statuses comes in BE15, and cancelling in BE16.

### New endpoints

| Method and path | Who | What it does |
|---|---|---|
| `GET /api/orders?page=` | Logged-in shopper | Own orders, newest first, 10 per page |
| `GET /api/orders/:id` | Logged-in shopper | One own order, with status history and refunds (someone else's → 404) |
| `GET /api/admin/orders?status=&from=&to=&page=` | Admin | All orders, 20 per page, filters, calculated refund status |
| `GET /api/admin/orders/:id` | Admin | Full details: contact, address, payment reference, history (who), refunds |

### New or changed files

| File | Purpose |
|---|---|
| `middleware/requireAdmin.js` | **New.** 403 unless `req.user.isAdmin` (after `requireAuth`) |
| `routes/admin.routes.js`, `controllers/admin.controller.js` | **New.** `/api/admin`; `router.use(requireAuth, requireAdmin)` protects every admin route at once |
| `services/order/adminOrder.service.js` | **New.** The filtered list, `refundStatus`, and the details |
| `utils/pagination.js` | **New.** `toLimitOffset`, `toPage`: the standard `{ items, page, pageSize, totalItems, totalPages }` |
| `services/order/order.service.js` | *(changed)* `listMyOrders`, `getMyOrder`; shared helpers `loadOrderDetails` and `toItemView` |
| `utils/dates.js` | *(changed)* `accraDayRange(from, to)`: Ghana days → a UTC range |
| `validators/order.validators.js` | *(changed)* `myOrdersQuery`, `orderIdParams`, `adminOrdersQuery` |
| `routes/orders.routes.js`, `controllers/order.controller.js`, `app.js` | The new routes |

**Tables:** none new. This task reads `Orders`, `OrderItems`, `OrderStatusChanges` and `Refunds`: an order has many items, many status changes and many refunds.

### How a request flows

```text
GET /api/admin/orders?status=Pending&from=2026-09-01&to=2026-09-30
  → routes/admin.routes.js
      requireAuth   (login cookie → fresh User row; 401 if none)
      requireAdmin  (user.isAdmin?  403 if not)
      validate      (status is one of 4; dates real and to ≥ from; page ≥ 1)
  → admin.controller.listOrders
  → adminOrder.service.listOrders
      accraDayRange → createdAt >= 2026-09-01 00:00 Accra  AND  < 2026-10-01 00:00 Accra
      Order.findAndCountAll (20, newest first)
      ONE grouped query: SUM(refunds) per order, requested + processed only
      → refundStatus none / partial / full
  ← { items, page, pageSize, totalItems, totalPages }
```

### Key concepts

- **Ownership (stopping IDOR).** My Orders never asks the client *whose* orders to show. The user id comes from the login cookie, and every query includes `userId`: `where: { id, userId }`. Asking for someone else's order id finds nothing, so it's a **404**, exactly like an order that doesn't exist. A 403 would confirm that the order exists. (IDOR, "insecure direct object reference", means changing an id in the URL to see someone else's data.)
- **Admin check in one place.** `router.use(requireAuth, requireAdmin)` at the top of `admin.routes.js` runs before **every** admin route, so a new admin route can't forget it. `requireAdmin` checks `isAdmin` from the database row, not from the token, so removing someone's admin rights takes effect immediately.
- **401 vs 403.** 401 means "we don't know who you are, so log in". 403 means "we know who you are, and you're not allowed".
- **Calculated, not stored.** `refundStatus` is worked out from the Refund rows every time: `none` if 0, `partial` if less than the total, `full` if the total or more. Failed refunds don't count. Storing it would mean two places that could disagree.
- **Ghana-time date filters.** An admin who picks "30 September" means the day in Ghana. `accraDayRange` turns the dates into `[start of from-day, start of the day after to-day)` in UTC, with the `<` on the end, so a 23:59:59 order on the last day is included and a 00:00 order on the next day isn't. The tests check both edges. Ghana is UTC+0, but the code uses the `Africa/Accra` time zone name, so the intent is clear and it would still work if that ever changed.
- **Pagination in two steps.** First count and get the ids for this page (cheap and exact), then load those orders with their items. Counting while joining items can over-count rows, because an order with 3 items is 3 joined rows.
- **Blank query values are "not given".** Forms often send `?status=&from=`, so an empty value is treated as missing rather than invalid.
- **Different views for different people.** Shoppers see their history and refunds, but not who changed the status, Paystack's refund id or error messages. Admins see all of that, plus the payment reference. Neither view includes the confirmation token.

---

## BE15 — Admin Order Status

### What was built and why

Staff need to move orders along as they're packed and delivered, and shoppers need to hear about it. An admin can now mark an order **Shipped**, then **Delivered**. Each change is recorded with the admin's ID, and the shopper gets an email.

### New endpoint

| Method and path | Who | What it does |
|---|---|---|
| `PATCH /api/admin/orders/:id/status` | Admin | `{ status: "Shipped" \| "Delivered" }`: checks the change is allowed, saves it with history, emails the shopper |

### New or changed files

| File | Purpose |
|---|---|
| `services/order/orderStatus.service.js` | **New.** The one shared transition service: allowed changes, locking, history, the email after commit |
| `services/email/templates/orderShipped.js`, `orderDelivered.js` | **New.** The two emails (HTML and text) |
| `services/email/templates/storeContact.js` | **New.** Store contact lines shared by all order emails (moved out of the confirmation email) |
| `validators/order.validators.js` | *(changed)* `statusChangeBody`: only `Shipped` or `Delivered` for now |
| `controllers/admin.controller.js`, `routes/admin.routes.js` | *(changed)* `changeStatus` and the PATCH route |

**Tables:** none new. Each change updates `Orders.status` and adds an `OrderStatusChanges` row (`fromStatus`, `toStatus`, `changedByUserId` = the admin).

### How a request flows

```text
PATCH /api/admin/orders/40/status  { "status": "Shipped" }
  → csrfCheck (X-Requested-With)  → requireAuth → requireAdmin → validate
  → admin.controller.changeStatus
  → orderStatus.service.changeOrderStatus(40, 'Shipped', adminId)
      transaction:
        SELECT … FOR UPDATE  (lock the order)
        current Pending → Shipped allowed?   no → 409, nothing saved
        UPDATE Orders.status;  INSERT OrderStatusChanges (by adminId)
      COMMIT
      → sendStatusEmail in the background (a failure is only logged)
  → adminOrder.service.getOrder(40)
  ← 200 { order }   (new status, history with changedBy)
```

### Key concepts

- **A state machine.** An order can only be in one of four states, and only some moves are allowed. They're written down once, in `ALLOWED_NEXT` (`Pending → Shipped`, `Shipped → Delivered`), and every change is checked against the order's **current** status. So no route or bug can send an order backwards or skip a step. `Cancelled` is reached only through the cancellation service (BE16), because cancelling also has to restore stock and refund.
- **Locking the order row.** Two admins clicking "Shipped" at the same moment: without a lock, both could read `Pending`, both pass the check, and the shopper gets two emails and two history rows. With `SELECT … FOR UPDATE`, the second click waits, then sees `Shipped` and gets 409 "This order is already Shipped." The test sends three clicks at once: one 200, two 409s, one email, one history row.
- **History in the same transaction.** The status change and its `OrderStatusChange` row commit together, so a status can never change without a record of who changed it and when.
- **Email after commit, never blocking.** The email goes out only once the change is saved, and in the background. If the mail server fails, the order is still Shipped; the failure is only logged. Emailing first and then failing to save would tell the shopper something that isn't true.
- **The right link for each shopper.** Account holders get `/orders/<id>` (My Orders), which never expires. Guests have no account, so they get the confirmation page link, which works for 30 days. Only account holders are invited to review, because reviews need an account (BE18).
- **400 vs 409.** 400 means the request itself is wrong (`"shipped"`, `"Cancelled"` for now). 409 means the request is fine, but the order is in the wrong state for it.

---

## BE16 — Cancellation

### What was built and why

Shoppers can now cancel an order **before it ships**, and admins can cancel any order that hasn't shipped. Cancelling has to do three things together: **put the items back into stock**, **mark the order Cancelled**, and **give the money back**. One service does all of it for both shoppers and admins, so the rules can't drift apart.

### New and changed endpoints

| Method and path | Who | What it does |
|---|---|---|
| `POST /api/orders/:id/cancel` | Logged-in shopper | Cancels your own `Pending` order (already cancelled → 200 + message) |
| `PATCH /api/admin/orders/:id/status` `{ "status": "Cancelled" }` | Admin | The same cancellation (already cancelled → 409, like BE15) |
| `GET /api/orders`, `GET /api/orders/:id` *(changed)* | Shopper | Now include `canCancel` (true while `Pending`) |

### New or changed files

| File | Purpose |
|---|---|
| `services/order/cancellation.service.js` | **New.** `cancelOrder({ orderId, actorUserId, ownerId })`: the one cancellation service |
| `services/email/templates/cancellation.js` | **New.** The email, with the refund amount and timing, or without them if nothing was left to refund |
| `services/refund/refund.service.js` | *(changed)* `refundedAmount(orderId)` and `COUNTED_REFUND_STATUSES`, now shared with the admin views |
| `services/order/orderStatus.service.js` | *(changed)* Exports `orderLink` (My Orders or the confirmation page link) |
| `controllers/order.controller.js`, `routes/orders.routes.js` | The shopper cancel endpoint |
| `controllers/admin.controller.js`, `validators/order.validators.js` | The admin PATCH accepts `Cancelled` and sends it to the cancellation service |
| `services/order/order.service.js` | `canCancel` in My Orders |

**Tables:** none new. A cancellation updates `Orders.status` and `Products.stock`, and adds one `OrderStatusChanges` row and (usually) one `Refunds` row with `type = 'cancellation'`.

### How a request flows

```text
POST /api/orders/46/cancel   (Sue)
  → requireAuth → validate → order.controller.cancelMine
  → cancellation.service.cancelOrder({ orderId: 46, actorUserId: Sue, ownerId: Sue })
      transaction (retried once on a deadlock):
        lock the order WHERE id = 46 AND userId = Sue    not found → 404
        Cancelled already? → { alreadyCancelled }        Shipped/Delivered? → 409
        lock its products (id order) → stock + quantity
        status Cancelled + history (by Sue)
        left = total − refunds already counted → Refund(left, 'requested')  (if left > 0)
      COMMIT
      → sendRefundToPaystack → 'processed' (or 'failed' + reason)
      → cancellation email (background)
  ← 200 { order }   (Cancelled, canCancel false, with the refund)
```

### Key concepts

- **One service, two callers.** The shopper endpoint passes `ownerId` (so the order must be theirs); the admin passes `null` (any order). Everything else is the same code. Each caller only decides how to *answer* "already cancelled": 200 + a message for shoppers (a double click is harmless), and 409 for admins (matching BE15's "already Shipped").
- **All or nothing.** Stock, status, history and the refund row commit together. If anything fails, nothing changes: no half-cancelled order with stock restored but no refund.
- **Locks prevent double cancelling.** The order row is locked first. Five cancels at the same moment take turns. The first does the work, and the other four find it already `Cancelled`. Stock is restored once, there's one refund and one email (the tests check this). The same lock means an admin pressing "Shipped" at the same moment is seen, so the shopper gets "already shipped" instead of cancelling a shipped order.
- **Refund what's left, not the full total.** Example: paid GHS 445.00, and the store had already refunded GHS 30.00 (a BE17 partial refund). Cancelling refunds **GHS 415.00**, so the total refunded equals what was paid, never more. `failed` refunds aren't counted, because that money never went back. If everything was already refunded, no new refund is created, and the email doesn't mention one.
- **Paystack after the commit.** The Refund is first saved as `requested`, inside the transaction. Only after the commit do we call Paystack. If Paystack refuses, the order is **still cancelled** (the stock is back), and the Refund becomes `failed` with the reason, so staff can retry it (BE17).
- **Same lock order everywhere.** Products are always locked in id order (fulfilment, the cart, and now cancellation), so two transactions can never wait for each other in a circle (a deadlock).

---

## BE17 — Admin Refunds

### What was built and why

Sometimes the store needs to give money back without cancelling: an item arrived damaged, delivery was late, or the order never arrived. An admin can now refund **part** of an order (an amount they choose) or **all of what's left**. If Paystack refuses a refund, the admin can **retry** it, and the retry is built so it can never pay the shopper twice.

### New endpoints

| Method and path | Who | What it does |
|---|---|---|
| `POST /api/admin/orders/:id/refunds` | Admin | `{ type: full \| partial, amount?, reason }`: saves the refund, sends it to Paystack, emails the shopper once Paystack accepts |
| `POST /api/admin/orders/:id/refunds/:refundId/retry` | Admin | Retries a `failed` refund, after checking with Paystack whether it was actually made |

### New or changed files

| File | Purpose |
|---|---|
| `services/refund/adminRefund.service.js` | **New.** `issueRefund` and `retryRefund` |
| `validators/refund.validators.js` | **New.** The body (amount required for partial, a whole number in pesewas; a reason of 1–200 characters) and the params |
| `services/refund/refund.service.js` | *(changed)* `sendRefundEmail`, `findPaystackRefundsForPayment` |
| `services/payment/paystack.client.js` | *(changed)* `listRefunds` (`GET /refund`) |
| `controllers/admin.controller.js`, `routes/admin.routes.js` | The two routes |

**Tables:** none new. Each refund is a `Refunds` row (`orderId`, `amount`, `type`, `reason`, `status`, `providerReference` = Paystack's refund id, `failureReason`, `issuedByUserId`).

### How a request flows

```text
POST /api/admin/orders/11/refunds  { type: "partial", amount: 5000, reason: "…" }
  → requireAuth → requireAdmin → validate
  → adminRefund.service.issueRefund
      transaction: lock the order → left = total − counted refunds
                   full → amount = left;  partial → amount ≤ left?  (400 if not)
                   INSERT Refund (requested)
      COMMIT
      → sendRefundToPaystack → processed (+ Paystack id)  or  failed (+ reason)
      → processed? email the shopper
  ← 201 { order, refund }

POST …/refunds/27/retry
  transaction: lock the order → is it failed? does it still fit? → CLAIM it (status requested)
  COMMIT
  → ask Paystack: which refunds exist for this payment?
       Paystack has more than we recorded → mark processed with Paystack's id, email, DON'T send
       otherwise                         → send to Paystack now
       couldn't ask                      → back to failed, send nothing
  ← 200 { order, refund }
```

### Key concepts

- **Never more than was paid.** "Left" = paid − (requested + processed refunds). It's calculated **while the order row is locked**, and cancellation (BE16) takes the same lock. So two refunds, or a refund and a cancellation, at the same moment can't both use the same money. In the test, 5 refunds of GHS 300 on a GHS 500 order at once: exactly 1 succeeded.
- **Save first, then Paystack.** The refund row is committed as `requested` before Paystack is called, so it's never forgotten, even if the server crashed mid-call. Paystack is never called inside the transaction.
- **A timeout is not a failure.** If Paystack doesn't answer in time, we record `failed`, but Paystack may have actually done it. Blindly sending again could refund the shopper twice. So a retry first **lists Paystack's refunds for this payment**. If Paystack has refunded more than we have recorded, the missing one *is* this refund: we link it (`providerReference`) and email, without sending again. The tests simulate exactly this.
- **Matching Paystack's list.** Paystack's "list refunds" (`GET /refund`) can't filter by payment, only by date. So we list from the order's date onwards, page by page, and keep the refunds whose `transaction_reference` is our payment reference, or whose `transaction` is the Paystack transaction id from verify. This was checked against the real test API: it found the BE16 refund with the same Paystack id we had saved.
- **Claiming before retrying.** Inside the lock, a retry switches the refund from `failed` to `requested`. A second retry at the same moment then sees `requested` and gets 409, so only one retry ever talks to Paystack.
- **If we can't check, we don't send.** If listing Paystack's refunds fails, the refund goes back to `failed` with "Couldn't check Paystack's refunds", and nothing is sent. Waiting is always safer than paying twice.
- **Emails only for real money.** The shopper is emailed only once Paystack has *accepted* the refund, so a failed refund never tells anyone "your money is on its way".
- **Refunds don't change orders.** Status and stock stay as they are. Cancelling (BE16) is the action that returns stock.

---

## BE18 — Reviews

### What was built and why

Shoppers can now rate and review products **they actually received**, and everyone sees the reviews with a star summary on the product page. Limiting reviews to real buyers ("verified purchase") is what makes them trustworthy.

### New endpoints

| Method and path | Login | What it does |
|---|---|---|
| `GET /api/products/:id/reviews?sort=&page=` | No | Visible reviews, 5 per page, plus `summary` (average, count, star breakdown) |
| `POST /api/products/:id/reviews` | Yes | Write a review (only if you received the product; one each) |
| `PATCH /api/reviews/:id` | Yes | Edit your own review (`editedAt` set; hidden stays hidden) |
| `DELETE /api/reviews/:id` | Yes | Delete your own review |
| `GET /api/products/:id` *(changed)* | Optional | `viewer` now has the real `canReview` and `myReview` |

### New or changed files

| File | Purpose |
|---|---|
| `services/review/review.service.js` | **New.** Eligibility, the list, create, edit, delete, `getViewer`, `reviewerName` |
| `controllers/review.controller.js`, `routes/reviews.routes.js` | **New.** The handlers; `/api/reviews/:id` for your own review |
| `validators/review.validators.js` | **New.** Rating 1–5 (whole), text ≤ 1,000, sort, at least one field for an edit |
| `validators/common.validators.js` | **New.** The shared `page` and "blank = not given" helpers (moved from the order validators) |
| `services/review/reviewStats.js` | *(changed)* `getReviewSummary`: average, count and breakdown in one grouped query |
| `services/catalog/catalog.service.js` | *(changed)* `viewer` filled from the review service |
| `routes/products.routes.js`, `middleware/rateLimits.js`, `app.js` | The routes, and `reviewLimiter` (20 per 15 minutes) |

**Tables:** none new. `Reviews` (from BE1) belongs to a `Product` and a `User` (the reviewer). The database enforces **one review per user per product** (UNIQUE) and **ratings 1–5** (CHECK).

### How a request flows

```text
POST /api/products/33/reviews  { "rating": 4, "text": "…" }
  → reviewLimiter → requireAuth → validate (rating 1–5, text ≤ 1000)
  → review.controller.create
  → review.service.createReview
      product active?                        no → 404
      already reviewed it?                   yes → 409
      Delivered order in MY account with it? no → 403
      INSERT Review   (two clicks at once: UNIQUE rule → 409)
  ← 201 { review }

GET /api/products/33/reviews?sort=highest
  → visible reviews, page of 5, sorted (ties: newest first)
  → ONE query: which of these reviewers bought it (verified purchase)
  → ONE grouped query: count per star → average, count, breakdown
  ← { items, page, …, summary }
```

### Key concepts

- **Eligibility comes from orders.** "Can review" means a `Delivered` order **in your account** containing the product. A Pending order isn't enough (you haven't received it), and guest orders aren't linked to any account. The tests check all three.
- **Avoiding N+1 queries.** "Verified purchase" is needed for every review on the page. Asking once per review would be 5 extra queries per page, and more on bigger pages. Instead, one query asks "which of these reviewers bought this product?" and returns a set. The test counts the database queries: the same number for a page of 1 review as for a page of 5.
- **The database as a backstop.** The service checks "already reviewed?" first, for a friendly 409. If two submits arrive at the same moment, both pass that check, but the UNIQUE (userId, productId) rule lets only one row in, and the other gets the same 409.
- **Hidden means gone from every number.** Hidden reviews are left out of the list, the average, the count and the breakdown, and of the product cards (`getRatingStats`), so moderation (BE19) really removes a review's effect. The reviewer still sees their own review, with `isHidden: true`. Editing never un-hides it: `isHidden` simply isn't one of the fields an edit can change.
- **Ownership by query.** Editing or deleting looks up `where: { id, userId: <you> }`. Someone else's review isn't found, so it's a 404, the same pattern as My Orders.
- **Privacy.** The public list shows "Ama M." (first name and last initial), never an email, full name or user id.
- **Stable sorting.** Sorting by rating alone would give ties in a random order that can change between pages. Adding `createdAt` and then `id` as tie-breakers makes the order the same every time, so no review appears on two pages or on none.
- **Rate limit.** Write, edit and delete share 20 requests per 15 minutes per IP, enough for real use but not for spamming. The test makes 21 requests and checks the 21st is refused.

---

## BE19 — Review Moderation (with the moderation log)

### What was built and why

The store needs to deal with bad reviews: offensive, spam, or about the wrong product. An admin can now list all reviews, **hide** one (reversible: it disappears publicly but isn't lost), **unhide** it, or **delete** it permanently. Every action is written to a new **moderation log** table, with who did it, why, when, and a copy of the review, so there's always a record, even after a delete.

### New endpoints (admin only)

| Method and path | What it does |
|---|---|
| `GET /api/admin/reviews?status=visible\|hidden&page=` | All reviews, 20 per page, newest first, with product, reviewer (name and email), status and hidden details |
| `PATCH /api/admin/reviews/:id/hide` `{ reason }` | Hide (reason required) |
| `PATCH /api/admin/reviews/:id/unhide` `{ reason? }` | Unhide (reason optional, only logged) |
| `DELETE /api/admin/reviews/:id` `{ reason }` | Delete permanently (reason required) |

### New table: `ReviewModerationLogs`

| Column | Meaning |
|---|---|
| `id` | The log row |
| `reviewId` | Which review. A plain number, **not a foreign key** (see below) |
| `productId` | The product (foreign key to `Products`) |
| `reviewerUserId` | Who wrote the review (foreign key to `Users`, set to NULL if that user is ever removed) |
| `action` | `hide`, `unhide` or `delete` |
| `reason` | Why (required for hide and delete; optional for unhide) |
| `adminUserId` | Which admin did it |
| `reviewCopy` | JSON: `{ rating, text, createdAt, wasHidden }`, the review **as it was** at that moment |
| `createdAt` | When (there's no `updatedAt`: log rows are never edited) |

Relationships: a log row **belongs to** a Product, a reviewer User and an admin User. A Review can have many log rows (found by `reviewId`).

To see it in MySQL Workbench:

```sql
SELECT id, action, reviewId, productId, reviewerUserId, adminUserId, reason, reviewCopy, createdAt
FROM ReviewModerationLogs ORDER BY id DESC;
```

### New or changed files

| File | Purpose |
|---|---|
| `migrations/20261001000001-create-review-moderation-logs.js` | **New.** The log table |
| `models/ReviewModerationLog.js` | **New.** Its model |
| `services/review/reviewModeration.service.js` | **New.** List, hide, unhide, delete, each with its log row in the same transaction |
| `validators/review.validators.js` | *(changed)* The admin list query and the reason bodies |
| `controllers/admin.controller.js`, `routes/admin.routes.js` | *(changed)* The four admin routes |

### How a request flows

```text
PATCH /api/admin/reviews/32/hide  { "reason": "Offensive language" }
  → requireAuth → requireAdmin → validate (reason 1–200)
  → reviewModeration.service.hideReview
      transaction:
        lock the review row                       (not found → 404)
        already hidden?                           → 409, nothing saved
        INSERT ReviewModerationLogs (hide, reason, admin, copy of rating + text)
        UPDATE Reviews SET isHidden, hiddenReason, hiddenAt, hiddenByUserId
      COMMIT            (both saved together, or neither)
  ← 200 { review }   — and the public average no longer counts it
```

### Key concepts

- **Same transaction, so the log tells the truth.** The log row and the action commit together. If the action fails, the log row is rolled back too, so the log never records something that didn't happen, and nothing happens without a record. The test forces a database failure halfway through a hide: no log row, and the review stays visible.
- **Why a copy of the review?** After a delete, the review row is gone. The log keeps `{ rating, text, createdAt, wasHidden }` so you can always see *what* was removed, not just that something was.
- **Why `reviewId` isn't a foreign key.** A foreign key would force us, when the review is deleted, to either delete its log rows (losing the history) or set `reviewId` to NULL (losing which review they were about). As a plain number, it keeps linking the hide, unhide and delete rows of the same review, forever.
- **Append-only.** Log rows are only ever inserted, never updated (no `updatedAt`). That's what makes a log trustworthy.
- **Hide vs delete.** Hiding is reversible: the review stays in the database, out of every public number, and its author still sees it marked hidden. Deleting is permanent. Both update the averages instantly, because ratings are always calculated live from the visible reviews (BE18). There's no stored average to forget to update.
- **Locking the review.** Two admins acting at the same moment take turns. The second sees the new state and gets 409 ("already hidden") instead of a second log row.

---

## BE20 — Dashboard and Settings

### What was built and why

The admin's home page: how the shop is doing (revenue, orders, average order), money going back (refunds, and failed ones to fix), the newest orders, what needs attention (Pending orders, hidden reviews), and which products need restocking. The admin can also choose how few items count as "low stock".

### New endpoints (admin only)

| Method and path | What it does |
|---|---|
| `GET /api/admin/dashboard?period=today\|7d\|30d\|all` | All the figures for the period (default `7d`, Ghana time) |
| `PATCH /api/admin/settings/low-stock-threshold` `{ value }` | Set the threshold (whole number 0–1,000) |

### New or changed files

| File | Purpose |
|---|---|
| `services/dashboard/dashboard.service.js` | **New.** Periods, sales, refunds, recent orders, counts, stock, all as SUM/COUNT queries |
| `validators/admin.validators.js` | **New.** `period` and the threshold body |
| `services/settings/settings.service.js` | *(changed)* `getLowStockThreshold`, `setLowStockThreshold` |
| `utils/dates.js` | *(changed)* `accraToday()`, `accraDaysAgo(n)` |
| `controllers/admin.controller.js`, `routes/admin.routes.js` | *(changed)* The two routes |

**Tables:** none new. The dashboard only **reads** `Orders`, `Refunds`, `Reviews` and `Products`. The threshold lives in `Settings` (`key = 'lowStockThreshold'`).

### How a request flows

```text
GET /api/admin/dashboard?period=7d
  → requireAuth → requireAdmin → validate (period, default 7d)
  → dashboard.service.getDashboard('7d')
      period: from = 6 days ago (Ghana date) → start = that day 00:00 Accra (UTC)
      in parallel:
        SUM(Orders.total), COUNT(not Cancelled)       orders placed since start
        SUM(Refunds.amount) JOIN Orders               refunds on THOSE orders
        SUM(Refunds.amount) since start                refunded in the period
        COUNT(failed refunds), latest 5 orders, Pending count, hidden reviews
        threshold → products with 1..threshold left, and with 0 left
  ← { period, sales, refunds, recentOrders, counts, stock }
```

### Key concepts

- **Definitions decide the numbers.** "Revenue" can mean different things, so it's defined once:
  - **revenue** = what orders placed in the period were worth, minus what's been given back on those orders;
  - **order count** leaves out Cancelled orders;
  - **average** = revenue ÷ count, rounded to the nearest pesewa, or `null` when there are no orders (you can't divide by zero).
- **Why revenue by order date?** If a refund made today counted against today, a quiet day with one big refund would show *negative* revenue, and last week's figure would never reflect its own refunds. Tying each refund to its order's date keeps every period's revenue meaning "what that period's orders earned". Refunds *by refund date* are shown separately (`refundedInPeriod`).
- **Let the database add up.** `SUM` and `COUNT` run in MySQL, which returns one number. Loading every order into Node to add them up would get slower as the shop grows.
- **Ghana-time periods.** "Last 7 days" means 7 whole Ghana days, today included. The start is that day's midnight in `Africa/Accra`, converted to UTC for the query (the same helper as the order filters).
- **Live stock.** Low stock isn't stored anywhere; it's worked out from `Products.stock` on every request. So it changes straight away after a sale, a cancellation (stock comes back), or a new threshold. The tests show a product leaving the list after a cancellation.
- **Testing against real data.** The test measures the dashboard, adds known orders and refunds, measures again, and checks the *difference* against hand-calculated values. That works whatever real orders already exist.

### Check it yourself in MySQL Workbench

Set the period start first. For `7d` it's midnight 6 days ago (Ghana is UTC+0); for `all`, set it to `NULL`.

```sql
SET @from = '2026-09-26 00:00:00';   -- period start; NULL for "all"

-- revenue = orders placed in the period − refunds on those orders
SELECT
  (SELECT COALESCE(SUM(total), 0) FROM Orders WHERE @from IS NULL OR createdAt >= @from)
  - (SELECT COALESCE(SUM(r.amount), 0) FROM Refunds r JOIN Orders o ON o.id = r.orderId
     WHERE r.status IN ('requested','processed') AND (@from IS NULL OR o.createdAt >= @from)) AS revenue;

-- order count (Cancelled excluded)
SELECT COUNT(*) AS orderCount FROM Orders
WHERE status <> 'Cancelled' AND (@from IS NULL OR createdAt >= @from);

-- refunded in the period (by refund date)
SELECT COALESCE(SUM(amount), 0) AS refundedInPeriod FROM Refunds
WHERE status IN ('requested','processed') AND (@from IS NULL OR createdAt >= @from);

-- failed refunds right now
SELECT COUNT(*) AS failedRefunds FROM Refunds WHERE status = 'failed';

-- low stock and out of stock (threshold from Settings)
SELECT value FROM Settings WHERE `key` = 'lowStockThreshold';
SELECT id, name, stock FROM Products WHERE isActive = 1 AND stock BETWEEN 1 AND 5 ORDER BY stock, name;
SELECT id, name, stock FROM Products WHERE isActive = 1 AND stock = 0 ORDER BY name;
```

The average order value is `revenue ÷ orderCount`, rounded.

---

## BE22 — Final Review, Deployment and README

### What was done and why

Before going live, the whole backend was reviewed against the plan's **Final Production Review** checklist (Section 21), the API documentation was checked against the real code, a Postman collection was made, and the README now explains how to run and deploy everything. Deployment itself (Aiven, GitHub, Render, the Paystack webhook) is done by hand, following the README.

### What the review checked (and found)

| Area | Result |
|---|---|
| **Secrets** | `.env` is ignored by git and was never committed; `*.pem` and `*.crt` (certificates) are ignored too |
| **Logging** | The only `console.log` calls are server start and stop messages, and the login code, which is printed **only** when `NODE_ENV=development` |
| **Dependencies** | Every package is used. `mysql2` is the driver Sequelize loads; `sequelize-cli` stays a normal dependency because Render runs the migrations |
| **Dead code** | An empty `services/image/` folder (meant for the stretch image-upload task, never built) was removed. `.env.example` now says the ImageKit keys are optional |
| **Database** | On a **throwaway database**, all 18 migrations ran, every seeder ran, everything was undone, and the migrations ran again: all clean. Every index and unique rule from the plan exists (e.g. `Orders.status`, `Orders.createdAt`, `Products.categoryId`, `Users.email`, `Reviews(userId, productId)`) |
| **Production mode** | `NODE_ENV=production` was tested locally: the health check is fine, cookies are `HttpOnly; Secure; SameSite=None`, HSTS is on, and `X-Powered-By` is hidden |
| **API docs** | A script listed **every route Express actually registers (39)** and compared them with docs/api.md's headings (39): no missing or extra endpoints |
| **Postman** | `docs/postman_collection.json` covers all 39 endpoints (43 requests). Its main requests were run in order against the app: all passed |

### One fix: the number of proxies (`TRUST_PROXY_HOPS`)

The rate limits count requests **per visitor IP**. On Render, every request passes through Render's proxy, so Express is told to trust **1** proxy hop and read the real IP from the `X-Forwarded-For` header.

But the recommended frontend setup (the frontend's host forwarding `/api` to Render, so cookies are first-party) adds a **second** proxy. With only 1 trusted hop, every visitor would appear to come from the frontend host's IP, so the whole shop would share **one** login limit (10 tries per 15 minutes)!

So the number of hops is now a setting: `TRUST_PROXY_HOPS` (default 1, or 2 with forwarding). It can't simply be "trust everything", because then anyone could fake their IP by sending their own `X-Forwarded-For` header and dodge the limits.

### Third-party cookies

In production the frontend and the API live on different sites. Cookies set by a different site are "third-party", and Safari (and some privacy settings) block them, so logins wouldn't stick. Cookies already use `SameSite=None; Secure`, which is the technically correct setting. The robust fix, though, is for the frontend's host to forward `/api` requests, so the browser only ever talks to one site. This is documented in docs/api.md and the README for the frontend project.

### Deployment, in one picture

```text
your computer ──git push──► GitHub ──► Render (build: npm ci + db:migrate, start: npm start)
                                              │  env vars: NODE_ENV=production, DB_SSL=true, …
                                              ▼
                                       Aiven MySQL (SSL, CA certificate)
Paystack ──webhook (signed)──► https://<service>.onrender.com/api/webhooks/paystack
```

### The product catalogue (`docs/catalogue.md`)

The product photos didn't match the original 24 products, so the shop now sells the **41 products** in [docs/catalogue.md](catalogue.md): 6 categories, each product with a price, stock, description, ImageKit photo and alt text.

**The seeder reads the docs file.** `seeders/20260929000002-products.js` opens `docs/catalogue.md` at seed time, finds each `## Bags (`bags`): 8 products` heading, and reads the table rows under it. The file is the one list for people **and** for code, so they can never disagree. The file is found relative to the seeder (`__dirname`), so seeding works from any folder.

**Every row is checked before anything is saved.** The seeder stops with a message naming the line if:
- the pesewas value isn't exactly GH₵ × 100 (money must be whole pesewas);
- the stock isn't a whole number;
- the photo isn't an ImageKit address;
- a name appears twice;
- a heading says "8 products" but has a different number of rows.

A typo in the file can't put a wrong price in the shop.

**Why the local database was reset.** Old orders point at products, and the foreign key from `OrderItems` to `Products` is `RESTRICT`: a product that has been ordered can't be deleted, so its order history can never lose its product. So the old catalogue couldn't simply be swapped out underneath the test orders. Since all local data was test data, the database was rebuilt from scratch (every table dropped, then all migrations and seeders run), giving exactly what a new production database gets.

**A bug found by the reset.** The BE9 migration (refunds for checkouts) had an **undo** step that made `Refunds.orderId` required again. That fails when "paid but sold out" refunds exist, because they have no order. Earlier undo tests passed only because that table was empty. MySQL can't roll back table changes, so the failed undo had left the table half-changed. The undo now first deletes the refunds that have no order (they can't exist in the older table shape). This was tested with such a refund present: all 18 migrations undo and redo cleanly.
