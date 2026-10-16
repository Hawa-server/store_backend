# BE25: Link Guest Orders and Carts to a New Account

An extra task, added after the presentation (teacher's feedback). When someone **pays as a guest** and later **creates an account with the same email**, their account should include:

1. **Their guest orders**, in My Orders, with status history, tracking emails, cancellation (while Pending), and reviews once Delivered.
2. **Their leftover guest cart**: anything still in the cart they used as a guest, even on another phone or browser.

It is **separate from `docs/backend-plan.md`**; follow `CLAUDE.md` and the plan's existing rules (transactions, lock order, deadlock retry, error format, comments for learning). It replaces the line "Linking guest orders to accounts created later" in the plan's *Out of scope* list.

---

## The safety rule: only after the email is proven

Orders hold a name, phone number and address, so they must never be handed to someone who only **typed** an email. Linking happens **only for verified accounts**:

- right after **email verification** succeeds (the person has just proved they own the inbox), and
- on every **login** (to catch guest orders placed later, while logged out).

Why this is safe: the guest's confirmation email, with a private link to the order, was already sent to that inbox. Linking gives the inbox's owner nothing they couldn't already open.

An **unverified** account never gets anything linked (and can't log in anyway).

---

## What gets linked

### Orders

All orders where `userId IS NULL` and the order's `email` matches the account's email (compared **case-insensitively and trimmed**: `Ama@Mail.com ` = `ama@mail.com`). Set `userId` to the account and `linkedAt` to now.

- Cancelled and refunded orders are linked too (they're part of the shopper's history).
- Orders already belonging to **another** account are never touched.
- After linking, the existing rules just work: My Orders lists them, `canCancel` is true while Pending, and Delivered orders count for **review eligibility** (the plan's "only orders placed while logged in" rule becomes "orders that belong to the account").

### Leftover guest carts

Guest carts are tied to a browser cookie, not an email, so the server finds them through **paid checkouts**:

- Find guest carts (`userId IS NULL`, not expired) that are the `cartId` of a **paid** `Checkout` whose email matches.
- Merge each into the account's cart with the **existing login merge** (add quantities for duplicates, cap by current stock, skip inactive products), then delete the guest cart.
- The other browser's guest cookie then points to nothing, which is already handled (treated as an empty cart, cookie cleared).
- Carts from **unpaid** checkouts aren't merged: only a payment shows the guest really used that email.

The normal same-browser merge at login (BE6) is unchanged and still runs.

---

## Data

Migration:

```text
Order: add linkedAt (DATETIME, nullable)    ← when a guest order was linked to an account
Order: add an index on (email, userId)     ← fast lookups for linking
Checkout: add an index on (email, status)
```

Store order and checkout emails **lower-cased and trimmed** from now on (normalise in the Zod schema). The linking query also compares with `LOWER(TRIM(email))`, so older rows still match.

---

## How it's built

One service, `services/guestLinkService.js`, with one function: `linkGuestActivity(userId)`.

1. Load the user; stop if not verified.
2. **Transaction** (with the existing deadlock retry):
   - lock and update matching guest orders (`userId`, `linkedAt`);
   - find the matching guest carts through paid checkouts;
   - merge them with the existing cart-merge helper, taking locks in the usual order (guest carts, then the account cart, then products).
3. Return `{ ordersLinked, cartItemsAdded, cartItemsReduced }` (reduced = quantities capped by stock or dropped because a product is inactive).

It's called:

- in `POST /api/auth/verify`, **after** the verification is committed;
- in login, **after** the login cookie is set (after the login code step, when it's on), alongside the existing guest-cart merge.

**If linking fails, the verification or login still succeeds.** The error is logged, and linking simply runs again at the next login (the function is safe to repeat: already-linked orders no longer match `userId IS NULL`).

---

## API changes

`POST /api/auth/verify` and the login response gain a `linked` object:

```json
{
  "user": { "...": "..." },
  "linked": { "ordersLinked": 2, "cartItemsAdded": 3, "cartItemsReduced": 0 }
}
```

All zeros when nothing was found. No new endpoints, and no emails are sent.

Admin order details show "Placed as a guest, linked to this account on 14 Oct 2026" when `linkedAt` is set.

---

## Done when

- [ ] A guest pays with `ama@test.com`, then registers and verifies with `Ama@Test.com`: the order appears in My Orders with its status history.
- [ ] Items left in that guest cart (on another browser) are in the new account's cart, capped by stock.
- [ ] Before verification, nothing is linked.
- [ ] A guest order placed later, while logged out, is linked at the next login.
- [ ] A linked Pending order can be cancelled from My Orders; a linked Delivered order allows reviews.
- [ ] Orders belonging to another account, and carts from unpaid checkouts, are never linked.
- [ ] Running linking twice changes nothing the second time; a linking error doesn't block verification or login.
- [ ] `docs/api.md`, `docs/backend-guide.md`, and the README are updated.

## Testing

A script (cleans up after itself): place two guest orders with one email in different capitals, one Delivered; leave items in the guest cart; register with the same email in another case; check nothing is linked before verifying; verify; check the orders, cart, review eligibility and cancellation; place another guest order and log in again; repeat the linking and check nothing doubles; try another account's order and an unpaid checkout's cart. Then test once on the live site with a real test payment and an Ethereal inbox.

---

## Prompt for Claude Code

```
Start the extra task in docs/BE25-link-guest-orders.md (it's not in
backend-plan.md). Follow CLAUDE.md and the plan's existing rules.
Explain your plan first and wait for my OK.
```
