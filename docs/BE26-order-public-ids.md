# BE26: Random IDs (UUIDs) for Orders

An extra task, added after the presentation (teacher's feedback). Order pages currently show the database's counting number in the address, for example `/orders/9`. That number:

- **can be guessed:** the next person tries `/orders/8` (Adorn already answers "Order not found" for someone else's order, but the address still invites trying), and
- **reveals business information:** order 9 tells anyone the store has had about 9 orders.

After this task, every order address uses a **UUID**, a long random ID such as `/orders/3f2a9c1e-7b4d-4e8a-9f01-6c2d5e8b7a43`, which can't be guessed and reveals nothing. **The counting number never leaves the server.**

It is **separate from `docs/backend-plan.md`**; follow `CLAUDE.md` and the plan's existing rules (error format, Zod validation, ownership checks, admin router, comments for learning).

---

## The approach: a public ID beside the internal ID

| Column | Used for | Seen by shoppers? |
|---|---|---|
| `id` (1, 2, 3…) | Inside the database: foreign keys, joins (`OrderItem.orderId`, `Refund.orderId`, …) | **Never** |
| `publicId` (UUID, new) | Every API address, response, and email link | Yes |
| `orderNumber` (existing) | What people read and say ("order ADN-…") | Yes |

Keeping the integer `id` inside the database means **no foreign keys, joins, or seeds change**, which keeps the migration small and safe on a live database. Replacing every primary key with a UUID would also work, but would rewrite every table for no extra benefit here.

---

## Data

Migration, in three steps so existing orders get an ID:

1. Add `Order.publicId CHAR(36)`, nullable.
2. Fill it for every existing order with `crypto.randomUUID()` (Node's built-in; no new library).
3. Make it `NOT NULL` and `UNIQUE`.

The `Order` model sets `publicId` automatically on creation (`defaultValue: () => crypto.randomUUID()`), so no code that creates orders needs to remember it.

**Check `orderNumber`:** if it's built from the counting number (for example `ADN-000009`), it reveals the order count too. If so, change new order numbers to a **date plus random letters** (for example `ADN-241012-K7QM`, unique, retried on a clash); old orders keep their numbers.

---

## Endpoints (changed)

Every order route takes the `publicId` instead of the number:

```text
GET   /api/orders/:orderId
POST  /api/orders/:orderId/cancel
GET   /api/admin/orders/:orderId
PATCH /api/admin/orders/:orderId/status
POST  /api/admin/orders/:orderId/refunds
POST  /api/admin/orders/:orderId/refunds/:refundId/retry
```

- **Validation:** `:orderId` must be a UUID (Zod `.uuid()`). Anything else, **including an old number like `9`**, returns the same **404 "Order not found."** as a missing order (not 400), so nothing hints at what a real ID looks like.
- **Lookup:** shopper routes still check ownership: `where: { publicId, userId }`. Another person's order → the same 404. Admin routes look up by `publicId` only.
- Internally, after the lookup, the code keeps using the order's integer `id` for joins and updates.

### Responses

In every order response (shopper list and details, admin list and details, checkout verify, the guest confirmation page), the **`id` field now holds the `publicId`**. The integer is never sent. Because the field keeps its name, frontend code that builds links from `order.id` keeps working.

Refund IDs in the retry route stay as they are (they're only used by the admin, after loading an order by its UUID).

### Emails

Links in status emails become `{CLIENT_URL}/orders/<publicId>`. Old emails that link to `/orders/9` now show "Order not found" with a link to My Orders. (Only test emails exist, so this is acceptable.)

---

## Done when

- [ ] Every existing order has a unique `publicId`; new orders get one automatically.
- [ ] All order routes work with the UUID; `9`, `abc`, or a random UUID return 404 "Order not found."
- [ ] Another shopper's order UUID still returns 404.
- [ ] No API response or email contains an order's integer `id`.
- [ ] Order numbers don't reveal how many orders exist.
- [ ] Payments, webhooks, refunds, cancellations and guest confirmation pages still work.
- [ ] `docs/api.md`, `docs/backend-guide.md` (what a UUID is and why the integer stays inside), and the README are updated.

## Testing

A script (cleans up after itself): run the migration on a copy of the data and check every order has a unique UUID; place an order and read it by UUID; try `9`, a malformed ID, a random UUID, and another user's UUID (all 404); cancel and refund by UUID; search all API responses in the test for an integer `id` on orders. Then, on the live site, place a test order and check the address bar and the emails.

**Back up the production database before running this migration** (it changes every order row).

---

## Prompt for Claude Code

```
Start the extra task in docs/BE26-order-public-ids.md (it's not in
backend-plan.md). Follow CLAUDE.md and the plan's existing rules.
Explain your plan first and wait for my OK.
```
