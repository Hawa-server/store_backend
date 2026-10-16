# BE28: Wishlist

An extra task. Logged-in shoppers can **save products for later** (♡) and see them on a Wishlist page.

It is **separate from `docs/backend-plan.md`**; follow `CLAUDE.md` and the plan's existing rules (error format, Zod validation, CSRF header, `requireAuth`, ownership, comments for learning). Product IDs are the public IDs the API already uses (UUIDs since BE26).

---

## Rules

- **Logged-in shoppers only.** Guests see the ♡ but are asked to log in (frontend).
- A product can be saved **once** per shopper; saving again changes nothing (not an error).
- **Up to 100 products** per shopper (409 `WISHLIST_FULL`: "Your wishlist is full. Remove something to add more.").
- **Inactive products** can't be added (404, like a missing product). If a saved product becomes inactive later, it stays in the list marked unavailable, so the shopper understands why it can't be bought.
- Saving doesn't reserve stock or change prices; the list always shows the **current** price and stock.
- **Deleting an account** (BE27) also deletes its wishlist.

---

## Data

```text
WishlistItem: id, userId (FK, CASCADE), productId (FK, RESTRICT), createdAt
UNIQUE (userId, productId)
```

---

## Endpoints

All need `requireAuth` (401 if logged out); changes need the CSRF header.

```text
GET    /api/wishlist               the shopper's saved products, newest first
GET    /api/wishlist/ids           just the saved product IDs (for the ♡ on lists)
PUT    /api/wishlist/:productId    save (200 whether new or already saved)
DELETE /api/wishlist/:productId    remove (200 even if it wasn't saved)
```

- `GET /api/wishlist` returns each item with the product's name, current price (GH₵ and US$), main image, stock label data (`stock`), `isActive`, the category, and `savedAt`. 20 per page with the shared pagination format.
- `PUT` checks the product exists and is active; a duplicate save is caught by the unique index and treated as success (two quick taps never cause a 500).
- Rate limit: 60 changes per 15 minutes per user.

---

## Done when

- [ ] A shopper can save, list, and remove products; saving twice keeps one row.
- [ ] Inactive products can't be saved; saved ones that become inactive show as unavailable.
- [ ] The 101st product is refused with `WISHLIST_FULL`.
- [ ] Another shopper never sees or changes my wishlist; logged-out requests get 401.
- [ ] Deleting an account removes its wishlist.
- [ ] `docs/api.md`, `docs/backend-guide.md`, and the README are updated.

## Testing

A script (cleans up after itself): save, save again, list, ids, remove, remove again; an inactive product; the limit; two users; logged out; account deletion. Then Postman.

---

## Prompt for Claude Code

```
Start the extra task in docs/BE28-wishlist.md (it's not in backend-plan.md).
Follow CLAUDE.md and the plan's existing rules. Explain your plan first and
wait for my OK.
```
