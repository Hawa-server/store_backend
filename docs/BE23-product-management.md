# BE23: Admin Product Management

An extra task, added after BE22. It lets the admin **see, add, and edit products** (including stock) through the API. It is **separate from `docs/backend-plan.md`**; follow `CLAUDE.md` and the plan's existing rules (error format, Zod validation, CSRF header, admin router, money in pesewas, comments for learning).

**Build this only after the frontend is deployed and working.**

---

## What's in and out

| In | Out (later) |
|---|---|
| List, search, and filter products (admin) | Uploading images through the app (BE21) |
| View one product with all its details | Product variants (sizes, shades, colours) |
| Add a product with one main image (an ImageKit URL) | Deleting products |
| Edit name, description, category, price, stock, active, and the main image | Bulk import or export |

**No delete:** past orders reference products (the foreign key is `RESTRICT`), so products are **deactivated** instead. An inactive product is hidden from the shop, shows as unavailable in carts, and is refused at checkout, which all already works through `isActive`.

---

## Endpoints

All on the existing **admin router** (`requireAuth` then `requireAdmin`, so not logged in → 401, not an admin → 403). State-changing requests need the `X-Requested-With` header, as everywhere.

```text
GET   /api/admin/products?search=&category=&status=&page=
GET   /api/admin/products/:id
POST  /api/admin/products
PATCH /api/admin/products/:id
```

The form's category list uses the existing public `GET /api/categories`.

### `GET /api/admin/products`

- **Filters (all optional, combinable):**
  - `search`: matches the product name (case-insensitive, contains), trimmed, up to 100 characters.
  - `category`: a category slug; unknown slug → 400 with `fields.category`.
  - `status`: `active`, `inactive`, or empty for all.
- **Order:** name A–Z. **20 per page**, standard pagination format `{ items, page, pageSize, totalItems, totalPages }` (reuse `utils/pagination.js`).
- **Each item:**

```json
{
  "id": 7, "name": "Black Canvas Tote Bag",
  "category": { "id": 1, "name": "Bags", "slug": "bags" },
  "priceGhs": 12000, "stock": 15, "isActive": true,
  "mainImage": { "url": "https://ik.imagekit.io/ADORN/...", "altText": "..." },
  "updatedAt": "2026-10-07T09:12:00.000Z"
}
```

### `GET /api/admin/products/:id`

Everything from the list item, plus `description`, `createdAt`, and `images` (all images, by `sortOrder`). Unknown ID → 404 "Product not found." Inactive products **are** returned here (admins must be able to see and reactivate them).

### `POST /api/admin/products`

**Body:**

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

`isActive` defaults to `true`. `image` is **required** when creating. In one transaction: create the product, then its `ProductImage` (`sortOrder` 1, `isMain` true). **201** `{ product }` in the admin detail shape.

### `PATCH /api/admin/products/:id`

Any subset of `name`, `description`, `categoryId`, `priceGhs`, `stock`, `isActive`, `image`. At least one field is required (otherwise 400). **200** `{ product }` in the admin detail shape.

- **`image`** replaces the **main** image (update its URL and alt text, in the same transaction).
- **Changing `stock` requires `expectedStock`**, the stock value the admin saw when they opened the product (see **Stock safety** below).

---

## Validation (Zod)

| Field | Rule | Error (in `fields`) |
|---|---|---|
| `name` | Trimmed, 2–150 characters; **unique** (case-insensitive) | Duplicate → **409** `CONFLICT` "A product with this name already exists." |
| `description` | Trimmed, 1–2,000 characters | |
| `categoryId` | Whole number; must be an existing category | "Choose a category." |
| `priceGhs` | Whole number of **pesewas**, 1 to 100,000,000 (GH₵ 1,000,000) | "Enter a price greater than 0." |
| `stock` | Whole number, 0 to 100,000 | "Enter a whole number from 0 to 100,000." |
| `isActive` | Boolean | |
| `image.url` | Must start with `https://ik.imagekit.io/`, up to 500 characters; strip any `?updatedAt=` query before saving | "Use an image address from the store's ImageKit." |
| `image.altText` | Trimmed, 1–200 characters; required with a URL | "Describe the photo (up to 200 characters)." |
| `expectedStock` | Whole number; required when `stock` is sent | |

Numbers must be **JSON numbers**, not text. Unknown fields are ignored (never mass-assigned). Product names are unique because the seeders and the catalogue link products by name.

---

## Stock safety (concurrency)

An admin may set stock while an order is being paid for (BE9 reduces stock in its own transaction). To avoid silently overwriting that change:

1. In one transaction, **lock the product row** (`SELECT … FOR UPDATE`, the same lock BE9 and BE16 use).
2. If the current stock **doesn't equal `expectedStock`**, answer **409** `CONFLICT`: "Stock changed since you opened this product (it's now X). Check the number and save again." Include `currentStock` in the error response. Nothing is changed.
3. Otherwise, save the new stock (and any other fields) and commit.

Changes without `stock` don't need `expectedStock`. Use `withDeadlockRetry`.

---

## Business rules

- **Price changes** apply only to **new** carts and checkouts. Orders keep the prices paid (`OrderItems`), and open checkouts keep their saved amounts (`CheckoutItems`); both already work this way.
- **Deactivating** hides the product from the shop and search, marks cart lines unavailable, and blocks checkout, using the existing `isActive` logic. Reviews stay in the database.
- **Stock** shown to shoppers ("In stock", "Only X left") and the dashboard's low-stock lists update automatically, because they're calculated from the product.
- **Logging:** after each create or update, log (at info level) the admin's ID, the product ID, and the names of the changed fields. Never log full request bodies.
- **The catalogue and the seeders:** `docs/catalogue.md` stays the source for **seeding**. Products added or changed through the admin are **live database changes**; re-running the seeders resets the products to the catalogue. Note this in the README.

---

## Files

- **New:** `services/product/adminProduct.service.js` (list, get, create, update), `validators/adminProduct.validators.js`.
- **Changed:** `controllers/admin.controller.js`, `routes/admin.routes.js`, `docs/api.md` (the four endpoints, every error, and the `expectedStock` rule), `docs/backend-guide.md` (a BE23 section: why products are deactivated rather than deleted, the stock check and row lock, live changes vs seeding), and the README.

---

## Done when

- [ ] The admin can list products with search, category, and status filters, 20 per page, A–Z.
- [ ] The admin can add a product with an ImageKit image, and it appears in the shop straight away.
- [ ] The admin can edit the name, description, category, price, stock, and image.
- [ ] A duplicate name returns 409; invalid values return 400 with `fields`; a non-ImageKit image URL is refused.
- [ ] Changing stock with an out-of-date `expectedStock` returns 409 with the current stock, and changes nothing.
- [ ] Deactivating hides the product from the shop and makes cart lines unavailable; reactivating brings it back.
- [ ] Past orders still show their original prices after a price change.
- [ ] Non-admins get 403; logged-out requests get 401.
- [ ] `docs/api.md`, `docs/backend-guide.md`, and the README are updated.

## Testing

A script (cleans up after itself): create, list with each filter, edit each field, duplicate name, bad values, the stock conflict (change stock directly in the database between reading and saving), deactivate and reactivate (check the public product list and a cart line), a price change with an existing order, 403 and 401. Then the student tests in Postman and checks MySQL Workbench.

---

## Prompt for Claude Code

```
Start the extra task in docs/BE23-product-management.md (it's not in
backend-plan.md). Follow CLAUDE.md and the plan's existing rules.
Explain your plan first and wait for my OK.
```
