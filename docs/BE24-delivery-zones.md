# BE24: Delivery Fees by Region and Town

An extra task, added after the presentation (teacher's feedback). The flat delivery fee is replaced by a fee that depends on **where the order is going**. The store ships from **Kumasi**, so nearer places cost less: for example, Kumasi to Accra GH₵ 20, Kumasi to Tamale GH₵ 50.

It is **separate from `docs/backend-plan.md`**; follow `CLAUDE.md` and the plan's existing rules (error format, Zod validation, CSRF header, admin router, money in pesewas, transactions, comments for learning).

---

## How the fee works

Fees are set **by region, with optional town fees** inside a region:

1. The shopper chooses one of Ghana's **16 regions**, then a **town** from that region's list, or **"Other town in this region"**.
2. **The fee is the town's own fee if it has one; otherwise the region's fee.**

Example: Ashanti region GH₵ 15, but Kumasi town GH₵ 10 (local delivery). An order to Obuasi (no town fee) pays GH₵ 15; an order to Kumasi pays GH₵ 10.

The admin can change every fee and add towns. **The server always works out the fee**; the browser only sends which region and town were chosen.

---

## What's in and out

| In | Out (later) |
|---|---|
| A fee per region, optional fees per town | Distance calculated from a map or GPS |
| Region and town chosen at checkout | Courier price lookups |
| Admin can change fees and add or hide towns | Free-delivery offers (for example, over GH₵ 500) |
| Orders keep the fee and place they were charged | Delivery times per region |

---

## Data

### New table: `DeliveryRegion`

```text
id, name UNIQUE, feePesewas (INT, 0–100,000 = GH₵ 0–1,000), sortOrder, isActive, createdAt, updatedAt
```

### New table: `DeliveryTown`

```text
id, regionId (FK → DeliveryRegion, RESTRICT), name, feePesewas NULLABLE (null = use the region's fee),
isActive, createdAt, updatedAt
UNIQUE (regionId, name)
```

### Changes to `Checkout` and `Order`

Add (migration, nullable so existing rows stay valid):

```text
deliveryRegionId (FK, nullable), deliveryTownId (FK, nullable),
deliveryRegionName, deliveryTownName      ← copies of the names at the time of the order
```

`deliveryFee` stays as it is: it already stores the amount charged. **Orders never recalculate their fee later**, so changing a fee never changes past orders (the same rule as product prices). The name copies mean old orders still show the right place even if a town is renamed or hidden.

Existing orders keep their flat fee and show "Delivery area: not recorded".

### Setting

The `deliveryFee` setting is **no longer used** for new checkouts. Leave it in the database (old code paths and seeds may read it) but remove it from anything shown to the admin.

### Seed data

A seeder adds the 16 regions, each with its capital as a town. **These fees are starting examples; the store owner should check them and change them in the admin.**

| Region | Region fee (GH₵) | Seeded towns (own fee, or "region fee") |
|---|---|---|
| Ashanti | 15 | Kumasi **10**, Obuasi (region fee) |
| Bono | 25 | Sunyani |
| Bono East | 25 | Techiman |
| Ahafo | 25 | Goaso |
| Eastern | 20 | Koforidua |
| Greater Accra | **20** | Accra, Tema |
| Central | 25 | Cape Coast |
| Western | 30 | Sekondi-Takoradi |
| Western North | 35 | Sefwi Wiawso |
| Volta | 30 | Ho |
| Oti | 40 | Dambai |
| Northern | **50** | Tamale |
| Savannah | 50 | Damongo |
| North East | 55 | Nalerigu |
| Upper East | 60 | Bolgatanga |
| Upper West | 60 | Wa |

The seeder is safe to run twice (it skips regions and towns that already exist). Run it in production too.

---

## Endpoints

### Public

```text
GET /api/delivery-areas
```

Returns active regions (by `sortOrder`, then name) with their active towns (A–Z) and each one's **effective fee**:

```json
{
  "regions": [
    {
      "id": 2, "name": "Ashanti", "feeGhs": 1500, "feeUsd": 97,
      "towns": [
        { "id": 5, "name": "Kumasi", "feeGhs": 1000, "feeUsd": 65 },
        { "id": 6, "name": "Obuasi", "feeGhs": 1500, "feeUsd": 97 }
      ]
    }
  ]
}
```

`feeGhs` is in pesewas and `feeUsd` in US cents, converted with the existing currency helper. Cache-friendly (`Cache-Control: public, max-age=300`).

### Checkout (`POST /api/checkout`, changed)

The body gains:

```json
{ "deliveryRegionId": 2, "deliveryTownId": 5 }
```

- `deliveryRegionId` is **required**; it must be an active region, otherwise 400 with `fields.deliveryRegionId` ("Choose a delivery region.").
- `deliveryTownId` is optional (missing or `null` means "Other town in this region"). If sent, it must be an active town **in that region**, otherwise 400 with `fields.deliveryTownId`.
- The server works out the fee (town fee, else region fee), saves it with the region and town IDs and names on the `Checkout`, and adds it to the total. A fee sent by the browser is ignored.
- The `address` field stays for the street, house number, or landmark.
- Fulfilment copies the region, town, names, and fee from the `Checkout` to the `Order`. The fee charged is the one saved at checkout, even if the admin changes it before the payment is confirmed.

### Order responses (changed)

Shopper, guest confirmation, and admin order details gain `deliveryRegionName` and `deliveryTownName` (either may be `null` for old orders). The confirmation email shows "Delivery to: Kumasi, Ashanti — GH₵ 10.00".

### Admin

On the existing **admin router** (401 if logged out, 403 if not an admin):

```text
GET   /api/admin/delivery-areas              all regions and towns, including inactive, with raw fees
PATCH /api/admin/delivery-regions/:id        { feePesewas?, isActive? }
POST  /api/admin/delivery-towns              { regionId, name, feePesewas | null }
PATCH /api/admin/delivery-towns/:id          { name?, feePesewas? (null allowed), isActive? }
```

- Fees: whole pesewas, 0 to 100,000. 0 is allowed (free delivery to that area).
- Town names: trimmed, 2–80 characters; a duplicate name in the same region → 409 with `fields.name`.
- **No deletes:** orders point to regions and towns, so they're hidden with `isActive: false`. Hidden regions and towns disappear from checkout but stay on past orders.
- A region can't be hidden if it's the **only** active region (409), so checkout always has at least one choice.
- Regions themselves aren't added or renamed through the API (Ghana's regions are fixed; the seeder handles them).

---

## Done when

- [ ] `GET /api/delivery-areas` returns the 16 regions with their towns and effective fees in GH₵ and US$.
- [ ] Checkout to Kumasi charges GH₵ 10, to Obuasi GH₵ 15, to Accra GH₵ 20, and to Tamale GH₵ 50 (with the seeded fees).
- [ ] A missing region, a hidden region, or a town from another region is refused with a clear field message.
- [ ] A fee sent by the browser is ignored; the server's fee is used and stored on the checkout and order.
- [ ] Changing a fee after an order doesn't change that order, its emails, or its refunds.
- [ ] The admin can change region and town fees, add a town, and hide and unhide towns; non-admins get 403.
- [ ] Old orders still display, with "Delivery area: not recorded".
- [ ] `docs/api.md`, `docs/backend-guide.md`, and the README are updated.

## Testing

A script (cleans up after itself): read delivery areas; check out to each example town and to "Other town in this region"; try a wrong region, a town from another region, and a hidden town; change a fee between checkout and verification and confirm the order keeps the checkout's fee; admin create, edit, hide and unhide a town; a duplicate town name; 403 and 401. Then test a real test payment on the live site to Tamale and check the total and the email.

---

## Prompt for Claude Code

```
Start the extra task in docs/BE24-delivery-zones.md (it's not in
backend-plan.md). Follow CLAUDE.md and the plan's existing rules.
Explain your plan first and wait for my OK.
```
