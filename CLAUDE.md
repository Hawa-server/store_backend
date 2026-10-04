Project: Online Store Backend (Final Project)

The backend (API) for a small online fashion and beauty store (bags, makeup, skincare, jewellery, accessories, and perfumes), for a class final project. Shoppers browse products, manage a cart, pay with mobile money (test mode), get an order confirmation by email, track and cancel orders, and review products they've received. Accounts use email verification, a login code, and login alerts.

The frontend is a separate React project in another folder, built after this backend is finished. Don't write any frontend code here.

What to build
Build only what is in docs/backend-plan.md, one task at a time, in order (BE1 to BE22).
docs/backlog.md is the full product plan, for reference only. Don't build anything from it that isn't in the backend plan.
Keep it simple. This is a student project with a short deadline, so choose the simplest solution that meets each task's acceptance criteria.
Admin features: only the admin endpoints in the plan (orders, status changes, refunds, review moderation, and the dashboard and threshold setting; product image uploads only if I ask). Nothing more.
Stretch items are built only if I ask for them.
Stack
Express.js, Sequelize, MySQL (mysql2), Zod, bcryptjs, jsonwebtoken, cookie-parser, cors, helmet, express-rate-limit, dotenv, Nodemailer; nodemon for development. Jest + Supertest only for the stretch tests.
Payments: Paystack in test mode, mobile money only, with server-side verification and webhooks.
Images: ImageKit URLs (photos are uploaded through ImageKit's website; API uploads in BE21 are a stretch).
Email: Nodemailer sending to a test inbox (Mailtrap sandbox).
Hosting: Render for the API, Aiven for MySQL (with SSL) for the production database.
Don't add other libraries or services without asking first.
Rules that always apply
Follow the principles in docs/backend-plan.md Sections 3 and 5 (server is the source of truth, money, time, error format, pagination, authentication, CSRF check).
Money: whole numbers in pesewas, never decimals. Prices and totals are calculated on the server; never trust amounts from the client.
Time: store UTC; business dates use Africa/Accra.
Transactions: never call Paystack, ImageKit, or email inside a database transaction. Commit first, then call the outside service.
Payments: always verify with Paystack on the server, and check webhook signatures. Fulfilment must be idempotent.
Errors: always use the standard error format; never expose SQL, stack traces, hashes, tokens, or secrets.
Secrets: all keys and passwords live in .env (never committed). Keep .env.example up to date.
Security: hash passwords with bcryptjs (cost 12); store verification links and login codes hashed; login tokens go in HTTP-only cookies; validate every body, query, and parameter with Zod; check ownership on every request; rate-limit sensitive endpoints.
Login code: controlled by LOGIN_CODE_ENABLED. In development only, print codes to the console.
Emails never break an order or login. Log failures and carry on. (Exception: a failed login code email tells the user to try again.)
Images: use only ImageKit URLs listed in the plan (or saved through BE21, if built). Don't invent image addresses.
If you're unsure how Paystack, ImageKit, or Mailtrap works, check their official documentation or ask me. Don't guess endpoint names or fields.
Comments for learning

I'm a student and need to understand and explain this backend.

Start each file with a comment explaining its purpose and how it fits into the app.
Above each function, explain what it does, what it receives, and what it returns.
Inside functions, explain the reasons behind important steps (security, money, stock, transactions, payments) in plain language.
Don't comment obvious single lines; focus on the why.
Documents you keep up to date
docs/backend-guide.md (my study guide). After each task, add a short section explaining, for a beginner: what was built and why, the new or changed files, new endpoints, new tables and how they relate, how one request flows through the code (route → middleware → controller → model → response), and any important concepts used.
docs/api.md (for the frontend). After each task, document every new or changed endpoint: method and path, whether login or admin is required, the request body, an example response, and possible errors. The frontend project will be built from this file alone, so it must be complete and accurate.
How to work
Before starting a task, read it in docs/backend-plan.md and briefly explain your plan. Wait for my OK.
Build the task, following the comment rules above.
When done, check every item in the task's Done when list, update docs/backend-guide.md and docs/api.md, tell me exactly how to test it in Thunder Client (method, address, body), and summarise what changed.
Stop after each task. Don't start the next one until I say so.
Commands

Install: npm install (then copy .env.example to .env and fill it in)
Start the server (development, auto-restart): npm run dev
Start the server (production): npm start
Run migrations: npx sequelize-cli db:migrate
Undo all migrations: npx sequelize-cli db:migrate:undo:all
Seed data: npx sequelize-cli db:seed:all
Undo all seed data: npx sequelize-cli db:seed:undo:all

One more thing: in BE8, the Paystack webhook must read the raw request
body to check its signature. Set up the JSON parsing in BE1 so that
the webhook route can get the raw body later.