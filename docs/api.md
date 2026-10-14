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

**Recommended in production: call the API through your frontend's own domain.** The frontend and the API will be on different sites (for example `…vercel.app` and `…onrender.com`). The login and cart cookies are then "third-party" cookies (`Secure; SameSite=None`), which **Safari and some privacy settings block**, so logins would silently not stick. The fix, used by the deployed frontend: Vercel's `vercel.json` **rewrites** `/api/*` to the Render address (locally, the Vite dev server `proxy` does the same), and the frontend calls the API with relative URLs such as `fetch('/api/products')`. The cookies then belong to the frontend's own domain and work everywhere. (The backend is configured for this with `TRUST_PROXY_HOPS=4`; see the README.)

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
- `currentStock` appears only on the stock-conflict 409 of `PATCH /api/admin/products/:id`.

| Code | Usual HTTP status | Meaning |
|---|---|---|
| `INVALID_REQUEST` | 400, 413, 415 | Validation failed, bad JSON, body too large, or not JSON |
| `UNAUTHENTICATED` | 401 | Not logged in, or the login has expired. `"Please log in again."` means the account's sessions were ended (password reset or account deleted, BE27): send the user to the login page |
| `WRONG_PASSWORD` | 401 | *(BE27)* The current password typed to delete the account is wrong. The user is still logged in |
| `FORBIDDEN` | 403 | Logged in but not allowed, or the `X-Requested-With` header is missing |
| `EMAIL_NOT_VERIFIED` | 403 | Correct password, but the email address hasn't been verified yet |
| `NOT_FOUND` | 404 | The resource or route doesn't exist (or isn't yours) |
| `CONFLICT` | 409 | Duplicate, or the resource is in the wrong state |
| `DISCOUNT_INVALID` | 400 | *(BE29)* The discount code can't be used; `message` says why (and at checkout `fields.discountCode` too) |
| `WISHLIST_FULL` | 409 | *(BE28)* The wishlist already has 100 products |
| `ORDERS_IN_PROGRESS` | 409 | *(BE27)* The account can't be deleted yet: an order is Pending or Shipped, or a payment is in progress |
| `RESET_LINK_INVALID` | 400 | *(BE27)* The password reset link is unknown, already used, replaced by a newer one, or older than 30 minutes |
| `OUT_OF_STOCK` | 409 | Not enough stock |
| `RATE_LIMITED` | 429 | Too many attempts; try again later |
| `PAYMENT_FAILED` | 402, 502 | The payment didn't succeed, or couldn't be started with Paystack (502) |
| `PAYMENT_PENDING` | 202 | The payment isn't confirmed yet; check again shortly |
| `SERVER_ERROR` | 500, 503 | Something went wrong on the server |

The exact status used by each endpoint is listed with that endpoint.

### Product ids (UUIDs)

Products use the same kind of id as orders (below): every product's **`id`**, and every **`productId`** (cart lines, order items, reviews), is a **UUID** string such as `6b1f0c2e-8d4a-4f7b-9e21-3a5c7d9e1f40`. It's also the `:id` in `GET /api/products/:id`, `GET` and `POST /api/products/:id/reviews`, and `GET` and `PATCH /api/admin/products/:id`, and the `productId` sent to `POST /api/cart/items`.

- The database's counting number is never sent, so ids don't reveal how many products exist or the order they were added in.
- A value that isn't a product UUID (including an old number like `12`) gets the same **404 "Product not found."** as a product that doesn't exist.
- Still numbers: category ids (`categoryId`), cart line ids (`/api/cart/items/:id`), review ids, image ids, delivery area ids, refund ids and user ids.

### Order ids (UUIDs)

*(BE26)* Every order has a random public id, a **UUID** such as `3f2a9c1e-7b4d-4e8a-9f01-6c2d5e8b7a43`. It's the order's **`id`** in every response (My Orders, order details, the confirmation page, checkout verify, the admin's lists and details, the dashboard), and the **`:id`** in every order address:

```text
GET   /api/orders/:id                 POST /api/orders/:id/cancel
GET   /api/admin/orders/:id           PATCH /api/admin/orders/:id/status
POST  /api/admin/orders/:id/refunds   POST /api/admin/orders/:id/refunds/:refundId/retry
```

- Treat it as an **opaque string**: build links with it as it is (e.g. `/orders/${order.id}`), and don't parse it or sort by it (sort by `placedAt`).
- The database's counting number is **never** sent, so order addresses can't be guessed and don't reveal how many orders the store has.
- Anything that isn't a valid order UUID in an order address, **including an old number such as `9`**, gets the same **404 `NOT_FOUND` "Order not found."** as an order that doesn't exist (never a 400). Show "Order not found" with a link to My Orders. Old links like `/orders/9` from earlier test emails therefore show "Order not found".
- `orderNumber` (e.g. `ORD-20261012-K8W82Y`) is still what people read and quote; it's a date plus random letters, so it reveals nothing either.
- Products use UUIDs too (above). Cart line, review, refund, category and delivery area ids are unchanged numbers.

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
{
  "message": "Your email is verified. You can now log in.",
  "linked": { "ordersLinked": 2, "cartItemsAdded": 3, "cartItemsReduced": 0 }
}
```

After this, send the user to the login page.

**`linked`** *(BE25)*: now that the email is proven, anything this person did **as a guest with the same email** is moved into the account:
- `ordersLinked`: guest orders (paid while logged out with this email) that now appear in **My Orders**: with their status history and tracking emails, **Cancel** while Pending, and **reviews** once Delivered.
- `cartItemsAdded`: cart lines added to the account's cart from the guest cart(s) they **paid** from (on any browser).
- `cartItemsReduced`: of those, lines that couldn't move in full: the quantity was capped by stock, or the product is no longer available (and was left out).

All three are `0` when nothing was found (the usual case). For example, show "We found 2 earlier orders and added them to your account." when `ordersLinked > 0`. No email is sent about it.

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
  },
  "linked": { "ordersLinked": 0, "cartItemsAdded": 0, "cartItemsReduced": 0 }
}
```

**`linked`** *(BE25)*: the same as in `POST /api/auth/verify`. Every login also links any **guest orders placed since** with this account's email (for example, the shopper bought something while logged out). Usually all zeros. With login codes on, it comes in the `verify-code` response instead (the login only completes there). If linking ever fails, the login still succeeds (with zeros) and it's tried again at the next login.

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
{
  "user": { "id": 2, "name": "Ama Mensah", "email": "ama.mensah@example.com", "isAdmin": false, "createdAt": "2026-09-29T15:56:39.000Z" },
  "linked": { "ordersLinked": 0, "cartItemsAdded": 0, "cartItemsReduced": 0 }
}
```

(`linked`: see `POST /api/auth/login`.)

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

**Ask before logging out (frontend).** The endpoint logs out straight away; it can't ask the user anything. So when the user clicks **Log out**, first show a confirmation, e.g. *"Log out of your account?"* with **Log out** and **Cancel** buttons. Call this endpoint only if they confirm. On **Cancel**, do nothing. Then, after a successful logout:
1. clear the stored user;
2. reset the cart badge to 0;
3. go to the home page (or the login page).

- **Login required:** no
- **Admin required:** no
- **Headers:** `X-Requested-With: XMLHttpRequest`
- **Request body:** none

**200 OK**

```json
{ "message": "You have been logged out." }
```

#### `POST /api/auth/forgot-password`

*(BE27)* Step 1 of "Forgot password": emails a link to set a new password.

- **Login required:** no
- **Admin required:** no
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`
- **Rate limit:** 5 per hour per IP address

**Request body**

```json
{ "email": "ama.mensah@example.com" }
```

**200 OK**, always the same, **whether or not an account exists** (so the form can't be used to find out who has an account):

```json
{ "message": "If an account exists for this email, we've sent a link to reset your password." }
```

- If an account exists, it gets an email with the link **`{CLIENT_URL}/reset-password?token=<64 hex characters>`**. The link works **once** and expires after **30 minutes**. Asking again sends a new link and **cancels the older one**.
- At most **3 links per email per hour**. Extra requests still get the same 200, but no email is sent.
- Show the message as it is, e.g. "Check your email (and Spam)".
- In development the server also prints the link in its console.

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | `fields.email`: missing or not a valid email |
| 429 | `RATE_LIMITED` | More than 5 requests from this IP in an hour |

#### `POST /api/auth/reset-password`

*(BE27)* Step 2: the frontend page `/reset-password` reads `token` from the address and sends it with the new password.

- **Login required:** no
- **Admin required:** no
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`
- **Rate limit:** 10 per 15 minutes per IP address

**Request body**

| Field | Type | Rules |
|---|---|---|
| `token` | string | Required, from the link (64 hex characters) |
| `password` | string | Required, **the same rules as registration**: 8–72 characters |

```json
{ "token": "3f9a…(64 hex characters)", "password": "MyNewPassword123" }
```

**200 OK**

```json
{ "message": "Your password has been changed. Please log in with your new password." }
```

- **The user is not logged in.** Send them to the login page (the login code step still applies when it's on).
- **Every existing login ends**, on every phone and browser: their next request gets 401 `"Please log in again."`.
- An account whose email wasn't verified yet becomes verified (the link proves they own the inbox).
- A "Your password was changed" email is sent.

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | `fields.password` (e.g. "Password must be at least 8 characters."), or `fields.token` for a badly formed token |
| 400 | `RESET_LINK_INVALID` | `"This link has expired or has already been used. Please ask for a new one."` Used, replaced by a newer link, or older than 30 minutes. Show a link to "Forgot password" |
| 429 | `RATE_LIMITED` | More than 10 attempts from this IP in 15 minutes |

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

### Account

#### `DELETE /api/account`

*(BE27)* The logged-in shopper deletes **their own** account.

- **Login required:** yes
- **Admin required:** no (admins are refused, below)
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`
- **Rate limit:** 5 per 15 minutes **per user**

**Request body**

| Field | Type | Rules |
|---|---|---|
| `password` | string | Required, the account's **current** password |
| `confirm` | string | Required, exactly `"DELETE"` (capitals), typed by the user |

```json
{ "password": "DemoShopper123", "confirm": "DELETE" }
```

**200 OK** (the response also clears the login and cart cookies)

```json
{ "message": "Your account has been deleted." }
```

**What happens:**

| Data | What happens |
|---|---|
| The account | Deleted: it can't log in, and every login on every device ends. The email address is freed: registering again with it creates a **new, empty** account |
| Orders | **Kept** for the store's records (sales, refunds), but no longer in any account. Registering again does **not** bring them back |
| Reviews | Deleted (product ratings update straight away) |
| Cart | Deleted |

A "Your Adorn account has been deleted" email is sent to the address the account had.

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | `fields.confirm`: `"Type DELETE to confirm."`; `fields.password` when missing |
| 401 | `UNAUTHENTICATED` | Not logged in |
| 401 | `WRONG_PASSWORD` | `"Your password is incorrect."` The user stays logged in; don't log them out |
| 403 | `FORBIDDEN` | `"Admin accounts can't be deleted here."`, or the `X-Requested-With` header is missing |
| 409 | `ORDERS_IN_PROGRESS` | `"You have orders that haven't been delivered yet. You can delete your account once they're delivered or cancelled."` Some order is **Pending** or **Shipped**, or a payment was started in the last 30 minutes and hasn't finished |
| 429 | `RATE_LIMITED` | More than 5 attempts in 15 minutes |

**For the frontend:** put it on the account page under "Delete account", explain what's kept and what's removed (the table above), and ask for the password and for the user to type DELETE. After the 200, clear any saved user state and go to the home page.

### Wishlist

*(BE28)* Logged-in shoppers save products for later (♡). **All four endpoints need a login** (401 `UNAUTHENTICATED` otherwise). **Guests:** show the ♡ anyway, and when it's tapped, ask them to log in.

- Products are identified by their **UUID** (`productId`, the product's `id` everywhere else).
- A product is saved **once**: saving it again changes nothing.
- At most **100** products.
- Nothing is reserved: the list always shows the product's **current** price and stock.
- **Rate limit** for saving and removing (not reading): 60 per 15 minutes per user.
- Deleting the account deletes the wishlist.

#### `GET /api/wishlist`

The shopper's saved products, **newest saves first**, **20 per page** (standard pagination format).

- **Login required:** yes
- **Query:** `page` (optional, default 1)
- The response has `Cache-Control: no-store`.

**200 OK**

```json
{
  "items": [
    {
      "productId": "6b1f0c2e-8d4a-4f7b-9e21-3a5c7d9e1f40",
      "name": "Black Canvas Tote Bag",
      "priceGhs": 12000,
      "priceUsd": 774,
      "stock": 15,
      "stockLabel": "In stock",
      "isActive": true,
      "category": { "name": "Bags", "slug": "bags" },
      "mainImage": { "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Bags/black-tote-bag-1.jpg", "altText": "Black canvas tote bag" },
      "savedAt": "2026-10-14T11:20:05.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 1,
  "totalPages": 1
}
```

- `isActive: false` means the product was **removed from the shop** after it was saved. It stays in the list so the shopper understands: show it greyed out as "No longer available", without an "Add to cart" button, and with **Remove**. (Its product page answers 404.)
- `stock` 0 / `stockLabel` work like on product cards: show "Out of stock" and disable "Add to cart".
- `priceGhs` is pesewas; `priceUsd` is US cents (display only).

**Errors:** 400 for a bad `page`; 401 not logged in.

#### `GET /api/wishlist/ids`

Just the saved products' UUIDs (at most 100), to fill in the ♡ on product lists and pages without loading the whole wishlist.

- **Login required:** yes. (For guests, don't call it: all hearts are empty.)
- The response has `Cache-Control: no-store`.

**200 OK**

```json
{ "productIds": ["6b1f0c2e-8d4a-4f7b-9e21-3a5c7d9e1f40", "0d8e2a41-5b6c-4e7f-8a9b-1c2d3e4f5a60"] }
```

Load it once after login (and after each change, or update it from the `PUT`/`DELETE` answers), then show ♥ for products whose `id` is in the list.

**Errors:** 401 not logged in.

#### `PUT /api/wishlist/:productId`

Saves a product. **The same answer whether it was just saved or already saved**, so a double tap is harmless.

- **Login required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`
- **Request body:** none
- **Rate limit:** 60 saves and removals per 15 minutes per user

**200 OK**

```json
{ "productId": "6b1f0c2e-8d4a-4f7b-9e21-3a5c7d9e1f40", "saved": true, "count": 3 }
```

`count` is how many products are saved now (e.g. for a badge on a "Wishlist" link).

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Not logged in: ask the guest to log in |
| 403 | `FORBIDDEN` | The `X-Requested-With` header is missing |
| 404 | `NOT_FOUND` | `"Product not found."` Unknown, removed from the shop, or `:productId` isn't a product UUID |
| 409 | `WISHLIST_FULL` | `"Your wishlist is full. Remove something to add more."` (100 products) |
| 429 | `RATE_LIMITED` | Too many changes |

#### `DELETE /api/wishlist/:productId`

Removes a product. **200 even if it wasn't saved** (the result is the same: it isn't in the wishlist).

- **Login required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`
- **Request body:** none
- **Rate limit:** shared with `PUT` (60 per 15 minutes per user)

**200 OK**

```json
{ "productId": "6b1f0c2e-8d4a-4f7b-9e21-3a5c7d9e1f40", "saved": false, "count": 2 }
```

**Errors:** 401 not logged in; 403 without the `X-Requested-With` header; 429 too many changes.

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
      "id": "6b1f0c2e-8d4a-4f7b-9e21-3a5c7d9e1f40",
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
      "id": "0d8e2a41-5b6c-4e7f-8a9b-1c2d3e4f5a60",
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
    "id": "6b1f0c2e-8d4a-4f7b-9e21-3a5c7d9e1f40",
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
      "id": 7, "productId": "6b1f0c2e-8d4a-4f7b-9e21-3a5c7d9e1f40", "rating": 5, "text": "Beautiful bag.",
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
| 404 | `NOT_FOUND` | `"Product not found."` The product doesn't exist, has been removed from the shop, or `:id` isn't a product UUID (e.g. an old number like `12`, or `abc`) |

### Reviews

Shoppers can review products **they have received**. Reviews show on the product page with a star summary.

**The rules:**
- **Who can review:** a logged-in shopper who has a **Delivered** order **in their account** containing the product. Guest orders count once they're linked to the account (same email, after verification: BE25).
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
| 400 | `INVALID_REQUEST` | A bad `sort` (`"Sort must be recent, highest or lowest."`) or `page` |
| 404 | `NOT_FOUND` | `"Product not found."` Unknown, removed from the shop, or `:id` isn't a product UUID (e.g. an old number like `12`) |

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
{ "review": { "id": 22, "productId": "7e6d5c4b-3a29-4818-b7f6-e5d4c3b2a190", "rating": 4, "text": "Gentle on my skin.", "createdAt": "2026-10-01T12:02:16.264Z", "editedAt": null, "isHidden": false } }
```

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | Validation failed: `fields.rating` (`"Rating must be from 1 to 5."`…) or `fields.text` (`"Your review must be 1,000 characters or fewer."`) |
| 401 | `UNAUTHENTICATED` | Not logged in. Show "Log in to write a review" |
| 403 | `FORBIDDEN` | `"You can review a product after it has been delivered to you."` |
| 404 | `NOT_FOUND` | `"Product not found."` Unknown, removed from the shop, or `:id` isn't a product UUID (e.g. an old number like `12`) |
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
        "productId": "6b1f0c2e-8d4a-4f7b-9e21-3a5c7d9e1f40",
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
| `productId` | string | Required. The product's **UUID** (its `id` from `GET /api/products`). A value that isn't a product UUID (e.g. an old number like `12`) gets **404 "Product not found."** |
| `quantity` | number | Required, a whole number from 1 to 99 |

Both must be JSON numbers (`1`, not `"1"`). Any other fields, such as a price or a cart ID, are ignored.

```json
{ "productId": "6b1f0c2e-8d4a-4f7b-9e21-3a5c7d9e1f40", "quantity": 1 }
```

**200 OK:** the updated cart object.

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | Validation failed (see `fields`): quantity is 0, negative, a decimal, text or over 99, or `productId` is missing |
| 400 | `INVALID_REQUEST` | `"You can add up to 99 of this product."` The line would go over 99 in total (quantity already in the cart plus this one) |
| 404 | `NOT_FOUND` | `"Product not found."` Unknown, removed from the shop, or `productId` isn't a product UUID (e.g. an old number like `12`) |
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

### Delivery areas

*(BE24)* The delivery fee depends on **where the order is going**. The store ships from **Kumasi**, so nearer places cost less. Fees are set **per region**, and a town inside a region may have **its own fee**:

1. The shopper chooses one of Ghana's **16 regions**, then a **town** from that region's list, or **"Other town in this region"**.
2. **The fee is the town's own fee if it has one; otherwise the region's fee.** For example, Ashanti is GH₵ 15 but Kumasi (local delivery) is GH₵ 10: an order to Obuasi pays GH₵ 15, an order to Kumasi GH₵ 10.

**The server always works out the fee.** The frontend only sends which region and town were chosen (`POST /api/checkout`); a fee sent by the browser is ignored.

#### `GET /api/delivery-areas`

The regions and towns a shopper can choose, with each one's fee. Hidden regions and towns aren't listed.

- **Login required:** no (guests check out too)
- **Admin required:** no
- **Caching:** `Cache-Control: public, max-age=300` (the browser may reuse it for 5 minutes). Checkout works the fee out again on the server, so a slightly old list can never change what's charged.

**200 OK**

```json
{
  "regions": [
    {
      "id": 1, "name": "Ashanti", "feeGhs": 1500, "feeUsd": 97,
      "towns": [
        { "id": 1, "name": "Kumasi", "feeGhs": 1000, "feeUsd": 65 },
        { "id": 2, "name": "Obuasi", "feeGhs": 1500, "feeUsd": 97 }
      ]
    },
    {
      "id": 6, "name": "Greater Accra", "feeGhs": 2000, "feeUsd": 129,
      "towns": [
        { "id": 7, "name": "Accra", "feeGhs": 2000, "feeUsd": 129 },
        { "id": 8, "name": "Tema", "feeGhs": 2000, "feeUsd": 129 }
      ]
    }
  ]
}
```

(Shortened: the real list has all 16 regions.)

- Regions come in the store's order (Ashanti first, as the store is in Kumasi); towns are A–Z.
- `feeGhs` is in **pesewas** and is the fee that **applies**: a town without its own fee shows its region's fee. `feeUsd` is US cents, display only.
- **For the checkout form:** a region dropdown, then a town dropdown with that region's `towns` **plus an "Other town in this region" option** (send `deliveryTownId: null`, and the region's `feeGhs` applies). Show the fee next to each choice, and update the order total as the shopper chooses. Keep the street / house / landmark in the `address` field.
- The starting fees are examples set by the seeder; the store owner changes them in the admin.

**Errors:** none expected (500 only if the server has a problem).

### Discounts

#### `POST /api/discounts/check`

*(BE29)* "Does this code work, and how much would I save?" for the code box on the cart or checkout page. It checks the code against the shopper's **current cart** (guest or logged in, from the cookie). It's a **preview only**: nothing is reserved, and `POST /api/checkout` checks everything again.

- **Login required:** no (guests can use codes)
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`
- **Rate limit:** 10 per 15 minutes per IP (stops anyone guessing codes)

**Request body**

```json
{ "code": "adorn10" }
```

Any capitals work: codes are stored upper-case.

**200 OK**

```json
{
  "discount": {
    "code": "ADORN10",
    "discountGhs": 2050,
    "discountUsd": 132,
    "subtotalGhs": 20500,
    "message": "10% off: you save GHS 20.50"
  }
}
```

- Show `message`, then send the code with the checkout as `discountCode`.
- The discount applies to the **products' subtotal only**, never to delivery. Percent codes round **down** to the pesewa and may have a maximum; fixed codes never take more than the subtotal.
- If the cart changes, check again (or simply let checkout work it out).

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | `fields.code`: `"Enter a discount code."` |
| 400 | `INVALID_REQUEST` | `"Your cart is empty."` |
| 400 | `DISCOUNT_INVALID` | `"This code isn't valid."` (unknown or switched off) |
| 400 | `DISCOUNT_INVALID` | `"This code isn't active yet."` / `"This code has expired."` |
| 400 | `DISCOUNT_INVALID` | `"Spend GHS 200.00 or more to use this code."` (the minimum order, products only) |
| 400 | `DISCOUNT_INVALID` | `"This code has reached its limit."` |
| 400 | `DISCOUNT_INVALID` | `"You've already used this code."` Only for **logged-in** shoppers here (their account email). Guests find out at checkout, when their email is known |
| 409 | `OUT_OF_STOCK` | Something in the cart is unavailable (as at checkout) |
| 429 | `RATE_LIMITED` | Too many tries |

### Checkout

Checkout turns the current cart into a **Paystack mobile-money payment** in GHS. It works for guests and logged-in shoppers. The server calculates every amount from the cart, and any amount sent by the frontend is ignored.

**No order exists yet after this call.** The order is created only after the payment is confirmed: the frontend calls the verify endpoint (BE8) with the `reference`. Until then the cart is kept, and stock isn't reduced.

**Payment flow for the frontend:**

1. `POST /api/checkout` with the delivery details, including the region and town chosen from `GET /api/delivery-areas`. You get back a `reference`, an `accessCode` and an `authorizationUrl`.
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
| `address` | string | Required, 5–500 characters. The street, house number or landmark |
| `deliveryRegionId` | number | **Required** *(BE24)*. A region `id` from `GET /api/delivery-areas` |
| `deliveryTownId` | number or `null` | Optional *(BE24)*. A town `id` **from that region**. Leave it out or send `null` for **"Other town in this region"** (the region's fee applies) |
| `discountCode` | string | Optional *(BE29)*. The code the shopper typed, any capitals (e.g. `"adorn10"`). Blank or missing = no code. The server checks it again and works out the discount |

Any other fields (for example `total` or `deliveryFee`) are ignored: the server works out the delivery fee from the region and town. For logged-in users, pre-fill `name` and `email` from `GET /api/auth/me`; the shopper can still change them.

```json
{
  "name": "Ama Mensah", "email": "ama@example.com", "phone": "0241234567",
  "address": "House 12, Adum, near the post office",
  "deliveryRegionId": 1, "deliveryTownId": 1
}
```

**201 Created**

```json
{
  "checkout": {
    "reference": "STORE-muntz37d-3cac4c5999ce",
    "accessCode": "3e1j3wq2poc6lzi",
    "authorizationUrl": "https://checkout.paystack.com/3e1j3wq2poc6lzi",
    "deliveryRegionName": "Ashanti",
    "deliveryTownName": "Kumasi",
    "subtotalGhs": 20500,
    "discountCode": "ADORN10",
    "discountGhs": 2050,
    "deliveryFeeGhs": 1000,
    "totalGhs": 19450,
    "currency": "GHS",
    "subtotalUsd": 1322,
    "discountUsd": 132,
    "deliveryFeeUsd": 65,
    "totalUsd": 1255,
    "usdRate": 15.5,
    "chargeNote": "You will be charged GHS 194.50. USD amounts are an estimate for display only."
  }
}
```

(Example cart: Black Canvas Tote Bag × 1 (12000 → 774) and Makeup Setting Spray × 1 (8500 → 548), delivered to Kumasi, Ashanti (1000 → 65), with `ADORN10` = 10% off the products (2050 → 132). Without a code, `discountCode` is `null` and `discountGhs` / `discountUsd` are `0`.)

- `deliveryRegionName` and `deliveryTownName` say where it's going; `deliveryTownName` is `null` for "Other town in this region". Show "Delivery to: Kumasi, Ashanti" (or "Delivery to: Ashanti (other town)") on the payment page.
- **The fee is fixed when the checkout starts.** If the store changes a fee before the payment is confirmed, this checkout and its order keep the fee shown here, which is exactly what Paystack charges.

- **GHS is the currency charged.** The `…Ghs` amounts are pesewas: `totalGhs = subtotalGhs − discountGhs + deliveryFeeGhs`, and `totalGhs` is exactly what Paystack charges.
- **Discounts (BE29)** come off the **products only**, never delivery, and never below 0 (so `totalGhs` is at least the delivery fee). The discount is fixed when the checkout starts: if the code expires or runs out while the shopper is paying, the order still gets it.
- The `…Usd` amounts are US cents, **display only**: `totalUsd = subtotalUsd − discountUsd + deliveryFeeUsd`, and `subtotalUsd` equals the cart's `subtotalUsd`.
- **Always show `chargeNote`** (or the GHS total) next to the Pay button, especially when the shopper is viewing USD, so they know exactly what they'll pay.

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | Validation failed (see `fields`) |
| 400 | `INVALID_REQUEST` | `"Your cart is empty."` |
| 400 | `INVALID_REQUEST` | `fields.deliveryRegionId`: `"Choose a delivery region."` The region is missing, unknown, or **hidden** by the store. Reload the delivery areas |
| 400 | `INVALID_REQUEST` | `fields.deliveryTownId`: `"Choose a town in <region>, or "Other town in this region"."` The town is unknown, hidden, or **belongs to a different region** |
| 400 | `DISCOUNT_INVALID` | `fields.discountCode` with the reason (the same messages as `POST /api/discounts/check`, plus `"You've already used this code."` for this email). Show it next to the code box; the shopper can remove the code and pay without it |
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
    "id": "5d748ff1-708b-4bbf-858f-f7fd5b9dadea",
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

The orders that **belong to this account**: those placed while logged in, plus **guest orders paid with the account's email**, which are linked automatically once the email is verified, and at every login after that *(BE25)*. Linked orders work like any other: status history, tracking emails, **Cancel** while Pending, and reviews once Delivered.

**Example:** `GET /api/orders?page=1`

**200 OK** (the standard pagination format)

```json
{
  "items": [
    {
      "id": "3f2a9c1e-7b4d-4e8a-9f01-6c2d5e8b7a43",
      "orderNumber": "ORD-20260930-3R6FTE",
      "placedAt": "2026-09-30T14:05:12.000Z",
      "status": "Pending",
      "canCancel": true,
      "totalGhs": 8000,
      "itemCount": 1,
      "items": [
        { "productId": "9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", "name": "Silver Pocket Mirror", "unitPriceGhs": 6000, "quantity": 1, "lineTotalGhs": 6000, "image": { "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Accessories/pocket-mirror-1.jpg", "altText": "Silver compact pocket mirror" } }
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
    "id": "3f2a9c1e-7b4d-4e8a-9f01-6c2d5e8b7a43",
    "orderNumber": "ORD-20260930-3R6FTE",
    "status": "Pending",
    "placedAt": "2026-09-30T14:05:12.000Z",
    "canCancel": true,
    "items": [
      { "productId": "9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", "name": "Silver Pocket Mirror", "unitPriceGhs": 6000, "quantity": 1, "lineTotalGhs": 6000, "image": { "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Accessories/pocket-mirror-1.jpg", "altText": "Silver compact pocket mirror" } }
    ],
    "subtotalGhs": 6000,
    "discountCode": null,
    "discountGhs": 0,
    "deliveryFeeGhs": 2000,
    "totalGhs": 8000,
    "currency": "GHS",
    "paymentMethod": "mobile_money",
    "email": "ama@example.com",
    "delivery": { "name": "Ama Mensah", "phone": "0241234567", "address": "12 Oxford Street, Osu, Accra" },
    "deliveryRegionName": "Greater Accra",
    "deliveryTownName": "Accra",
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
| 401 | `UNAUTHENTICATED` | Not logged in |
| 404 | `NOT_FOUND` | `"Order not found."` The order doesn't exist, **or belongs to someone else**, or `:id` isn't an order UUID (e.g. an old number like `9`). All give the same answer |

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
    "id": "3f2a9c1e-7b4d-4e8a-9f01-6c2d5e8b7a43",
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
| 401 | `UNAUTHENTICATED` | Not logged in |
| 403 | `FORBIDDEN` | The `X-Requested-With` header is missing |
| 404 | `NOT_FOUND` | `"Order not found."` It doesn't exist, **or it isn't yours**, or `:id` isn't an order UUID |
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
    "id": "5d748ff1-708b-4bbf-858f-f7fd5b9dadea",
    "orderNumber": "ORD-20260930-PRN6Q2",
    "status": "Pending",
    "placedAt": "2026-09-30T18:44:21.000Z",
    "items": [
      {
        "productId": "2b4d6f8a-0c1e-4a3b-9d5f-7e9a1c3e5b7d",
        "name": "Black Volumising Mascara",
        "unitPriceGhs": 7000,
        "quantity": 2,
        "lineTotalGhs": 14000,
        "image": { "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Makeup/black-volumising-mascara-1.jpg", "altText": "Black mascara tube and wand on a pink background" }
      }
    ],
    "subtotalGhs": 14000,
    "discountCode": "ADORN10",
    "discountGhs": 1400,
    "deliveryFeeGhs": 2000,
    "totalGhs": 14600,
    "currency": "GHS",
    "paymentMethod": "mobile_money",
    "email": "ama@example.com",
    "delivery": { "name": "Ama Mensah", "phone": "0241234567", "address": "12 Oxford Street, Osu, Accra" },
    "deliveryRegionName": "Greater Accra",
    "deliveryTownName": "Accra"
  }
}
```

- `name` and `unitPriceGhs` are what was **paid**, even if the product's name or price has changed since.
- `image` is the product's current main image, or `null` if it has none.
- `placedAt` is UTC; show it in Ghana time.
- `status` is one of `Pending`, `Shipped`, `Delivered`, `Cancelled`.
- `paymentMethod` is always `mobile_money`; show it as "Mobile money".
- All money is in pesewas.
- **Discount** *(BE29)*: `discountCode` is the code used (`null` if none) and `discountGhs` what it took off (`0` if none): `totalGhs = subtotalGhs − discountGhs + deliveryFeeGhs`. When there is one, show a line **between Subtotal and Delivery**: "Discount (ADORN10) − GHS 14.00". The same two fields are in `GET /api/orders/:id` and the admin's `GET /api/admin/orders/:id`. Refunds can never exceed `totalGhs` (what was actually paid).
- **Delivery area** *(BE24)*: `deliveryRegionName` and `deliveryTownName` are where it was sent, saved when the shopper paid (they stay the same even if the store later renames or hides the area, or changes its fee). `deliveryFeeGhs` is the fee that was **charged**. Show:
  - both set: "Delivery to: Accra, Greater Accra";
  - only the region (town `null`): "Delivery to: Greater Accra (other town)";
  - both `null`: an order from **before delivery areas**: "Delivery area: not recorded".
- The same two fields are in `GET /api/orders/:id` and the admin's `GET /api/admin/orders/:id`.

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
    { "id": "9b1e6f0a-2c3d-4e5f-8a7b-1c2d3e4f5a6b", "orderNumber": "ORD-20261001-85SK9Q", "placedAt": "2026-10-01T10:14:49.000Z", "customerName": "Toffick Agyeman", "totalGhs": 38000, "status": "Cancelled" }
  ],
  "counts": { "pendingOrders": 3, "hiddenReviews": 0 },
  "stock": {
    "lowStockThreshold": 5,
    "lowStockCount": 2,
    "lowStock": [ { "id": "a3c5e7f9-1b2d-4f6a-8c0e-2d4f6a8c0e12", "name": "Makeup Setting Spray", "stock": 2 } ],
    "outOfStock": [ { "id": "f1e2d3c4-b5a6-4978-8a6b-5c4d3e2f1a09", "name": "Pearl Stud Earrings", "stock": 0 } ]
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
| `recentOrders` | The 5 newest orders, whatever the period. Link each to the admin order page using `id` (the order's UUID) |
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

#### `GET /api/admin/products`

All products, **including inactive ones**, for the admin's product screen. **A–Z by name, 20 per page.**

- **Login required:** yes
- **Admin required:** yes
- **Query** (all optional, and they can be combined; blank values are ignored):

| Parameter | Rules |
|---|---|
| `search` | Part of the product name, ignoring case (e.g. `gloss` finds "Pink Lip Gloss"). Up to 100 characters. `%` and `_` are matched literally |
| `category` | A category **slug** (e.g. `bags`). An unknown slug gives 400 with `fields.category` |
| `status` | `active` or `inactive` |
| `page` | Default 1 |

**Example:** `GET /api/admin/products?search=bag&status=active&page=1`

**200 OK** (the standard pagination format)

```json
{
  "items": [
    {
      "id": "6b1f0c2e-8d4a-4f7b-9e21-3a5c7d9e1f40",
      "name": "Black Canvas Tote Bag",
      "category": { "id": 1, "name": "Bags", "slug": "bags" },
      "priceGhs": 12000,
      "stock": 15,
      "isActive": true,
      "mainImage": { "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Bags/black-tote-bag-1.jpg", "altText": "Black canvas tote bag hanging on a wooden chair" },
      "updatedAt": "2026-10-07T09:12:00.000Z"
    }
  ],
  "page": 1, "pageSize": 20, "totalItems": 1, "totalPages": 1
}
```

- `priceGhs` is pesewas: divide by 100 to show it (12000 → GH₵ 120.00).
- `mainImage` can be `null` if a product has no photo.
- For the category drop-down, use the public `GET /api/categories`.

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | `fields.category` (`"Unknown category."`, or a badly formed slug), `fields.status` (`"Status must be active or inactive."`), `fields.search` (too long) or a bad `page` |
| 401 | `UNAUTHENTICATED` | Not logged in |
| 403 | `FORBIDDEN` | Not an admin |

#### `GET /api/admin/products/:id`

One product with everything the edit form needs. **Inactive products are returned too**, so the admin can see and reactivate them; in the shop they're 404.

- **Login required:** yes
- **Admin required:** yes

**200 OK**

```json
{
  "product": {
    "id": "6b1f0c2e-8d4a-4f7b-9e21-3a5c7d9e1f40",
    "name": "Black Canvas Tote Bag",
    "category": { "id": 1, "name": "Bags", "slug": "bags" },
    "priceGhs": 12000,
    "stock": 15,
    "isActive": true,
    "mainImage": { "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Bags/black-tote-bag-1.jpg", "altText": "Black canvas tote bag hanging on a wooden chair" },
    "updatedAt": "2026-10-07T09:12:00.000Z",
    "description": "A roomy black canvas tote with long shoulder handles. Light, sturdy and easy to fold, it's made for everyday errands, books and beach days.",
    "createdAt": "2026-10-04T11:02:00.000Z",
    "images": [
      { "id": 1, "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Bags/black-tote-bag-1.jpg", "altText": "Black canvas tote bag hanging on a wooden chair", "sortOrder": 1, "isMain": true }
    ]
  }
}
```

**Keep `stock`:** send it back as `expectedStock` when you change the stock (see `PATCH` below).

**Errors:** 401, 403, **404** `NOT_FOUND` `"Product not found."` (also when `:id` isn't a product UUID)

#### `POST /api/admin/products`

Adds a product with one main photo. It's **in the shop straight away** if `isActive` is `true`, the default.

- **Login required:** yes
- **Admin required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`

**Request body**

| Field | Type | Rules |
|---|---|---|
| `name` | string | Required, 2–150 characters (trimmed). **Must be unique, ignoring case** |
| `description` | string | Required, 1–2,000 characters (trimmed) |
| `categoryId` | number | Required: an existing category's `id` (from `GET /api/categories`) |
| `priceGhs` | number | Required, **pesewas**, a whole number from 1 to 100,000,000 (GH₵ 1,000,000). For GH₵ 95.00, send `9500` |
| `stock` | number | Required, a whole number from 0 to 100,000 |
| `isActive` | boolean | Optional, default `true` |
| `image` | object | **Required:** `{ "url", "altText" }`. `url` must start with `https://ik.imagekit.io/` (up to 500 characters); a `?updatedAt=…` part, added when copying a link from ImageKit, is removed automatically. `altText` describes the photo, 1–200 characters |

Numbers must be **JSON numbers** (`9500`, not `"9500"`). Any other field (e.g. `id`) is ignored.

```json
{
  "name": "Rose Gold Hoop Earrings",
  "description": "Light rose-gold hoops for every day.",
  "categoryId": 4,
  "priceGhs": 9500,
  "stock": 12,
  "isActive": true,
  "image": { "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Jewellery/rose-gold-hoops-1.jpg", "altText": "Pair of rose-gold hoop earrings" }
}
```

**201 Created:** `{ "product": { … } }`, in the same shape as `GET /api/admin/products/:id`.

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | Validation failed; see `fields`. For example `fields.name` "The name must be 2–150 characters.", `fields.priceGhs` "Enter a price greater than 0.", `fields.stock` "Enter a whole number from 0 to 100,000.", `fields.categoryId` "Choose a category." (also for a category that doesn't exist), `fields["image.url"]` "Use an image address from the store's ImageKit.", `fields["image.altText"]` "Describe the photo (up to 200 characters).", `fields.image` when the image is missing |
| 401 | `UNAUTHENTICATED` | Not logged in |
| 403 | `FORBIDDEN` | Not an admin, or the `X-Requested-With` header is missing |
| 409 | `CONFLICT` | `"A product with this name already exists."` (ignoring case: "pink lip gloss" = "Pink Lip Gloss") |

#### `PATCH /api/admin/products/:id`

Edits a product. Send **only the fields that change**, at least one of: `name`, `description`, `categoryId`, `priceGhs`, `stock`, `isActive`, `image` (same rules as `POST`).

- **Login required:** yes
- **Admin required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`

**There's no delete.** Old orders point at products, so to remove a product from the shop, **deactivate** it: `{ "isActive": false }`. It's then hidden from the shop and search, any cart lines with it show as unavailable, and checkout refuses it. Its reviews are kept. `{ "isActive": true }` brings it back.

**Changing the stock needs `expectedStock`:** the `stock` value you were shown when you opened the product. If a sale or cancellation changed the stock meanwhile, the server refuses (409) instead of silently overwriting it:

```json
{ "stock": 25, "expectedStock": 15 }
```

`image` replaces the product's **main** photo:

```json
{ "image": { "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Bags/black-tote-bag-2.jpg", "altText": "Black canvas tote bag, side view" } }
```

**200 OK:** `{ "product": { … } }` with the updated product (the same shape as `GET`).

**What a change affects:**
- **Price:** only **new** carts and checkouts. Past orders keep the prices that were paid, and checkouts already started keep their amounts.
- **Stock:** the shop's "In stock / Only X left" labels and the dashboard's low-stock lists update straight away.

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | Any validation error from `POST`; `fields._` "Send at least one field to change."; `fields.expectedStock` when `stock` is sent without it |
| 401 | `UNAUTHENTICATED` | Not logged in |
| 403 | `FORBIDDEN` | Not an admin, or the `X-Requested-With` header is missing |
| 404 | `NOT_FOUND` | `"Product not found."` Unknown, or `:id` isn't a product UUID |
| 409 | `CONFLICT` | `"A product with this name already exists."` |
| 409 | `CONFLICT` | **The stock changed since you opened the product.** Nothing was saved, including any other fields in the same request. The error includes the current stock: |

```json
{ "error": { "code": "CONFLICT", "message": "Stock changed since you opened this product (it's now 14). Check the number and save again.", "currentStock": 14 } }
```

Show the message, put `currentStock` into the stock field, and let the admin check and save again.

#### `GET /api/admin/delivery-areas`

*(BE24)* Every delivery region and town, **including hidden ones**, with their **raw** fees, for the admin's delivery fees screen.

- **Login required:** yes
- **Admin required:** yes
- The response has `Cache-Control: no-store`.

**200 OK**

```json
{
  "regions": [
    {
      "id": 1,
      "name": "Ashanti",
      "feePesewas": 1500,
      "sortOrder": 1,
      "isActive": true,
      "updatedAt": "2026-10-12T09:00:00.000Z",
      "towns": [
        { "id": 3, "regionId": 1, "name": "Ejisu", "feePesewas": null, "effectiveFeePesewas": 1500, "isActive": false, "updatedAt": "2026-10-12T10:00:00.000Z" },
        { "id": 1, "regionId": 1, "name": "Kumasi", "feePesewas": 1000, "effectiveFeePesewas": 1000, "isActive": true, "updatedAt": "2026-10-12T09:00:00.000Z" },
        { "id": 2, "regionId": 1, "name": "Obuasi", "feePesewas": null, "effectiveFeePesewas": 1500, "isActive": true, "updatedAt": "2026-10-12T09:00:00.000Z" }
      ]
    }
  ]
}
```

- All 16 regions, by `sortOrder`; towns A–Z.
- Fees are whole **pesewas**. A town's `feePesewas: null` means it **uses the region's fee**; `effectiveFeePesewas` is the fee that actually applies (show it as "GH₵ 15.00 (region fee)").
- `isActive: false` = hidden from checkout (show it greyed out with a **Show** button).

**Errors:** 401 not logged in; 403 not an admin.

#### `PATCH /api/admin/delivery-regions/:id`

*(BE24)* Changes a region's fee, or hides / shows the region. Regions can't be added, renamed or deleted (Ghana's 16 regions are fixed and come from the seeder).

- **Login required:** yes
- **Admin required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`

**Request body:** at least one of:

| Field | Type | Rules |
|---|---|---|
| `feePesewas` | number | A whole number from **0 to 100000** (GH₵ 0–1,000). 0 = free delivery |
| `isActive` | boolean | `false` hides the region (and so all its towns) from checkout; `true` shows it again |

```json
{ "feePesewas": 1800 }
```

**200 OK:** `{ "region": { … } }`, in the same shape as one region of `GET /api/admin/delivery-areas` (with its towns).

**What a change affects:** only **new** checkouts. Orders (and checkouts already started) keep the fee and area they were charged, including in their emails and refunds. Towns without their own fee follow the new region fee straight away.

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | `fields.feePesewas` "Enter a fee from 0 to 100000 pesewas (GH₵ 0–1,000)." or "The fee must be a whole number of pesewas."; `fields._` "Send at least one field to change." |
| 401 | `UNAUTHENTICATED` | Not logged in |
| 403 | `FORBIDDEN` | Not an admin, or the `X-Requested-With` header is missing |
| 404 | `NOT_FOUND` | `"Delivery region not found."` |
| 409 | `CONFLICT` | `"This is the only active region. Show another region before hiding this one."` Checkout must always have at least one region |

#### `POST /api/admin/delivery-towns`

*(BE24)* Adds a town to a region.

- **Login required:** yes
- **Admin required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`

**Request body**

| Field | Type | Rules |
|---|---|---|
| `regionId` | number | Required. A region `id` (a hidden region is allowed; the town appears when the region is shown) |
| `name` | string | Required, 2–80 characters (spaces at the ends are removed). Must be new **in that region**, ignoring case |
| `feePesewas` | number or `null` | Optional. A whole number from 0 to 100000, or `null` / left out = **use the region's fee** |

```json
{ "regionId": 1, "name": "Ejisu", "feePesewas": null }
```

**201 Created:** `{ "town": { "id": 19, "regionId": 1, "name": "Ejisu", "feePesewas": null, "effectiveFeePesewas": 1500, "isActive": true, "updatedAt": "…" } }`

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | `fields.name` "Enter the town name (2–80 characters)."; `fields.feePesewas` (as above); `fields.regionId` "Choose a region." (missing, or no such region) |
| 401 | `UNAUTHENTICATED` | Not logged in |
| 403 | `FORBIDDEN` | Not an admin, or the `X-Requested-With` header is missing |
| 409 | `CONFLICT` | `fields.name`: `"This region already has a town called "Ejisu"."` ("ejisu" counts as the same name). The same name in a **different** region is fine |

#### `PATCH /api/admin/delivery-towns/:id`

*(BE24)* Renames a town, changes its fee, or hides / shows it. Send at least one field.

- **Login required:** yes
- **Admin required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`

| Field | Type | Rules |
|---|---|---|
| `name` | string | 2–80 characters, new in its region |
| `feePesewas` | number or `null` | 0–100000, or **`null` to go back to the region's fee** |
| `isActive` | boolean | `false` hides the town from checkout; `true` shows it again |

```json
{ "feePesewas": 1200 }
```
```json
{ "isActive": false }
```

**200 OK:** `{ "town": { … } }` (the same shape as in `POST`).

**There's no delete.** Orders point at towns, so a town is **hidden** instead. Hidden towns disappear from checkout but past orders still show them (orders keep a copy of the name, so renaming a town doesn't change old orders either).

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | Any validation error from `POST`; `fields._` "Send at least one field to change." |
| 401 | `UNAUTHENTICATED` | Not logged in |
| 403 | `FORBIDDEN` | Not an admin, or the `X-Requested-With` header is missing |
| 404 | `NOT_FOUND` | `"Delivery town not found."` |
| 409 | `CONFLICT` | `fields.name`: the region already has a town with that name |

#### `GET /api/admin/discount-codes`

*(BE29)* All discount codes, **newest first**, **20 per page** (standard pagination format).

- **Login required:** yes
- **Admin required:** yes
- **Query** (optional): `status` = `active`, `scheduled`, `expired`, `used_up` or `off`; `page`
- The response has `Cache-Control: no-store`.

**200 OK**

```json
{
  "items": [
    {
      "id": 3,
      "code": "ADORN10",
      "type": "percent",
      "value": 10,
      "maxDiscountPesewas": 5000,
      "minSubtotalPesewas": null,
      "startsOn": null,
      "endsOn": "2026-12-31",
      "startsAt": null,
      "endsAt": "2027-01-01T00:00:00.000Z",
      "usageLimit": 100,
      "oncePerCustomer": true,
      "isActive": true,
      "timesUsed": 12,
      "overLimit": false,
      "status": "active",
      "createdAt": "2026-10-14T12:00:00.000Z",
      "updatedAt": "2026-10-14T12:00:00.000Z"
    }
  ],
  "page": 1, "pageSize": 20, "totalItems": 1, "totalPages": 1
}
```

- **`type` and `value`:** `percent` with `value` 1–90 (whole percent), or `fixed` with `value` in **pesewas** (100–100000 = GHS 1–1,000). Show `value` as "10%" or "GHS 15.00".
- **Dates:** `startsOn` / `endsOn` are the **Ghana days** chosen (both included; `null` = no limit). `startsAt` / `endsAt` are the exact moments (`endsAt` is the midnight after `endsOn`).
- **`status`** (worked out by the server, in this order): `off` (switched off), `scheduled` (starts later), `expired`, `used_up` (`timesUsed` ≥ `usageLimit`), `active`.
- **`timesUsed`** counts **paid** orders. In rare cases (two shoppers paying at the same moment for the last use) it can go **over** `usageLimit`: then `overLimit` is `true`. Both orders keep their discount, because they paid it. Show a small warning.

**Errors:** 400 for a bad `status` or `page`; 401; 403.

#### `GET /api/admin/discount-codes/:id`

*(BE29)* One code, with its **20 latest redemptions** (paid orders that used it).

- **Login required:** yes · **Admin required:** yes · `Cache-Control: no-store`

**200 OK:** `{ "discountCode": { …the list fields…, "redemptions": [ { "orderId": "3f2a9c1e-…", "orderNumber": "ORD-20261014-K8W82Y", "email": "ama@example.com", "discountGhs": 2050, "redeemedAt": "2026-10-14T12:30:00.000Z" } ] } }`

`orderId` is the order's UUID: link to `/admin/orders/<orderId>`.

**Errors:** 400 bad id; 401; 403; 404 `"Discount code not found."`

#### `POST /api/admin/discount-codes`

*(BE29)* Creates a code.

- **Login required:** yes · **Admin required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`

| Field | Type | Rules |
|---|---|---|
| `code` | string | Required. 3–20 letters and digits (spaces at the ends removed); stored **upper-case**; unique (ignoring case) |
| `type` | string | Required: `"percent"` or `"fixed"` |
| `value` | number | Required. Percent: 1–90. Fixed: 100–100000 pesewas |
| `maxDiscountPesewas` | number or null | Optional, **percent codes only**: the most it can take off (1–100000) |
| `minSubtotalPesewas` | number or null | Optional: the minimum products' subtotal to use it |
| `startsOn`, `endsOn` | string or null | Optional Ghana days `YYYY-MM-DD`, both included; `endsOn` on or after `startsOn` |
| `usageLimit` | number or null | Optional: the total number of paid orders that can use it (1–1,000,000) |
| `oncePerCustomer` | boolean | Default `true`: one paid order per email address (guests too) |
| `isActive` | boolean | Default `true` |

```json
{ "code": "ADORN10", "type": "percent", "value": 10, "maxDiscountPesewas": 5000, "endsOn": "2026-12-31", "usageLimit": 100 }
```

**201 Created:** `{ "discountCode": { … } }` (the same shape as `GET /api/admin/discount-codes/:id`).

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | A field's rules (see `fields`), e.g. `fields.value` "A percent discount must be from 1 to 90.", `fields.maxDiscountPesewas` "A maximum discount only applies to percent codes.", `fields.endsOn` "The end date must be on or after the start date." |
| 401 / 403 | | Not logged in / not an admin (or no `X-Requested-With`) |
| 409 | `CONFLICT` | `fields.code`: `"A discount code with this name already exists."` |

#### `PATCH /api/admin/discount-codes/:id`

*(BE29)* Edits a code. Send **only the fields that change** (at least one); `null` clears an optional one (e.g. `{ "endsOn": null }` removes the end date). **Switch a code off** with `{ "isActive": false }`. There's no delete.

- **Login required:** yes · **Admin required:** yes
- **Headers:** `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`

**A code that has been used** (`timesUsed` > 0) can't change its `code`, `type` or `value` (409): paid orders describe it. Create a new code instead. Its dates, limits, `oncePerCustomer` and on/off can still change. An unused code can change anything.

**200 OK:** `{ "discountCode": { … } }`

**Errors:** as `POST`, plus `fields._` "Send at least one field to change."; 404 `"Discount code not found."`; 409 `"This code has been used, so its code, type and value can't change. Create a new code instead."`

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
      "id": "3f2a9c1e-7b4d-4e8a-9f01-6c2d5e8b7a43",
      "orderNumber": "ORD-20260930-3R6FTE",
      "placedAt": "2026-09-30T14:05:12.000Z",
      "customer": { "name": "Ama Mensah", "email": "ama@example.com", "userId": 2, "isGuest": false, "accountDeleted": false },
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

- `customer` holds the name and email given **at checkout**. `isGuest` is `true` (with `userId: null`) for orders placed without logging in that **aren't linked** to an account. A guest order linked later (BE25: same email, verified) has the account's `userId` and `isGuest: false`; its details show `linkedAt`. `accountDeleted` *(BE27)* is `true` when the shopper has since **deleted their account**: show the account as **"Deleted user"**. The order's own `name`, `email`, `phone` and delivery address are kept for the store's records.
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
    "id": "3f2a9c1e-7b4d-4e8a-9f01-6c2d5e8b7a43",
    "orderNumber": "ORD-20260930-3R6FTE",
    "placedAt": "2026-09-30T14:05:12.000Z",
    "status": "Pending",
    "customer": { "name": "Ama Mensah", "email": "ama@example.com", "phone": "0241234567", "userId": 2, "isGuest": false, "accountDeleted": false },
    "linkedAt": null,
    "deliveryAddress": "12 Oxford Street, Osu, Accra",
    "deliveryRegionName": "Greater Accra",
    "deliveryTownName": "Accra",
    "items": [
      { "productId": "9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", "name": "Silver Pocket Mirror", "unitPriceGhs": 6000, "quantity": 1, "lineTotalGhs": 6000, "image": { "url": "https://ik.imagekit.io/ADORN/ADORN/Products/Accessories/pocket-mirror-1.jpg", "altText": "Silver compact pocket mirror" } }
    ],
    "subtotalGhs": 6000,
    "discountCode": null,
    "discountGhs": 0,
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
- `linkedAt` *(BE25)*: `null`, unless the order was **placed as a guest** and later linked to this account (same email, verified). Then show "Placed as a guest, linked to this account on 14 Oct 2026" (Ghana time). `customer.isGuest` is `false` once linked, because the order now belongs to an account.
- `deliveryRegionName` / `deliveryTownName`: where to send it (town `null` = "other town in this region"; both `null` = an order from before delivery areas: "Delivery area: not recorded"). `deliveryFeeGhs` is what was charged.
- `statusHistory[].changedBy` is `null` for changes made by the system, such as the order being placed.
- `refunds[].providerReference` is Paystack's refund id (once accepted).
- `failureReason` explains a `failed` refund.
- `issuedBy` is `null` for automatic refunds.
- A `failed` refund has `providerReference: null`, a `failureReason` (e.g. `"Paystack returned HTTP 400: …"`), and isn't counted in `refundedGhs`.

**Errors**

| Status | Code | When |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Not logged in |
| 403 | `FORBIDDEN` | Not an admin |
| 404 | `NOT_FOUND` | `"Order not found."` No such order, or `:id` isn't an order UUID (e.g. an old number like `9`) |

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
    "id": "3f2a9c1e-7b4d-4e8a-9f01-6c2d5e8b7a43",
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

- shoppers with an account: their order in My Orders, `{CLIENT_URL}/orders/<order UUID>` (BE26), which never expires;
- guests: the confirmation page, `{CLIENT_URL}/order/confirmation/<token>`, which works for 30 days after the order.

**Errors**

| Status | Code | Message / when |
|---|---|---|
| 400 | `INVALID_REQUEST` | `"Status must be Shipped, Delivered or Cancelled."` (in `fields.status`) |
| 401 | `UNAUTHENTICATED` | Not logged in |
| 403 | `FORBIDDEN` | Not an admin, or the `X-Requested-With` header is missing |
| 404 | `NOT_FOUND` | `"Order not found."` No such order, or `:id` isn't an order UUID (e.g. an old number like `9`) |
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
  "order": { "id": "3f2a9c1e-7b4d-4e8a-9f01-6c2d5e8b7a43", "totalGhs": 8000, "refundStatus": "partial", "refundedGhs": 5000, "refunds": [ "…" ], "…": "the full admin order view" },
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
| 404 | `NOT_FOUND` | `"Order not found."` No such order, or `:id` isn't an order UUID (e.g. an old number like `9`) |
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
| 400 | `INVALID_REQUEST` | `refundId` isn't a positive whole number |
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
      "product": { "id": "6b1f0c2e-8d4a-4f7b-9e21-3a5c7d9e1f40", "name": "Black Canvas Tote Bag" },
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
