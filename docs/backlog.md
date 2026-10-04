# Shopping Cart Backlog

> **Implementation update:** the backend now follows the engineering plan in `docs/backend-plan.md`. It uses **ImageKit** instead of Cloudinary (photos uploaded through ImageKit's website; API uploads are a stretch), **Paystack webhooks**, **Render** hosting with a managed MySQL database, Zod validation, and JWT in HTTP-only cookies without refresh tokens. Where this backlog says otherwise, the backend plan wins.
>
> **Reference only.** This is the full product plan. Claude Code builds only what's in `docs/backend-plan.md` (this folder) and `docs/frontend-plan.md` (the `store-frontend` folder).

**Project:** Final project: a working full-stack online fashion and beauty store (bags, makeup, jewellery, and accessories), due in under two weeks (no existing codebase)
**Stack:** Backend: Express.js, Sequelize, MySQL (`store-backend`). Frontend: React (`store-frontend`). The backend is built first.
**Team:** One developer, also acting as product owner, with Claude as planning and review teammate
**Last updated:** 25 Sep 2026

---

## Table of Contents

1. [How This Backlog Works](#how-this-backlog-works)
2. [Estimation Scale](#estimation-scale)
3. [Definition of Done](#definition-of-done)
4. [Epic 0: Foundations](#epic-0-foundations)
5. [Epic 1: Add to Cart](#epic-1-add-to-cart)
6. [Epic 2: Manage Cart Items](#epic-2-manage-cart-items)
7. [Epic 3: Save the Cart](#epic-3-save-the-cart)
8. [Epic 4: Checkout and Payment](#epic-4-checkout-and-payment)
9. [Epic 5: Prices in My Currency](#epic-5-prices-in-my-currency)
10. [Epic 6: Pay with Mobile Money](#epic-6-pay-with-mobile-money)
11. [Epic 7: Order Confirmation](#epic-7-order-confirmation)
12. [Epic 8: Account Email Security](#epic-8-account-email-security)
13. [Epic 9: Order History and Status](#epic-9-order-history-and-status)
14. [Epic 10: Cancel an Order](#epic-10-cancel-an-order)
15. [Epic 11: Ratings and Reviews](#epic-11-ratings-and-reviews)
16. [Epic 12: Read Reviews](#epic-12-read-reviews)
17. [Epic 13: Product Details](#epic-13-product-details)
18. [Epic 14: Browse by Category](#epic-14-browse-by-category)
19. [Epic 15: Manage Orders (Admin)](#epic-15-manage-orders-admin)
20. [Epic 16: Moderate Reviews (Admin)](#epic-16-moderate-reviews-admin)
21. [Epic 17: Low-Stock Alerts (Admin)](#epic-17-low-stock-alerts-admin)
22. [Backlog Totals](#backlog-totals)
23. [Delivery Plan (Full Product)](#delivery-plan-full-product)
24. [What's Next](#whats-next)

---

## How This Backlog Works

**This document has two parts.** The epics, totals, and full delivery plan describe the complete product, as a real business would need it. The smaller version actually being built for the final project is in **`docs/backend-plan.md` and `docs/frontend-plan.md`**. That file, not this one, is what Claude Code builds from.

Each user story is worked through in the same steps:

1. **Acceptance criteria:** Turn the original story into clear, testable Given/When/Then criteria.
2. **Stories and points:** Break the criteria into separate, production-ready stories, each estimated in story points. Each story lists which acceptance criteria it covers.
3. **Decisions:** Answer the open questions as product owner, so the behavior is clear before building.
4. **Developer review:** Check the estimates and dependencies, and add any missing stories.

Epic 0 contains the foundations the cart needs, since there is no existing codebase. Foundation stories are numbered F1–F7. Stories are numbered 1–84 across Epics 1–17, plus one spike (a short, time-limited investigation) labelled P1. Some stories moved between epics as new user stories were added, so numbers are not always in order within an epic.

---

## Estimation Scale

Points use the Fibonacci scale (1, 2, 3, 5, 8, 13) and measure effort, complexity, and risk together. The baseline is Story 2: **2 points = a small, well-understood UI change with light backend work.** Any story above 8 points should be split before it is started.

**Priorities:**
- **Must have:** needed for the first release.
- **Should have:** planned for the releases soon after the first release.
- **Could have:** planned for later, once there's evidence it's needed.

---

## Definition of Done

A story is done only when all of the following are true:

- Code is reviewed before merging: a self-review against this checklist, plus a second review by Claude for anything touching stock, prices, accounts, or security
- Unit tests cover new logic, and integration tests cover any API change
- All acceptance criteria pass in the staging environment
- Stock and prices are checked **on the server**; the browser or app is never trusted for either
- Money is stored and calculated in whole minor units (e.g. cents), never as decimals
- The UI meets WCAG 2.1 AA: works with a keyboard, has accessible labels, and announces changes to screen readers
- Works on supported browsers on both mobile and desktop
- User-facing text is kept separate from code so it can be translated later
- Errors are logged with a request ID and no personal data
- The story's analytics events fire and are checked
- The product owner has accepted the story

---

# Epic 0: Foundations

**Goal:** Build the basic store the cart depends on: a deployable project, products, stock, accounts, a cart page, and analytics.

**Why this epic exists:** The cart stories need these pieces, and there is no existing codebase, so they are built first.

---

### Story F1: Project setup and deployment pipeline

**Points:** 5 | **Priority:** Must have | **Dependencies:** None

As the developer, I want a working project with automated testing and deployment, so that every story can be built, tested, and released safely.

**Acceptance criteria**

- **Given** code is pushed to the main branch, **when** the pipeline runs, **then** tests run automatically and the build fails if any test fails.
- **Given** tests pass, **when** the pipeline finishes, **then** the app is deployed to a staging environment.
- **Given** a version is approved in staging, **when** I trigger a release, **then** it is deployed to production.
- **Given** the app is running, **when** an error occurs, **then** it is captured in an error-logging tool.
- **Given** any environment, **when** it needs secrets (database passwords, API keys), **then** they come from environment configuration, never from the code.

---

### Story F2: Products and variants with prices

**Points:** 5 | **Priority:** Must have | **Dependencies:** F1, F5

As a store admin, I want to create products with variants and prices, so that there is something for shoppers to buy.

**Acceptance criteria**

- **Given** I'm signed in as an admin, **when** I create a product with a name, description, image, and price, **then** it is saved with a unique ID.
- **Given** a product has options (e.g. size, color), **when** I add variants, **then** each variant has its own ID and can have its own price.
- **Given** I enter a price, **when** it is saved, **then** it is stored in minor units as a whole number.
- **Given** I leave a required field empty or enter an invalid price, **when** I save, **then** I see a validation error and nothing is saved.
- **Given** a product is archived, **when** shoppers browse, **then** it no longer appears, but existing references (e.g. in carts) still work.

---

### Story F3: Product listing and product page

**Points:** 5 | **Priority:** Must have | **Dependencies:** F2

As a shopper, I want to browse products and view their details, so that I can decide what to buy.

**Acceptance criteria**

- **Given** products exist, **when** I open the store, **then** I see a list of active products with image, name, and price.
- **Given** I tap a product, **when** its page opens, **then** I see its details, price, and available options.
- **Given** a product has variants, **when** I select an option, **then** the price and availability update for that variant.
- **Given** a product doesn't exist or is archived, **when** I open its link, **then** I see a friendly "not found" page.

**Technical notes:** The product page is where Stories 1, 2, and 5 add the "Add to cart" button and option selectors.

---

### Story F4: Stock tracking per variant

**Points:** 5 | **Priority:** Must have | **Dependencies:** F2

As a store admin, I want to set and see stock levels for each variant, so that shoppers can only buy what's available.

**Acceptance criteria**

- **Given** I'm an admin editing a variant, **when** I set a stock quantity, **then** it is saved and shown to me.
- **Given** a variant has stock, **when** the cart asks for availability, **then** the server returns the current stock.
- **Given** two requests change stock at the same time, **when** both complete, **then** the stock is correct and never goes below zero.
- **Given** stock changes, **when** it is updated, **then** the change is logged with who or what changed it.

**Technical notes:** Use database transactions or atomic updates for stock changes. Stock is reduced at checkout, not when adding to cart (Decision 1).

---

### Story F5: Customer accounts and admin role

**Points:** 8 | **Priority:** Must have | **Dependencies:** F1

As a shopper, I want to create an account and sign in, so that my cart follows me across devices.

**Acceptance criteria**

- **Given** I'm new, **when** I sign up with email and password, **then** my account is created and I'm signed in.
- **Given** I have an account, **when** I sign in with correct details, **then** I'm signed in; with wrong details, I see a general error that doesn't reveal which part was wrong.
- **Given** I'm signed in, **when** I sign out, **then** my session ends on this device.
- **Given** I forgot my password, **when** I request a reset, **then** I receive a time-limited reset link by email.
- **Given** a user is marked as admin, **when** they sign in, **then** they can access the admin area; other users cannot.

**Technical notes:** Use a proven authentication provider or framework library rather than building password handling from scratch. That is safer and keeps this at 8 points; building it by hand would be 13 or more. Limit repeated sign-in attempts.

---

### Story F6: Cart storage and basic cart page

**Points:** 3 | **Priority:** Must have | **Dependencies:** F1, F3

As a shopper, I want a cart page, so that I can see what I've added.

**Acceptance criteria**

- **Given** I open the cart, **when** it has items, **then** I see each item's image, name, selected options, unit price, and quantity.
- **Given** my cart is empty, **when** I open it, **then** I see an empty cart message.
- **Given** a cart is created, **when** it is stored, **then** it is saved on the server with a unique ID and linked to a guest token or user ID.
- **Given** any page in the store, **when** it loads, **then** the header shows a cart icon with the item count.

**Technical notes:** Stories 1, 6, 11, and 12 build on this page. Give the cart a version number from the start to support Story 14.

---

### Story F7: Analytics setup

**Points:** 2 | **Priority:** Must have | **Dependencies:** F1

As the store owner, I want shopper activity tracked, so that I can see how people use the cart.

**Acceptance criteria**

- **Given** analytics is set up, **when** a page loads, **then** a page view is recorded.
- **Given** a story defines an event (e.g. `add_to_cart`), **when** that action happens, **then** the event is recorded with the listed fields.
- **Given** a shopper's region requires consent for tracking, **when** they first visit, **then** analytics only runs after they agree.

---

### Epic 0 Summary

| # | Story | Points | Priority |
|---|---|---|---|
| F1 | Project setup and deployment | 5 | Must |
| F2 | Products and variants with prices | 5 | Must |
| F3 | Product listing and product page | 5 | Must |
| F4 | Stock tracking per variant | 5 | Must |
| F5 | Customer accounts and admin role | 8 | Must |
| F6 | Cart storage and basic cart page | 3 | Must |
| F7 | Analytics setup | 2 | Must |
| | **Total** | **33** | |

---

# Epic 1: Add to Cart

## Step 1: User Story and Acceptance Criteria

**User story:** As a shopper, I want to add products to my cart, so that I can buy several items at once.

**Original criteria**

- Given a product is in stock, when I tap "Add to cart," then it appears in my cart and the cart count updates.
- Given a product is out of stock, when I view it, then the "Add to cart" button is disabled.

**Full acceptance criteria**

| AC | Criterion |
|---|---|
| AC1 | **Given** a product is in stock, **when** I tap "Add to cart," **then** it appears in my cart with a quantity of 1 and the cart count updates. |
| AC2 | **Given** a product is out of stock, **when** I view it, **then** the "Add to cart" button is disabled and "Out of stock" is shown. |
| AC3 | **Given** I tap "Add to cart," **when** the item is added, **then** I see a confirmation with an option to view the cart. |
| AC4 | **Given** a product is already in my cart, **when** I add it again, **then** its quantity increases by 1 instead of creating a duplicate line. |
| AC5 | **Given** one product is in my cart, **when** I add a different product, **then** both appear as separate line items. |
| AC6 | **Given** a product has limited stock, **when** I try to add more than is available, **then** it isn't added beyond the limit and I see a message. |
| AC7 | **Given** a product has options, **when** I tap "Add to cart" without choosing one, **then** I'm asked to choose and nothing is added. |
| AC8 | **Given** I add a product, **when** I open the cart, **then** the subtotal reflects each price multiplied by its quantity. |
| AC9 | **Given** I have items in my cart, **when** I leave, refresh, or close the app, **then** my cart is still there when I return. |
| AC10 | **Given** I added items as a guest, **when** I sign in, **then** those items are kept in my account's cart. |
| AC11 | **Given** a network or server error, **when** I tap "Add to cart," **then** nothing is added and I see an error with the option to try again. |
| AC12 | **Given** an item in my cart goes out of stock, **when** I view my cart, **then** it is flagged as unavailable and can't be checked out. |

---

## Step 2: Stories and Points

### Story 1: Add an in-stock product to the cart

**Points:** 5 | **Priority:** Must have | **Dependencies:** F3, F4, F6, F7 | **Covers:** AC1, AC3, AC5

As a shopper, I want to add an in-stock product to my cart, so that I can collect items to buy together.

**Acceptance criteria**

- **Given** a product is in stock, **when** I tap "Add to cart," **then** it appears in my cart with a quantity of 1 and the cart count updates.
- **Given** the item is added, **when** the request completes, **then** I see "Added to cart" with a "View cart" link, and screen readers announce it.
- **Given** one product is in my cart, **when** I add a different product, **then** both appear as separate line items and the count shows the total number of items.
- **Given** I tap "Add to cart," **when** the request is in progress, **then** the button shows a loading state and is disabled so a double tap can't add the item twice.

**Technical notes:** The add-to-cart request should be safe to repeat (use a request ID) so retries never create duplicates. Target: 95% of requests finish in under 1 second. Fire an `add_to_cart` event with product ID, variant ID, quantity, and price.

---

### Story 2: Prevent adding out-of-stock products

**Points:** 2 | **Priority:** Must have | **Dependencies:** Story 1 | **Covers:** AC2

As a shopper, I want to clearly see when a product is out of stock, so that I don't try to buy something unavailable.

**Acceptance criteria**

- **Given** a product is out of stock, **when** I view it, **then** the "Add to cart" button is disabled and "Out of stock" is shown.
- **Given** the button is disabled, **when** I use a screen reader, **then** it is announced as unavailable with the reason.
- **Given** a product sells out after I loaded the page, **when** I tap "Add to cart," **then** the server rejects it and I see "Sorry, this item just sold out."

---

### Story 3: Increase quantity when adding a product already in the cart

**Points:** 2 | **Priority:** Must have | **Dependencies:** Story 1 | **Covers:** AC4

As a shopper, I want adding the same product again to increase its quantity, so that my cart stays tidy.

**Acceptance criteria**

- **Given** a product is already in my cart, **when** I tap "Add to cart" again, **then** its quantity increases by 1, no duplicate line appears, and the count updates.
- **Given** the same product in a different variant (e.g. another size), **when** I add it, **then** it appears as a separate line item.

---

### Story 4: Enforce stock limits when adding

**Points:** 3 | **Priority:** Must have | **Dependencies:** Stories 1, 3, 15 | **Covers:** AC6

As a shopper, I want to know when I've reached the available stock, so that I don't order more than can be supplied.

**Acceptance criteria**

- **Given** a product has limited stock, **when** I try to add more than is available, **then** the quantity doesn't go past the limit and I see "Only X left in stock."
- **Given** a per-order limit is set for the product, **when** I reach it, **then** I can't add more and the limit is explained.
- **Given** the 99-per-line cap, **when** I try to add past it, **then** nothing more is added and the cap is explained.

**Technical notes:** The server checks stock and limits every time. Adding to cart does not reserve stock (Decision 1).

---

### Story 5: Require variant selection before adding

**Points:** 3 | **Priority:** Must have | **Dependencies:** Story 1 | **Covers:** AC7

As a shopper, I want to be asked to choose options like size or color, so that I get the exact product I want.

**Acceptance criteria**

- **Given** a product has options, **when** I tap "Add to cart" without choosing one, **then** nothing is added and the missing option is highlighted with a message such as "Please select a size."
- **Given** I've chosen all options, **when** I tap "Add to cart," **then** that specific variant is added.
- **Given** a specific variant is out of stock, **when** I view the options, **then** it is shown as unavailable and can't be selected.

---

### Story 6: Show an accurate cart subtotal

**Points:** 5 | **Priority:** Must have | **Dependencies:** Story 1 | **Covers:** AC8; also Epic 3 AC7

As a shopper, I want to see my cart subtotal, so that I know how much I'm spending.

**Acceptance criteria**

- **Given** I have items in my cart, **when** I open it, **then** the subtotal equals each item's price multiplied by its quantity, added together.
- **Given** a price changed after I added the item, **when** I open my cart, **then** the current price is used and I see a notice that the price changed, whether up or down (Decision 4).
- **Given** the store's currency, **when** prices are shown, **then** they use the correct currency symbol and formatting.

**Technical notes:** The server calculates all totals. Store each item's price at the time it was added so changes can be detected.

---

### Story 9: Handle add-to-cart failures

**Points:** 3 | **Priority:** Must have | **Dependencies:** Story 1 | **Covers:** AC11

As a shopper, I want clear feedback if adding an item fails, so that I know what happened and can try again.

**Acceptance criteria**

- **Given** a network or server error, **when** I tap "Add to cart," **then** nothing is added, the count doesn't change, and I see an error with "Try again."
- **Given** I'm offline, **when** I tap "Add to cart," **then** I'm told I'm offline and nothing is added.
- **Given** an error happens, **when** it is logged, **then** the log includes a request ID and no personal data.

---

### Story 10: Flag items that become unavailable in the cart

**Points:** 5 | **Priority:** Should have | **Dependencies:** Stories 1, 6 | **Covers:** AC12; also Epic 3 AC7

As a shopper, I want to be told when something in my cart is no longer available, so that I'm not surprised at checkout.

**Acceptance criteria**

- **Given** an item in my cart goes out of stock, **when** I view my cart, **then** it is marked "No longer available," left out of the subtotal, and I can remove it.
- **Given** stock falls below the quantity in my cart, **when** I view my cart, **then** the quantity is reduced to what's available and I'm told why.
- **Given** my cart has unavailable items, **when** I go to checkout, **then** I can't continue until they're dealt with.
- **Given** a product has been archived, **when** I view my cart, **then** it shows as unavailable instead of causing an error.

---

### Story 15: Set a per-order limit on a product (admin)

**Points:** 3 | **Priority:** Must have | **Dependencies:** F2, F5 | **Covers:** Decision 3

As a store admin, I want to set a maximum quantity per order on specific products, so that high-demand items can't be bought in bulk.

**Acceptance criteria**

- **Given** I'm editing a product in the admin area, **when** I enter a per-order limit and save, **then** it is stored and applies to all its variants.
- **Given** a product has no limit, **when** shoppers add it, **then** only stock and the 99 cap apply.
- **Given** I enter an invalid limit (zero, negative, or text), **when** I save, **then** I see an error and nothing is saved.
- **Given** I change or remove a limit, **when** shoppers next add or update that product, **then** the new limit applies.

**Technical notes:** Admin changes are logged with who made them and when.

---

### Epic 1 Summary

| # | Story | Points | Priority | Covers |
|---|---|---|---|---|
| 1 | Add an in-stock product | 5 | Must | AC1, AC3, AC5 |
| 2 | Prevent adding out-of-stock products | 2 | Must | AC2 |
| 3 | Increase quantity for existing item | 2 | Must | AC4 |
| 4 | Enforce stock limits when adding | 3 | Must | AC6 |
| 5 | Require variant selection | 3 | Must | AC7 |
| 6 | Show accurate subtotal | 5 | Must | AC8 |
| 9 | Handle add-to-cart failures | 3 | Must | AC11 |
| 10 | Flag unavailable items | 5 | Should | AC12 |
| 15 | Set a per-order limit (admin) | 3 | Must | Decision 3 |
| | **Total** | **31** | | |

Must-have points: **26**. Should-have points: **5**.

Stories 7, 8a, 8b and 16 moved to Epic 3 (Save the Cart) when User Story 3 was added. AC9 and AC10 are now covered there.

---

## Step 3: Product Owner Decisions

Decided 24 Sep 2026.

| # | Question | Decision | Why | Alternatives considered |
|---|---|---|---|---|
| 1 | Does adding to cart reserve stock? | No. Stock is checked when adding and again at checkout. | Most carts are abandoned, so reserving would tie up stock. Story 10 handles items that sell out. | Reserve at checkout only; reserve on add (+5–8 pts). Revisit before any flash sale. |
| 2 | How long are carts kept? | Guests: 30 days from last activity. Signed-in: until emptied, or 12 months of inactivity. | Covers most "come back later" shopping without keeping stale data forever. | 7 days (too short); 90 days (more stale prices and stock). |
| 3 | Are there quantity limits? | Optional per-order limit per product, set by admin. No per-customer limits at launch. | Protects high-demand items without affecting normal shopping. | No limits; per-customer limits across orders (+5 pts). |
| 4 | Show price changes or apply silently? | Always charge the current price and tell the shopper about any change, up or down. | Honest and builds trust; silent changes cause abandoned carts. | Silent update; honor the old price (+3 pts, risky). |
| 5 | Which currencies and languages? | **Currency replaced by Epic 5:** GHS by default, with USD shortly after the first release (Decisions 20–27). **Language:** one language at launch, built so more can be added later. | Keeps launch simple; the Definition of Done prevents a rewrite later. | Multiple currencies at launch (separate epic). Finance to confirm the currency. |

---

## Step 4: Developer Review

| Story | Before | After | Reason |
|---|---|---|---|
| 1 | 5 | 5 | Confirmed. |
| 6 | 3 | 5 | Price-change notices need each item's original price stored and compared. |
| 8 | 8 | 5 + 3 | Split into 8a and 8b so each fits comfortably in a sprint (now in Epic 3). |
| 15 | — | 3 | Added. Decision 3 needs a way for admins to set limits. |
| 16 | — | 2 | Added. Decision 2 needs old carts to actually be deleted (now in Epic 3). |

All other Epic 1 estimates were confirmed without change.

---

# Epic 2: Manage Cart Items

## Step 1: User Story and Acceptance Criteria

**User story:** As a shopper, I want to change quantities or remove items, so that my cart matches what I want.

**Original criteria**

- When I change a quantity, the line total and cart subtotal update immediately.
- When I set a quantity to 0 or tap "Remove," the item leaves the cart.
- I can't set a quantity higher than available stock, and I see a message if I try.

**Full acceptance criteria**

| AC | Criterion |
|---|---|
| AC1 | **Given** an item is in my cart, **when** I change its quantity, **then** the line total and cart subtotal update immediately. |
| AC2 | **Given** an item is in my cart, **when** I set its quantity to 0, **then** the item leaves the cart and the subtotal updates. |
| AC3 | **Given** an item is in my cart, **when** I tap "Remove," **then** the item leaves the cart and the subtotal updates. |
| AC4 | **Given** an item is in my cart, **when** I try to set a quantity higher than available stock, **then** it isn't increased beyond the stock level and I see a message such as "Only X available." |

The original second point is split into AC2 and AC3 because they are two different actions and each is tested on its own.

---

## Step 2: Stories and Points

### Story 11: Change the quantity of a cart item

**Points:** 5 | **Priority:** Must have | **Dependencies:** Stories 1, 6, F6 | **Covers:** AC1

As a shopper, I want to change how many of an item I'm buying, so that my cart reflects the amount I need.

**Acceptance criteria**

- **Given** an item is in my cart, **when** I tap "+" or "−," **then** the quantity changes by 1, and the line total, subtotal, and cart count update immediately.
- **Given** I type a quantity, **when** I confirm it (press Enter or move away from the field), **then** the quantity and totals update.
- **Given** I enter an invalid value (blank, negative, decimal, or text), **when** I confirm it, **then** the quantity goes back to the last valid value and I see "Please enter a whole number."
- **Given** I tap "+" or "−" quickly several times, **when** the changes are saved, **then** the final quantity is correct and no taps are lost or counted twice.
- **Given** the quantity changes, **when** I use a screen reader, **then** the new quantity and subtotal are announced.

**Technical notes:** Update the screen instantly (under 100 ms), then confirm with the server, which has the final say on totals. Changes save automatically with no "Update cart" button (Decision 7). Group rapid taps into one update (300–500 ms). Fire an `update_cart_quantity` event.

---

### Story 12: Remove an item from the cart

**Points:** 5 | **Priority:** Must have | **Dependencies:** Story 1, F6 | **Covers:** AC2, AC3

As a shopper, I want to remove items I no longer want, so that I only buy what I intend to.

**Acceptance criteria**

- **Given** an item is in my cart, **when** I tap "Remove," **then** it leaves the cart and the subtotal and count update.
- **Given** an item is in my cart, **when** I set its quantity to 0, or tap "−" at quantity 1, **then** it leaves the cart (Decision 8).
- **Given** I remove an item, **when** it disappears, **then** I see "Item removed" with an "Undo" option for at least 5 seconds, and Undo restores it if still in stock (Decision 6).
- **Given** I remove the last item, **when** the cart is empty, **then** I see an empty cart message with a link to keep shopping, and checkout is unavailable.
- **Given** I remove an item, **when** I use a screen reader, **then** the removal is announced and focus moves to the next item or the empty cart message.

**Technical notes:** The Undo message must stay long enough for keyboard and screen reader users, and pause while focused. Fire a `remove_from_cart` event with product ID, variant ID, and quantity removed.

---

### Story 13: Prevent quantities above available stock

**Points:** 2 | **Priority:** Must have | **Dependencies:** Stories 4, 11 | **Covers:** AC4

As a shopper, I want to know when I've reached the available stock, so that I don't ask for more than can be supplied.

**Acceptance criteria**

- **Given** the quantity equals available stock, **when** I view the item, **then** the "+" button is disabled and I see "Only X available."
- **Given** I type a quantity above available stock, **when** I confirm it, **then** it is set to the maximum available and I'm told why.
- **Given** a per-order limit or the 99-per-line cap applies, **when** I try to exceed it, **then** the quantity is capped and the limit is explained (Decisions 3 and 9).
- **Given** stock drops while I'm on the cart page, **when** I next change the quantity, **then** the server rejects anything above current stock and shows the new maximum.

**Technical notes:** Reuses the server-side checks from Story 4.

---

### Story 14: Handle cart update failures

**Points:** 5 | **Priority:** Must have | **Dependencies:** Stories 11, 12 | **Covers:** AC1–AC4 (production readiness)

As a shopper, I want clear feedback if a change to my cart fails, so that I know what's really in my cart.

**Acceptance criteria**

- **Given** a network or server error, **when** I change a quantity or remove an item, **then** the cart goes back to its last saved state and I see an error with "Try again."
- **Given** I'm offline, **when** I try to change my cart, **then** I'm told I'm offline and nothing changes.
- **Given** my cart was changed on another device, **when** I update it here, **then** the latest cart loads and I'm told it changed elsewhere.
- **Given** an error happens, **when** it is logged, **then** the log has a request ID and no personal data.

**Technical notes:** Use the cart version number from F6 so the server can detect out-of-date updates.

---

### Epic 2 Summary

| # | Story | Points | Priority | Covers |
|---|---|---|---|---|
| 11 | Change item quantity | 5 | Must | AC1 |
| 12 | Remove an item | 5 | Must | AC2, AC3 |
| 13 | Prevent quantities above stock | 2 | Must | AC4 |
| 14 | Handle update failures | 5 | Must | AC1–AC4 |
| | **Total** | **17** | | |

---

## Step 3: Product Owner Decisions

Decided 24 Sep 2026.

| # | Question | Decision | Why | Alternatives considered |
|---|---|---|---|---|
| 6 | Undo or "Are you sure?" on remove? | Undo message, shown for at least 5 seconds. | Faster for the usual case, still recovers from mistakes. | Confirmation dialog (adds a step to every removal). |
| 7 | Auto-save or "Update cart" button? | Save automatically. | Totals are always right; no forgotten unsaved changes. | "Update cart" button (+2 pts). |
| 8 | What does "−" do at quantity 1? | Removes the item, with Undo. | Matches "quantity 0 removes the item." | Disable the button at 1. |
| 9 | Maximum per line? | 99, with per-product limits on top. | Catches typos like 1000 instead of 10. | No cap beyond stock. |
| 10 | "Saved for later" list? | Not in this epic. Added to future ideas. | Keeps this epic small; it needs its own storage and screens. | Build now (+5–8 pts). |

---

## Step 4: Developer Review

| Story | Before | After | Reason |
|---|---|---|---|
| 11 | 5 | 5 | Confirmed. |
| 12 | 3 | 5 | Undo must re-check stock before restoring, and screen reader focus needs careful testing. |
| 13 | 2 | 2 | Confirmed; reuses Story 4's checks. |
| 14 | 3 | 5 | Detecting changes from another device affects every cart request. |

---

# Epic 3: Save the Cart

## Step 1: User Story and Acceptance Criteria

**User story:** As a shopper, I want my cart saved, so that I don't lose it if I leave.

**Original criteria**

- Given I'm logged in, when I return on any device, my cart is still there.
- Given I'm a guest, my cart persists in the same browser for at least 7 days.

**Full acceptance criteria**

| AC | Criterion |
|---|---|
| AC1 | **Given** I'm logged in, **when** I return on any device, **then** my cart is still there with the same items, options, and quantities. |
| AC2 | **Given** I'm logged in on two devices, **when** I change my cart on one and then open or refresh it on the other, **then** I see the latest version. |
| AC3 | **Given** I'm a guest, **when** I return in the same browser within the retention period, **then** my cart is still there. |
| AC4 | **Given** I'm a guest and the retention period has passed, **when** I return, **then** I see an empty cart instead of an error. |
| AC5 | **Given** I added items as a guest, **when** I log in, **then** those items are kept in my account's cart. |
| AC6 | **Given** I'm logged in, **when** I log out, **then** my cart is no longer visible in that browser. |
| AC7 | **Given** I return to a saved cart, **when** I open it, **then** prices and stock are current and I'm told about any changes. |

The original guest criterion says "at least 7 days." Decision 12 sets 30 days, which meets it.

---

## Step 2: Stories and Points

### Story 7: Keep my cart across visits and devices

**Points:** 3 | **Priority:** Should have | **Dependencies:** Story 1, F5, F6 | **Covers:** AC1, AC2, AC3

As a shopper, I want my cart saved, so that I don't lose it if I leave.

**Acceptance criteria**

- **Given** I'm logged in, **when** I return on any device, **then** my cart has the same items, options, and quantities.
- **Given** I'm logged in on two devices, **when** I change my cart on one, **then** the other shows the latest version when its cart page loads, is refreshed, or I switch back to that tab or app (Decision 11).
- **Given** I'm a guest, **when** I return in the same browser within 30 days of my last activity, **then** my cart is still there (Decision 12).
- **Given** I navigate away, refresh, or close and reopen the app, **when** I come back, **then** my cart and count are unchanged.

**Technical notes:** F6 already saves carts on the server, so this story loads the right cart on return. Guest carts use a secure, HTTP-only cookie that lasts the retention period. The cookie is treated as strictly necessary and listed in the cookie policy (Decision 15).

---

### Story 16: Expire old carts

**Points:** 2 | **Priority:** Should have | **Dependencies:** Story 7 | **Covers:** AC4

As the store owner, I want old carts removed automatically, so that we follow our retention policy.

**Acceptance criteria**

- **Given** a guest cart has had no activity for 30 days, **when** the cleanup job runs, **then** it is deleted.
- **Given** a signed-in cart has had no activity for 12 months, **when** the cleanup job runs, **then** it is deleted.
- **Given** my guest cart has expired, **when** I return, **then** I see an empty cart, not an error.
- **Given** a cart had activity within its retention period, **when** the job runs, **then** it is untouched.
- **Given** the job runs, **when** it finishes, **then** it logs how many carts were removed and alerts me if it fails.

**Technical notes:** Run daily at a quiet time, deleting in batches.

---

### Story 8a: Keep guest items when logging in (basic merge)

**Points:** 5 | **Priority:** Should have | **Dependencies:** Story 7, F5 | **Covers:** AC5

As a shopper, I want items I added as a guest kept when I log in, so that I don't have to add them again.

**Acceptance criteria**

- **Given** I have a guest cart and my account cart is empty, **when** I log in, **then** the guest items move to my account cart.
- **Given** both carts have items, **when** I log in, **then** they are combined, and matching items have their quantities added together (Decision 13).
- **Given** the merge completes, **when** it finishes, **then** the guest cart is deleted so it can't be merged twice.

**Technical notes:** The merge must be all-or-nothing so a failure never loses items.

---

### Story 8b: Keep guest items when logging in (limits)

**Points:** 3 | **Priority:** Should have | **Dependencies:** Stories 8a, 4 | **Covers:** AC5

As a shopper, I want to be told if merging my carts changed any quantities, so that I'm not surprised.

**Acceptance criteria**

- **Given** a combined quantity is more than stock, a per-order limit, or the 99 cap, **when** the merge completes, **then** it is reduced to the allowed maximum.
- **Given** anything was reduced or dropped, **when** the merge completes, **then** I see which items changed and why.

---

### Story 17: Keep my cart private on shared devices

**Points:** 2 | **Priority:** Must have | **Dependencies:** F5, F6 | **Covers:** AC6

As a shopper, I want my cart hidden when I log out, so that other people using the same device can't see what I was buying.

**Acceptance criteria**

- **Given** I'm logged in, **when** I log out, **then** my cart items and count disappear from that browser straight away.
- **Given** I've logged out, **when** someone presses the back button, **then** they don't see my cart page.
- **Given** I've logged out, **when** someone shops as a guest on the same device, **then** they start with an empty cart not linked to my account (Decision 14).
- **Given** I log in again, **when** my cart loads, **then** my items are back.
- **Given** my session expires, **when** the page next loads, **then** my cart is hidden in the same way.

**Technical notes:** Clear cart data cached in the browser on logout, and send "no-store" cache headers on cart pages.

---

### AC7: Saved items rechecked on return

No new story. Covered by **Story 6** (price changes shown to the shopper) and **Story 10** (unavailable items flagged), both in Epic 1.

---

### Epic 3 Summary

| # | Story | Points | Priority | Covers |
|---|---|---|---|---|
| 7 | Keep cart across visits and devices | 3 | Should | AC1, AC2, AC3 |
| 16 | Expire old carts | 2 | Should | AC4 |
| 8a | Keep guest items on login (basic) | 5 | Should | AC5 |
| 8b | Keep guest items on login (limits) | 3 | Should | AC5 |
| 17 | Keep cart private on shared devices | 2 | Must | AC6 |
| 6, 10 | *(in Epic 1)* | — | — | AC7 |
| | **Total** | **15** | | |

Must-have points: **2**. Should-have points: **13**.

---

## Step 3: Product Owner Decisions

Decided 24 Sep 2026.

| # | Question | Decision | Why | Alternatives considered |
|---|---|---|---|---|
| 11 | Live updates across devices, or on refresh? | Update when the cart page loads, is refreshed, or the shopper switches back to that tab or app. | Covers real use (phone, then laptop) without extra infrastructure. | Live updates (+5 pts); checking every few seconds (wasteful). |
| 12 | How long are guest carts kept? | 30 days from last activity (confirms Decision 2). | Meets "at least 7 days" and covers shoppers who take weeks to decide. | Exactly 7 days; 90 days. |
| 13 | Guest and account carts both have items at login? | Combine them, adding quantities for matching items. | Nothing the shopper chose is lost. | Replace the account cart (loses items); ask each time (+3 pts). |
| 14 | Keep items on the device as a guest cart after logout? | No. The device starts empty; items return on next login. | Protects privacy on shared devices. | Keep a guest copy (visible to anyone on the device). |
| 15 | Does the guest cart cookie need consent? | Treat it as strictly necessary and list it in the cookie policy. | The cart can't work without it. | Ask for consent first. Rules vary by country, so confirm with someone who knows privacy law where you sell. |

---

## Step 4: Developer Review

| Story | Before | After | Reason |
|---|---|---|---|
| 7 | 5 | 3 | F6 already stores carts on the server. Decision 11's "switch back to tab" check is small and fits in 3. |
| 16 | 2 | 2 | Confirmed. Added the expired-guest case (AC4); the server simply starts a new empty cart. |
| 8a | 5 | 5 | Confirmed. Added deleting the guest cart after merging, so a retry can't merge it twice. |
| 8b | 3 | 3 | Confirmed. |
| 17 | — | 2 | New. **Dependency fixed:** first depended on Story 7 (should-have), which would block a must-have. It only needs F5 and F6, so it can ship in the first release. |

**Planning note:** AC7 relies on Story 10, a should-have. That's fine, because shoppers only return to a saved cart once Story 7 ships, and Stories 7 and 10 are planned for the same sprint.

---

# Epic 4: Checkout and Payment

## Step 1: User Story and Acceptance Criteria

**User story:** As a shopper, I want to pay securely by card, so that I can complete my purchase.

**Original criteria**

- Given valid card details, when I submit payment, the order is created and I see a confirmation.
- Given a declined card, I see a clear error and my cart is unchanged.
- Card details are handled by the payment provider and never stored on our servers.

**Full acceptance criteria**

| AC | Criterion |
|---|---|
| AC1 | **Given** valid card details, **when** I submit payment, **then** the order is created, I see a confirmation with an order number, and my cart is emptied. |
| AC2 | **Given** my card is declined, **when** I submit payment, **then** I see a clear error, my cart is unchanged, and I can try again or use another card. |
| AC3 | **Given** I enter my card details, **when** I submit payment, **then** they go directly to the payment provider and are never stored on, or passed through, our servers. |
| AC4 | **Given** my bank asks me to verify the payment, **when** I complete it, **then** the payment goes ahead; if I cancel or fail it, it's treated as declined. |
| AC5 | **Given** I'm about to pay, **when** I submit payment, **then** prices and stock are rechecked first, and I'm told about any changes before I'm charged. |
| AC6 | **Given** I tap "Pay" more than once or retry after a dropped connection, **when** the payment is processed, **then** I'm charged once and one order is created. |
| AC7 | **Given** the payment succeeds but something fails before I see the confirmation, **when** it's resolved, **then** my order is still created, or I'm refunded automatically. |
| AC8 | **Given** my order is created, **when** payment succeeds, **then** I receive an email with the order number, items, and total paid. |
| AC9 | **Given** my payment succeeds, **when** the order is created, **then** stock for each item is reduced. |

**Gap found:** To charge the right amount, the store also needs a delivery address, delivery cost, and taxes. Stories 18, 19, and 28 cover this.

---

## Step 2: Stories and Points

### Spike P1: Choose and set up the payment provider

**Points:** 2 | **Priority:** Must have | **Dependencies:** None | **Covers:** Decision 16

As the store owner, I want the right payment provider chosen and my account ready, so that payment work can start without delays.

**Acceptance criteria**

- **Given** candidate providers (such as Paystack, Flutterwave, and Hubtel), **when** they're compared, **then** fees, supported cards and mobile money networks, USD support, payout speed, and API quality are recorded side by side.
- **Given** the comparison, **when** a provider is chosen, **then** the reason is recorded in Decision 16.
- **Given** a provider is chosen, **when** the spike ends, **then** the business account is open and test keys work.

**Technical notes:** Start before Sprint 1. Opening a business account can take weeks, and most of the work is paperwork rather than coding.

---

### Story 18: Enter a delivery address

**Points:** 3 | **Priority:** Must have | **Dependencies:** F6 | **Covers:** Gap

As a shopper, I want to enter where my order should be delivered, so that it reaches me.

**Acceptance criteria**

- **Given** I start checkout, **when** I enter my name, address, and phone number, **then** they're saved to this checkout.
- **Given** I'm checking out as a guest, **when** I start checkout, **then** I'm asked for my email address, and creating an account is optional (Decision 17).
- **Given** I leave a required field empty or enter something invalid, **when** I continue, **then** I see which field needs fixing and can't move on.
- **Given** I'm logged in and have ordered before, **when** I start checkout, **then** my last address is filled in for me.

---

### Story 19: See delivery cost and full order total

**Points:** 5 | **Priority:** Must have | **Dependencies:** Stories 6, 18, 28 | **Covers:** Gap

As a shopper, I want to see the full amount before I pay, so that there are no surprises.

**Acceptance criteria**

- **Given** I've entered my address, **when** I view the order summary, **then** I see the items, subtotal, delivery cost, and total, with prices including all taxes (Decision 19).
- **Given** my address is in a delivery zone, **when** the summary loads, **then** that zone's delivery price is used (Decision 18).
- **Given** my address isn't in any delivery zone, **when** I continue, **then** I'm told it can't be delivered to and can't pay.

**Technical notes:** The server calculates every amount.

---

### Story 20: Connect the payment provider

**Points:** 3 | **Priority:** Must have | **Dependencies:** Spike P1, F1 | **Covers:** AC3

As the developer, I want the payment provider connected safely, so that the store can take card and mobile money payments without handling card details.

**Acceptance criteria**

- **Given** the store runs in staging, **when** a payment is made, **then** it uses the provider's test mode and no real money moves.
- **Given** the store runs in production, **when** a payment is made, **then** it uses live mode with keys stored in environment configuration, never in code.
- **Given** the provider sends a message to our server (a "webhook"), **when** it arrives, **then** its signature is checked and fake messages are rejected.

**Technical notes:** This connection covers both cards and mobile money, so Epic 6 reuses it.

---

### Story 21: Pay by card

**Points:** 5 | **Priority:** Must have | **Dependencies:** Stories 19, 20 | **Covers:** AC1, AC3, AC4

As a shopper, I want to pay by card, so that I can complete my purchase.

**Acceptance criteria**

- **Given** I'm on the payment step, **when** I enter my card details, **then** they go into the provider's secure fields or page and never reach our servers.
- **Given** valid card details, **when** I tap "Pay," **then** I'm charged the total shown, in the currency shown, and taken to the confirmation page.
- **Given** my bank asks for extra verification, **when** I complete it, **then** the payment continues; if I cancel or fail it, it's treated as declined.
- **Given** payment is in progress, **when** I wait, **then** I see a loading state and the "Pay" button is disabled.

**Technical notes:** Use the provider's built-in bank verification. GHS payments can be built first; USD payments depend on Epic 5. Fire a `purchase` analytics event.

---

### Story 22: Handle declined payments

**Points:** 2 | **Priority:** Must have | **Dependencies:** Story 21 | **Covers:** AC2

As a shopper, I want a clear message if my payment fails, so that I can fix it and try again.

**Acceptance criteria**

- **Given** my card is declined, **when** I submit payment, **then** I see a clear, general message such as "Your card was declined. Please try another card," and no order is created.
- **Given** a payment fails, **when** I look at my cart, **then** it is unchanged.
- **Given** a payment fails, **when** I try again, **then** I can use the same or another card without re-entering my address.

**Technical notes:** Show general messages only; specific bank reasons can help fraudsters.

---

### Story 23: Recheck prices and stock before charging

**Points:** 3 | **Priority:** Must have | **Dependencies:** Stories 4, 6, 21 | **Covers:** AC5

As a shopper, I want to be told about changes before I'm charged, so that I only pay for what I expect.

**Acceptance criteria**

- **Given** a price changed since I started checkout, **when** I tap "Pay," **then** I'm not charged and I'm shown the new total to confirm.
- **Given** an item sold out or has less stock than I ordered, **when** I tap "Pay," **then** I'm not charged and I'm told which items changed.
- **Given** nothing changed, **when** I tap "Pay," **then** payment goes ahead normally.

---

### Story 24: Prevent double charges

**Points:** 3 | **Priority:** Must have | **Dependencies:** Story 21 | **Covers:** AC6

As a shopper, I want to be charged only once, so that I don't pay twice for the same order.

**Acceptance criteria**

- **Given** I tap "Pay" more than once, **when** the payment is processed, **then** I'm charged once and one order is created.
- **Given** my connection drops and I retry, **when** the payment already went through, **then** I'm shown my existing order instead of being charged again.

**Technical notes:** Give each checkout a unique reference and pass it to the provider so repeated requests are recognised.

---

### Story 25: Create the order and reduce stock

**Points:** 5 | **Priority:** Must have | **Dependencies:** Stories 21, F4 | **Covers:** AC1, AC9

As the store owner, I want an order recorded for every successful payment, so that I know what to deliver.

**Acceptance criteria**

- **Given** a payment succeeds, **when** the order is created, **then** it records the items, prices paid, address, delivery option, total, currency charged, exchange rate used (if any), and payment reference.
- **Given** the order is created, **when** it's saved, **then** stock is reduced and the shopper's cart is emptied, all together or not at all.
- **Given** the order is saved, **when** it's viewed later, **then** it shows the prices actually paid, even if product prices change afterwards.

---

### Story 26: Recover from interrupted payments

**Points:** 5 | **Priority:** Must have | **Dependencies:** Stories 20, 25 | **Covers:** AC7

As a shopper, I want my order to be safe even if something goes wrong after I pay, so that I'm never charged without getting my order.

**Acceptance criteria**

- **Given** the payment succeeded but my browser closed or lost connection, **when** the provider confirms the payment, **then** the order is still created.
- **Given** the payment succeeded but an item sold out in the meantime, **when** the order can't be completed, **then** the payment is refunded automatically, in the currency charged, and I'm emailed to explain.
- **Given** a payment and an order don't match up, **when** a daily check runs, **then** I'm alerted so I can fix it.

**Technical notes:** The provider's confirmation message (webhook) is the source of truth, not the browser. Cards and mobile money share the same confirmations, so Epic 6 reuses this story. If the provider can't refund automatically, you're alerted and refund manually, then record it with Story 42 (Decision 32).

---

### Story 28: Set delivery zones and tax rates (admin)

**Points:** 3 | **Priority:** Must have | **Dependencies:** F5 | **Covers:** Decisions 18, 19

As the store owner, I want to set delivery prices by zone and the tax rates, so that checkout totals are correct.

**Acceptance criteria**

- **Given** I'm in the admin area, **when** I create a delivery zone with its areas and price, **then** it's saved and used at checkout.
- **Given** I set the tax rates, **when** I save them, **then** they're used to calculate prices that include tax.
- **Given** I enter an invalid price or rate, **when** I save, **then** I see an error and nothing is saved.
- **Given** I change a zone or rate, **when** shoppers check out afterwards, **then** the new values apply; past orders are unchanged.

---

### Story 29: View orders (admin)

**Points:** 3 | **Priority:** Must have | **Dependencies:** Story 25, F5 | **Covers:** Gap

As the store owner, I want to see my orders, so that I can deliver them.

**Acceptance criteria**

- **Given** I'm in the admin area, **when** I open the orders page, **then** I see a list of orders, newest first, with order number, date, customer, total, and payment status.
- **Given** I open an order, **when** its page loads, **then** I see the items, quantities, prices paid, delivery address, contact details, payment method (card or mobile money, with the number partly hidden), and payment reference.
- **Given** I'm not an admin, **when** I try to open the orders page, **then** I'm refused.

**Technical notes:** Order statuses and customer order history are covered by Epic 9.

---

### Epic 4 Summary

| # | Story | Points | Priority | Covers |
|---|---|---|---|---|
| P1 | Choose and set up the payment provider | 2 | Must | Decision 16 |
| 18 | Enter a delivery address | 3 | Must | Gap |
| 19 | Delivery cost and full total | 5 | Must | Gap |
| 20 | Connect the payment provider | 3 | Must | AC3 |
| 21 | Pay by card | 5 | Must | AC1, AC3, AC4 |
| 22 | Handle declined payments | 2 | Must | AC2 |
| 23 | Recheck prices and stock | 3 | Must | AC5 |
| 24 | Prevent double charges | 3 | Must | AC6 |
| 25 | Create the order and reduce stock | 5 | Must | AC1, AC9 |
| 26 | Recover from interrupted payments | 5 | Must | AC7 |
| 28 | Delivery zones and tax rates (admin) | 3 | Must | Decisions 18, 19 |
| 29 | View orders (admin) | 3 | Must | Gap |
| | **Total** | **42** | | |

Story 27 (confirmation page and email) moved to Epic 7 when User Story 7 was added.

Every story is a must-have, because the store can't safely take money or deliver orders without them.

---

## Step 3: Product Owner Decisions

Decided 25 Sep 2026.

| # | Question | Decision | Why | Alternatives considered |
|---|---|---|---|---|
| 16 | Which payment provider? | One local provider for both cards and mobile money (such as Paystack, Flutterwave, or Hubtel), chosen in Spike P1. | One integration, settles in GHS, supports mobile money. | PayPal for cards plus a local provider for mobile money (two integrations; PayPal doesn't list GHS as a supported currency). PayPal may be added later as an extra option. |
| 17 | Can guests check out without an account? | Yes, with an email address. Creating an account is optional. | Forcing sign-up loses sales. | Require an account. |
| 18 | How is delivery priced? | Flat rate per delivery zone, set by the admin. | Simple to understand and manage. | Price by weight or distance (more complex). |
| 19 | How are taxes shown? | Prices include all taxes, with rates set by the admin. | Shoppers see the final price upfront. | Add tax at checkout. Confirm rates and VAT registration with an accountant. |
| 20 | Which currency is charged? | GHS by default. USD charging depends on the chosen provider; full rules in Epic 5. | The charged amount must always match what checkout displayed. | — |

---

## Step 4: Developer Review

| Story | Before | After | Reason |
|---|---|---|---|
| P1 | — | 2 | New. Choosing a provider and opening the account must happen before any payment work. |
| 18 | 3 | 3 | Added the guest email field (Decision 17). |
| 20 | 3 | 3 | Covers cards and mobile money together. |
| 21 | 5 | 5 | GHS first; USD depends on Epic 5. |
| 25 | 5 | 5 | Now records currency and exchange rate. |
| 26 | 5 | 5 | Built to work for any payment method, so Epic 6 reuses it. |
| 28 | — | 3 | New. Decisions 18 and 19 need a way to set zones and rates. |
| 29 | — | 3 | New. The store owner needs to see orders to deliver them. |

Stories 19, 22, 23, and 24 were confirmed without change. Story 27 later moved to Epic 7. **Biggest risk:** Spike P1. Start it early.

---

# Epic 5: Prices in My Currency

## Step 1: User Story and Acceptance Criteria

**User story:** As an international shopper, I want to see prices in my currency, so that I understand the cost.

**Original criteria**

- Prices show in GHS by default, with USD available, and the total I'm charged matches what checkout displayed.

**Full acceptance criteria**

| AC | Criterion |
|---|---|
| AC1 | **Given** I visit for the first time, **when** any page loads, **then** all prices are shown in GHS. |
| AC2 | **Given** I'm viewing GHS, **when** I choose USD from the currency selector, **then** every price in the store updates to USD. |
| AC3 | **Given** I've chosen USD, **when** I move between pages or come back later on the same device, **then** prices stay in USD until I change it. |
| AC4 | **Given** prices are shown, **when** I read them, **then** the currency is unmistakable ("GH₵ 250.00", "US$ 16.50"), never a plain "$". |
| AC5 | **Given** prices are in USD, **when** I view my cart or checkout, **then** line totals, subtotal, delivery, and total add up exactly. |
| AC6 | **Given** checkout shows a total, **when** I pay, **then** I'm charged exactly that amount in that currency. |
| AC7 | **Given** I've started checkout in USD, **when** the exchange rate changes, **then** my total stays the same for a set time, after which the new total is shown before I can pay. |
| AC8 | **Given** I'm viewing USD and choose a payment method that only charges in GHS, **when** I reach the payment step, **then** I'm shown the GHS amount I'll be charged before I pay. |
| AC9 | **Given** my order is created, **when** I view the confirmation page or email, **then** it shows the currency and amount I was actually charged. |
| AC10 | **Given** the store can't get an up-to-date rate, **when** the last rate becomes too old, **then** USD is temporarily hidden and prices show in GHS. |

This epic replaces the currency part of Decision 5. AC6 depends on the payment provider supporting USD charges (Spike P1); if it doesn't, shoppers are charged in GHS with USD shown only as a guide.

---

## Step 2: Stories and Points

### Story 30: Get and store exchange rates

**Points:** 3 | **Priority:** Could have | **Dependencies:** F1 | **Covers:** AC10

As the store owner, I want up-to-date exchange rates saved automatically, so that USD prices are accurate.

**Acceptance criteria**

- **Given** the rate job runs every hour (Decision 22), **when** it gets a new GHS–USD rate, **then** the rate is saved with the time it was fetched.
- **Given** the rate source fails, **when** the job runs, **then** the last known rate is kept, the failure is logged, and I'm alerted.
- **Given** the last rate is more than 24 hours old, **when** prices are requested, **then** the rate is marked as too old to use.
- **Given** rates are saved, **when** I look back, **then** every past rate is still available, so old orders can be checked.

**Technical notes:** Rates come from a reliable exchange rate service, spot-checked against Bank of Ghana published rates (Decision 21).

---

### Story 36: Set the USD price buffer (admin)

**Points:** 2 | **Priority:** Could have | **Dependencies:** Story 30, F5 | **Covers:** Decision 24

As the store owner, I want to set a small buffer on USD prices, so that conversion fees and rate changes don't cost me money.

**Acceptance criteria**

- **Given** I'm in the admin area, **when** I set the buffer percentage and save, **then** it's applied to all USD prices from then on.
- **Given** no buffer has been changed, **when** USD prices are calculated, **then** the default of 2% is used.
- **Given** I enter an invalid value (negative, above 10%, or text), **when** I save, **then** I see an error and nothing is saved.
- **Given** I change the buffer, **when** it's saved, **then** the change is logged, and checkouts already in progress keep their fixed rate.

---

### Story 31: Choose my currency

**Points:** 3 | **Priority:** Could have | **Dependencies:** Story 30, F5, F6 | **Covers:** AC1, AC2, AC3, AC10

As a shopper, I want to choose between GHS and USD, so that I see prices in the currency I understand.

**Acceptance criteria**

- **Given** I visit for the first time, **when** any page loads, **then** prices are in GHS, wherever I'm visiting from (Decision 27).
- **Given** I choose USD from the selector in the header, **when** I make the choice, **then** every price on the page updates without me losing my place.
- **Given** I've chosen USD, **when** I move between pages or return later on the same device, **then** USD stays selected; if I'm logged in, it's also saved to my account.
- **Given** the rate is too old to use, **when** a page loads, **then** USD is hidden from the selector and prices show in GHS, with a short note if I had chosen USD.

---

### Story 32: Show prices in my chosen currency

**Points:** 5 | **Priority:** Could have | **Dependencies:** Stories 6, 31, 36, F3 | **Covers:** AC2, AC4, AC5

As a shopper, I want every price shown in my chosen currency, so that I understand the cost everywhere in the store.

**Acceptance criteria**

- **Given** I've chosen a currency, **when** I view the product list, product page, cart, or checkout, **then** every price is in that currency.
- **Given** prices are shown, **when** I read them, **then** they're labelled "GH₵" or "US$," never a plain "$."
- **Given** prices are in USD, **when** I view the cart or checkout, **then** line totals, subtotal, delivery, and total add up exactly, rounded to the cent (Decision 25).
- **Given** a GHS price, **when** it's converted, **then** the server does the conversion, including the buffer, and the browser never calculates prices.

**Technical notes:** Convert and round each unit price first, then multiply by quantity and add, so totals always add up.

---

### Story 33: Fix the exchange rate during checkout

**Points:** 3 | **Priority:** Could have | **Dependencies:** Stories 19, 32 | **Covers:** AC7

As a shopper, I want my total to stay the same while I pay, so that I'm not caught out by rate changes.

**Acceptance criteria**

- **Given** I start checkout in USD, **when** my total is calculated, **then** the rate is fixed for 30 minutes (Decision 23).
- **Given** the rate changes during checkout, **when** I pay within 30 minutes, **then** I pay the total I was shown.
- **Given** 30 minutes have passed, **when** I try to pay, **then** my total is recalculated and shown to me before I can pay.

**Technical notes:** Uses the same "show changes before charging" flow as Story 23.

---

### Story 34: Charge in the currency shown

**Points:** 3 | **Priority:** Could have | **Dependencies:** Stories 21, 33, Spike P1 | **Covers:** AC6, AC8

As a shopper, I want to be charged exactly what checkout showed, so that there are no surprises on my statement.

**Acceptance criteria**

- **Given** checkout shows a total, **when** I pay by a method that supports that currency, **then** I'm charged exactly that amount in that currency.
- **Given** I'm viewing USD and choose a method that only charges in GHS (such as mobile money), **when** I reach the payment step, **then** I'm clearly shown the GHS amount before I pay.
- **Given** the provider can't charge in USD at all, **when** I pay, **then** I'm always shown and charged the GHS amount, with USD shown only as a guide.

**Technical notes:** Add the currency to the `purchase` analytics event.

---

### Story 35: Show the currency paid on orders

**Points:** 2 | **Priority:** Could have | **Dependencies:** Stories 25, 27, 29, 34 | **Covers:** AC9

As a shopper, I want my order to show exactly what I paid, so that it matches my bank or mobile money statement.

**Acceptance criteria**

- **Given** my order is created, **when** I view the confirmation page or email, **then** it shows the currency and amount I was charged.
- **Given** an order was paid in USD, **when** it's viewed in the admin area, **then** it shows the USD amount, the rate used, and the GHS equivalent.
- **Given** an order is refunded, **when** the refund is made, **then** it's in the currency and amount originally charged.

---

### Epic 5 Summary

| # | Story | Points | Priority | Covers |
|---|---|---|---|---|
| 30 | Get and store exchange rates | 3 | Could | AC10 |
| 36 | Set the USD price buffer (admin) | 2 | Could | Decision 24 |
| 31 | Choose my currency | 3 | Could | AC1, AC2, AC3, AC10 |
| 32 | Show prices in my chosen currency | 5 | Could | AC2, AC4, AC5 |
| 33 | Fix the exchange rate during checkout | 3 | Could | AC7 |
| 34 | Charge in the currency shown | 3 | Could | AC6, AC8 |
| 35 | Show the currency paid on orders | 2 | Could | AC9 |
| | **Total** | **21** | | |

All stories are could-haves, planned for a later release once there's evidence of demand (Decision 26). GHS, the default, works from day one.

---

## Step 3: Product Owner Decisions

Decided 25 Sep 2026.

| # | Question | Decision | Why | Alternatives considered |
|---|---|---|---|---|
| 21 | Where do exchange rates come from? | A reliable exchange rate service, spot-checked against Bank of Ghana published rates. | Automatic, with a check against a faulty source. | Entering rates by hand. |
| 22 | How often do rates update, and when is a rate too old? | Every hour. Older than 24 hours is too old, and USD is hidden. | Keeps USD close to the real rate while tolerating short outages. | Daily updates; a shorter cut-off. |
| 23 | How long is the rate fixed during checkout? | 30 minutes. | Enough time to pay, while limiting rate risk. | 15 or 60 minutes. |
| 24 | Should USD prices include a buffer? | Yes, 2% by default, adjustable by the admin. Finalise after Spike P1 shows real fees. | Covers conversion fees and cedi movement. | No buffer; a larger buffer. |
| 25 | How are USD prices rounded? | Exact to the cent. | Simple, honest, totals add up. | "Nice" prices like US$ 16.99. |
| 26 | When should USD be added? | Later, not straight after the first release. USD is a could-have, reviewed about 3 months after launch, and built once there's evidence of demand (for example, international visitors in analytics, or customer requests). Updated 25 Sep 2026. | Most early customers pay in GHS, so effort goes to local needs first; real data shows whether USD is worth building. | Keep USD as a must-have; release it straight after the first release (the original version of this decision). |
| 27 | Switch to USD automatically for visitors outside Ghana? | No. Everyone starts in GHS and can switch in one tap. | Simple and never guesses wrong. | Switch by location (later improvement). |

---

## Step 4: Developer Review

| Story | Before | After | Reason |
|---|---|---|---|
| 30 | 3 | 3 | Confirmed. |
| 36 | — | 2 | New. Decision 24 needs an admin setting for the buffer; split out rather than growing Story 30. |
| 31 | 3 | 3 | Confirmed. **Dependency added:** F5, because the choice is saved to the shopper's account. |
| 32 | 5 | 5 | Confirmed. **Dependency added:** Story 36, because conversion includes the buffer. |
| 33 | 3 | 3 | Confirmed. |
| 34 | 3 | 3 | Confirmed. May shrink if Spike P1 shows the provider can't charge in USD, since only the "GHS as a guide" case would be built. |
| 35 | 2 | 2 | Confirmed. |

**Dependency check:** Every Epic 5 story depends only on must-have stories or on other Epic 5 stories, so moving USD to a later release doesn't block anything else.

---

# Epic 6: Pay with Mobile Money

## Step 1: User Story and Acceptance Criteria

**User story:** As a local shopper, I want to pay with mobile money, so that I don't need a card.

**Original criteria**

- When I choose mobile money and enter my number, I get a prompt on my phone, and the order is confirmed once I approve it.
- If I don't approve within the time limit, the order stays unpaid and I can retry.

**Full acceptance criteria**

| AC | Criterion |
|---|---|
| AC1 | **Given** I'm on the payment step, **when** I choose mobile money, **then** I can pick my network (from those the provider supports) and enter my phone number. |
| AC2 | **Given** I enter a phone number, **when** it isn't a valid Ghanaian number for that network, **then** I see a clear message and no prompt is sent. |
| AC3 | **Given** I submit a valid number, **when** the request is sent, **then** I get a prompt on my phone, and the screen tells me to check my phone, showing the GHS amount and how long I have. |
| AC4 | **Given** I approve the prompt, **when** the payment is confirmed, **then** the order is created, I see the confirmation page, I get an email, and my cart is emptied. |
| AC5 | **Given** I don't approve within the time limit, **when** it runs out, **then** I'm not charged, my checkout stays unpaid, my cart is unchanged, and I can try again. |
| AC6 | **Given** I reject the prompt, enter the wrong PIN, or don't have enough money, **when** the payment fails, **then** I see a clear message, my cart is unchanged, and I can try again or choose another method. |
| AC7 | **Given** I retried after a timeout, **when** I approve both the old and the new prompt, **then** I'm charged only once; any extra payment is refunded automatically. |
| AC8 | **Given** I approve the prompt but close the page or lose connection, **when** the provider confirms the payment, **then** my order is still created and I get the email. |
| AC9 | **Given** my network needs an extra step (such as a code or menu), **when** I choose it, **then** I see clear instructions for that network. |

Most of this epic reuses Epic 4: Stories 20 (provider connection), 23 (recheck prices and stock), 24 (no double charges), 25 (create the order), 26 (recovery), and 27 (confirmation).

---

## Step 2: Stories and Points

### Story 37: Choose mobile money and enter my number

**Points:** 3 | **Priority:** Must have | **Dependencies:** Stories 19, 20 | **Covers:** AC1, AC2, AC9

As a local shopper, I want to choose mobile money and enter my number, so that I can pay without a card.

**Acceptance criteria**

- **Given** I'm on the payment step, **when** I choose mobile money, **then** I can pick my network from those the provider supports and enter my phone number.
- **Given** I enter a number, **when** it isn't a valid Ghanaian number for the chosen network, **then** I see a clear message and no prompt is sent.
- **Given** my network needs an extra step (such as a code or menu), **when** I choose it, **then** I see clear instructions for that network.
- **Given** I'm logged in and have paid by mobile money before, **when** I choose mobile money, **then** my last number and network are filled in (Decision 33). Guests enter them each time.

**Technical notes:** Show the number partly hidden (for example, 024 ••• ••67) on screens, emails, and in the admin area.

---

### Story 38: Send the payment prompt and wait for approval

**Points:** 5 | **Priority:** Must have | **Dependencies:** Stories 23, 24, 25, 27, 37 | **Covers:** AC3, AC4

As a local shopper, I want a prompt on my phone to approve the payment, so that I can pay securely with my PIN.

**Acceptance criteria**

- **Given** I submit a valid number, **when** prices and stock have been rechecked, **then** a prompt is sent to my phone for the exact GHS total.
- **Given** the prompt is sent, **when** I'm waiting, **then** the screen shows "Awaiting payment: check your phone to approve," the amount, and a countdown based on the provider's time limit (Decisions 29, 30), and the "Pay" button is disabled.
- **Given** I approve the prompt, **when** the provider confirms it, **then** the page moves to the confirmation page automatically, and the order is created with a confirmation email.
- **Given** I'm waiting, **when** I use a screen reader, **then** the waiting message and any status change are announced.

**Technical notes:** The provider's confirmation message (webhook) decides whether the payment succeeded; the waiting page only checks for updates. No order exists until payment succeeds (Decision 29). Use the provider's test numbers to test approval, rejection, and timeout in staging. Fire the `purchase` event with payment method "mobile money."

---

### Story 39: Handle time-outs and retries

**Points:** 3 | **Priority:** Must have | **Dependencies:** Story 38 | **Covers:** AC5

As a local shopper, I want to try again if I miss the prompt, so that I can still complete my purchase.

**Acceptance criteria**

- **Given** I don't approve within the time limit, **when** it runs out, **then** I'm not charged, I'm told the request timed out, and my cart is unchanged.
- **Given** the request timed out, **when** I tap "Try again," **then** a new prompt is sent without re-entering my address or number.
- **Given** the request timed out, **when** I'd rather pay another way, **then** I can switch to card.

---

### Story 40: Handle rejected mobile money payments

**Points:** 2 | **Priority:** Must have | **Dependencies:** Story 38 | **Covers:** AC6

As a local shopper, I want a clear message if my payment fails, so that I know what to do next.

**Acceptance criteria**

- **Given** I reject the prompt, **when** the provider reports it, **then** I see "You declined the payment" and can try again.
- **Given** I enter the wrong PIN or don't have enough money, **when** the payment fails, **then** I see a specific message, such as "Not enough money in your mobile money account" (Decision 34), and can try again or choose another method.
- **Given** any failure, **when** I look at my cart, **then** it is unchanged and no order is created.

---

### Story 41: Handle late approvals and duplicate payments

**Points:** 5 | **Priority:** Must have | **Dependencies:** Stories 26, 39 | **Covers:** AC7

As a local shopper, I want to be charged only once even if I approve an old prompt, so that I never pay twice.

**Acceptance criteria**

- **Given** I approve a prompt after it timed out, and I haven't paid another way, **when** the provider confirms it, **then** my order is created if prices and stock are still valid; otherwise I'm refunded and told why (Decision 31).
- **Given** I approve both an old and a new prompt, **when** both payments arrive, **then** only one order is created and the extra payment is refunded.
- **Given** a refund is needed, **when** the provider supports automatic refunds, **then** it's made automatically; otherwise I'm alerted to refund manually within 2 business days (Decision 32).
- **Given** a refund is made, **when** it's processed, **then** the shopper gets an email explaining it.

---

### Story 42: Record manual refunds (admin)

**Points:** 2 | **Priority:** Must have | **Dependencies:** Story 29 | **Covers:** Decision 32

As the store owner, I want to record refunds I made by hand, so that orders show the right status.

**Acceptance criteria**

- **Given** I've refunded a payment in the provider's dashboard, **when** I mark it as refunded in the admin area with the amount and reference, **then** it's saved on the order or payment.
- **Given** a refund is recorded, **when** it's saved, **then** the shopper gets a refund email.
- **Given** a manual refund is waiting, **when** 2 business days pass without it being recorded, **then** I'm reminded.
- **Given** I record a refund, **when** it's saved, **then** it's logged with who recorded it and when.

**Technical notes:** Works for card and mobile money refunds.

---

### Already covered by Epic 4

| AC or need | Covered by |
|---|---|
| AC8: closing the page after approving | Story 26 (recover from interrupted payments) |
| Repeated taps on "Pay" | Story 24 (prevent double charges) |
| Prices and stock rechecked before the prompt | Story 23 |
| Provider connection for mobile money | Story 20 |

---

### Epic 6 Summary

| # | Story | Points | Priority | Covers |
|---|---|---|---|---|
| 37 | Choose mobile money and enter my number | 3 | Must | AC1, AC2, AC9 |
| 38 | Send the prompt and wait for approval | 5 | Must | AC3, AC4 |
| 39 | Handle time-outs and retries | 3 | Must | AC5 |
| 40 | Handle rejected payments | 2 | Must | AC6 |
| 41 | Handle late approvals and duplicates | 5 | Must | AC7 |
| 42 | Record manual refunds (admin) | 2 | Must | Decision 32 |
| 26 | *(Epic 4)* | — | — | AC8 |
| | **Total** | **20** | | |

---

## Step 3: Product Owner Decisions

Decided 25 Sep 2026.

| # | Question | Decision | Why | Alternatives considered |
|---|---|---|---|---|
| 28 | Is mobile money in the first release? | Yes, it's a must-have. | Many Ghanaian shoppers pay by mobile money and don't have a card. | Add shortly after launch; launch with mobile money only. |
| 29 | Pending order or unpaid checkout while waiting? | Unpaid checkout. The shopper sees "Awaiting payment" and can retry; an order is created only when payment succeeds. | Clean order list, matches card payments, doesn't hold stock. | Pending orders (+2 pts). |
| 30 | How long is the time limit? | The provider's or network's limit, confirmed in Spike P1, shown as a countdown. | The network controls how long the prompt stays open. | Our own shorter limit. |
| 31 | Approval after the time limit? | Create the order if prices and stock are still valid; otherwise refund. | The shopper clearly meant to pay. | Always refund late approvals. |
| 32 | Are refunds automatic? | Automatic where the provider supports it; otherwise you're alerted and refund manually within 2 business days. | Protects shoppers either way. | Always manual. |
| 33 | Remember the mobile money number? | Yes, for logged-in shoppers only, always partly hidden. | Faster repeat purchases, safe on shared devices. | Never; for guests too. |
| 34 | How specific are failure messages? | Specific for mobile money (for example, "not enough money," "wrong PIN"). | Shoppers can fix these themselves. | General, like cards. |

---

## Step 4: Developer Review

| Story | Before | After | Reason |
|---|---|---|---|
| 37 | 3 | 3 | Confirmed. Includes remembering the number for logged-in shoppers. |
| 38 | 5 | 5 | Confirmed. **Dependencies added:** Stories 25 and 27, because success creates the order and sends the email. |
| 39 | 3 | 3 | Confirmed. |
| 40 | 2 | 2 | Confirmed. |
| 41 | 5 | 5 | Confirmed. The manual refund fallback moved into its own story. |
| 42 | — | 2 | New. Decision 32's manual refunds need a way to record them, and the same applies to card refunds in Story 26. |

**Also updated in Epic 4:** Story 29 (view orders) now shows the payment method, and Story 26 points to Story 42 for manual refunds.

**Checks for Spike P1:** Which networks the provider supports, the prompt time limit, whether automatic mobile money refunds are available, and test numbers for staging.

---

# Epic 7: Order Confirmation

## Step 1: User Story and Acceptance Criteria

**User story:** As a shopper, I want an order confirmation, so that I know my purchase went through.

**Original criteria**

- After successful payment, I see an order number on screen and receive a confirmation email within 5 minutes.

**Full acceptance criteria**

| AC | Criterion |
|---|---|
| AC1 | **Given** my payment succeeds (card or mobile money), **when** the confirmation page loads, **then** I see my order number, items, delivery address, and total paid. |
| AC2 | **Given** my payment succeeds, **when** my order is created, **then** a confirmation email is sent within 5 minutes. |
| AC3 | **Given** I open the email, **when** it loads, **then** it shows the order number, items and quantities, prices paid, delivery address, delivery cost, total and currency, payment method (partly hidden), and how to contact the store. |
| AC4 | **Given** my payment succeeded but I closed the page, **when** the order is created from the provider's confirmation, **then** I still get the email within 5 minutes. |
| AC5 | **Given** I'm on the confirmation page, **when** I refresh it or return with the same link, **then** I see the same order and no new order is created. |
| AC6 | **Given** someone else gets or guesses the link, **when** they open it, **then** they can't see my order. |
| AC7 | **Given** the store sends an email, **when** it arrives, **then** it comes from the store's own address and is set up to avoid spam folders. |
| AC8 | **Given** I don't see the email, **when** I tap "Resend confirmation email," **then** it's sent again, with a limit on how often. |
| AC9 | **Given** an email fails or isn't sent within 5 minutes, **when** that happens, **then** it's retried and the store owner is alerted, while the order stays valid. |
| AC10 | **Given** I open the email on a phone or in an app that blocks images, **when** it loads, **then** it's still easy to read. |

Story 27 moved here from Epic 4, since it already covered part of this user story.

---

## Step 2: Stories and Points

### Story 27: Order confirmation page and email

**Points:** 5 | **Priority:** Must have | **Dependencies:** Stories 25, 43 | **Covers:** AC1, AC2, AC3, AC4, AC10

As a shopper, I want confirmation that my order went through, so that I know my purchase worked.

**Acceptance criteria**

- **Given** my payment succeeds by card or mobile money, **when** the confirmation page loads, **then** I see my order number, items, delivery address, and total paid.
- **Given** my order is created, **when** it's saved, **then** a confirmation email is queued straight away, so it's sent whether or not I'm still on the page.
- **Given** I open the email, **when** it loads, **then** it shows everything listed in AC3.
- **Given** I open the email on a phone or in an app that blocks images, **when** it loads, **then** it's still easy to read, and a plain-text version is included.

---

### Story 43: Set up the store's email sending

**Points:** 3 | **Priority:** Must have | **Dependencies:** F1 | **Covers:** AC7

As the store owner, I want emails sent from my store's own address and set up properly, so that shoppers receive them in their inbox.

**Acceptance criteria**

- **Given** the store sends an email, **when** it arrives, **then** it comes from an address on the store's domain (Decision 38).
- **Given** the store's domain, **when** email is set up, **then** it's verified with the email service using SPF, DKIM, and DMARC records.
- **Given** an email bounces or is marked as spam, **when** the service reports it, **then** it's logged.
- **Given** staging, **when** emails are sent, **then** they go to a test inbox, never to real shoppers.

**Technical notes:** Use a dedicated transactional email service (Decision 37). Build this early, since F5's password-reset emails need it too.

---

### Story 44: Keep confirmation pages private and safe to revisit

**Points:** 3 | **Priority:** Must have | **Dependencies:** Story 27 | **Covers:** AC5, AC6

As a shopper, I want only me to be able to see my order confirmation, so that my details stay private.

**Acceptance criteria**

- **Given** I'm on the confirmation page, **when** I refresh it or return with the same link, **then** I see the same order and no new order is created.
- **Given** a confirmation link, **when** it's created, **then** it contains a long random code that can't be guessed from the order number.
- **Given** a link with a wrong or expired code (older than 30 days, Decision 36), **when** it's opened, **then** a "not found" page shows and no order details.
- **Given** I'm logged in, **when** I open the confirmation for my own order, **then** I can always see it; someone else's, **then** I can't.

---

### Story 45: Resend the confirmation email

**Points:** 2 | **Priority:** Should have | **Dependencies:** Stories 27, 44 | **Covers:** AC8

As a shopper, I want to resend my confirmation email, so that I can get it if the first one went missing.

**Acceptance criteria**

- **Given** I'm on the confirmation page, **when** I tap "Resend confirmation email," **then** it's sent again to the email on the order.
- **Given** I've resent it 3 times in an hour (Decision 40), **when** I try again, **then** the button is disabled and I'm told when I can retry.
- **Given** I resend it, **when** it's sent, **then** the page confirms it and reminds me to check my spam folder.

---

### Story 46: Monitor the 5-minute email promise

**Points:** 3 | **Priority:** Must have | **Dependencies:** Stories 27, 43 | **Covers:** AC2, AC9

As the store owner, I want to know if confirmation emails are late or failing, so that shoppers always get their confirmation.

**Acceptance criteria**

- **Given** a confirmation email fails to send, **when** it fails, **then** it's retried automatically within the 5 minutes.
- **Given** an email hasn't been sent 5 minutes after the order was created, **when** that happens, **then** I'm alerted with the order number.
- **Given** emails are being sent, **when** I check, **then** I can see each order's email status (queued, sent, bounced, or failed).
- **Given** an email fails, **when** it's logged, **then** the order stays valid.

---

### Epic 7 Summary

| # | Story | Points | Priority | Covers |
|---|---|---|---|---|
| 27 | Confirmation page and email | 5 | Must | AC1, AC2, AC3, AC4, AC10 |
| 43 | Set up the store's email sending | 3 | Must | AC7 |
| 44 | Keep confirmation pages private | 3 | Must | AC5, AC6 |
| 45 | Resend the confirmation email | 2 | Should | AC8 |
| 46 | Monitor the 5-minute email promise | 3 | Must | AC2, AC9 |
| | **Total** | **16** | | |

---

## Step 3: Product Owner Decisions

Decided 25 Sep 2026.

| # | Question | Decision | Why | Alternatives considered |
|---|---|---|---|---|
| 35 | "Within 5 minutes": sent or arrived? | Sent within 5 minutes (usually within a minute); delivery reports are tracked but inbox arrival can't be promised. | We control sending, not the shopper's email provider. | Promise inbox arrival (can't be tested). |
| 36 | How long do confirmation links work? | 30 days. Logged-in shoppers can always see their own orders. | Long enough for guests, without exposing details forever. | Forever; 24 hours. |
| 37 | Which email service? | A dedicated transactional email service, chosen by price and delivery reputation. | Handles retries, bounces, and spam protection. | Sending from our own server. |
| 38 | Where do emails come from? | An address on the store's own domain, with replies to an inbox the owner checks. | Trustworthy, and shoppers can reply. | No-reply address; a free email address. |
| 39 | Resend button in the first release? | No, a should-have. | The page shows the order number, and Story 46 catches failures. | Must-have (+2 pts). |
| 40 | Resend limit? | 3 times per hour, per order. | Enough for real problems, stops misuse. | No limit. |
| 41 | SMS confirmation? | Not now; a could-have for later. | Email meets the requirement; SMS adds cost and a new provider. | Add now (about +5 pts). |

For the final project, Decisions 37 and 38 are replaced by a test inbox, since there's no real domain (see `docs/backend-plan.md` and `docs/frontend-plan.md`).

---

## Step 4: Developer Review

| Story | Before | After | Reason |
|---|---|---|---|
| 27 | 3 | 5 | More email content, and it must read well on phones and without images. |
| 43 | — | 3 | New. Also needed by F5's password-reset emails, so it's scheduled early. |
| 44 | — | 3 | New. Confirmation links must not be guessable. |
| 45 | — | 2 | New. Should-have (Decision 39). |
| 46 | — | 3 | New. The 5-minute promise can only be kept if it's measured. |

**Effect:** Epic 4 drops to 42 points (Story 27 moved out). Epic 7 is 16 points.

---

# Epic 8: Account Email Security

## Step 1: User Story and Acceptance Criteria

**User story:** As a user, I want email confirmations for my account, so that I know my account is secure.

**Original request:** Any user who logs in should receive an email confirmation. This covers three things: verifying the email at sign-up, a login code, and a login alert.

**Full acceptance criteria**

| AC | Criterion |
|---|---|
| AC1 | **Given** I register, **when** my account is created, **then** I get an email with a verification link, and I can't log in until I've clicked it. |
| AC2 | **Given** I click the link within 24 hours, **when** it opens, **then** my email is verified and I can log in. The link works only once. |
| AC3 | **Given** the link has expired or is invalid, **when** I open it, **then** I'm told why and can ask for a new one. |
| AC4 | **Given** I enter the correct email and password, **when** I submit, **then** a 6-digit code is emailed to me, and I must enter it to finish logging in. |
| AC5 | **Given** I have a code, **when** 10 minutes pass or I've used it, **then** it no longer works. After 5 wrong tries, I must request a new code. |
| AC6 | **Given** I didn't get the code, **when** I tap "Resend code," **then** a new one is sent, with a limit on how often. |
| AC7 | **Given** I finish logging in, **when** I'm in, **then** I get an email saying when I signed in and from which browser, with advice if it wasn't me. |
| AC8 | **Given** the alert email fails, **when** that happens, **then** I stay logged in and the failure is logged. If the code email fails, I'm told to try again. |

Guests can still check out without an account. A guest's cart moves into their account only after they've fully logged in, including the code.

---

## Step 2: Stories and Points

### Story 47: Verify email at sign-up

**Points:** 3 | **Priority:** Must have | **Dependencies:** F5, Story 43 | **Covers:** AC1, AC2, AC3

As a new user, I want to confirm my email address, so that the account is really mine.

**Acceptance criteria**

- **Given** I register, **when** my account is created, **then** I get an email with a verification link, and I see "Check your email to verify your account."
- **Given** I haven't verified yet, **when** I try to log in, **then** I'm told to verify first, with a "Resend verification email" button.
- **Given** I click the link within 24 hours (Decision 43), **when** it opens, **then** my email is verified and I'm taken to the login page. The link then stops working.
- **Given** the link has expired or is invalid, **when** I open it, **then** I'm told why and can request a new one, up to 3 times per hour (Decision 45).

**Technical notes:** Store only a hashed version of the link's code, with its expiry time.

---

### Story 48: Log in with an email code

**Points:** 5 | **Priority:** Must have | **Dependencies:** Story 47 | **Covers:** AC4, AC5, AC6

As a user, I want to enter a code from my email when I log in, so that nobody can get into my account with just my password.

**Acceptance criteria**

- **Given** I enter the correct email and password, **when** I submit, **then** a 6-digit code is emailed to me and I'm asked to enter it. I'm not logged in yet. This applies on every login, for shoppers and admins alike (Decisions 42, 47).
- **Given** I enter the correct code within 10 minutes (Decision 44), **when** I submit it, **then** I'm logged in, and any guest cart moves into my account.
- **Given** the code is wrong, **when** I've tried 5 times, **then** that code stops working and I must request a new one.
- **Given** I didn't get the code, **when** I tap "Resend code," **then** a new one is sent and the old one stops working. I must wait 60 seconds between resends, up to 5 per hour (Decision 45).
- **Given** the code email fails to send, **when** that happens, **then** I'm told to try again.

**Technical notes:** Generate codes with a secure random function, store them hashed, and track attempts. The login cookie is only set after the code is correct. Add an on/off setting (for example, `LOGIN_CODE_ENABLED` in `.env`) so the code step can be switched off if needed. In development only, also print the code to the server console to speed up testing; never do this in production.

---

### Story 49: Login alert email

**Points:** 2 | **Priority:** Must have | **Dependencies:** Story 48 | **Covers:** AC7, AC8

As a user, I want an email every time I log in, so that I'd notice if someone else used my account.

**Acceptance criteria**

- **Given** I finish logging in, **when** I'm in, **then** I get an email with the date, time, and browser, and advice to change my password if it wasn't me (Decision 46).
- **Given** the alert fails to send, **when** that happens, **then** I stay logged in and the failure is logged.

---

### Epic 8 Summary

| # | Story | Points | Priority | Covers |
|---|---|---|---|---|
| 47 | Verify email at sign-up | 3 | Must | AC1, AC2, AC3 |
| 48 | Log in with an email code | 5 | Must | AC4, AC5, AC6 |
| 49 | Login alert email | 2 | Must | AC7, AC8 |
| | **Total** | **10** | | |

---

## Step 3: Product Owner Decisions

Decided 25 Sep 2026.

| # | Question | Decision | Why | Later improvement |
|---|---|---|---|---|
| 42 | Login code every time, or trust a device? | Every login. | Matches the request, and it's simpler to build. | Add "trust this device for 30 days," since a code on every login can put shoppers off. |
| 43 | How long does the verification link work? | 24 hours, once only. | Enough time to check email, while staying safe. | — |
| 44 | How long does the login code work? | 10 minutes, 5 tries. | Enough time, while making guessing useless. | — |
| 45 | How often can emails be resent? | Verification: 3 per hour. Code: 60 seconds between resends, up to 5 per hour. | Stops inbox flooding. | — |
| 46 | Login alert on every login? | Yes. | As requested. | Send alerts only for a new device or browser, since two emails per login gets ignored. |
| 47 | Same rules for admins? | Yes. | Admin accounts need the most protection. | — |
| 48 | Do guests need any of this? | No. Guest checkout stays (Decision 17). | Keeps buying quick. | — |

---

## Step 4: Developer Review

| Story | Before | After | Reason |
|---|---|---|---|
| 47 | 3 | 3 | Confirmed. Seed the admin account as already verified so it can log in straight away. |
| 48 | 5 | 5 | Confirmed. Includes the on/off setting and the development-only console code. |
| 49 | 2 | 2 | Confirmed. If the login code is switched off, the alert is sent straight after the password step. |

**Dependency note:** Story 8a (guest cart merge on login) now runs after the code step in Story 48, not after the password.

---

# Epic 9: Order History and Status

## Step 1: User Story and Acceptance Criteria

**User story:** As a shopper, I want to view my order history and status, so that I can track deliveries.

**Original criteria**

- My orders are listed newest first, each showing date, items, total, and status (Pending, Shipped, Delivered, Cancelled).

**Full acceptance criteria**

| AC | Criterion |
|---|---|
| AC1 | **Given** I'm logged in, **when** I open "My Orders," **then** I see all my orders, newest first. |
| AC2 | **Given** my orders are listed, **when** I look at one, **then** I see the date, order number, items with quantities, total, and status. |
| AC3 | **Given** an order has a status, **when** it's shown, **then** it's one of Pending, Shipped, Delivered, or Cancelled, labelled in words, not just colour. |
| AC4 | **Given** I tap an order, **when** its page opens, **then** I see the items, prices paid, delivery address, payment method, and the date each status changed. |
| AC5 | **Given** the store changes my order's status, **when** I next view my orders, **then** I see the new status. |
| AC6 | **Given** I'm logged in, **when** I view order history, **then** I only see my own orders; someone else's order shows "not found." |
| AC7 | **Given** I haven't ordered anything, **when** I open "My Orders," **then** I see a friendly message with a link to start shopping. |
| AC8 | **Given** I have many orders, **when** I scroll, **then** they load a page at a time. |
| AC9 | **Given** I'm the store admin, **when** I update a status, **then** it can only move Pending → Shipped → Delivered, or Pending → Cancelled. |

---

## Step 2: Stories and Points

### Story 50: View my order list

**Points:** 3 | **Priority:** Must have | **Dependencies:** F5, Story 25 | **Covers:** AC1, AC2, AC3, AC7, AC8

As a shopper, I want to see all my orders, so that I can check what I've bought and where it is.

**Acceptance criteria**

- **Given** I'm logged in, **when** I open "My Orders," **then** my orders are listed newest first.
- **Given** an order is listed, **when** I look at it, **then** I see the date, order number, items with quantities (the first few, then "and 2 more"), total, and status.
- **Given** a status is shown, **when** I read it, **then** it's a word label, and "Pending" is explained as "we're preparing your order" (Decision 49).
- **Given** I have no orders, **when** I open the page, **then** I see a friendly message and a "Start shopping" link.
- **Given** I have many orders, **when** I reach the end of the list, **then** more load, 10 at a time.

---

### Story 51: View order details and status history

**Points:** 3 | **Priority:** Must have | **Dependencies:** Story 50 | **Covers:** AC4, AC5, AC6

As a shopper, I want to see the full details of an order, so that I can track its progress.

**Acceptance criteria**

- **Given** I tap an order, **when** its page opens, **then** I see the items, prices paid, delivery address, payment method (number partly hidden), and total.
- **Given** the status has changed, **when** I view the order, **then** I see each status with the date it changed.
- **Given** I open an order that isn't mine, **when** the page loads, **then** I see "not found," with no details.

---

### Story 52: Update an order's status (admin)

**Points:** 5 | **Priority:** Must have | **Dependencies:** Story 29, F5 | **Covers:** AC5, AC9

As the store owner, I want to update each order's status, so that shoppers can track their deliveries.

**Acceptance criteria**

- **Given** I'm logged in as admin, **when** I open the admin orders page, **then** I see all orders, newest first, with their status.
- **Given** an order, **when** I change its status, **then** I can only choose the next allowed step: Pending → Shipped → Delivered, or Pending → Cancelled.
- **Given** an invalid change (for example, Delivered → Pending), **when** the server receives it, **then** it's refused, even if the page is bypassed.
- **Given** I cancel an order, **when** it's saved, **then** its items go back into stock and the shopper is refunded automatically (Decision 50), all together or not at all.
- **Given** I change a status, **when** it's saved, **then** it's recorded with who changed it and when.
- **Given** I'm not an admin, **when** I try to open the page or call its API, **then** I'm refused.

**Technical notes:** Cancelling uses the same logic as Story 55, and refunds use Story 56. Shoppers can also cancel Pending orders (Decision 56, which replaced Decision 51).

---

### Story 53: Email shoppers when the status changes

**Points:** 2 | **Priority:** Must have (moved from should-have by Decision 87) | **Dependencies:** Stories 43, 52 | **Covers:** Decision 52

As a shopper, I want an email when my order ships, arrives, or is cancelled, so that I don't have to keep checking.

**Acceptance criteria**

- **Given** my order becomes Shipped or Delivered, **when** the change is saved, **then** I get an email with the order number, new status, and a link to the order.
- **Given** the email fails, **when** that happens, **then** the status change still stands and the failure is logged.

---

### Story 54: Show guest orders after creating an account

**Points:** 2 | **Priority:** Could have | **Dependencies:** Stories 47, 50 | **Covers:** Decision 53

As a shopper who first bought as a guest, I want my earlier orders in my history, so that I can see everything in one place.

**Acceptance criteria**

- **Given** I placed guest orders with an email address, **when** I create an account with that email and verify it, **then** those orders appear in my order history.
- **Given** I haven't verified my email, **when** I view my history, **then** guest orders are not linked yet.

---

### Epic 9 Summary

| # | Story | Points | Priority | Covers |
|---|---|---|---|---|
| 50 | View my order list | 3 | Must | AC1, AC2, AC3, AC7, AC8 |
| 51 | View order details and status history | 3 | Must | AC4, AC5, AC6 |
| 52 | Update an order's status (admin) | 5 | Must | AC5, AC9 |
| 53 | Email shoppers when the status changes | 2 | Must (Decision 87) | Decision 52 |
| 54 | Show guest orders after creating an account | 2 | Could | Decision 53 |
| | **Total** | **15** | | |

---

## Step 3: Product Owner Decisions

Decided 25 Sep 2026.

| # | Question | Decision | Why | Alternatives considered |
|---|---|---|---|---|
| 49 | What does "Pending" mean? | Paid and being prepared, not yet shipped. Shown as "Pending: we're preparing your order." | Orders only exist after payment (Decision 29). | Rename it "Processing." |
| 50 | What happens on cancellation? | Stock goes back automatically, and the shopper is refunded automatically. For the final project, cancelling only changes the status and returns stock (test payments need no refund). | Items can be sold again, and shoppers get their money back. | Manual refunds only. |
| 51 | Can shoppers cancel orders themselves? | **Replaced by Decision 56** (Epic 10): shoppers can now cancel Pending orders. Originally: no, only the admin. | Simple, and avoids cancelling orders already being packed. | Let shoppers cancel while Pending (later). |
| 52 | Email on status changes? | Yes, for Shipped and Delivered (Story 53, should-have; a stretch for the project). Cancellation emails come from Story 57. | Shoppers find out without checking the site. | No emails. |
| 53 | Show guest orders after sign-up? | Yes, once the email is verified (Story 54, could-have; later for the project). | Verification proves the orders are theirs. | Never; link without verification (unsafe). |
| 54 | Courier tracking numbers? | Not now; status only. | No courier is set up. | Add tracking later. |
| 55 | Are Stories 50–52 must-haves? | Yes. | Shoppers expect to see orders, and the owner needs statuses to manage deliveries. | Make shopper pages should-haves. |

---

## Step 4: Developer Review

| Story | Before | After | Reason |
|---|---|---|---|
| 50 | 3 | 3 | Confirmed. |
| 51 | 3 | 3 | Confirmed. |
| 52 | 3 | 5 | Cancelling now also returns stock and triggers a refund, in one transaction (Decision 50). |
| 53 | — | 2 | New, from Decision 52. |
| 54 | — | 2 | New, from Decision 53. Relies on email verification (Story 47). |

**Also affects Story 25:** creating an order must set its status to Pending and record that first status change, so the history in Story 51 is complete. **Admin page:** keep it minimal (a list with status buttons), since it only needs to support deliveries.

---

# Epic 10: Cancel an Order

## Step 1: User Story and Acceptance Criteria

**User story:** As a shopper, I want to cancel an order before it ships, so that I can change my mind.

**Original criteria**

- Given the status is Pending, I can cancel, and a refund is triggered.
- Given the status is Shipped, the cancel option is not shown.

**Full acceptance criteria**

| AC | Criterion |
|---|---|
| AC1 | **Given** my order is Pending, **when** I view it, **then** I see a "Cancel order" button. |
| AC2 | **Given** I tap "Cancel order," **when** the confirmation appears, **then** I must confirm, because a cancellation can't be undone. |
| AC3 | **Given** I confirm, **when** the cancellation is saved, **then** the status becomes Cancelled, the items go back into stock, a full refund (including delivery) is triggered, and the change is recorded as made by me. |
| AC4 | **Given** my order is cancelled, **when** the page updates, **then** I see that it's cancelled and roughly how long the refund takes. |
| AC5 | **Given** my order is cancelled, **when** it's saved, **then** I get an email confirming the cancellation and the refund. |
| AC6 | **Given** my order is Shipped, Delivered, or already Cancelled, **when** I view it, **then** there's no cancel option. |
| AC7 | **Given** the admin marks my order Shipped just as I cancel, **when** the server checks, **then** the cancellation is refused and I'm told it has shipped. |
| AC8 | **Given** I try to cancel someone else's order, **when** the server receives it, **then** it's refused. |
| AC9 | **Given** I confirm twice, **when** the server processes it, **then** the order is cancelled and refunded only once. |
| AC10 | **Given** the refund can't be completed, **when** that happens, **then** the order stays cancelled, the admin is alerted to refund by hand, and I'm told my refund is being processed. |

---

## Step 2: Stories and Points

### Story 55: Cancel a Pending order

**Points:** 5 | **Priority:** Must have | **Dependencies:** Stories 51, 52 | **Covers:** AC1, AC2, AC3, AC6, AC7, AC8, AC9

As a shopper, I want to cancel my order before it ships, so that I can change my mind.

**Acceptance criteria**

- **Given** my order is Pending, **when** I view it, **then** I see "Cancel order"; for any other status, it isn't shown.
- **Given** I tap "Cancel order," **when** the confirmation appears, **then** I must confirm before anything happens.
- **Given** I confirm, **when** the server processes it, **then** in one step the status becomes Cancelled, the items go back into stock, the change is recorded as made by me, and a refund is requested (Story 56).
- **Given** the order was marked Shipped a moment before, **when** the server checks, **then** the cancellation is refused and I'm told it has shipped.
- **Given** I try to cancel someone else's order, **when** the server receives it, **then** it's refused.
- **Given** I confirm twice, **when** both requests arrive, **then** the order is cancelled and refunded only once.

**Technical notes:** The server locks the order while checking its status, so a cancel and a "Shipped" update can't both succeed. The admin's cancel (Story 52) uses this same cancel logic.

---

### Story 56: Refund a cancelled order

**Points:** 5 | **Priority:** Must have | **Dependencies:** Stories 20, 26, 42, 55 | **Covers:** AC3, AC10

As a shopper, I want my money back automatically when I cancel, so that I don't have to chase the store.

**Acceptance criteria**

- **Given** an order is cancelled, **when** the refund is requested, **then** the full amount paid, including delivery, is refunded through Paystack in the currency charged (Decision 60).
- **Given** a refund is requested, **when** it's saved, **then** it's recorded with its amount, status (requested, processed, or failed), and Paystack's reference.
- **Given** the refund fails, **when** that happens, **then** the order stays cancelled, the refund is marked failed, and the admin is alerted to refund by hand (recorded with Story 42).
- **Given** Paystack later confirms the refund, **when** the update arrives, **then** its status becomes "processed."

**Technical notes:** All refunds (Stories 26, 42, and 56) use one shared `Refund` table, so the admin sees every refund in one place.

---

### Story 57: Cancellation messages and email

**Points:** 2 | **Priority:** Must have | **Dependencies:** Stories 43, 55 | **Covers:** AC4, AC5

As a shopper, I want to be told clearly what happens after I cancel, so that I know when to expect my money.

**Acceptance criteria**

- **Given** my order is cancelled, **when** the page updates, **then** I see "Order cancelled" and "Refunds usually take a few business days to reach your mobile money wallet" (Decision 61).
- **Given** my order is cancelled, **when** it's saved, **then** I get an email confirming the cancellation, refund amount, and expected timing.
- **Given** the email fails, **when** that happens, **then** the cancellation still stands and the failure is logged.

---

### Story 58: Cancel a guest order through the confirmation link

**Points:** 2 | **Priority:** Should have | **Dependencies:** Stories 44, 55 | **Covers:** Decision 58

As a guest shopper, I want to cancel my order from my confirmation link, so that I can change my mind without an account.

**Acceptance criteria**

- **Given** I open my valid confirmation link and the order is Pending, **when** the page loads, **then** I see "Cancel order," which works exactly as in Story 55.
- **Given** the link has expired or the order isn't Pending, **when** the page loads, **then** there's no cancel option.

---

### Epic 10 Summary

| # | Story | Points | Priority | Covers |
|---|---|---|---|---|
| 55 | Cancel a Pending order | 5 | Must | AC1, AC2, AC3, AC6, AC7, AC8, AC9 |
| 56 | Refund a cancelled order | 5 | Must | AC3, AC10 |
| 57 | Cancellation messages and email | 2 | Must | AC4, AC5 |
| 58 | Cancel a guest order through the confirmation link | 2 | Should | Decision 58 |
| | **Total** | **14** | | |

---

## Step 3: Product Owner Decisions

Decided 25 Sep 2026.

| # | Question | Decision | Why | Alternatives considered |
|---|---|---|---|---|
| 56 | Who can cancel? | Shoppers can cancel their own Pending orders; the admin can cancel any Pending order. **Replaces Decision 51.** | That's what the user story asks for, and both use the same logic. | Admin only. |
| 57 | What if Paystack's test mode can't refund mobile money? | Check in Task 0. If test refunds work, the project does real test refunds. If not, it records the refund as "requested," shows the normal message, and the README explains the limitation. | The demo works either way, honestly. | Skip refunds. |
| 58 | Can guests cancel? | Yes, through their private confirmation link (Story 58, should-have; a stretch for the project). | The private link proves the order is theirs. | Guests contact the store. |
| 59 | Is there a time limit? | No, only while Pending. | Simple, matches the story. The admin should mark orders Shipped promptly. | A time window, or a "Packing" status (later). |
| 60 | How much is refunded? | The full amount, including delivery. No fee. | The order never shipped. | Keep delivery, or charge a fee. |
| 61 | What do we say about refund timing? | "Refunds usually take a few business days to reach your mobile money wallet," updated once Paystack's timing is known. | Honest without promising a date. | Promise an exact number of days. |
| 62 | Are Stories 55–57 must-haves? | Yes. For the project: build 55 and 57, and 56 as real or simulated refunds (Decision 57). | The story needs all three. | — |

---

## Step 4: Developer Review

| Story | Before | After | Reason |
|---|---|---|---|
| 55 | 5 | 5 | Confirmed. The admin's cancel (Story 52) now uses the same logic. |
| 56 | 5 | 5 | Confirmed. **Dependency added:** Story 26, because refund updates arrive the same way as payment updates. |
| 57 | 2 | 2 | Confirmed. |
| 58 | — | 2 | New, from Decision 58. |

**Fixes made:**
- **One `Refund` table** for all refunds (Stories 26, 42, and 56).
- **No double emails:** Story 53 now emails only for Shipped and Delivered; Story 57 sends the cancellation email.
- **Task 0 check:** test whether Paystack's test mode can refund a mobile money payment (Decision 57).

---

# Epic 11: Ratings and Reviews

## Step 1: User Story and Acceptance Criteria

**User story:** As a shopper, I want to rate and review products I've bought, so that I can share my experience.

**Original criteria**

- Given I've received the product, I can submit a 1–5 star rating with optional text.
- Given I haven't bought it, the review option is not available.
- I can leave only one review per product, and I can edit it later.

**Full acceptance criteria**

| AC | Criterion |
|---|---|
| AC1 | **Given** I'm logged in and have an order containing the product with status Delivered, **when** I view the product, **then** I see "Write a review." |
| AC2 | **Given** I'm writing a review, **when** I submit it, **then** a 1–5 star rating is required and the text is optional, up to 1,000 characters. |
| AC3 | **Given** I haven't bought the product, or my order isn't Delivered, **when** I view it, **then** there's no review option, and the server refuses a review even if the page is bypassed. |
| AC4 | **Given** I've already reviewed a product, **when** I view it, **then** I see "Edit your review" instead of "Write a review." |
| AC5 | **Given** I edit my review, **when** I save it, **then** my stars and text are updated, and it shows "Edited" with the date. |
| AC6 | **Given** a product has reviews, **when** I view it, **then** I see the average rating, the number of reviews, and the reviews newest first, each with stars, text, first name and last initial, date, and "Verified purchase." |
| AC7 | **Given** a product has reviews, **when** I browse the product list, **then** each product shows its average stars and number of reviews. |
| AC8 | **Given** a product has no reviews, **when** I view it, **then** I see "No reviews yet." |
| AC9 | **Given** a review contains unusual characters or code, **when** it's displayed, **then** it's shown as plain text. |
| AC10 | **Given** I'm choosing stars, **when** I use a keyboard or screen reader, **then** I can select a rating, and it's announced clearly (for example, "4 out of 5 stars"). |

---

## Step 2: Stories and Points

### Story 59: Write a review for a product I've received

**Points:** 5 | **Priority:** Should have | **Dependencies:** Stories 50, 52 | **Covers:** AC1, AC2, AC3, AC4, AC9, AC10

As a shopper, I want to rate and review a product I've received, so that I can share my experience.

**Acceptance criteria**

- **Given** I'm logged in and have a Delivered order containing the product (Decision 63), **when** I view it, **then** I see "Write a review."
- **Given** I submit a review, **when** it's saved, **then** a 1–5 star rating is required and the text is optional, up to 1,000 characters. It's published straight away (Decision 66).
- **Given** I haven't received the product, **when** I view it or call the review API directly, **then** there's no review option and the server refuses it.
- **Given** I've already reviewed the product, **when** I try to add another, **then** the server refuses it, even if I bought it more than once (Decision 69).
- **Given** I choose a rating, **when** I use a keyboard or screen reader, **then** I can select it, and it's announced as "4 out of 5 stars."

**Technical notes:** The server checks eligibility itself. The database allows only one review per shopper per product.

---

### Story 60: Edit my review

**Points:** 2 | **Priority:** Should have | **Dependencies:** Story 59 | **Covers:** AC4, AC5

As a shopper, I want to edit my review, so that I can update it if my opinion changes.

**Acceptance criteria**

- **Given** I've reviewed a product, **when** I view it, **then** I see "Edit your review."
- **Given** I change my stars or text, **when** I save, **then** the review updates and shows "Edited" with the date.
- **Given** someone tries to edit a review that isn't theirs, **when** the server receives it, **then** it's refused.

---

### Story 61: Show reviews on the product page

**Points:** 3 | **Priority:** Should have | **Dependencies:** Story 59 | **Covers:** AC6, AC8, AC9

As a shopper, I want to read other people's reviews, so that I can decide whether to buy.

**Acceptance criteria**

- **Given** a product has reviews, **when** I view it, **then** I see the average rating (for example, "4.3 out of 5") and the number of reviews.
- **Given** reviews are listed, **when** I read them, **then** they're newest first, each with stars, text, first name and last initial (Decision 68), date, and "Verified purchase."
- **Given** there are many reviews, **when** I reach the end, **then** I can load 5 more at a time.
- **Given** a review contains code or odd characters, **when** it's shown, **then** it's displayed as plain text.
- **Given** a product has no reviews, **when** I view it, **then** I see "No reviews yet."
- **Given** a review has been hidden by the admin (Story 64), **when** reviews are shown, **then** it's left out of the list and the average.

---

### Story 62: Show ratings in the product list

**Points:** 2 | **Priority:** Should have | **Dependencies:** Story 61 | **Covers:** AC7

As a shopper, I want to see ratings while browsing, so that I can spot popular products quickly.

**Acceptance criteria**

- **Given** a product has reviews, **when** I browse the product list, **then** it shows its average stars and number of reviews.
- **Given** a product has no reviews, **when** I browse, **then** no stars are shown (not zero stars).

**Technical notes:** A small store can calculate averages when products are requested. A larger one would save each product's average and count, updating them when reviews change.

---

### Story 63: Delete my review

**Points:** 2 | **Priority:** Should have | **Dependencies:** Story 59 | **Covers:** Decision 64

As a shopper, I want to delete my review, so that I stay in control of what I've written.

**Acceptance criteria**

- **Given** I've reviewed a product, **when** I tap "Delete review" and confirm, **then** it's removed and the product's average updates.
- **Given** I've deleted my review, **when** I view the product again, **then** I can write a new one.
- **Given** someone tries to delete a review that isn't theirs, **when** the server receives it, **then** it's refused.

---

### Story 64: Hide offensive reviews (admin)

**Points:** 3 | **Priority:** Should have | **Dependencies:** Stories 52, 61 | **Covers:** Decision 65

As the store owner, I want to hide offensive or spam reviews, so that the store stays trustworthy.

**Acceptance criteria**

- **Given** I'm logged in as admin, **when** I view a review, **then** I can hide it, with a short reason.
- **Given** a review is hidden, **when** shoppers view the product, **then** it's left out of the list and the average; the reviewer still sees it marked "Hidden by the store."
- **Given** I hid a review by mistake, **when** I unhide it, **then** it shows again.
- **Given** I hide a review, **when** I save, **then** a reason is required, up to 200 characters (Decision 90).
- **Given** a hidden review is edited by its reviewer, **when** it's saved, **then** it stays hidden until the admin unhides it (Decision 92).

---

### Epic 11 Summary

| # | Story | Points | Priority | Covers |
|---|---|---|---|---|
| 59 | Write a review for a product I've received | 5 | Should | AC1, AC2, AC3, AC4, AC9, AC10 |
| 60 | Edit my review | 2 | Should | AC4, AC5 |
| 61 | Show reviews on the product page | 3 | Should | AC6, AC8, AC9 |
| 62 | Show ratings in the product list | 2 | Should | AC7 |
| 63 | Delete my review | 2 | Should | Decision 64 |
| 64 | Hide offensive reviews (admin) | 3 | Should | Decision 65 |
| | **Total** | **17** | | |

---

## Step 3: Product Owner Decisions

Decided 25 Sep 2026.

| # | Question | Decision | Why | Alternatives considered |
|---|---|---|---|---|
| 63 | What does "received" mean? | The order's status is Delivered. | The only status confirming the shopper has the product. | Allow reviews once Shipped. |
| 64 | Can shoppers delete their reviews? | Yes (Story 63). **Built** for the project. | Shoppers control what they've written, and it completes the feature. | Edit only. |
| 65 | Can the admin hide offensive reviews? | Yes (Story 64). **Updated by Decision 89:** moderation is now built for the project too, since User Story 16 asks for it. | A real store needs to remove abuse and spam. | Automatic bad-word filtering. |
| 66 | Published straight away, or approved first? | Straight away; the admin can hide bad ones later. | Approving every review creates needless work. | Pre-approval. |
| 67 | Can guests review? | Not in the project. In the full product, yes once Story 54 links their orders after email verification. | Only verified buyers should review. | Review through the confirmation link. |
| 68 | How is the reviewer shown? | First name and last initial (for example, "Ama K."). | Feels real, protects privacy. | Full name; anonymous. |
| 69 | Bought more than once? | Still one review per product, which can be edited. | One person, one voice. | One review per order. |
| 70 | Must-have or should-have? | Should-have for the full product (first release stays at 187 points). Built for the project. | A store can launch without reviews. | Must-have. |

**For the project demo:** seed 2–3 sample shoppers with Delivered orders and a few reviews, so product pages don't look empty. These are clearly named as sample data in the seeder and README; a real store must never publish fake reviews.

---

## Step 4: Developer Review

| Story | Before | After | Reason |
|---|---|---|---|
| 59 | 5 | 5 | Confirmed. Depends on the admin marking orders Delivered (Story 52). |
| 60 | 2 | 2 | Confirmed. |
| 61 | 3 | 3 | Confirmed. Hidden reviews (Story 64) are excluded from the list and the average. |
| 62 | 2 | 2 | Confirmed. Averages must also exclude hidden reviews. |
| 63 | — | 2 | New, from Decision 64. After deleting, the shopper can review again. |
| 64 | — | 3 | New, from Decision 65. |

**Dependency check:** Every Epic 11 story depends only on must-haves or on other Epic 11 stories, so keeping reviews as should-have doesn't block the first release.

---

# Epic 12: Read Reviews

## Step 1: User Story and Acceptance Criteria

**User story:** As a shopper, I want to read other reviews, so that I can decide whether to buy.

**Original criteria:** Product pages show the average rating, review count, and reviews sorted by most recent.

| AC | Criterion | Covered by |
|---|---|---|
| AC1 | **Given** a product has reviews, **when** I view it, **then** I see the average rating and review count. | Story 61 |
| AC2 | **Given** reviews are listed, **when** I read them, **then** they're sorted by most recent by default. | Story 61 |
| AC3 | **Given** a product has reviews, **when** I view it, **then** I see how many reviews gave each star rating. | Story 65 (new) |
| AC4 | **Given** I'm reading reviews, **when** I choose a sort, **then** I can switch between Most recent, Highest rated, and Lowest rated. | Story 66 (new) |

Most of this user story was already covered by Epic 11 (Stories 61 and 62). Two small extras were added.

## Step 2: Stories and Points

### Story 65: Rating breakdown

**Points:** 2 | **Priority:** Should have | **Dependencies:** Story 61 | **Covers:** AC3

- **Given** a product has reviews, **when** I view it, **then** I see a bar for each star level (5 to 1) showing how many reviews gave that rating.
- **Given** a review is hidden by the admin, **when** the breakdown is shown, **then** it isn't counted.
- **Given** I use a screen reader, **when** I reach the breakdown, **then** each bar is read as text, for example "5 stars: 12 reviews."

### Story 66: Sort reviews

**Points:** 2 | **Priority:** Should have | **Dependencies:** Story 61 | **Covers:** AC2, AC4

- **Given** I'm reading reviews, **when** the page loads, **then** they're sorted by Most recent.
- **Given** I choose Highest rated or Lowest rated, **when** the list updates, **then** reviews are sorted by stars, newest first within each star level, and "load more" continues in that order.

## Step 3: Product Owner Decisions

| # | Question | Decision | Why |
|---|---|---|---|
| 71 | Default sort? | Most recent, as the user story says. | Newest reviews reflect the product today. |
| 72 | Build the extras for the project? | Yes, both, as part of Task 13. | Small, and they make the review section feel complete. |

## Step 4: Developer Review

Stories 65 and 66 confirmed at 2 points each. Both reuse Story 61's review query, so no new tables are needed.

---

# Epic 13: Product Details

## Step 1: User Story and Acceptance Criteria

**User story:** As a shopper, I want to view product details, so that I can decide whether to buy.

| AC | Criterion | Covered by |
|---|---|---|
| AC1 | **Given** I open a product, **when** its page loads, **then** I see its name, description, price, and category. | F3 |
| AC2 | **Given** a product has several photos, **when** I view it, **then** I see the main photo and can view the others in a small gallery, each with alt text. | F3 (with `ProductImage`) |
| AC3 | **Given** I've chosen a currency, **when** I view the price, **then** it's shown in that currency. | Story 32 |
| AC4 | **Given** a product is out of stock, **when** I view it, **then** I see "Out of stock" and can't add it. | Story 2 |
| AC5 | **Given** a product has only a few left, **when** I view it, **then** I see "Only X left." | Story 67 (new) |
| AC6 | **Given** a product has reviews, **when** I view it, **then** I see its rating and reviews. | Stories 61, 65, 66 |
| AC7 | **Given** a product doesn't exist or is inactive, **when** I open its link, **then** I see a friendly "not found" page. | F3 |

Almost all of this user story was already covered. One small addition was made.

## Step 2: Stories and Points

### Story 67: Low-stock label

**Points:** 1 | **Priority:** Should have | **Dependencies:** F3, F4 | **Covers:** AC5

- **Given** a product has 5 or fewer in stock, **when** I view it, **then** I see "Only X left."
- **Given** it has more than 5, **when** I view it, **then** no stock number is shown.

## Step 3: Product Owner Decisions

| # | Question | Decision | Why |
|---|---|---|---|
| 73 | When is "Only X left" shown? | At 5 or fewer. | Creates helpful urgency without revealing stock levels for every product. |

## Step 4: Developer Review

Story 67 confirmed at 1 point. For the project, it's built in Task 2 with the product page.

---

# Epic 14: Browse by Category

## Step 1: User Story and Acceptance Criteria

**User story:** As a shopper, I want to browse products by category, so that I can find what I'm looking for quickly.

| AC | Criterion |
|---|---|
| AC1 | **Given** I'm anywhere in the store, **when** I look at the menu, **then** I see Bags, Makeup, Jewellery, and Accessories, plus "All products." |
| AC2 | **Given** I choose a category, **when** the page loads, **then** I see only its products, with the category name as the title and the number of products. |
| AC3 | **Given** I choose "All products," **when** the page loads, **then** I see every product. |
| AC4 | **Given** I'm viewing a product, **when** I look at its details, **then** I see its category and can tap it to see similar products. |
| AC5 | **Given** I'm viewing a category, **when** I copy its address (for example, `/category/bags`) and open it later, **then** it shows the same category. |
| AC6 | **Given** a category has no products, **when** I open it, **then** I see a friendly message and a link to all products. |
| AC7 | **Given** I open a category address that doesn't exist, **when** the page loads, **then** I see the not-found page. |
| AC8 | **Given** a product is saved, **when** it's stored, **then** it belongs to exactly one category. |
| AC9 | **Given** I use a keyboard or screen reader, **when** I use the category menu, **then** I can reach every category, and the current one is announced. |

## Step 2: Stories and Points

### Story 68: Categories and product links

**Points:** 2 | **Priority:** Must have | **Dependencies:** F2 | **Covers:** AC8

- **Given** the store is set up, **when** the seed data runs, **then** Bags, Makeup, Jewellery, and Accessories exist, each with a web name (`bags`, `makeup`, `jewellery`, `accessories`) and a display order.
- **Given** a product is saved, **when** it's stored, **then** it belongs to exactly one category; the database refuses a product without one.

**Technical notes:** The seeder links products to categories by web name, not ID, so products never end up in the wrong category.

### Story 69: Category menu

**Points:** 2 | **Priority:** Must have | **Dependencies:** Story 68 | **Covers:** AC1, AC9

- **Given** I'm anywhere in the store, **when** I look at the menu, **then** I see "All products" and all four categories in display order, even empty ones (Decision 79).
- **Given** a laptop screen, **when** the page loads, **then** categories are links across the top; on a phone, they're behind a "Categories" button (Decision 76).
- **Given** I'm viewing a category, **when** I look at the menu, **then** it's highlighted and announced as the current page. Everything works with a keyboard.

### Story 70: Browse products by category

**Points:** 3 | **Priority:** Must have | **Dependencies:** Stories 68, 69 | **Covers:** AC2, AC3, AC5, AC6, AC7

- **Given** I open a category, **when** the page loads, **then** I see only its active products, alphabetically (Decision 78), with the category name and product count.
- **Given** I choose "All products," **when** the page loads, **then** I see every active product, alphabetically.
- **Given** a category's address, **when** I open it later, **then** it shows the same category.
- **Given** a category has no active products, **when** I open it, **then** I see a friendly message and a link to all products.
- **Given** an unknown category address, **when** it's opened, **then** I see the not-found page.

### Story 71: Category on the product page

**Points:** 1 | **Priority:** Must have | **Dependencies:** Stories 68, 70 | **Covers:** AC4

- **Given** I'm viewing a product, **when** I look at its details, **then** I see its category as a link to that category's page.

### Story 72: Manage categories (admin)

**Points:** 3 | **Priority:** Should have | **Dependencies:** Stories 52, 68 | **Covers:** Decision 75

- **Given** I'm the admin, **when** I create or rename a category, **then** it's saved with a unique web name and appears in the menu.
- **Given** a category still has products, **when** I try to delete it, **then** I'm refused until its products are moved.

### Epic 14 Summary

| # | Story | Points | Priority | Covers |
|---|---|---|---|---|
| 68 | Categories and product links | 2 | Must | AC8 |
| 69 | Category menu | 2 | Must | AC1, AC9 |
| 70 | Browse products by category | 3 | Must | AC2, AC3, AC5, AC6, AC7 |
| 71 | Category on the product page | 1 | Must | AC4 |
| 72 | Manage categories (admin) | 3 | Should | Decision 75 |
| | **Total** | **11** | | |

## Step 3: Product Owner Decisions

Decided 25 Sep 2026.

| # | Question | Decision | Why | Alternatives considered |
|---|---|---|---|---|
| 74 | Must-have? | Yes, Stories 68–71. | Shoppers expect categories; only 8 points. | Should-have. |
| 75 | Can the admin manage categories? | Not in the project (seed data only). In the full product, yes (Story 72, should-have). | Admin features stay minimal. | Admin page now. |
| 76 | Menu on phones? | Laptops: links across the top. Phones: a "Categories" button. | Five links don't fit on a small screen. | A scrolling row of links. |
| 77 | More than one category per product? | No, exactly one. | Simple for 16 products. | Several categories or tags (later). |
| 78 | Product order? | Alphabetical by name. | Predictable and easy to scan; other sorting is a separate story. | Newest first; by price. |
| 79 | Show empty categories? | Yes, always all four. | The menu stays consistent, and links never break. | Hide empty categories. |

## Step 4: Developer Review

| Story | Before | After | Reason |
|---|---|---|---|
| 68 | 2 | 2 | Confirmed. Products are linked by web name in the seeder. |
| 69 | 2 | 2 | Confirmed. |
| 70 | 3 | 3 | Confirmed. |
| 71 | 1 | 1 | Confirmed. |
| 72 | — | 3 | New, from Decision 75. |

**For the project:** no new tasks are needed. The backend work fits into BE1 (table and seed data) and BE3 (endpoints); the frontend work fits into FE1.

---

# Epic 15: Manage Orders (Admin)

## Step 1: User Story and Acceptance Criteria

**User story:** As an admin, I want to manage orders, so that I can fulfil them.

**Original criteria**

- I can filter orders by status and date.
- I can update an order's status, and the shopper is emailed on each change.
- I can issue a full or partial refund.

| AC | Criterion | Covered by |
|---|---|---|
| AC1 | **Given** I'm the admin, **when** I open the orders page, **then** I see orders newest first, 20 at a time, with order number, date, customer, total, status, and refund status. | Story 73 |
| AC2 | **Given** I choose a status, **when** the list updates, **then** only that status is shown; "All" shows every order. | Story 73 |
| AC3 | **Given** I choose a date range, **when** the list updates, **then** only orders in that range are shown; filters combine and can be cleared; an invalid range shows a message. | Story 73 |
| AC4 | **Given** an order, **when** I change its status, **then** only the allowed steps are possible. | Story 52 |
| AC5 | **Given** I change a status, **when** it's saved, **then** the shopper is emailed; a failed email doesn't block the change. | Stories 53, 57 |
| AC6 | **Given** a paid order, **when** I issue a full refund, **then** everything not yet refunded is refunded. | Story 74 |
| AC7 | **Given** a paid order, **when** I issue a partial refund, **then** I enter an amount and a reason, and only that amount is refunded. | Story 74 |
| AC8 | **Given** earlier refunds, **when** I issue another, **then** the total refunded never exceeds the amount paid, and I see how much is left. | Story 74 |
| AC9 | **Given** a refund is made, **when** it's saved, **then** the shopper is emailed the amount, reason, and timing. | Story 75 |
| AC10 | **Given** a refund fails, **when** that happens, **then** it's marked failed and I can try again. | Story 74 |
| AC11 | **Given** I open an order, **when** its page loads, **then** I see items, contact details, address, payment reference, status history, and every refund. | Stories 29, 74 |
| AC12 | **Given** a non-admin tries any of this, **when** the server receives it, **then** it's refused; every change and refund is recorded with who and when. | Stories 52, 74 |
| AC13 | **Given** I tap "Refund" twice, **when** the server processes it, **then** only one refund is made. | Story 74 |

## Step 2: Stories and Points

**Story 53 (status emails) moves from should-have to must-have**, since this user story requires an email on every change.

### Story 73: Filter admin orders by status and date

**Points:** 3 | **Priority:** Must have | **Dependencies:** Story 29 | **Covers:** AC1, AC2, AC3

- **Given** I open the admin orders page, **when** it loads, **then** orders are newest first, 20 at a time, each with order number, date, customer, total, status, and refund status (none, partial, or full).
- **Given** I choose a status, **when** the list updates, **then** only that status is shown; "All" shows every order.
- **Given** I choose a start and end date, **when** the list updates, **then** only orders placed in that range (Ghana time, both dates included) are shown.
- **Given** both filters, **when** the list updates, **then** they apply together, and "Clear filters" resets them.
- **Given** the end date is before the start date, **when** I apply it, **then** I see a clear message, and the server refuses it too.

### Story 74: Issue a full or partial refund

**Points:** 5 | **Priority:** Must have | **Dependencies:** Stories 29, 56 | **Covers:** AC6, AC7, AC8, AC10, AC11, AC12, AC13

- **Given** a paid order with money left to refund, whatever its status (Decision 84), **when** I choose "Full refund," **then** everything not yet refunded is refunded through Paystack.
- **Given** a paid order, **when** I choose "Partial refund," **then** I enter an amount and a required reason (up to 200 characters), and only that amount is refunded.
- **Given** earlier refunds, **when** I open the refund form, **then** I see how much is left, and the server refuses any amount above that, or zero or less.
- **Given** a refund fails, **when** Paystack reports it, **then** it's marked failed, and I can try again.
- **Given** I tap "Refund" twice, **when** the server processes it, **then** only one refund is made.
- **Given** I open an order, **when** its page loads, **then** I see every refund with its amount, reason, status, date, and who issued it.
- **Given** a refund is made, **when** it's saved, **then** the order's status doesn't change, and no stock is returned (Decisions 81, 82).

**Technical notes:** The shared `Refund` table gains `reason`, `type` (cancellation, full, or partial), and `issuedByUserId`. "Left to refund" is the amount paid minus all refunds that haven't failed. The server locks the order while checking.

### Story 75: Refund email to the shopper

**Points:** 2 | **Priority:** Must have | **Dependencies:** Stories 43, 74 | **Covers:** AC9

- **Given** the admin issues a refund, **when** it's saved, **then** the shopper gets an email with the amount, the reason, and "Refunds usually take a few business days to reach your mobile money wallet."
- **Given** the email fails, **when** that happens, **then** the refund still stands and the failure is logged.

### Epic 15 Summary

| # | Story | Points | Priority | Covers |
|---|---|---|---|---|
| 73 | Filter admin orders by status and date | 3 | Must | AC1, AC2, AC3 |
| 74 | Issue a full or partial refund | 5 | Must | AC6–AC8, AC10–AC13 |
| 75 | Refund email to the shopper | 2 | Must | AC9 |
| | **Total** | **10** | | |

## Step 3: Product Owner Decisions

Decided 25 Sep 2026.

| # | Question | Decision | Why | Alternatives considered |
|---|---|---|---|---|
| 80 | Build for the project? | Yes: filters, order details, status buttons, and a refund form. The "admin stays minimal" rule becomes "only the admin features in the plan." | It's a user story, and it makes a strong demo. It comes after the core shopping features. | Keep the plain table. |
| 81 | Does a refund change the status? | No. Refunds and statuses are separate; the order shows a refund status (none, partial, or full). Cancel handles cancelling. | Clear actions: a Delivered order with a damaged item stays Delivered. | A full refund cancels the order. |
| 82 | Does a refund return stock? | No. Only cancelling returns stock. | A refunded damaged item can't be resold. | Return stock on full refunds. |
| 83 | What if test mode can't do partial refunds? | Check in BE0. If not, record the refund as "requested" and explain it in the README. | The demo works either way, honestly. | Skip partial refunds. |
| 84 | Which orders can be refunded? | Any paid order with money left to refund, whatever its status. | Problems can appear after delivery. | Only Delivered, or only Pending. |
| 85 | Is a reason required? | Yes, up to 200 characters; it's included in the shopper's email. | A clear record for everyone. | Optional. |
| 86 | Date filter time zone? | Ghana time, both dates included. Ghana uses UTC all year, with no daylight saving. | Matches how the admin thinks about dates. | Server time. |
| 87 | Which changes send emails? | Shipped and Delivered (Story 53), and Cancelled (Story 57). | Every change a shopper cares about, with no duplicates. | — |
| 88 | Must-have? | Yes: Stories 73–75, plus Story 53. | Needed to fulfil orders. | — |

## Step 4: Developer Review

| Story | Before | After | Reason |
|---|---|---|---|
| 53 | 2 (should) | 2 (must) | Moved to must-have (Decision 87). |
| 73 | 3 | 3 | Confirmed. Dates are checked on the server as well as the page. |
| 74 | 5 | 5 | Confirmed. Shares one refund service with Story 56, so cancelling and admin refunds work the same way. |
| 75 | 2 | 2 | Confirmed. |

**Refund status is calculated, not stored:** the order's refund status (none, partial, or full) is worked out from its refunds each time, so it can never get out of step with them.

---

# Epic 16: Moderate Reviews (Admin)

## Step 1: User Story and Acceptance Criteria

**User story:** As an admin, I want to moderate reviews, so that inappropriate content is removed.

**Original criteria:** I can hide or delete a review, and hidden reviews don't count toward the average rating.

| AC | Criterion | Covered by |
|---|---|---|
| AC1 | **Given** I'm the admin, **when** I open the reviews page, **then** I see all reviews newest first, and can filter to visible or hidden. | Story 76 |
| AC2 | **Given** a review, **when** I hide it with a reason, **then** shoppers no longer see it. | Story 64 |
| AC3 | **Given** a review is hidden, **when** ratings are calculated, **then** it's left out of the average, count, breakdown, and list ratings. | Stories 61, 62, 64, 65 |
| AC4 | **Given** I hid a review by mistake, **when** I unhide it, **then** it's shown and counted again. | Story 64 |
| AC5 | **Given** my review was hidden, **when** I view the product, **then** I see it marked "Hidden by the store." | Story 64 |
| AC6 | **Given** a review, **when** I delete it and confirm, **then** it's removed permanently, and the average and count update. | Story 77 |
| AC7 | **Given** I hide, unhide, or delete a review, **when** it's saved, **then** it's recorded with who, when, and why. | Story 78 |
| AC8 | **Given** a non-admin tries any of this, **when** the server receives it, **then** it's refused. | Stories 64, 76, 77 |

## Step 2: Stories and Points

Story 64 (hide and unhide) already exists; see Epic 11. Three new stories:

### Story 76: Admin reviews list

**Points:** 2 | **Priority:** Should have | **Dependencies:** Stories 52, 59 | **Covers:** AC1, AC8

- **Given** I open the admin reviews page, **when** it loads, **then** I see reviews newest first, 20 at a time, with product, reviewer, stars, text, date, and status (visible or hidden).
- **Given** I choose "Visible" or "Hidden," **when** the list updates, **then** only those reviews are shown.
- **Given** a non-admin tries to open it, **when** the server receives it, **then** it's refused.

### Story 77: Delete a review (admin)

**Points:** 2 | **Priority:** Should have | **Dependencies:** Story 76 | **Covers:** AC6, AC8

- **Given** a review, **when** I choose "Delete," enter a reason, and confirm, **then** it's removed permanently, and the product's average, count, and breakdown update.
- **Given** I tap "Delete" twice, **when** the server processes it, **then** it's deleted once, with no error for the second tap.

### Story 78: Moderation record

**Points:** 2 | **Priority:** Should have | **Dependencies:** Stories 64, 77 | **Covers:** AC7

- **Given** I hide, unhide, or delete a review, **when** it's saved, **then** a record keeps the action, reason, admin, and date.
- **Given** a review is deleted, **when** its record is saved, **then** it keeps a copy of the stars and text.
- **Given** a reviewer's review was deleted, **when** they try to review that product again, **then** they're refused (Decision 91, full product only).

### Epic 16 Summary

| # | Story | Points | Priority | Covers |
|---|---|---|---|---|
| 76 | Admin reviews list | 2 | Should | AC1, AC8 |
| 77 | Delete a review (admin) | 2 | Should | AC6, AC8 |
| 78 | Moderation record | 2 | Should | AC7 |
| | **Total** | **6** | | |

## Step 3: Product Owner Decisions

Decided 25 Sep 2026.

| # | Question | Decision | Why |
|---|---|---|---|
| 89 | What's built for the project? | Stories 64, 76, and 77 (hide, unhide, delete, admin list). Story 78 is a stretch. This updates Decision 65. | Covers the whole user story with the least extra work. |
| 90 | Is a reason required? | Yes, for hiding and deleting, up to 200 characters. | A clear explanation for each action. |
| 91 | Can someone review again after their review is deleted? | Project: yes, and the admin can hide it again. Full product: no; Story 78's record blocks reposting. | Blocking needs the record, which is a stretch for the project. |
| 92 | Does editing a hidden review make it reappear? | No. It stays hidden until the admin unhides it. | Stops a small edit bringing abuse back. |
| 93 | Is the reviewer emailed? | Not now; a could-have for later. | They already see "Hidden by the store." |
| 94 | Priority in the full product? | Should-have, the same as reviews. | Moderation can't matter more than the reviews themselves. |

## Step 4: Developer Review

| Story | Before | After | Reason |
|---|---|---|---|
| 64 | 3 | 3 | Confirmed. Now built for the project; a reason is required, and editing keeps a review hidden. |
| 76 | 2 | 2 | Confirmed. |
| 77 | 2 | 2 | Confirmed. Separate from the shopper's own delete (Story 63). |
| 78 | 2 | 2 | Confirmed. A stretch for the project. |

**Scope note:** after this story, new stories go into this backlog as "later" rather than into the project build, so the project can be finished on time.

---

# Epic 17: Low-Stock Alerts (Admin)

## Step 1: User Story and Acceptance Criteria

**User story:** As an admin, I want low-stock alerts, so that products don't sell out unexpectedly.

**Original criteria:** When stock falls below a threshold I set, I'm notified on the dashboard.

| AC | Criterion | Covered by |
|---|---|---|
| AC1 | **Given** I'm the admin, **when** I set a low-stock threshold, **then** it's saved. | Story 79 (one threshold); Story 82 (per product, later) |
| AC2 | **Given** a product's stock falls to or below the threshold, **when** that happens, **then** it's shown as an alert. | Story 80 |
| AC3 | **Given** there are alerts, **when** I open the admin dashboard, **then** I see each low-stock product with its stock and the threshold; out-of-stock products are highlighted. | Story 80 |
| AC4 | **Given** there are alerts, **when** I'm anywhere in the admin area, **then** I see a badge with their number. | Story 81 |
| AC5 | **Given** a product is already low, **when** more units sell, **then** there's no repeat alert; it just shows the new stock. | Story 80 |
| AC6 | **Given** a low product is restocked above the threshold, **when** stock is updated, **then** its alert clears. | Story 80 |
| AC7 | **Given** a non-admin tries to see or change alerts, **when** the server receives it, **then** it's refused. | Stories 79, 80 |

## Step 2: Stories and Points

### Story 79: Set the low-stock threshold

**Points:** 1 | **Priority:** Should have | **Dependencies:** F5 | **Covers:** AC1, AC7

- **Given** I'm on the admin dashboard, **when** I change the threshold (a whole number from 0 to 1,000) and save, **then** it's used for all products straight away. The default is 5.
- **Given** an invalid value, **when** I save, **then** it's refused with a clear message.

### Story 80: Admin dashboard with low-stock alerts

**Points:** 2 | **Priority:** Should have | **Dependencies:** Stories 52, 76, 79, F4 | **Covers:** AC2, AC3, AC5, AC6, AC7

- **Given** I open the admin dashboard, **when** it loads, **then** I see every active product at or below the threshold, lowest stock first, with its stock and the threshold; out-of-stock products are highlighted.
- **Given** stock changes (an order, a cancellation, or an update), **when** I reload the dashboard, **then** the alerts reflect the new stock, with no duplicates, and restocked products disappear from the list.
- **Given** I open the dashboard, **when** it loads, **then** I also see counts of Pending orders and Hidden reviews, linking to those pages.
- **Given** a non-admin tries to open it, **when** the server receives it, **then** it's refused.

**Technical notes:** Alerts are calculated live from stock and the threshold, not stored, so they can't repeat or go stale.

### Story 81: Low-stock badge

**Points:** 1 | **Priority:** Should have | **Dependencies:** Story 80 | **Covers:** AC4

- **Given** there are low-stock products, **when** I'm anywhere in the admin area, **then** the admin menu shows a badge with their number; with none, no badge is shown.

### Story 84: Sales summary on the dashboard

**Points:** 3 | **Priority:** Should have | **Dependencies:** Stories 25, 74, 80 | **Covers:** Teacher requirement (sales summary)

As an admin, I want a sales summary on the dashboard, so that I can see how the store is doing at a glance.

- **Given** I open the dashboard, **when** it loads, **then** I see **Revenue**, **Orders**, and **Average order value** for the chosen period, in GHS.
- **Given** I choose a period (Today, Last 7 days, Last 30 days, or All time), **when** the summary updates, **then** it uses Ghana time, with Last 7 days as the default.
- **Given** refunds have been made, **when** revenue is calculated, **then** it's the amount paid minus refunds that haven't failed (Decision 101).
- **Given** Cancelled orders, **when** orders are counted, **then** they're left out (Decision 102).
- **Given** no orders in the period, **when** the summary loads, **then** it shows GH₵ 0.00, 0 orders, and "—" for the average, not an error.

**Technical notes:** All amounts are calculated on the server in pesewas. Average order value = revenue ÷ orders, rounded to the nearest pesewa.

### Story 82: Thresholds per product, and when stock became low

**Points:** 3 | **Priority:** Could have | **Dependencies:** Story 80 | **Covers:** AC1 (per product)

- **Given** a product, **when** I set its own threshold, **then** it's used instead of the default.
- **Given** a product becomes low, **when** I view the dashboard, **then** I see when it became low.

### Story 83: Email low-stock alerts to the admin

**Points:** 2 | **Priority:** Could have | **Dependencies:** Stories 43, 80 | **Covers:** Decision 98

- **Given** a product first falls to or below its threshold, **when** that happens, **then** the admin gets one email about it, not one per sale.

### Epic 17 Summary

| # | Story | Points | Priority | Covers |
|---|---|---|---|---|
| 79 | Set the low-stock threshold | 1 | Should | AC1, AC7 |
| 80 | Admin dashboard with low-stock alerts | 2 | Should | AC2, AC3, AC5, AC6, AC7 |
| 81 | Low-stock badge | 1 | Should | AC4 |
| 84 | Sales summary on the dashboard | 3 | Should | Teacher requirement |
| 82 | Thresholds per product, and when stock became low | 3 | Could | AC1 |
| 83 | Email low-stock alerts to the admin | 2 | Could | Decision 98 |
| | **Total** | **12** | | |

## Step 3: Product Owner Decisions

Decided 25 Sep 2026.

| # | Question | Decision | Why |
|---|---|---|---|
| 95 | Build for the project? | Yes, the simple version: Stories 79, 80, and 81, plus the sales summary (Story 84). The "no dashboards" rule becomes "one simple admin dashboard, as described in the plan." | The app has an admin dashboard, and this version is small and demos well. |
| 96 | One threshold or one per product? | One threshold for all products (default 5), changeable on the dashboard. Per product is later (Story 82). | Simple, and enough for 16 products. |
| 97 | Stored alerts or calculated live? | Calculated live from stock. | No repeats, and alerts clear on restock automatically. |
| 98 | Email alerts? | Not now; a could-have (Story 83). | The dashboard covers the user story. |
| 99 | What's on the dashboard? | Low-stock alerts, the threshold setting, and counts of Pending orders and Hidden reviews, with links. No charts. | Useful at a glance, without becoming a big feature. |
| 101 | How is revenue calculated? | Amount paid minus refunds that haven't failed. | Shows the money the store actually keeps. |
| 102 | Do Cancelled orders count? | No, they're left out of the order count (they're fully refunded anyway). | The average isn't dragged down by orders that didn't happen. |
| 103 | Which periods? | Today, Last 7 days (default), Last 30 days, and All time, in Ghana time. No charts. | Enough to see how the store is doing; charts can come later. |
| 100 | Is the shopper's "Only X left" label linked to this threshold? | No. It stays at 5 or fewer (Decision 73). | The shopper label is about urgency; the admin threshold is about restocking, and they may need different numbers. |

## Step 4: Developer Review

| Story | Before | After | Reason |
|---|---|---|---|
| 79 | — | 1 | Confirmed. Stored as a `Setting` (`lowStockThreshold`). |
| 80 | — | 2 | Confirmed. Calculated live; the counts reuse existing queries. |
| 81 | — | 1 | Confirmed. |
| 82 | — | 3 | Later. |
| 83 | — | 2 | Later. |
| 84 | — | 3 | Added at the teacher's request. Revenue, order count, and average are calculated on the server for the chosen period. |

**Demo without a restock feature:** the seed data already has a low-stock and an out-of-stock product, so alerts appear straight away, and cancelling an order returns stock, so an alert can be shown clearing.

---

# Backlog Totals

| Epic | Stories | Points | Must-have | Should-have |
|---|---|---|---|---|
| 0. Foundations | F1–F7 | 33 | 33 | 0 |
| 1. Add to Cart | 1–6, 9, 10, 15 | 31 | 26 | 5 |
| 2. Manage Cart Items | 11–14 | 17 | 17 | 0 |
| 3. Save the Cart | 7, 8a, 8b, 16, 17 | 15 | 2 | 13 |
| 4. Checkout and Payment | P1, 18–26, 28, 29 | 42 | 42 | 0 |
| 5. Prices in My Currency | 30–36 | 21 | 0 | 0 |
| 6. Pay with Mobile Money | 37–42 | 20 | 20 | 0 |
| 7. Order Confirmation | 27, 43–46 | 16 | 14 | 2 |
| 8. Account Email Security | 47–49 | 10 | 10 | 0 |
| 9. Order History and Status | 50–54 | 15 | 13 | 0 |
| 10. Cancel an Order | 55–58 | 14 | 12 | 2 |
| 11. Ratings and Reviews | 59–64 | 17 | 0 | 17 |
| 12. Read Reviews | 65, 66 | 4 | 0 | 4 |
| 13. Product Details | 67 | 1 | 0 | 1 |
| 14. Browse by Category | 68–72 | 11 | 8 | 3 |
| 15. Manage Orders (Admin) | 73–75 | 10 | 10 | 0 |
| 16. Moderate Reviews (Admin) | 76–78 | 6 | 0 | 6 |
| 17. Low-Stock Alerts and Dashboard (Admin) | 79–84 | 12 | 0 | 7 |
| **Total** | **93** | **295** | **207** | **60** |

Could-have stories (Epic 5's 21 points, Story 54's 2 points, and Stories 82–83's 5 points) are not counted in the must or should columns.

The first releasable version (all must-have stories) is **207 points**.

---

# Delivery Plan (Full Product)

This is the plan for building the complete product as a real business. For the final project, follow `docs/backend-plan.md` and `docs/frontend-plan.md` instead.


**Assumptions:** Two-week sprints, one developer, and a starting guess of 10–15 points per sprint. After Sprint 2, replace the guess with the real average of points finished and re-plan the remaining sprints.

| Sprint | Stories | Points | Outcome |
|---|---|---|---|
| 0 | Spike P1 | 2 | Provider chosen, business account open (mostly paperwork; start now) |
| 1 | F1, F5 | 13 | Deployable project with sign-in and admin role |
| 2 | F2, F4, F7, Story 43 | 15 | Admin can add products, prices, and stock; analytics and email sending live |
| 3 | F3, F6, Story 1 | 13 | Shoppers can browse and add items to a cart |
| 4 | Stories 2, 3, 5, 15, 47 | 13 | Out-of-stock handling, quantity merging, variant choice, admin limits, email verification |
| 5 | Stories 4, 6, 9 | 11 | Stock limits, subtotal with price notices, add-to-cart errors |
| 6 | Stories 11, 12, 48 | 15 | Change quantities and remove items; login code |
| 7 | Stories 13, 14, 17, 20, 49 | 14 | Cart finished; private cart on logout; payment provider connected; login alerts |
| 8 | Stories 18, 28, 19 | 11 | Delivery address, delivery zones and tax rates, full order total |
| 9 | Stories 21, 22, 24 | 10 | Pay by card, declined payments, no double charges |
| 10 | Stories 23, 25, 27 | 13 | Price and stock recheck, orders created, confirmation page and email |
| 11 | Stories 26, 29, 42, 44 | 13 | Payment recovery, admin order list, manual refund records, private confirmation links |
| 12 | Stories 37, 38, 40, 52 | 15 | Pay by mobile money, with rejection handling; admin order status updates |
| 13 | Stories 39, 41, 50 | 11 | Mobile money time-outs and late approvals; shopper order list |
| 14 | Stories 46, 51, 55 | 11 | Email monitoring, order details and status history, shopper cancellation |
| 15 | Stories 56, 57, 68, 69, 70, 71 | 15 | Refunds, cancellation emails, and browsing by category |
| 16 | Stories 53, 73, 74, 75 | 12 | Status emails, admin order filters, full and partial refunds, refund emails; **first release (207 points)** |
| 17 | Stories 7, 16, 10 | 10 | Saved carts across visits and devices, cart expiry, unavailable-item warnings |
| 18 | Stories 8a, 8b, 45, 58 | 12 | Guest items kept on login, resend confirmation email, guest cancellation |
| 19 | Stories 59, 60, 61 | 10 | Write, edit, and read reviews |
| 20 | Stories 62, 63, 64, 65, 66, 67, 72 | 15 | Ratings in the product list, delete and hide reviews, rating breakdown, review sorting, low-stock label, admin categories |
| 21 | Stories 76, 77, 78, 79, 80, 81, 84 | 13 | Admin reviews list, deleting reviews, moderation record, admin dashboard with low-stock alerts and sales summary |
| Later | Story 54 | 2 | Guest orders shown after verified sign-up |
| Later | Stories 30, 36, 31, 32 | 13 | Exchange rates, USD buffer, currency selector, USD prices across the store |
| Later | Stories 33, 34, 35 | 8 | USD checkout and orders (**USD release**) |

At this pace, the first release, a store taking card and mobile money payments in GHS, is ready after about 16 sprints (about 32 weeks), and the should-have stories after about 21 sprints (about 42 weeks). USD is scheduled only after the review about 3 months after launch (Decision 26); if it goes ahead, it takes about 2 sprints.

**If this is too long:** Reuse proven tools instead of building (an authentication provider for F5, a hosted analytics tool for F7). Story 14's cross-device check could move to should-have, saving about 2–3 points from the first release.

---

# What's Next

- **For the final project:** follow `docs/backend-plan.md` and `docs/frontend-plan.md`, starting with Task 0. Payments are mobile money only for now; cards come later.
- **If this became a real business:** start Spike P1 (payment provider and business account), register a domain name for email (Decision 38), and hold the USD review about 3 months after launch (Decision 26).
- **Future user story:** "As the store owner, I want to add products and upload their images in the app, so that I can grow the store without editing the database." (For now, images are uploaded to Cloudinary by hand; see `docs/backend-plan.md` and `docs/frontend-plan.md`.)
- **Future ideas:** review photos and "helpful" votes, courier tracking numbers (Decision 54), a cancellation time window or "Packing" status (Decision 59), "Saved for later" (Decision 10), stock reservation for flash sales (Decision 1), PayPal as an extra payment option (Decision 16), automatic currency by location (Decision 27), SMS confirmations (Decision 41), "trust this device" (Decision 42), login alerts only for new devices (Decision 46), more languages (Decision 5).
