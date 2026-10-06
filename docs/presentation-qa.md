# Presentation Q&A: revision sheet

Likely questions about the Online Store backend, with short answers based on what was actually built. **[BEx]** means "see that section in [backend-guide.md](backend-guide.md)" for the full explanation.

**How to revise:** cover the answer, say it out loud in your own words, then check. If you can explain *why* and not just *what*, you're ready.

---

## 1. Stack and design choices

**Q: Why Express, Sequelize and MySQL?**
- **Express:** small and widely used. Its middleware chain (security → validation → controller) is easy to follow and explain.
- **Sequelize:** gives **migrations**, so the database structure is versioned like code and can be undone. It also gives transactions and row locks, which the payment logic needs.
- **MySQL:** the data is relational. Orders, items, refunds, reviews and users are linked tables, with foreign keys and unique rules that protect the data even if the code has a bug.

**Q: Why Zod?**
Every body, query string and URL parameter is checked **before** any code uses it. Fields the schema doesn't list are dropped, which blocks **mass assignment** (someone sending `"isAdmin": true`). **[BE1, BE2]**

**Q: How is the code organised?**
Route → middleware → validator → controller → service → model.
- **Controllers** only deal with HTTP (read the request, send JSON).
- **Services** hold the business rules, so one rule can be used by several endpoints. For example, cancellation is shared by the shopper and the admin.
- **Models** describe the tables.

**Q: Why is money stored as pesewas (whole numbers)?**
Decimal numbers in JavaScript are inexact: `0.1 + 0.2 = 0.30000000000000004`. Whole numbers are always exact, so `GHS 350.00` is stored as `35000`. Prices and totals are always calculated on the server, and any amount the frontend sends is ignored. **[BE1, BE13]**

**Q: Why store times in UTC?**
The database stores UTC. Anything people see, or any business date (dashboard periods, date filters), uses **Ghana time** (`Africa/Accra`), referred to by the time zone's name so the intent is clear.

---

## 2. Security

**Q: How does login work? Why a cookie instead of localStorage?**
- After login, the server signs a **JWT** and puts it in an **HTTP-only cookie**. Page JavaScript can't read it, so an XSS bug can't steal it.
- Passwords are hashed with **bcrypt, cost 12**.
- Email verification links are random tokens, stored **hashed**. **[BE2]**

**Q: What is CSRF, and how do you stop it?**
CSRF (cross-site request forgery) is another website making the browser send a request using your user's cookies. Every POST, PATCH and DELETE must carry the header `X-Requested-With: XMLHttpRequest`. Another site can't add a custom header unless CORS allows it, and CORS only allows our frontend (`CLIENT_URL`). **[BE1]**

**Q: Can a user see someone else's order?**
No. Every query includes the logged-in user's id (`where: { id, userId }`). Someone else's order simply isn't found, so the answer is **404, not 403**: a 403 would confirm the order exists. This is protection against **IDOR** (insecure direct object reference). **[BE14]**

**Q: What's the difference between 401 and 403?**
401 means "we don't know who you are: log in". 403 means "we know who you are, and you're not allowed". Admin checks use the **database's** `isAdmin`, not the token, so removing admin rights takes effect immediately. **[BE14]**

**Q: How does the login code (two-step login) work?**
- After the correct password, the user isn't logged in yet. A 6-digit code is emailed, and a short "login challenge" cookie remembers who passed the password step.
- The challenge cookie is signed with a **different key**, so it can never be used as a login token.
- Codes are random, stored **hashed**, expire after 10 minutes, and are cancelled after 5 wrong tries. There's a 60-second wait between sends and at most 5 per hour.
- Wrong guesses are counted even though the request returns an error: the counter is saved first, then the error is thrown. **[BE12]**

**Q: Why rate limits? What is `TRUST_PROXY_HOPS`?**
Rate limits slow down password guessing and spam (for example, 10 logins per 15 minutes per IP). On Render, requests pass through proxies, so Express must trust **exactly** that many hops to read the visitor's real IP. If it trusted too few, everyone would share one limit; too many, and visitors could fake their IP. **[BE22]**

**Q: What do you never show in errors?**
SQL, stack traces, password hashes, tokens and secrets. Every error has the same shape: `{ error: { code, message, fields? } }`. Unexpected errors are logged on the server, and the user only sees "Something went wrong".

---

## 3. Payments (expect the most questions here)

**Q: How does a payment work, from start to finish?**
1. `POST /api/checkout`: the server prices the cart itself, saves a Checkout with a **snapshot of the items** (CheckoutItems), commits, then asks Paystack to start a GHS mobile money payment.
2. The shopper pays in Paystack's popup or page.
3. `POST /api/checkout/verify`, or Paystack's **webhook**: the server checks with Paystack and creates the order.

**Q: How do you know a payment is real?**
The server never trusts the browser saying "I paid". It asks **Paystack's API directly** and checks that the **amount, currency (GHS) and reference** match its own saved checkout. If anything differs, there's no order. **[BE8]**

**Q: What is a webhook, and how do you know it's really from Paystack?**
A webhook is Paystack calling our server when a payment succeeds, even if the shopper closed the page. Each one is **signed**: an HMAC SHA512 of the raw request body, made with our secret key. We recalculate it and compare **in constant time** (`timingSafeEqual`), so response times reveal nothing. That's why BE1 keeps the **raw** body. Parsed JSON could differ by a single space, and then the signature wouldn't match. **[BE8]**

**Q: What if verify and the webhook arrive at the same moment?**
Fulfilment is **idempotent**. The checkout row is locked, so the second request waits, then sees "already paid" and returns the **same** order. There's never a second order, and the confirmation email is sent only once. **[BE8, BE11]**

**Q: Two people pay for the last item at the same moment. What happens?**
*(Your best story.)* Checkout doesn't reserve stock, so both can pay. When each payment is confirmed, stock is re-checked **under a row lock**. The first payment gets the item. The second payment's checkout is marked failed, and it is **refunded in full automatically** and emailed. Stock never goes below zero. This was tested with real test payments, and with 5 payments at once. **[BE9]**

**Q: What about failed, abandoned or slow payments?**
- A payment that isn't finished yet is rechecked up to 3 times, within about 20 seconds; after that the answer is "pending, try again".
- Each Paystack call has an 8-second limit.
- Only verify (a read) is retried after a network error. Creating payments or refunds is never blindly retried, because that could charge or refund twice.
- A failed payment leaves the checkout open: a late approval on the phone still becomes an order.
- **Late duplicate payment:** an old checkout for the same cart is approved after a newer one already became an order. It's refunded automatically instead of creating a second order. **[BE10]**

**Q: How do refunds avoid paying back too much, or twice?**
- **Never more than was paid:** the amount must fit in what's *left* (paid minus refunds that aren't failed). This is checked while the **order row is locked**, and cancellation takes the same lock.
- **Save first, then Paystack:** the Refund is saved as `requested`, committed, and only then sent to Paystack. A crash can't lose it.
- **Retries check first:** a timeout doesn't mean failure, because Paystack may have done it. Before retrying, the server **lists Paystack's refunds for that payment**. If Paystack already made it, the refund is linked, not sent again.
- The shopper is emailed only once Paystack has accepted the refund. **[BE16, BE17]**

**Q: Are refunds really tested?**
Yes, with real test-mode refunds: the "sold out" refund, a shopper's cancellation, and an admin's partial refund followed by a full one. All were accepted by Paystack.

---

## 4. Database and concurrency

**Q: What is a transaction? Give an example.**
A group of changes that all succeed or all fail. **Cancelling** an order puts the stock back, sets Cancelled, records the history and creates the refund, all in one transaction. There's never a half-cancelled order. **[BE16]**

**Q: What is a row lock, and why do you need one?**
`SELECT … FOR UPDATE` makes other transactions wait for that row. Without it, two requests could both read "stock = 1", both pass the check, and both take the item. **[BE9]**

**Q: What is a deadlock, and how do you avoid it?**
Two transactions each waiting for a row the other has locked. Products are always locked **in id order** everywhere (cart, fulfilment, cancellation), so they can't wait for each other in a circle. If MySQL still reports a deadlock, the transaction is retried once. **[BE6]**

**Q: Why not call Paystack or send emails inside a transaction?**
Outside calls can take seconds. Holding database locks that long would block other shoppers. So: commit first, then call. An email failure never undoes an order (except the login code, where the user is told to try again).

**Q: How do the unique rules help?**
They're the last line of defence. For example, if two "write review" clicks both pass the code's check, the database's UNIQUE (userId, productId) still lets only one in. **[BE18]**

**Q: What is N+1, and where did you avoid it?**
Running one query per item in a list. "Verified purchase" for a page of reviews uses **one** query for the whole page, and the test counted the queries to prove it. **[BE18]**

**Q: How is the dashboard revenue calculated?**
- Revenue = totals of orders **placed** in the period, minus refunds on **those** orders.
- Refunds count against their order's date, so a past week stays stable and today can't go negative.
- Cancelled orders aren't counted in the order count.
- It's calculated with SUM/COUNT in MySQL, by Ghana days. **[BE20]**

**Q: How are USD prices worked out?**
GHS is charged; USD is display only. Each **unit price** is converted first and rounded, then multiplied and added, so the numbers on screen always add up. Converting the total instead gave 3903 cents while the lines added up to 3904. **[BE13]**

---

## 5. Problems I faced (they love these)

| Problem | What happened | What I learned |
|---|---|---|
| Couldn't connect to MySQL ("user ''") | `DB_USER` was empty, and nodemon doesn't reload when `.env` changes | Check the config first; restart with `rs` |
| Registration took about 5 seconds | We waited for the email server (Mailtrap at the time) before answering, and the delay also showed which emails had accounts | Send emails in the background, after the database work **[BE2]** |
| Last-item race | Two payments, one item | Row locks + an automatic refund **[BE9]** |
| USD totals didn't add up | 3903 vs 3904 cents | Convert unit prices first, then multiply and add **[BE13]** |
| Late duplicate payments | An old checkout was approved after a newer order existed | Detect and refund automatically **[BE10]** |
| Refund timeouts | A "failed" refund might really have gone through | Check Paystack's records before retrying **[BE17]** |
| Only one Paystack test number | Declined or timed-out payments can't be triggered in test mode | Automated tests that replace Paystack's answers, and the limit documented in the README |
| A migration couldn't be undone | The undo failed once checkout refunds existed; MySQL can't roll back table changes, so the table was left half-changed | Test undo with **real data**, and order the steps safely **[BE22]** |
| Photos didn't match the products | A new catalogue was needed | `docs/catalogue.md` as the single source, read and checked by the seeder **[BE22]** |
| Cookies on a different site | Safari blocks third-party cookies | Forward `/api` through the frontend's own domain **[BE22]** |
| Mystery 404s in Postman | A trailing space at the end of the URL | A generic "not found" means the route itself didn't match |
| My own test hit the rate limit | The review test sent more than 20 requests | Proof the limit works; reset it between test sections **[BE18]** |

---

## 6. Testing and deployment

**Q: How did you test it?**
- After every task, **automated scripts** against a real database, covering the normal case, bad input, the wrong user, and requests at the same moment.
- **Paystack replaced inside the test process** to simulate failures, timeouts and duplicates.
- **Real test payments and refunds** with Paystack.
- A **Postman collection** with all 39 endpoints, run locally and against Render.
- A script that checks **api.md lists exactly the routes in the code** (39 = 39).
- Results checked in **MySQL Workbench**.

**Q: How is it deployed?**
- GitHub → **Render** (the build installs packages and runs the migrations; start: `npm start`) → **Aiven MySQL** over SSL, verified with Aiven's CA certificate.
- Secrets live only in environment variables. `.env` files are git-ignored.
- The starting data was seeded **once** from my computer (`npm run seed:production`).
- The Paystack webhook URL points to `/api/webhooks/paystack` on Render.

**Q: How did you prove the webhook works?**
I paid a test checkout and **closed the page without calling verify**. The order still appeared: Paystack's webhook created it by itself.

---

## 7. Limits and "what would you improve?"

Answer honestly: naming your limits yourself shows understanding.
- **No automated test suite** in the project. Jest + Supertest was a stretch goal, and it's the first thing I'd add.
- **Payments:** mobile money only, GHS only, test mode.
- **Delivery:** a flat fee and Pending → Shipped → Delivered; no courier tracking.
- **Guest orders** aren't linked to an account if the guest registers later.
- **Render's free plan sleeps** after about 15 minutes, so the first request can be slow. Webhooks are retried by Paystack, so nothing is lost.
- **Images** are uploaded through the ImageKit dashboard, not the API (BE21 was a stretch).
- **One photo per product** for now, though the API already supports several.

---

## 8. Quick facts to remember

| Thing | Value |
|---|---|
| Endpoints | 39 |
| Products / categories | 41 / 6 |
| Tables | 18 |
| Delivery fee | GHS 20.00 (2000 pesewas) |
| USD rate | 15.50 GHS per US$ 1 (display only) |
| Low-stock threshold | 5 (Makeup Setting Spray 2 = low; Pearl Stud Earrings 0 = out) |
| Login lasts | 1 day |
| Login code | 6 digits, 10 minutes, 5 tries, 60 s between sends, 5 per hour |
| Guest cart | 30 days since the last change |
| Confirmation link | Works for 30 days |
| Pagination | 10 (My Orders), 20 (admin), 5 (reviews) |
| Paystack test number | 0551234987 (MTN, always succeeds) |
| Demo shoppers | ama.mensah@ / kwame.boateng@ / efua.owusu@example.com, password `DemoShopper123` |

---

## 9. Demos to have ready (about 30 seconds each)

1. **The last-item race:** two payments for one item → one order, one automatic refund, stock 0.
2. **Webhook only:** pay, close the page → the order still appears, and the confirmation email is in the Ethereal inbox.
3. **Admin dashboard after a cancellation:** cancel a Pending order → the stock comes back, the refund is created, and the low-stock list updates.
