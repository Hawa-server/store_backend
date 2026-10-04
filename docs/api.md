# Store API Reference

This document is the contract between the backend and the React frontend. Every endpoint the frontend can call is listed here, with its exact request and response shapes. It is updated after every backend task.

---

## 1. Basics

### Base URL

| Environment | Base URL |
|---|---|
| Local development | `http://localhost:5000` |
| Production (Render) | `https://<your-render-service>.onrender.com` (fill in the real address once deployed) |

All endpoint paths start with `/api`.

**Recommended in production: call the API through your frontend's own domain.** The frontend and the API will be on different sites (for example `…vercel.app` and `…onrender.com`). The login and cart cookies are then "third-party" cookies (`Secure; SameSite=None`), which **Safari and some privacy settings block**, so logins would silently not stick. The simple fix is to let the frontend host forward `/api/*` to the Render address (a "rewrite" on Vercel, a "redirect/proxy" on Netlify, or the Vite dev server `proxy` locally), and call the API with relative URLs such as `fetch('/api/products')`. The cookies then belong to the frontend's own domain and work everywhere.

### Requests from the browser

The API logs users in with an **HTTP-only cookie**, so the frontend never sees or stores the login token. For cookies to work across the frontend and API origins:

- Always send credentials: `fetch(url, { credentials: 'include' })` or `axios` with `withCredentials: true`.
- The API accepts requests only from the configured frontend origin (`CLIENT_URL`, `http://localhost:5173` in development).

### Required header on every POST, PATCH and DELETE

Every request that changes something **must** include:

```http
X-Requested-With: XMLHttpRequest
```

Without it, the API responds `403 FORBIDDEN`. This protects logged-in users against cross-site request forgery (CSRF). `GET` requests don't need it.

### Request bodies are JSON only

Send bodies as JSON with `Content-Type: application/json`. Limits and errors:

- Any other body type → `415`, code `INVALID_REQUEST`.
- A body larger than 100 kb → `413`, code `INVALID_REQUEST`.
- Broken JSON → `400`, code `INVALID_REQUEST`.

An empty body (for example, a POST with nothing to send) is fine.

### Recommended fetch helper

```js
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(method !== 'GET' && { 'X-Requested-With': 'XMLHttpRequest' }),
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw data.error; // { code, message, fields? }
  return data;
}
```

---

## 2. Conventions

### Money

- All amounts are **whole numbers in pesewas** (1 GHS = 100 pesewas). Example: `35000` means **GHS 350.00**. To display: `(amount / 100).toFixed(2)`.
- The server always calculates prices and totals. Any price or total the frontend sends is ignored.

**GHS is charged; USD is display only.** Every GHS amount (`…Ghs`, in pesewas) in products, the cart and checkout has a matching **USD** amount (`…Usd`) in **whole US cents**. Example: `2258` means **US$ 22.58**.

- The server converts with the store's `usdRate` (GHS per 1 US dollar, from `GET /api/settings/currency`). **Never convert on the frontend**; just show the `…Usd` fields.
- **The USD amounts always add up.** Each **unit price** is converted first, then multiplied and added: `lineTotalUsd = unitPriceUsd × quantity`, `subtotalUsd` = the sum of the lines, `totalUsd = subtotalUsd + deliveryFeeUsd`. So a USD total can be one cent away from converting the GHS total directly. That's expected, because the GHS amount is the real price.
- Always label the currency: `GH₵ 350.00` or `GHS 350.00`, and `US$ 22.58`. Never show a bare `$`.
- A GHS/USD switch is a frontend setting. Remember the shopper's choice in `localStorage` and pick the matching field; nothing needs to be sent to the API.
- **Paystack always charges GHS.** At checkout, always show the GHS total that will be charged (the `chargeNote`), even when the shopper is viewing USD.
- Orders, the confirmation page and order emails show GHS only: the amount actually charged.

### Dates

- Dates are ISO 8601 strings in UTC, for example `"2026-09-29T13:45:00.000Z"`.
- Business dates (filters, dashboard periods) use Ghana time (`Africa/Accra`, which is UTC+0).

### Error format

Every error response has this shape:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request is invalid.",
    "fields": { "email": "Enter a valid email address." }
  }
}
```

- `message` is safe to show to the user.
- `fields` appears **only** for validation errors. It maps each field name to a message, so the frontend can show errors next to form inputs.
- `reason` appears only where an endpoint documents it (currently the 402 errors of `POST /api/checkout/verify`). It's a short machine-readable detail, so the frontend doesn't have to read the message text.

| Code | Usual HTTP status | Meaning |
|---|---|---|
| `INVALID_REQUEST` | 400, 413, 415 | Validation failed, bad JSON, body too large, or not JSON |
| `UNAUTHENTICATED` | 401 | Not logged in, or the login has expired |
| `FORBIDDEN` | 403 | Logged in but not allowed, or the `X-Requested-With` header is missing |
| `EMAIL_NOT_VERIFIED` | 403 | Correct password, but the email address hasn't been verified yet |
| `NOT_FOUND` | 404 | The resource or route doesn't exist (or isn't yours) |
| `CONFLICT` | 409 | Duplicate, or the resource is in the wrong state |
| `OUT_OF_STOCK` | 409 | Not enough stock |
| `RATE_LIMITED` | 429 | Too many attempts; try again later |
| `PAYMENT_FAILED` | 402, 502 | The payment didn't succeed, or couldn't be started with Paystack (502) |
| `PAYMENT_PENDING` | 202 | The payment isn't confirmed yet; check again shortly |
| `SERVER_ERROR` | 500, 503 | Something went wrong on the server |

The exact status used by each endpoint is listed with that endpoint.

### Pagination format

Paginated lists return:

```json
{ "items": [], "page": 1, "pageSize": 10, "totalItems": 0, "totalPages": 0 }
```

Request a page with `?page=2`. Pages start at 1. A missing or blank `page` means page 1. A page past the end returns `items: []` (not an error), and `totalPages` is `0` for an empty list. A `page` that isn't a whole number of 1 or more gives `400 INVALID_REQUEST` with `fields.page`.

---

## 3. Endpoints

### Health

#### `GET /api/health`

Checks that the API and its database are running. Open this before a demo to wake the free-tier server and database.

- **Login required:** no
- **Admin required:** no
- **Request body:** none

**200 OK**

```json
{ "status": "ok", "database": "ok" }
```

**Errors**

| Status | Code | When |
|---|---|---|
| 503 | `SERVER_ERROR` | The database can't be reached |

```json
{ "error": { "code": "SERVER_ERROR", "message": "The database is unavailable. Please try again shortly." } }
```

### Auth

How accounts work:

1. **Register.** The user gets an email with a verification link.
2. **Verify.** The user clicks the link. It opens the frontend page `/verify-email?token=...`, and that page sends the token to the API.
3. **Log in.** The API sets an HTTP-only cookie named `token`. The frontend can't read it; the browser sends it automatically with `credentials: 'include'`.
   - **When login codes are on** (the server setting `LOGIN_CODE_ENABLED`), the password alone isn't enough. The login answers `{ "requiresCode": true }`, a 6-digit code is emailed, and the user is logged in only after `POST /api/auth/login/verify-code`. The frontend must handle **both** answers, because the setting can be switched either way.
4. **Login alert.** Every successful login also emails the user a login alert.

The login lasts **1 day**; after that, protected endpoints return `401 UNAUTHENTICATED` and the user must log in again. To know whether someone is logged in (for example, when the app loads), call `GET /api/auth/me`: a `200` means logged in, a `401` means not.

**Rate limits (per IP address):**

| Endpoint | Limit |
|---|---|
| Login | 10 per 15 minutes |
| Register | 5 per hour |
| Verify | 10 per 15 minutes |
| Resend verification | 5 per 15 minutes |
| Verify login code | 10 per 15 minutes |
| Resend login code | 5 per 15 minutes |

Going over a limit returns `429 RATE_LIMITED`.

**The user object** returned by these endpoints:

```json
{
  "id": 2,
  "name": "Ama Mensah",
  "email": "ama.mensah@example.com",
  "isAdmin": false,
  "createdAt": "2026-09-29T15:56:39.000Z"
}
```

`isAdmin` is only for showing or hiding admin screens. The server checks admin rights itself on every admin request.

#### `POST /api/auth/register`

Creates an account and emails a verification link. The user can't log in until they verify.

- **Login required:** no
- **Admin required:** no
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`

**Request body**

| Field | Type | Rules |
|---|---|---|
| `name` | string | Required, 1–100 characters (trimmed) |
| `email` | string | Required, a valid email, up to 255 characters. Stored lowercase |
| `password` | string | Required, 8–72 characters |

Any other fields are ignored.

```json
{ "name": "Ama Mensah", "email": "ama@example.com", "password": "Password123" }
```

**201 Created**

```json
{ "message": "Account created. Check your email to verify your account." }
```

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | Validation failed (see `fields`) |
| 409 | `CONFLICT` | `"An account with this email already exists."` |
| 429 | `RATE_LIMITED` | Too many registrations from this IP |

Example validation error:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Please check the highlighted fields.",
    "fields": {
      "name": "Name is required.",
      "email": "Enter a valid email address.",
      "password": "Password must be at least 8 characters."
    }
  }
}
```

The frontend's success screen should say "Check your email to verify your account" and offer a **Resend verification email** button.

#### `POST /api/auth/verify`

Verifies the email address using the token from the emailed link.

- **Login required:** no
- **Admin required:** no
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`

**The link in the email** looks like this:

```text
{CLIENT_URL}/verify-email?token=<64 hex characters>
```

The frontend route `/verify-email` should read `token` from the query string and send it here straight away. A link works **once** and expires after **24 hours**.

**Request body**

```json
{ "token": "3f9a…(64 hex characters)" }
```

**200 OK**

```json
{ "message": "Your email is verified. You can now log in." }
```

After this, send the user to the login page.

**Errors**

| Status | Code | Message |
|---|---|---|
| 400 | `INVALID_REQUEST` | `"This link is invalid or has already been used."` |
| 400 | `INVALID_REQUEST` | `"This link has expired. Request a new one."` |
| 429 | `RATE_LIMITED` | Too many attempts |

Show the message, and offer **Resend verification email** in both 400 cases. A malformed token also returns 400 with `fields.token`.

#### `POST /api/auth/resend-verification`

Sends a new verification link. The response is always the same, whether or not the email has an account, so it can't be used to discover accounts. Each new link cancels the earlier ones, so only the newest link works.

- **Login required:** no
- **Admin required:** no
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`
- **Limit:** 3 resends per hour per account, plus the per-IP limit above

**Request body**

```json
{ "email": "ama@example.com" }
```

**200 OK**

```json
{ "message": "If that email belongs to an account that still needs verifying, we have sent a new link. Please check your inbox and spam folder." }
```

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | The email is missing or invalid (see `fields`) |
| 429 | `RATE_LIMITED` | `"You can request up to 3 new links per hour. Please try again later."`, or the per-IP limit |

#### `POST /api/auth/login`

Checks the email and password. What happens next depends on the server's login code setting:

- **Login codes off:** the user is logged in straight away. It sets the HTTP-only `token` cookie, merges the guest cart, and emails a login alert showing the date and time (in Ghana time) and the browser. The answer is `200 { user }`.
- **Login codes on:** the user is **not** logged in yet. A 6-digit code is emailed, and the answer is `200 { requiresCode: true, message }` (see *Answer when login codes are on* below). Continue with `POST /api/auth/login/verify-code`.

Tell the two apart with `requiresCode`: if it's `true`, show the code screen; otherwise the body has `user`.

- **Login required:** no
- **Admin required:** no
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`
- **Must be sent with credentials** (`credentials: 'include'`), or the browser will ignore the cookie

**Request body**

```json
{ "email": "ama.mensah@example.com", "password": "DemoShopper123" }
```

**200 OK (login codes off)**, and the response sets the cookie:

```http
Set-Cookie: token=<JWT>; Path=/; Expires=<in 1 day>; HttpOnly; SameSite=Lax
```

In production the cookie is `Secure; SameSite=None`.

```json
{
  "user": {
    "id": 2,
    "name": "Ama Mensah",
    "email": "ama.mensah@example.com",
    "isAdmin": false,
    "createdAt": "2026-09-29T15:56:39.000Z"
  }
}
```

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | The email is missing or invalid, or the password is missing (see `fields`) |
| 401 | `UNAUTHENTICATED` | `"Email or password is incorrect."` (the same for an unknown email or a wrong password) |
| 403 | `EMAIL_NOT_VERIFIED` | `"Please verify your email before logging in."` Show a **Resend verification email** button |
| 429 | `RATE_LIMITED` | Too many login attempts from this IP |
| 429 | `RATE_LIMITED` | *(login codes on)* `"Too many login codes requested. Please try again later."` 5 codes have been sent to this account in the last hour |
| 503 | `SERVER_ERROR` | *(login codes on)* `"We couldn't send your login code. Please try again."` The code email failed; the user isn't logged in and can simply log in again |

**Answer when login codes are on:** **200 OK**

```json
{ "requiresCode": true, "message": "We've emailed you a 6-digit login code. It expires in 10 minutes." }
```

- **No** `token` cookie is set, the guest cart is **not** merged yet, and no login alert is sent. All three happen after the correct code.
- Instead, the response sets a short-lived HTTP-only cookie: `loginChallenge` (15 minutes). It remembers that this browser entered the right password. The frontend doesn't read it; just keep sending requests with `credentials: 'include'`. The code only works in the browser that received this cookie.
- If the user presses **Log in** again within 60 seconds, no second email is sent; the code already sent still works.

**Guest cart merge.** If the browser has a guest cart (the `guestCart` cookie), logging in moves its items into the user's account cart:

- **The same product in both carts:** the quantities are added together, then capped at the current stock and at 99.
- **Products that were removed from the shop or have sold out:** dropped.
- **Afterwards:** the guest cart is deleted, and the response clears the `guestCart` cookie.
- **If the merge fails** (rare, a server-side problem): login **still succeeds**. The guest cart and its cookie are kept, and the merge is tried again at the next login.

The login response doesn't include the cart. **After a successful login, call `GET /api/cart`** to show the merged cart and the badge count. (With login codes on, the merge happens at verify-code instead, so call it after that.)

#### `POST /api/auth/login/verify-code`

The second login step, used only when login codes are on. It checks the 6-digit code from the email and, if it's right, logs the user in: exactly like a direct login, it sets the `token` cookie, merges the guest cart, and sends the login alert.

- **Login required:** no, but the `loginChallenge` cookie from `POST /api/auth/login` is required. The user is identified by that cookie, never by the body.
- **Admin required:** no
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`. Send with `credentials: 'include'`
- **Rate limit:** 10 per 15 minutes per IP

**Request body**

| Field | Type | Rules |
|---|---|---|
| `code` | string | Required, exactly 6 digits. Send it as a **string**, so a leading zero isn't lost (`"048213"`) |

```json
{ "code": "048213" }
```

**200 OK:** the same as a direct login. It sets the `token` cookie, clears the `loginChallenge` cookie, and clears the `guestCart` cookie after a successful merge.

```json
{ "user": { "id": 2, "name": "Ama Mensah", "email": "ama.mensah@example.com", "isAdmin": false, "createdAt": "2026-09-29T15:56:39.000Z" } }
```

**Code rules:** a code expires after **10 minutes** and works **once**. After **5 wrong tries** it's cancelled. Requesting a new code cancels the old one.

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | `"Enter the 6-digit code."` Not exactly 6 digits (in `fields.code`) |
| 400 | `INVALID_REQUEST` | `"That code is incorrect. 3 attempts left."` (the number counts down; `"1 attempt left."` at the end) |
| 400 | `INVALID_REQUEST` | `"Too many wrong attempts. Request a new code."` The 5th wrong try cancels the code |
| 400 | `INVALID_REQUEST` | `"This code has expired. Request a new code."` |
| 400 | `INVALID_REQUEST` | `"This code is no longer valid. Request a new code."` Already used, cancelled, or replaced by a newer code |
| 401 | `UNAUTHENTICATED` | `"Your login has expired. Please log in again."` No `loginChallenge` cookie, or it's older than 15 minutes. Send the user back to the login form |
| 429 | `RATE_LIMITED` | Too many tries from this IP |

#### `POST /api/auth/login/resend-code`

Emails a new login code. The old code stops working, and the `loginChallenge` cookie is renewed for another 15 minutes.

- **Login required:** no, but the `loginChallenge` cookie is required
- **Admin required:** no
- **Headers:** `X-Requested-With: XMLHttpRequest`. Send with `credentials: 'include'`
- **Request body:** none
- **Limits:** at least **60 seconds** between codes, and at most **5 codes per hour** per account (the first code sent at login counts), plus 5 requests per 15 minutes per IP

**200 OK**

```json
{ "message": "We've emailed you a new code. It expires in 10 minutes." }
```

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 401 | `UNAUTHENTICATED` | `"Your login has expired. Please log in again."` |
| 429 | `RATE_LIMITED` | `"Please wait 42 seconds before requesting a new code."` Less than 60 seconds since the last code |
| 429 | `RATE_LIMITED` | `"Too many login codes requested. Please try again later."` 5 codes in the last hour |
| 503 | `SERVER_ERROR` | `"We couldn't send your login code. Please try again."` The email failed; the user can press Resend again straight away |

**The code screen, for the frontend:**

1. After a login that answers `requiresCode: true`, show "Enter the 6-digit code we emailed you", with the `message`.
2. Use one input that accepts digits only (`inputmode="numeric"`, `autocomplete="one-time-code"`), and send it as a string.
3. The **Resend code** button starts disabled, with a 60-second countdown. On a 429 "Please wait N seconds", count down from N.
4. On a 400, show the message under the input. After "Too many wrong attempts", "expired" or "no longer valid", highlight **Resend code**.
5. On a 401, go back to the login form ("Your login has expired. Please log in again.").
6. On a 200, do exactly what you do after a direct login: store the user, then call `GET /api/cart`.

#### `POST /api/auth/logout`

Logs out by clearing the login cookie, the `guestCart` cookie, and any unfinished `loginChallenge` cookie. It always succeeds, even if the user wasn't logged in.

After logout, `GET /api/cart` returns an empty cart, so reset the cart badge to 0. The account cart isn't deleted: it's still saved and comes back at the next login.

- **Login required:** no
- **Admin required:** no
- **Headers:** `X-Requested-With: XMLHttpRequest`
- **Request body:** none

**200 OK**

```json
{ "message": "You have been logged out." }
```

#### `GET /api/auth/me`

Returns the logged-in user. Use it when the app loads to find out whether someone is logged in.

- **Login required:** yes (the `token` cookie)
- **Admin required:** no
- **Request body:** none

**200 OK**

```json
{
  "user": {
    "id": 2,
    "name": "Ama Mensah",
    "email": "ama.mensah@example.com",
    "isAdmin": false,
    "createdAt": "2026-09-29T15:56:39.000Z"
  }
}
```

**Errors**

| Status | Code | When |
|---|---|---|
| 401 | `UNAUTHENTICATED` | `"Please log in to continue."` No cookie, or the token is invalid or expired, or the account no longer exists |

Every endpoint marked **Login required** returns this same `401` when the user isn't logged in.

### Settings

#### `GET /api/settings/currency`

The currency rules and the current exchange rate, for a GHS/USD switch and a "prices are charged in GHS" note.

- **Login required:** no
- **Admin required:** no
- **Request body:** none

**200 OK**

```json
{
  "currency": {
    "chargeCurrency": "GHS",
    "displayCurrencies": ["GHS", "USD"],
    "usdRate": 15.5,
    "note": "Prices are charged in Ghana cedis (GHS). USD amounts are an estimate for display only."
  }
}
```

- `usdRate` is **cedis per 1 US dollar** (15.5 means US$ 1 = GHS 15.50). It's for information only, for example "US$ 1 = GH₵ 15.50". Use the `…Usd` fields for prices, never your own conversion.
- `chargeCurrency` is always `GHS`.

### Categories and products

These endpoints are all **public**: no login and no special headers are needed. Only active products are ever returned. A product that has been removed from the shop behaves exactly like one that never existed (404).

**Product fields used below**

| Field | Type | Notes |
|---|---|---|
| `priceGhs` | integer | Pesewas. `35000` = GHS 350.00 |
| `priceUsd` | integer | US cents, display only. `2258` = US$ 22.58 |
| `stock` | integer | Units available now |
| `stockLabel` | string | `"Out of stock"` (0), `"Only X left"` (1–5), `"In stock"` (more than 5). Show it as-is. Disable "Add to cart" when `stock` is 0 |
| `category` | object | `{ "name": "Bags", "slug": "bags" }` |
| `mainImage` | object or `null` | `{ "url", "altText" }`. Every seeded product has a photo; `null` would mean a product has none, so still show a placeholder |
| `rating` | object | `{ "average": 4.5, "count": 2 }`. `average` has 1 decimal place and is `null` when `count` is 0 ("No reviews yet"). Hidden reviews are never counted |

**Photos:** every product has one photo, stored on ImageKit (`https://ik.imagekit.io/ADORN/…`). The originals are large (some are several megabytes), so **always ask ImageKit for a smaller version** by adding a width setting to the URL:
- product cards and the cart: `?tr=w-600`;
- the product page: `?tr=w-1200`.

For example: `https://ik.imagekit.io/ADORN/ADORN/Products/Bags/black-tote-bag-1.jpg?tr=w-600`. Always use `altText` as the image's `alt`. If an image fails to load, or `mainImage` is `null`, show the frontend's own `/placeholder.jpg`. The full product and photo list is in [catalogue.md](catalogue.md).

#### `GET /api/categories`

Lists all categories in display order.

- **Login required:** no
- **Admin required:** no

**200 OK**

```json
{
  "categories": [
    { "id": 1, "name": "Bags", "slug": "bags", "productCount": 8 },
    { "id": 2, "name": "Makeup", "slug": "makeup", "productCount": 8 },
    { "id": 3, "name": "Skincare", "slug": "skincare", "productCount": 6 },
    { "id": 4, "name": "Jewellery", "slug": "jewellery", "productCount": 8 },
    { "id": 5, "name": "Accessories", "slug": "accessories", "productCount": 7 },
    { "id": 6, "name": "Perfumes", "slug": "perfumes", "productCount": 4 }
  ]
}
```

- `productCount` counts active products only.
- Use `slug` to build category links, for example `/products?category=bags`.
- **Don't hard-code IDs** (category or product) in the frontend: they change whenever the database is re-seeded. Slugs never change.

#### `GET /api/products`

Lists active products, sorted A–Z by name. Not paginated.

- **Login required:** no
- **Admin required:** no

**Query parameters**

| Name | Required | Example | Notes |
|---|---|---|---|
| `category` | no | `bags` | A category `slug`. Leave it out to list every active product |

**200 OK** for `GET /api/products?category=bags`:

```json
{
  "products": [
    {
      "id": 1,
      "name": "Black Canvas Tote Bag",
      "priceGhs": 12000,
      "priceUsd": 774,
      "stock": 15,
      "stockLabel": "In stock",
      "category": { "name": "Bags", "slug": "bags" },
      "mainImage": { "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Bags/black-tote-bag-1.jpg", "altText": "Black canvas tote bag hanging on a wooden chair" },
      "rating": { "average": 4.5, "count": 2 }
    },
    {
      "id": 7,
      "name": "Black Leather Mini Duffle Bag",
      "priceGhs": 38000,
      "priceUsd": 2452,
      "stock": 6,
      "stockLabel": "In stock",
      "category": { "name": "Bags", "slug": "bags" },
      "mainImage": { "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Bags/black-mini-duffle-bag-1.jpg", "altText": "Black leather mini duffle bag on a lime-green background" },
      "rating": { "average": null, "count": 0 }
    }
  ]
}
```

(Shortened here: the real response for `bags` has 8 products.)

A category that exists but has no active products returns `200` with `{ "products": [] }`.

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | `category` isn't a valid slug (lowercase letters, numbers and dashes); see `fields.category` |
| 404 | `NOT_FOUND` | `"Category not found."` |

#### `GET /api/products/:id`

One product's full details.

- **Login required:** no. If the user **is** logged in, the response also includes `viewer`.
- **Admin required:** no

**200 OK** for `GET /api/products/1`:

```json
{
  "product": {
    "id": 1,
    "name": "Black Canvas Tote Bag",
    "priceGhs": 12000,
    "priceUsd": 774,
    "stock": 15,
    "stockLabel": "In stock",
    "category": { "name": "Bags", "slug": "bags" },
    "mainImage": { "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Bags/black-tote-bag-1.jpg", "altText": "Black canvas tote bag hanging on a wooden chair" },
    "rating": { "average": 4.5, "count": 2 },
    "description": "A roomy black canvas tote with long shoulder handles. Light, sturdy and easy to fold, it's made for everyday errands, books and beach days.",
    "images": [
      { "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Bags/black-tote-bag-1.jpg", "altText": "Black canvas tote bag hanging on a wooden chair", "sortOrder": 1, "isMain": true }
    ],
    "viewer": null
  }
}
```

Each product currently has one image, so `images` has one entry. The list supports more photos per product, so show it as a gallery when it has more than one.

- `images` is sorted by `sortOrder`. `mainImage` is the image with `isMain: true`, or the first image if none is marked.
- `viewer` is `null` for guests. For a logged-in user:

  ```json
  "viewer": {
    "canReview": false,
    "myReview": {
      "id": 7, "productId": 1, "rating": 5, "text": "Beautiful bag.",
      "createdAt": "2026-09-29T17:32:28.000Z", "editedAt": null, "isHidden": false
    }
  }
  ```

  - `canReview` is `true` when the user has **received** this product (a `Delivered` order in their account containing it) **and** hasn't reviewed it yet. Show the **Write a review** form only then.
  - `myReview` is the user's own review, or `null`. Show it with **Edit** and **Delete** buttons.
  - If `myReview.isHidden` is `true`, the store has hidden it. It isn't shown to anyone else and doesn't count in the rating. Show "Hidden by the store" on it.

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | `id` isn't a positive whole number (for example `abc` or `1.5`); see `fields.id` |
| 404 | `NOT_FOUND` | `"Product not found."` The product doesn't exist or has been removed from the shop |

### Reviews

Shoppers can review products **they have received**. Reviews show on the product page with a star summary.

**The rules:**
- **Who can review:** a logged-in shopper who has a **Delivered** order **in their account** containing the product. Orders placed as a guest don't count.
- **One review per product per person.** It can be edited or deleted later.
- **Rating** 1–5 (whole stars), plus optional **text** of up to 1,000 characters.
- **Hidden reviews:** reviews hidden by the store (admin moderation, BE19) never appear in lists and never count in averages.

**Rate limit:** writing, editing and deleting reviews share a limit of **20 per 15 minutes per IP**. Going over it gives `429 RATE_LIMITED`.

**Show review text as plain text** (React does this by default). Never insert it as HTML.

#### `GET /api/products/:id/reviews`

The public reviews for one product, with a summary for the star breakdown.

- **Login required:** no
- **Query:**
  - `sort`: `recent` (the default, newest first), `highest` (most stars first, then newest) or `lowest` (fewest stars first, then newest);
  - `page`: default 1.
- **5 reviews per page.**

**Example:** `GET /api/products/1/reviews?sort=highest&page=1`

**200 OK** (the standard pagination format, plus `summary`)

```json
{
  "items": [
    {
      "id": 7,
      "rating": 5,
      "text": "Beautiful bag and very strong. It fits my laptop and still looks smart.",
      "reviewerName": "Ama M.",
      "verifiedPurchase": true,
      "createdAt": "2026-09-29T17:32:28.000Z",
      "editedAt": null
    }
  ],
  "page": 1,
  "pageSize": 5,
  "totalItems": 2,
  "totalPages": 1,
  "summary": {
    "average": 4.5,
    "count": 2,
    "breakdown": { "1": 0, "2": 0, "3": 0, "4": 1, "5": 1 }
  }
}
```

- `reviewerName` is the reviewer's **first name and last initial**. Emails and user ids are never shown.
- `verifiedPurchase` is `true` when the reviewer has a Delivered order containing this product. Show a **Verified purchase** badge.
- `editedAt` is set if the review was changed. Show "(edited)".
- `text` can be `null` (stars only).
- `summary` counts **all** visible reviews, not just this page:
  - `average` has 1 decimal place, or is `null` when there are none;
  - `breakdown` gives the number of reviews for each star, so you can draw the 5★…1★ bars.
- The product card's `rating` (`{ average, count }`) always matches `summary`.

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | A bad `id`, `sort` (`"Sort must be recent, highest or lowest."`) or `page` |
| 404 | `NOT_FOUND` | `"Product not found."` |

#### `POST /api/products/:id/reviews`

Writes a review for a product you've received.

- **Login required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`

**Request body**

| Field | Type | Rules |
|---|---|---|
| `rating` | number | Required, a whole number from 1 to 5 (a JSON number, not `"5"`) |
| `text` | string | Optional, up to 1,000 characters. Spaces are trimmed; empty text is saved as `null` |

```json
{ "rating": 4, "text": "Gentle on my skin." }
```

**201 Created**: your review, in the same shape as `viewer.myReview`:

```json
{ "review": { "id": 22, "productId": 33, "rating": 4, "text": "Gentle on my skin.", "createdAt": "2026-10-01T12:02:16.264Z", "editedAt": null, "isHidden": false } }
```

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | Validation failed: `fields.rating` (`"Rating must be from 1 to 5."`…) or `fields.text` (`"Your review must be 1,000 characters or fewer."`) |
| 401 | `UNAUTHENTICATED` | Not logged in. Show "Log in to write a review" |
| 403 | `FORBIDDEN` | `"You can review a product after it has been delivered to you."` |
| 404 | `NOT_FOUND` | `"Product not found."` |
| 409 | `CONFLICT` | `"You've already reviewed this product. You can edit your review instead."` |
| 429 | `RATE_LIMITED` | Too many review actions from this IP |

#### `PATCH /api/reviews/:id`

Edits **your own** review. Send a new `rating`, new `text`, or both.

- **Login required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`

```json
{ "rating": 5, "text": "Even better after a week." }
```

**200 OK:** `{ "review": { … } }`, the same shape as above, with `editedAt` set to now. If the store had hidden the review, **it stays hidden** after editing (`isHidden: true`).

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | A bad value, or neither field sent (`fields.rating`: `"Send a new rating or text."`) |
| 401 | `UNAUTHENTICATED` | Not logged in |
| 404 | `NOT_FOUND` | `"Review not found."` It doesn't exist, **or it isn't yours** |
| 429 | `RATE_LIMITED` | Too many review actions from this IP |

#### `DELETE /api/reviews/:id`

Deletes **your own** review, permanently. The product's rating updates straight away, and the user can write a new review afterwards (`canReview` becomes `true` again).

- **Login required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`
- **Request body:** none

**200 OK**

```json
{ "message": "Your review has been deleted." }
```

**Errors:** the same 401, 404 and 429 as for editing.

### Cart

The cart works for **guests and logged-in users**. The frontend never sends a cart ID: the server finds the cart from the login cookie, or for guests from a `guestCart` cookie.

**How carts are found:**

- **Logged in:** the user's own account cart.
- **Guest:** the cart in the HTTP-only `guestCart` cookie.
  - The cookie is created the first time a guest **adds** an item. Just viewing the cart creates nothing.
  - It lasts 30 days and is renewed every time the cart is used.
  - Always send requests with `credentials: 'include'`, or the guest cart will seem to empty itself.
- A guest cart expires **30 days after it was last changed** (an add, change or remove). An expired cart behaves as if it didn't exist: `GET /api/cart` returns an empty cart and clears the cookie.
- **When a guest logs in**, their guest cart is merged into their account cart (see `POST /api/auth/login`).
- **Logging out** clears the cookies, so the browser starts with an empty cart. The account cart stays saved for the next login.

**Stock** is checked when adding, but not reserved. It's only taken when an order is paid.

**The cart object** (returned by both endpoints):

```json
{
  "cart": {
    "items": [
      {
        "id": 12,
        "productId": 1,
        "name": "Black Canvas Tote Bag",
        "unitPriceGhs": 12000,
        "unitPriceUsd": 774,
        "quantity": 2,
        "lineTotalGhs": 24000,
        "lineTotalUsd": 1548,
        "stock": 15,
        "stockLabel": "In stock",
        "isAvailable": true,
        "mainImage": { "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Bags/black-tote-bag-1.jpg", "altText": "Black canvas tote bag hanging on a wooden chair" },
        "category": { "name": "Bags", "slug": "bags" }
      }
    ],
    "itemCount": 2,
    "subtotalGhs": 24000,
    "subtotalUsd": 1548,
    "hasUnavailableItems": false
  }
}
```

| Field | Meaning |
|---|---|
| `items[].id` | The cart **line** ID, used to change or remove the line (BE5). This is not the product ID |
| `unitPriceGhs`, `lineTotalGhs` | Pesewas, calculated by the server from the **current** product price. `lineTotalGhs = unitPriceGhs × quantity` |
| `unitPriceUsd`, `lineTotalUsd` | The same in US cents (display only). `lineTotalUsd = unitPriceUsd × quantity` |
| `isAvailable` | `false` if the product has been removed from the shop, or its stock has dropped below `quantity` since it was added. Show a warning on that line |
| `itemCount` | The total number of units across all lines (for the cart badge) |
| `subtotalGhs` | The sum of `lineTotalGhs` for **available** lines only. The delivery fee is added at checkout |
| `subtotalUsd` | The sum of `lineTotalUsd` for **available** lines only (US cents, display only) |
| `hasUnavailableItems` | `true` if any line has `isAvailable: false`. Checkout will refuse the cart until the shopper fixes it |

Lines are in the order they were first added. An empty cart looks like this:

```json
{ "cart": { "items": [], "itemCount": 0, "subtotalGhs": 0, "subtotalUsd": 0, "hasUnavailableItems": false } }
```

#### `GET /api/cart`

Returns the current cart.

- **Login required:** no (works for guests too)
- **Admin required:** no
- **Request body:** none

**200 OK:** the cart object above. With no cart yet, the empty cart. It never fails for "no cart".

#### `POST /api/cart/items`

Adds a product to the cart. If the product is already in the cart, its quantity **increases** instead of a second line being added. For a guest's first add, this also creates the cart and sets the `guestCart` cookie.

- **Login required:** no (works for guests too)
- **Admin required:** no
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`

**Request body**

| Field | Type | Rules |
|---|---|---|
| `productId` | number | Required, a positive whole number |
| `quantity` | number | Required, a whole number from 1 to 99 |

Both must be JSON numbers (`1`, not `"1"`). Any other fields, such as a price or a cart ID, are ignored.

```json
{ "productId": 1, "quantity": 1 }
```

**200 OK:** the updated cart object.

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | Validation failed (see `fields`): quantity is 0, negative, a decimal, text or over 99, or productId is invalid |
| 400 | `INVALID_REQUEST` | `"You can add up to 99 of this product."` The line would go over 99 in total (quantity already in the cart plus this one) |
| 404 | `NOT_FOUND` | `"Product not found."` Unknown, or removed from the shop |
| 409 | `OUT_OF_STOCK` | `"This product is out of stock."` Stock is 0 |
| 409 | `OUT_OF_STOCK` | `"Only X available."` Quantity already in the cart plus this one is more than the stock |

When an add fails, nothing in the cart changes.

#### `PATCH /api/cart/items/:id`

Changes the quantity of one cart line. `:id` is the **line** ID (`items[].id` from the cart), **not** the product ID. Setting the quantity to `0` removes the line.

- **Login required:** no (works for guests too)
- **Admin required:** no
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`

**Request body**

| Field | Type | Rules |
|---|---|---|
| `quantity` | number | Required, a whole number from 0 to 99 (a JSON number, not text) |

```json
{ "quantity": 3 }
```

**200 OK:** the updated cart object. If the server had to change what was asked for, the response also has a `message` to show the shopper:

```json
{
  "cart": { "items": [ ... ], "itemCount": 2, "subtotalGhs": 17000, "subtotalUsd": 1096, "hasUnavailableItems": false },
  "message": "Only 2 available."
}
```

| Situation | What happens | `message` |
|---|---|---|
| Quantity is within stock | The quantity is set | *(none)* |
| `quantity: 0` | The line is removed | *(none)* |
| More than the stock | The quantity is **capped** at the stock | `"Only X available."` |
| The product has sold out (stock 0) | The line is removed | `"This product is out of stock and has been removed from your cart."` |

Always show `message` when it's present, and redraw the cart from the returned `cart` object.

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | `quantity` is negative, a decimal, text, missing or over 99, or `:id` isn't a positive whole number (see `fields`) |
| 404 | `NOT_FOUND` | `"Cart item not found."` The line doesn't exist or isn't in **your** cart |
| 409 | `CONFLICT` | `"This product is no longer available. Please remove it from your cart."` The product was removed from the shop; delete the line instead |

#### `DELETE /api/cart/items/:id`

Removes one cart line. `:id` is the **line** ID.

- **Login required:** no (works for guests too)
- **Admin required:** no
- **Headers:** `X-Requested-With: XMLHttpRequest`
- **Request body:** none

**200 OK:** the updated cart object (without that line).

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | `:id` isn't a positive whole number |
| 404 | `NOT_FOUND` | `"Cart item not found."` The line doesn't exist, isn't in your cart, or was already removed |

### Checkout

Checkout turns the current cart into a **Paystack mobile-money payment** in GHS. It works for guests and logged-in shoppers. The server calculates every amount from the cart, and any amount sent by the frontend is ignored.

**No order exists yet after this call.** The order is created only after the payment is confirmed: the frontend calls the verify endpoint (BE8) with the `reference`. Until then the cart is kept, and stock isn't reduced.

**Payment flow for the frontend:**

1. `POST /api/checkout` with the delivery details. You get back a `reference`, an `accessCode` and an `authorizationUrl`.
2. **Main way:** open Paystack's popup (Paystack's InlineJS) with the `accessCode`. **Backup:** redirect the browser to `authorizationUrl`.
3. **If Paystack redirects** instead of using the popup, the shopper comes back to `{CLIENT_URL}/checkout/complete?reference=<reference>`. Paystack adds `reference` (and also `trxref`) to the address.
4. Either way, the frontend then calls `POST /api/checkout/verify` with the `reference` (below).

If a payment fails or is abandoned, just call `POST /api/checkout` again with the same cart. Each attempt gets a new `reference`, and the old one is simply never used. If an old payment is approved late anyway, after a newer one already became an order, it's refunded automatically (see verify, 409 `CONFLICT`).

#### `POST /api/checkout`

- **Login required:** no (guests can check out)
- **Admin required:** no
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`
- **Rate limit:** 10 per 15 minutes per IP address

**Request body**

| Field | Type | Rules |
|---|---|---|
| `name` | string | Required, 1–100 characters |
| `email` | string | Required, a valid email (stored lowercase). The receipt and Paystack emails go here |
| `phone` | string | Required, a Ghana number: `0XXXXXXXXX` or `+233XXXXXXXXX` (spaces and dashes are allowed). Stored as `0XXXXXXXXX` |
| `address` | string | Required, 5–500 characters |

Any other fields (for example `total`) are ignored. For logged-in users, pre-fill `name` and `email` from `GET /api/auth/me`; the shopper can still change them.

```json
{ "name": "Ama Mensah", "email": "ama@example.com", "phone": "0241234567", "address": "12 Oxford Street, Osu, Accra" }
```

**201 Created**

```json
{
  "checkout": {
    "reference": "STORE-muntz37d-3cac4c5999ce",
    "accessCode": "3e1j3wq2poc6lzi",
    "authorizationUrl": "https://checkout.paystack.com/3e1j3wq2poc6lzi",
    "subtotalGhs": 20500,
    "deliveryFeeGhs": 2000,
    "totalGhs": 22500,
    "currency": "GHS",
    "subtotalUsd": 1322,
    "deliveryFeeUsd": 129,
    "totalUsd": 1451,
    "usdRate": 15.5,
    "chargeNote": "You will be charged GHS 225.00. USD amounts are an estimate for display only."
  }
}
```

(Example cart: Black Canvas Tote Bag × 1 (12000 → 774) and Makeup Setting Spray × 1 (8500 → 548).)

- **GHS is the currency charged.** The `…Ghs` amounts are pesewas: `totalGhs = subtotalGhs + deliveryFeeGhs`, and `totalGhs` is exactly what Paystack charges.
- The `…Usd` amounts are US cents, **display only**: `totalUsd = subtotalUsd + deliveryFeeUsd`, and `subtotalUsd` equals the cart's `subtotalUsd`.
- **Always show `chargeNote`** (or the GHS total) next to the Pay button, especially when the shopper is viewing USD, so they know exactly what they'll pay.

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | Validation failed (see `fields`) |
| 400 | `INVALID_REQUEST` | `"Your cart is empty."` |
| 409 | `OUT_OF_STOCK` | `"Only X of <product> available. Please update your cart."`, `"<product> is out of stock. Please remove it from your cart."`, or `"<product> is no longer available. Please remove it from your cart."` Send the shopper back to the cart |
| 429 | `RATE_LIMITED` | Too many checkouts from this IP |
| 502 | `PAYMENT_FAILED` | `"We couldn't start the payment. Please try again."` Paystack couldn't be reached or refused the request. Nothing was charged, and the cart is unchanged |

#### `POST /api/checkout/verify`

Confirms a payment **with Paystack, on the server**, and creates the order if it succeeded. Call it:

- when Paystack's popup reports that the payment is complete (its success callback), or
- on the `/checkout/complete` page, using `reference` from the address.

It's safe to call **as many times as you like**: once the order exists, every call returns the **same** order.

**It can take up to about 20 seconds.** If the payment isn't finished yet, the server itself checks with Paystack up to 3 times, 2 seconds apart, before answering 202. If Paystack is slow or unreachable, it retries once. Show a "Confirming your payment…" spinner, and don't set a client timeout shorter than 25 seconds.

- **Login required:** no (guests pay too; the reference identifies the payment)
- **Admin required:** no
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`
- **Rate limit:** 30 per 15 minutes per IP, enough to call again every few seconds while a payment is pending

**Request body**

```json
{ "reference": "STORE-muntz37d-3cac4c5999ce" }
```

**200 OK:** paid, and the order exists.

```json
{
  "order": {
    "orderNumber": "ORD-20260930-DF96W8",
    "confirmationToken": "9f2c…(64 hex characters)",
    "status": "Pending",
    "totalGhs": 80500
  }
}
```

- Show the `orderNumber`, and refresh the cart badge: the purchased items have been removed from the cart.
- Then go to the confirmation page **`/order/confirmation/<confirmationToken>`**, which loads the order with `GET /api/orders/confirmation/:token` (below). The token works like a password for that order, so only use it in that link, and never log it or send it to analytics.
- A confirmation email with the same link is sent automatically, once, when the order is created, even if the shopper closed the page and the webhook created the order.

**202 Accepted:** the payment still isn't finished after the server's own rechecks (for example, the shopper hasn't approved the prompt on their phone). Wait a few seconds and call again. After about 2 minutes of 202s, show: "We're still waiting for your payment. We'll email you when it's confirmed." (The webhook still creates the order if the payment succeeds later.)

```json
{ "error": { "code": "PAYMENT_PENDING", "message": "Your payment is still being processed. Please wait a moment." } }
```

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | `reference` is missing or has invalid characters |
| 402 | `PAYMENT_FAILED` | `reason: "declined"`: `"Your payment was declined. This can happen with a wrong PIN or not enough money in your wallet. Please try again."` |
| 402 | `PAYMENT_FAILED` | `reason: "not_completed"`: `"Your payment wasn't completed. It may have timed out. Please try again."` The shopper closed the popup, never approved the prompt, or it timed out |
| 402 | `PAYMENT_FAILED` | `reason: "reversed"`: `"Your payment was reversed, so no order was placed. Please try again."` |
| 402 | `PAYMENT_FAILED` | `reason: "closed"`: `"Your payment was not successful. Please try again."` This checkout was already closed (for example, the payment could never be started) |
| 402 | `PAYMENT_FAILED` | No `reason`: `"We couldn't confirm your payment. Please contact us."` Paystack reported an amount or currency that doesn't match this checkout, so no order was created. Don't offer "try again" |
| 404 | `NOT_FOUND` | `"Payment not found."` Unknown reference |
| 409 | `OUT_OF_STOCK` | **Paid, but sold out.** `"Sorry, an item in your order sold out before your payment was confirmed. Your payment of GHS X will be refunded to your mobile money wallet, usually within a few business days."` Another shopper's payment took the last unit first. **No order is created**; the full amount (including delivery) is refunded automatically, and the shopper is emailed. Show the message, and don't offer "try again". Calling verify again returns the same answer, and never refunds twice |
| 409 | `CONFLICT` | **Duplicate payment.** `"You already paid for this order with another payment. Your payment of GHS X will be refunded to your mobile money wallet, usually within a few business days."` This is an older payment for the same cart, approved late, after a newer payment had already created the order. It's refunded in full automatically, and the shopper is emailed. Show the message, and don't offer "try again" |
| 429 | `RATE_LIMITED` | Too many checks from this IP |
| 503 | `SERVER_ERROR` | `"We couldn't confirm your payment right now. Please try again."` Paystack couldn't be reached, even after one retry. Nothing changed, so call again shortly |

For the four "try again" failures (`declined`, `not_completed`, `reversed`, `closed`), no money was taken and nothing changed: the cart and stock are untouched. Offer a **Try again** button that calls `POST /api/checkout` again. `error.reason` only appears on these 402 errors, so check `error.code` first.

**What the frontend should show (summary):**

| Situation | Verify answer | Show |
|---|---|---|
| Paid | 200 | The order number and a link to the confirmation page |
| Waiting for approval on the phone | 202 | A spinner, then call again after a few seconds |
| Wrong PIN or not enough money | 402 `declined` | The message and a "Try again" button |
| Popup closed, or timed out | 402 `not_completed` | The message and a "Try again" button |
| Paid, but sold out, or a duplicate payment | 409 | The message only (the refund is automatic) |
| Paystack is down or the network dropped | 503 | "Try again" (calls verify again, **not** checkout) |

**The order is also created without the frontend.** If the shopper closes the browser straight after paying, Paystack's webhook (below) still creates the order. Calling verify afterwards then simply returns it.

### Orders

#### `GET /api/orders`

**My Orders:** the logged-in shopper's own orders, **newest first**, **10 per page**.

- **Login required:** yes (the `token` cookie)
- **Admin required:** no
- **Query:** `page` (optional, default 1)

Only orders placed **while logged in** to this account appear. Orders placed as a guest aren't linked to an account, even with the same email.

**Example:** `GET /api/orders?page=1`

**200 OK** (the standard pagination format)

```json
{
  "items": [
    {
      "id": 11,
      "orderNumber": "ORD-20260930-3R6FTE",
      "placedAt": "2026-09-30T14:05:12.000Z",
      "status": "Pending",
      "canCancel": true,
      "totalGhs": 8000,
      "itemCount": 1,
      "items": [
        { "productId": 31, "name": "Silver Pocket Mirror", "unitPriceGhs": 6000, "quantity": 1, "lineTotalGhs": 6000, "image": { "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Accessories/pocket-mirror-1.jpg", "altText": "Silver compact pocket mirror" } }
      ]
    }
  ],
  "page": 1,
  "pageSize": 10,
  "totalItems": 1,
  "totalPages": 1
}
```

- `items[].items` uses the **historical** names and prices, what was paid.
- `itemCount` is the total number of units, for "3 items".
- `status` is one of `Pending`, `Shipped`, `Delivered`, `Cancelled`.
- `canCancel` is `true` only while the order is `Pending`. Show a **Cancel order** button only when it's `true`.
- Use `id` to open the details below.

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | `page` isn't a whole number of 1 or more (`fields.page`) |
| 401 | `UNAUTHENTICATED` | Not logged in |

#### `GET /api/orders/:id`

One of **your own** orders, with its status history and refunds.

- **Login required:** yes
- **Admin required:** no
- The response has `Cache-Control: no-store`.

**200 OK**

```json
{
  "order": {
    "id": 11,
    "orderNumber": "ORD-20260930-3R6FTE",
    "status": "Pending",
    "placedAt": "2026-09-30T14:05:12.000Z",
    "canCancel": true,
    "items": [
      { "productId": 31, "name": "Silver Pocket Mirror", "unitPriceGhs": 6000, "quantity": 1, "lineTotalGhs": 6000, "image": { "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Accessories/pocket-mirror-1.jpg", "altText": "Silver compact pocket mirror" } }
    ],
    "subtotalGhs": 6000,
    "deliveryFeeGhs": 2000,
    "totalGhs": 8000,
    "currency": "GHS",
    "paymentMethod": "mobile_money",
    "email": "ama@example.com",
    "delivery": { "name": "Ama Mensah", "phone": "0241234567", "address": "12 Oxford Street, Osu, Accra" },
    "statusHistory": [
      { "fromStatus": null, "toStatus": "Pending", "changedAt": "2026-09-30T14:05:12.000Z" }
    ],
    "refunds": [
      { "id": 3, "amountGhs": 8000, "type": "cancellation", "status": "processed", "reason": "Cancelled by the customer", "createdAt": "2026-10-01T09:00:00.000Z" }
    ]
  }
}
```

- The fields are the same as the confirmation page, plus `id`, `canCancel`, `statusHistory` and `refunds`.
- `statusHistory` is **oldest first**, like a timeline. The first entry is always `null → Pending`, when the order was placed.
- `refunds` are oldest first; the list is empty (`[]`) when there are none. Refund `status` is one of:
  - `requested`: being sent to the mobile money wallet;
  - `processed`: accepted by the payment provider, and usually arrives within a few business days;
  - `failed`: the store is looking into it.
- When `canCancel` is `true`, show **Cancel order**, which calls `POST /api/orders/:id/cancel` (below).

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | `id` isn't a positive whole number |
| 401 | `UNAUTHENTICATED` | Not logged in |
| 404 | `NOT_FOUND` | `"Order not found."` The order doesn't exist, **or belongs to someone else**. Both give the same answer |

#### `POST /api/orders/:id/cancel`

Cancels one of **your own** orders while it's still **`Pending`** (not shipped yet). In one step, the items go back into stock, the order becomes `Cancelled`, and the money is refunded to the shopper's mobile money wallet. The shopper also gets a cancellation email.

- **Login required:** yes
- **Admin required:** no
- **Headers:** `X-Requested-With: XMLHttpRequest`
- **Request body:** none

**How much is refunded:** everything that **hasn't been refunded yet**: the amount paid (including delivery) minus any earlier refunds that are `requested` or `processed`. Usually that's the full total. If the store had already refunded part of it (BE17), only the rest is refunded. If it had already been refunded in full, no new refund is made.

**200 OK:** the updated order, in the same shape as `GET /api/orders/:id`, now `Cancelled` and with the refund:

```json
{
  "order": {
    "id": 11,
    "orderNumber": "ORD-20260930-3R6FTE",
    "status": "Cancelled",
    "canCancel": false,
    "statusHistory": [
      { "fromStatus": null, "toStatus": "Pending", "changedAt": "2026-09-30T14:05:12.000Z" },
      { "fromStatus": "Pending", "toStatus": "Cancelled", "changedAt": "2026-10-01T10:00:00.000Z" }
    ],
    "refunds": [
      { "id": 7, "amountGhs": 8000, "type": "cancellation", "status": "processed", "reason": "Order cancelled.", "createdAt": "2026-10-01T10:00:00.000Z" }
    ],
    "…": "all the other order fields"
  }
}
```

**Already cancelled** (for example, a double click): nothing changes, and the answer is still **200**, with the order and a message:

```json
{ "order": { "status": "Cancelled", "…": "…" }, "message": "This order is already cancelled." }
```

The refund `status` may be `failed` if the payment provider refused it. The order stays cancelled, and the store retries the refund. Show "Your refund is being processed" for `requested` and `processed`, and "We're sorting out your refund" for `failed`.

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | `id` isn't a positive whole number |
| 401 | `UNAUTHENTICATED` | Not logged in |
| 403 | `FORBIDDEN` | The `X-Requested-With` header is missing |
| 404 | `NOT_FOUND` | `"Order not found."` It doesn't exist, **or it isn't yours** |
| 409 | `CONFLICT` | `"This order has already shipped, so it can't be cancelled."` It's `Shipped` or `Delivered`, for example because the store shipped it just before you pressed Cancel. Reload the order |

**For the frontend:**
- Ask "Cancel this order? This can't be undone." before calling.
- After a 200, show the cancelled order and "Refunds usually take a few business days to reach your mobile money wallet."

#### `GET /api/orders/confirmation/:token`

Loads one order for the **order confirmation page**. The frontend page address is **`/order/confirmation/<token>`** (singular "order"). The `token` is the `confirmationToken` returned by `POST /api/checkout/verify`, and it's also in the link in the confirmation email.

- **Login required:** no (guests buy too). The 64-character random token is the key; nobody can guess it.
- **Admin required:** no
- **Link lifetime:** **30 days** from when the order was placed. After that, the link returns the same 404 as an unknown one. Logged-in shoppers can still see the order in My Orders *(BE14)*.
- **Caching:** the response has `Cache-Control: no-store`, because it contains the delivery name, phone and address.
- Opening or refreshing the page any number of times never creates anything; it only reads the order.

**Example:** `GET /api/orders/confirmation/7cccc4011566b76645b60fe3250c7b17b8dc710a0b4c14825914b5a074a4772a`

**200 OK**

```json
{
  "order": {
    "orderNumber": "ORD-20260930-PRN6Q2",
    "status": "Pending",
    "placedAt": "2026-09-30T18:44:21.000Z",
    "items": [
      {
        "productId": 22,
        "name": "Black Volumising Mascara",
        "unitPriceGhs": 7000,
        "quantity": 2,
        "lineTotalGhs": 14000,
        "image": { "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Makeup/black-volumising-mascara-1.jpg", "altText": "Black mascara tube and wand on a pink background" }
      }
    ],
    "subtotalGhs": 14000,
    "deliveryFeeGhs": 2000,
    "totalGhs": 16000,
    "currency": "GHS",
    "paymentMethod": "mobile_money",
    "email": "ama@example.com",
    "delivery": { "name": "Ama Mensah", "phone": "0241234567", "address": "12 Oxford Street, Osu, Accra" }
  }
}
```

- `name` and `unitPriceGhs` are what was **paid**, even if the product's name or price has changed since.
- `image` is the product's current main image, or `null` if it has none.
- `placedAt` is UTC; show it in Ghana time.
- `status` is one of `Pending`, `Shipped`, `Delivered`, `Cancelled`.
- `paymentMethod` is always `mobile_money`; show it as "Mobile money".
- All money is in pesewas.

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 404 | `NOT_FOUND` | `"Order not found."` The token is unknown, badly formed, or the order is more than 30 days old. All three give the same answer on purpose. Show "This order link is invalid or has expired", with a link to the shop (and to My Orders for logged-in shoppers) |

### Admin

Every `/api/admin/...` endpoint requires an **admin** login:

- not logged in → `401 UNAUTHENTICATED` `"Please log in to continue."`;
- logged in but not an admin → `403 FORBIDDEN` `"You don't have permission to do that."`.

Use the user object's `isAdmin` to decide whether to show admin screens. The server checks every request anyway, using the account's current rights in the database.

#### `GET /api/admin/dashboard`

The admin home page: sales, refunds, recent orders, things needing attention, and stock warnings. Everything is calculated live on each request.

- **Login required:** yes
- **Admin required:** yes
- **Query:** `period` = `today`, `7d`, `30d` or `all` (default `7d`). Periods are whole days in **Ghana time**, ending now:
  - `today` is from midnight today;
  - `7d` is today and the 6 days before;
  - `30d` is today and the 29 days before;
  - `all` is everything.
- The response has `Cache-Control: no-store`.

**Example:** `GET /api/admin/dashboard?period=7d`

**200 OK**

```json
{
  "period": { "name": "7d", "from": "2026-09-26", "to": "2026-10-02" },
  "sales": { "revenueGhs": 339000, "orderCount": 4, "averageOrderValueGhs": 84750 },
  "refunds": { "refundedInPeriodGhs": 112000, "failedRefunds": 0 },
  "recentOrders": [
    { "id": 53, "orderNumber": "ORD-20261001-85SK9Q", "placedAt": "2026-10-01T10:14:49.000Z", "customerName": "Toffick Agyeman", "totalGhs": 38000, "status": "Cancelled" }
  ],
  "counts": { "pendingOrders": 3, "hiddenReviews": 0 },
  "stock": {
    "lowStockThreshold": 5,
    "lowStockCount": 2,
    "lowStock": [ { "id": 15, "name": "Makeup Setting Spray", "stock": 2 } ],
    "outOfStock": [ { "id": 30, "name": "Pearl Stud Earrings", "stock": 0 } ]
  }
}
```

**What each figure means** (all money in **pesewas**: divide by 100 for GHS)

| Field | Meaning |
|---|---|
| `period.from` / `period.to` | The Ghana dates covered (`from` is `null` for `all`). Show them, e.g. "26 Sep – 2 Oct" |
| `sales.revenueGhs` | Totals of orders **placed in the period**, minus refunds (requested or processed) on **those orders**, even if the refund happened later. A cancelled order adds nothing |
| `sales.orderCount` | Orders placed in the period, **not counting Cancelled** |
| `sales.averageOrderValueGhs` | `revenue ÷ orderCount`, rounded to the nearest pesewa, or `null` with no orders (show "—") |
| `refunds.refundedInPeriodGhs` | Money refunded (requested or processed) **during** the period, by refund date. It includes automatic "paid but sold out" refunds |
| `refunds.failedRefunds` | Refunds that are `failed` **right now**, whatever the period. They need attention: find them in the order details and **Retry** them |
| `recentOrders` | The 5 newest orders, whatever the period. Link each to the admin order page using `id` |
| `counts.pendingOrders` | Orders waiting to be shipped, right now |
| `counts.hiddenReviews` | Reviews currently hidden, right now |
| `stock.lowStock` | Active products with **1 to `lowStockThreshold`** left, fewest first |
| `stock.outOfStock` | Active products with **0** left |
| `stock.lowStockCount` | `lowStock` + `outOfStock` together. Use it for the **admin menu badge** |

Because revenue is counted by order date, a refund for an older order lowers **that** period's revenue, not today's. `refundedInPeriodGhs` is where today's refunds show up.

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | `"Period must be today, 7d, 30d or all."` |
| 401 | `UNAUTHENTICATED` | Not logged in |
| 403 | `FORBIDDEN` | Not an admin |

#### `PATCH /api/admin/settings/low-stock-threshold`

Changes how few items count as "low stock". The dashboard's stock lists change straight away.

- **Login required:** yes
- **Admin required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`

**Request body**

```json
{ "value": 10 }
```

`value` is a whole number from **0 to 1,000** (a JSON number, not `"10"`). With `0`, nothing is "low stock", and only out-of-stock products are shown.

**200 OK**

```json
{ "lowStockThreshold": 10 }
```

The current value is always shown in the dashboard as `stock.lowStockThreshold`.

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | `fields.value`: `"The threshold must be from 0 to 1,000."`, `"…a whole number."` or `"…a number."` |
| 401 | `UNAUTHENTICATED` | Not logged in |
| 403 | `FORBIDDEN` | Not an admin, or the `X-Requested-With` header is missing |

#### `GET /api/admin/orders`

All orders, **newest first**, **20 per page**, with optional filters.

- **Login required:** yes
- **Admin required:** yes

**Query** (all optional, and they can be combined; blank values such as `?status=&from=` are ignored):

| Parameter | Rules |
|---|---|
| `status` | `Pending`, `Shipped`, `Delivered` or `Cancelled` (exact capitalisation) |
| `from` | A date `YYYY-MM-DD`. Orders placed on or after the **start** of that day, in Ghana time |
| `to` | A date `YYYY-MM-DD`. Orders placed on or before the **end** of that day, in Ghana time. Must not be before `from` |
| `page` | Default 1 |

Both dates are **included**: `from=2026-09-01&to=2026-09-30` means all of September, and `from=2026-09-30&to=2026-09-30` means just that one day.

**Example:** `GET /api/admin/orders?status=Pending&from=2026-09-01&to=2026-09-30&page=1`

**200 OK** (the standard pagination format)

```json
{
  "items": [
    {
      "id": 11,
      "orderNumber": "ORD-20260930-3R6FTE",
      "placedAt": "2026-09-30T14:05:12.000Z",
      "customer": { "name": "Ama Mensah", "email": "ama@example.com", "userId": 2, "isGuest": false },
      "totalGhs": 8000,
      "status": "Pending",
      "refundStatus": "none",
      "refundedGhs": 0
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 1,
  "totalPages": 1
}
```

- `customer` holds the name and email given **at checkout**. `isGuest` is `true` (with `userId: null`) for orders placed without logging in.
- `refundStatus` is **calculated** from the order's refunds each time:
  - `none`: nothing refunded;
  - `partial`: some refunded;
  - `full`: the whole total refunded.
- `refundedGhs` is the amount counted. It adds up refunds that are `requested` or `processed`; **`failed` refunds don't count**, because that money never went back.

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | A bad `status`, a date that isn't `YYYY-MM-DD` or doesn't exist (e.g. `2026-02-30`), a bad `page`, or `"The end date must be on or after the start date."` (in `fields.to`) |
| 401 | `UNAUTHENTICATED` | Not logged in |
| 403 | `FORBIDDEN` | Not an admin |

#### `GET /api/admin/orders/:id`

Everything staff need to handle one order.

- **Login required:** yes
- **Admin required:** yes
- The response has `Cache-Control: no-store`.

**200 OK**

```json
{
  "order": {
    "id": 11,
    "orderNumber": "ORD-20260930-3R6FTE",
    "placedAt": "2026-09-30T14:05:12.000Z",
    "status": "Pending",
    "customer": { "name": "Ama Mensah", "email": "ama@example.com", "phone": "0241234567", "userId": 2, "isGuest": false },
    "deliveryAddress": "12 Oxford Street, Osu, Accra",
    "items": [
      { "productId": 31, "name": "Silver Pocket Mirror", "unitPriceGhs": 6000, "quantity": 1, "lineTotalGhs": 6000, "image": { "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Accessories/pocket-mirror-1.jpg", "altText": "Silver compact pocket mirror" } }
    ],
    "subtotalGhs": 6000,
    "deliveryFeeGhs": 2000,
    "totalGhs": 8000,
    "currency": "GHS",
    "paymentMethod": "mobile_money",
    "paymentReference": "STORE-muo2wdix-570d890c74c3",
    "refundStatus": "partial",
    "refundedGhs": 3000,
    "statusHistory": [
      { "fromStatus": null, "toStatus": "Pending", "changedAt": "2026-09-30T14:05:12.000Z", "changedBy": null }
    ],
    "refunds": [
      {
        "id": 4,
        "amountGhs": 3000,
        "type": "partial",
        "status": "processed",
        "reason": "Item arrived scratched",
        "providerReference": "18492401",
        "failureReason": null,
        "issuedBy": { "id": 1, "name": "Store Admin" },
        "createdAt": "2026-10-01T09:00:00.000Z"
      }
    ]
  }
}
```

- `paymentReference` is the Paystack reference; search for it in the Paystack dashboard.
- `statusHistory[].changedBy` is `null` for changes made by the system, such as the order being placed.
- `refunds[].providerReference` is Paystack's refund id (once accepted).
- `failureReason` explains a `failed` refund.
- `issuedBy` is `null` for automatic refunds.
- A `failed` refund has `providerReference: null`, a `failureReason` (e.g. `"Paystack returned HTTP 400: …"`), and isn't counted in `refundedGhs`.

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | `id` isn't a positive whole number |
| 401 | `UNAUTHENTICATED` | Not logged in |
| 403 | `FORBIDDEN` | Not an admin |
| 404 | `NOT_FOUND` | `"Order not found."` |

#### `PATCH /api/admin/orders/:id/status`

Moves an order to its next status, records who did it, and emails the shopper.

- **Login required:** yes
- **Admin required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`

**Allowed changes**

| From | To | Email to the shopper |
|---|---|---|
| `Pending` | `Shipped` | "Your order … is on its way" |
| `Shipped` | `Delivered` | "Your order … has been delivered" (account holders are also invited to review what they bought) |
| `Pending` | `Cancelled` | "Your order … has been cancelled", with the refund amount. Cancelling also puts the items back into stock and refunds everything not refunded yet, exactly like a shopper's cancellation |

Nothing else is allowed: no going backwards, no skipping a step (`Pending → Delivered`), and no changes to `Delivered` or `Cancelled` orders. In the admin screen, offer only the allowed options: **Mark as shipped** and **Cancel order** for `Pending`, and **Mark as delivered** for `Shipped`. Ask for confirmation before cancelling, because it refunds the shopper and can't be undone.

**Request body**

| Field | Type | Rules |
|---|---|---|
| `status` | string | Required: `"Shipped"`, `"Delivered"` or `"Cancelled"` (exact capitalisation) |

```json
{ "status": "Shipped" }
```

**200 OK:** the updated order, in exactly the same shape as `GET /api/admin/orders/:id`. Use it to refresh the screen. The new entry at the end of `statusHistory` has `changedBy` set to the admin.

```json
{
  "order": {
    "id": 11,
    "orderNumber": "ORD-20260930-3R6FTE",
    "status": "Shipped",
    "statusHistory": [
      { "fromStatus": null, "toStatus": "Pending", "changedAt": "2026-09-30T14:05:12.000Z", "changedBy": null },
      { "fromStatus": "Pending", "toStatus": "Shipped", "changedAt": "2026-10-01T09:30:00.000Z", "changedBy": { "id": 9, "name": "Store Admin" } }
    ],
    "…": "all the other fields of the admin order details"
  }
}
```

**The emails** are sent after the change is saved. If an email fails, the change still stands; the failure is only logged. Each email links to the order:

- shoppers with an account: their order in My Orders, `{CLIENT_URL}/orders/<id>`, which never expires;
- guests: the confirmation page, `{CLIENT_URL}/order/confirmation/<token>`, which works for 30 days after the order.

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | `"Status must be Shipped, Delivered or Cancelled."` (in `fields.status`), or a bad `id` |
| 401 | `UNAUTHENTICATED` | Not logged in |
| 403 | `FORBIDDEN` | Not an admin, or the `X-Requested-With` header is missing |
| 404 | `NOT_FOUND` | `"Order not found."` |
| 409 | `CONFLICT` | `"This order can't be changed from Delivered to Shipped."` The change isn't allowed from the order's **current** status |
| 409 | `CONFLICT` | `"This order is already Shipped."` (or `"…already Cancelled."`). For example, a double click, or another admin got there first. Nothing changed and no second email was sent; reload the order |
| 409 | `CONFLICT` | `"This order has already shipped, so it can't be cancelled."` Cancelling a `Shipped` or `Delivered` order |

#### `POST /api/admin/orders/:id/refunds`

Gives money back to the shopper, in full or in part, through Paystack, to the mobile money wallet they paid with.

- **Login required:** yes
- **Admin required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`

**Request body**

| Field | Type | Rules |
|---|---|---|
| `type` | string | Required: `"full"` (everything not refunded yet) or `"partial"` |
| `amount` | number | **Pesewas**, a whole number greater than 0. **Required for `partial`**, and ignored for `full` |
| `reason` | string | Required, 1–200 characters. Shown to the shopper in the email |

```json
{ "type": "partial", "amount": 5000, "reason": "One earring was scratched" }
```

```json
{ "type": "full", "reason": "Order never arrived" }
```

**How much can be refunded:** at most what's **left**, meaning the amount paid (including delivery) minus every earlier refund that is `requested` or `processed`. Failed refunds don't count. The `order.refundedGhs` and `order.totalGhs` fields show this: left = `totalGhs − refundedGhs`.

**What it doesn't do:** a refund **never changes the order's status or stock**. To cancel an order and put the items back, use **Cancel** (`PATCH …/status` with `Cancelled`).

**201 Created**

```json
{
  "order": { "id": 11, "totalGhs": 8000, "refundStatus": "partial", "refundedGhs": 5000, "refunds": [ "…" ], "…": "the full admin order view" },
  "refund": {
    "id": 21,
    "amountGhs": 5000,
    "type": "partial",
    "status": "processed",
    "reason": "One earring was scratched",
    "providerReference": "18507180",
    "failureReason": null,
    "createdAt": "2026-10-01T11:00:00.000Z"
  }
}
```

- `refund.status: "processed"` means Paystack accepted it, and the shopper has been **emailed** the amount, the reason, and "Refunds usually take a few business days to reach your mobile money wallet."
- **The answer is still 201 if Paystack refuses**, because the refund is saved: `refund.status` is `"failed"`, with a `failureReason` (for example `"Paystack returned HTTP 400: …"`). **No email is sent**, and the amount isn't counted in `refundedGhs`. Show the reason and a **Retry** button (next endpoint).

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | Validation failed: a missing or bad `type`, `amount` (0, negative, a decimal, text, or missing for partial) or `reason` (see `fields`) |
| 400 | `INVALID_REQUEST` | `fields.amount`: `"You can refund at most GHS 50.00."` The partial amount is more than what's left |
| 401 | `UNAUTHENTICATED` | Not logged in |
| 403 | `FORBIDDEN` | Not an admin, or the `X-Requested-With` header is missing |
| 404 | `NOT_FOUND` | `"Order not found."` |
| 409 | `CONFLICT` | `"This order has already been refunded in full."` Nothing is left to refund |

#### `POST /api/admin/orders/:id/refunds/:refundId/retry`

Tries a **failed** refund again.

- **Login required:** yes
- **Admin required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`
- **Request body:** none

**It never refunds twice.** Before sending again, the server asks Paystack which refunds it already has for this payment. A "failed" refund can really have gone through, for example when Paystack accepted it but its answer didn't reach us in time. In that case the refund is marked `processed`, linked to Paystack's refund, and the shopper is emailed, **without sending money again**. Otherwise it's sent to Paystack now.

**200 OK:** the same shape as above, `{ order, refund }`.
- `refund.status: "processed"`: done, and the shopper was emailed.
- `refund.status: "failed"`: it failed again. Read the new `failureReason`. For example, `"Couldn't check Paystack's refunds: …"` means Paystack couldn't be reached, so nothing was sent; try again later.

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | `id` or `refundId` isn't a positive whole number |
| 401 | `UNAUTHENTICATED` | Not logged in |
| 403 | `FORBIDDEN` | Not an admin, or the `X-Requested-With` header is missing |
| 404 | `NOT_FOUND` | `"Order not found."` or `"Refund not found."` (including a refund that belongs to a different order) |
| 409 | `CONFLICT` | `"Only failed refunds can be retried."` It's already `processed`, or another retry is running right now |
| 409 | `CONFLICT` | `"This refund no longer fits: only GHS X is left to refund."` The order was refunded another way in the meantime |

#### `GET /api/admin/reviews`

All reviews, for moderation: **newest first, 20 per page**.

- **Login required:** yes
- **Admin required:** yes
- **Query:** `status` is `visible` or `hidden` (optional; leave it out for all), and `page`.

**200 OK** (the standard pagination format)

```json
{
  "items": [
    {
      "id": 7,
      "product": { "id": 1, "name": "Black Canvas Tote Bag" },
      "reviewer": { "id": 10, "name": "Ama Mensah", "email": "ama.mensah@example.com" },
      "rating": 5,
      "text": "Beautiful bag and very strong.",
      "createdAt": "2026-09-29T17:32:28.000Z",
      "editedAt": null,
      "status": "hidden",
      "hiddenReason": "Offensive language",
      "hiddenAt": "2026-10-01T15:00:00.000Z",
      "hiddenBy": { "id": 9, "name": "Store Admin" }
    }
  ],
  "page": 1, "pageSize": 20, "totalItems": 1, "totalPages": 1
}
```

- The admin view shows the reviewer's **full name and email**; the public only ever sees "Ama M.".
- `hiddenReason`, `hiddenAt` and `hiddenBy` are `null` for visible reviews.

**Errors:** 400 (`"Status must be visible or hidden."` or a bad `page`), 401, 403.

#### `PATCH /api/admin/reviews/:id/hide`

Hides a review. It's removed from the public list and from every average, count and breakdown straight away. The reviewer still sees it on the product page, marked hidden.

- **Login required:** yes
- **Admin required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`

**Request body**

```json
{ "reason": "Offensive language" }
```

`reason` is required, 1–200 characters.

**200 OK:** `{ "review": { … } }`, in the same shape as the list items, with `"status": "hidden"`, the reason, the time and `hiddenBy` (you).

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | `fields.reason`: `"A reason is required."` or `"The reason must be 200 characters or fewer."` |
| 401 / 403 | | Not logged in / not an admin (or the `X-Requested-With` header is missing) |
| 404 | `NOT_FOUND` | `"Review not found."` |
| 409 | `CONFLICT` | `"This review is already hidden."` |

#### `PATCH /api/admin/reviews/:id/unhide`

Makes a hidden review public again. It counts in the averages again straight away.

- **Login required:** yes
- **Admin required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`. Add `Content-Type: application/json` if you send a body.
- **Request body:** optional, `{ "reason": "…" }` (up to 200 characters). It's only recorded in the moderation log.

**200 OK:** `{ "review": { … } }` with `"status": "visible"`, and `hiddenReason`, `hiddenAt` and `hiddenBy` cleared to `null`.

**Errors:** 400 (reason too long), 401, 403, 404 `"Review not found."`, 409 `"This review isn't hidden."`

#### `DELETE /api/admin/reviews/:id`

Deletes a review **permanently**. The product's rating updates straight away.

- **Login required:** yes
- **Admin required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`
- **Request body (required, yes, on a DELETE):** `{ "reason": "Spam" }`, 1–200 characters. With `fetch`, pass `body: JSON.stringify({ reason })` as usual.

**200 OK**

```json
{ "message": "Review deleted." }
```

**Errors:** 400 (`fields.reason`), 401, 403, 404 `"Review not found."`

**For the admin screen:** ask for the reason in a dialog before hiding or deleting, and warn that deleting can't be undone. Prefer **Hide**: it can be reversed.

*Every hide, unhide and delete is also recorded in a database table (`ReviewModerationLogs`) with the admin, the reason, the time and a copy of the review. There's no endpoint for it; it's for the store's own records.*

### Webhooks (not for the frontend)

#### `POST /api/webhooks/paystack`

Called by **Paystack's servers**, never by the frontend. Paystack sends payment events here, such as `charge.success`.

- Every request must carry a valid `x-paystack-signature` header: an HMAC SHA512 of the raw body, made with the Paystack secret key. Without a valid signature → `401 UNAUTHENTICATED`, and the request is ignored.
- Valid events are recorded, answered with `200 { "received": true }` straight away, and then processed. For `charge.success`, the server confirms the payment with Paystack's API and creates the order (the same logic as verify).
- Paystack may send the same event more than once. Duplicates never create a second order.
- This URL must be set in the Paystack dashboard (test mode) after deployment *(BE22)*.

### Unknown routes

Any path or method that doesn't exist returns:

**404 Not Found**

```json
{ "error": { "code": "NOT_FOUND", "message": "The requested resource was not found." } }
```
