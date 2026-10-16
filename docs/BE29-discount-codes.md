# BE29: Discount Codes

An extra task. The admin creates codes such as `ADORN10`, and shoppers enter them at checkout for money off. **The server decides everything**: whether a code is valid, how much it takes off, and the final total.

It is **separate from `docs/backend-plan.md`**; follow `CLAUDE.md` and the plan's existing rules (money in pesewas, integer maths only, the server recalculates totals, transactions and locks, error format, admin router, comments for learning). Build it **after BE24** (delivery fees), because checkout changes in both.

---

## What a code can be

| Field | Rules |
|---|---|
| `code` | 3–20 characters, letters and digits only, stored **uppercase**; unique. Shoppers can type it in any case. |
| `type` | `percent` (1–90 % off) or `fixed` (GH₵ 1–1,000 off, in pesewas) |
| `value` | The percent (whole number) or the amount in pesewas |
| `maxDiscountPesewas` | Optional cap for percent codes (for example, 20 % off, at most GH₵ 50) |
| `minSubtotalPesewas` | Optional minimum order (for example, only on orders over GH₵ 200) |
| `startsAt`, `endsAt` | Optional dates (Ghana time); outside them the code doesn't work |
| `usageLimit` | Optional total number of paid orders that can use it |
| `oncePerCustomer` | Default **true**: one paid order per email address (works for guests too) |
| `isActive` | The admin can switch it off |

### How the discount is worked out

- The discount applies to the **products' subtotal only**, never to the delivery fee.
- `percent`: `floor(subtotal × percent ÷ 100)`, then capped by `maxDiscountPesewas`. Integer maths only.
- `fixed`: the amount, but **never more than the subtotal** (the products can't go below GH₵ 0).
- `total = subtotal − discount + deliveryFee`. The total is never below the delivery fee.
- **One code per order.**

---

## Data

```text
DiscountCode: id, code UNIQUE, type, value, maxDiscountPesewas?, minSubtotalPesewas?,
              startsAt?, endsAt?, usageLimit?, oncePerCustomer, isActive,
              timesUsed (paid orders), createdByUserId, createdAt, updatedAt

DiscountRedemption: id, discountCodeId (FK), orderId (FK, UNIQUE), email (lower-case),
                    discountPesewas, createdAt
```

`Checkout` and `Order` gain `discountCodeId?`, `discountCode?` (a copy of the text) and `discountPesewas` (default 0). Old rows stay valid with 0.

---

## Endpoints

### Shopper

```text
POST /api/discounts/check    { code }
```

Checks the code against the shopper's **current cart** (guest or account, from the cookie) and returns `{ code, discountGhs, discountUsd, subtotalGhs, message }` (for example "20% off: you save GH₵ 24.00"). It only previews; nothing is reserved. Rate limit: 10 per 15 minutes per IP (stops guessing codes).

**Errors** (400 `DISCOUNT_INVALID`, with one clear message each; never reveal more than needed):
- unknown or switched off: "This code isn't valid."
- not started or expired: "This code has expired." / "This code isn't active yet."
- under the minimum: "Spend GH₵ 200.00 or more to use this code."
- used up: "This code has reached its limit."
- already used by this email: "You've already used this code." (checked at checkout, when the email is known)

### Checkout (`POST /api/checkout`, changed)

The body gains an optional `discountCode`. The server checks the code again (all the rules above, including once per email with the checkout's email), works out the discount, and saves the code, discount and new total on the `Checkout`. If the code fails, checkout answers 400 with `fields.discountCode` and the message, so the shopper can remove it and continue.

### Fulfilment (after payment, changed)

In the order's transaction: **lock the code's row**, create the `DiscountRedemption`, and add 1 to `timesUsed`. The order **keeps the discount it was charged**, even if the code expired or hit its limit while the shopper was paying: they already paid that amount, so the order must match the payment. (This can push `timesUsed` slightly over `usageLimit` in rare cases; that's accepted and shown to the admin.)

**Cancelled or refunded orders don't give the use back** (keeps the rule simple and stops abuse).

### Orders, emails and refunds

- Order responses, the confirmation page and emails show a **Discount** line ("Discount (ADORN10) − GH₵ 24.00") between Subtotal and Delivery.
- **Refunds:** the most that can be refunded is still the order's **total paid** (already the rule), so a discounted order can never refund more than the shopper paid.
- The dashboard's revenue uses order totals, so it already counts discounts correctly.

### Admin

On the existing admin router (401/403 as usual):

```text
GET   /api/admin/discount-codes?status=&page=     list with timesUsed and status (active, scheduled, expired, used up, off)
GET   /api/admin/discount-codes/:id               details and the last 20 redemptions (order number, email, discount, date)
POST  /api/admin/discount-codes                    create
PATCH /api/admin/discount-codes/:id                edit
```

- **No deletes.** A code that has been used can't change its `code`, `type` or `value` (409; create a new code instead); its dates, limits and on/off can still change. An unused code can be edited freely.
- Duplicate code → 409 with `fields.code`.

---

## Done when

- [ ] Percent, fixed, capped, minimum-order, dated, limited and once-per-customer codes all work as described, with integer maths.
- [ ] The discount never applies to delivery, never makes products negative, and the total equals subtotal − discount + delivery.
- [ ] A changed total sent by the browser is ignored; the server's total is charged by Paystack.
- [ ] A shopper can't use a once-per-customer code twice with the same email (guest or account).
- [ ] An order keeps its discount even if the code expires during payment; `timesUsed` counts paid orders only.
- [ ] Refunds never exceed the amount paid on a discounted order.
- [ ] The admin can create, list, edit and switch off codes; used codes can't change their value.
- [ ] `docs/api.md`, `docs/backend-guide.md`, and the README are updated.

## Testing

A script (cleans up after itself): each code type and rule; the check endpoint for every error; checkout with a valid and an invalid code; a code that expires between checkout and fulfilment; two checkouts racing for the last use; once-per-customer for a guest and an account; a full and a partial refund on a discounted order; admin create, edit, edit-after-use (409) and switch off. Then a real test payment with `ADORN10` on the live site.

---

## Prompt for Claude Code

```
Start the extra task in docs/BE29-discount-codes.md (it's not in
backend-plan.md). Follow CLAUDE.md and the plan's existing rules. Explain
your plan first and wait for my OK.
```
