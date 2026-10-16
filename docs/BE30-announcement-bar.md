# BE30: Announcement Bar

An extra task. The admin can show a short message in a thin bar at the top of every shop page, usually to promote a discount code: "Use **WELCOME5** for 5% off your first order".

It is **separate from `docs/backend-plan.md`**; follow `CLAUDE.md` and the plan's existing rules (settings service, error format, Zod validation, CSRF header, admin router, comments for learning). Build it **after BE29** (discount codes).

---

## Rules

- **One announcement at a time:** on or off, a message, and optionally **one discount code** to show with it.
- **Message:** plain text, 5–120 characters, trimmed. **No HTML**: it's always shown as text, so nobody can inject code into every page.
- **Linked code:** optional. If a code is linked, the bar shows **only while the code can actually be used**: it's active, it has started, it hasn't expired, and it isn't used up. When the code stops working, the bar **hides itself automatically**, so shoppers never see a code that fails at checkout.
- **Without a code:** the bar is just a message (for example "Free delivery in Kumasi this week"), shown whenever it's switched on.
- Optional **end date** (Ghana day, inclusive) for message-only announcements; with a code, the code's own dates apply.

---

## Data

Stored through the existing **settings service** (new keys, no new table):

```text
announcementEnabled   (true/false, default false)
announcementMessage   (text, default empty)
announcementCodeId    (discount code ID, or empty)
announcementEndsAt    (date, or empty)
```

If the settings table only stores strings, the service converts them; keep the conversion in the service, not the routes.

---

## Endpoints

### Public

```text
GET /api/announcement
```

- Returns `{ "announcement": null }` when switched off, expired, or its code can't be used.
- Otherwise: `{ "announcement": { "message": "...", "code": "WELCOME5" | null, "id": "<short version string>" } }`.
- `id` changes whenever the message or code changes (for example a short hash of both), so the frontend can tell a **new** announcement from one the shopper already closed.
- `Cache-Control: public, max-age=60`, so the bar isn't fetched from the database on every page view.
- Never reveals anything about a code except its text.

### Admin

```text
GET /api/admin/announcement
PUT /api/admin/announcement    { enabled, message, codeId | null, endsAt | null }
```

- `GET` returns the saved settings, the linked code's details (code, status in words as in BE29), and `isShowing` (true/false) with a reason when it's on but hidden: "The linked code has expired", "The end date has passed".
- `PUT` validates everything (message length, the code exists, `endsAt` not in the past). Turning it on with no message → 400 with `fields.message`.
- Linking a code that's currently **off, expired or used up** is allowed (the admin may be preparing), but the response says `isShowing: false` with the reason.

---

## Done when

- [ ] The admin can switch the bar on and off, set the message, link a code, and set an end date.
- [ ] `GET /api/announcement` returns the message and code while the code is usable, and `null` when the bar is off, past its end date, or the code is off, expired or used up.
- [ ] The `id` changes when the message or code changes.
- [ ] HTML in the message is stored and returned as plain text.
- [ ] Non-admins get 403; logged-out admin requests get 401.
- [ ] `docs/api.md`, `docs/backend-guide.md`, and the README are updated.

## Testing

A script (cleans up after itself, and restores the original settings): off; on with a message only; on with an end date that passes; on with a code that's active, then switched off, expired and used up; a message with `<script>` in it; a too-long message; 401 and 403.

---

## Prompt for Claude Code

```
Start the extra task in docs/BE30-announcement-bar.md (it's not in
backend-plan.md). Follow CLAUDE.md and the plan's existing rules. Explain
your plan first and wait for my OK.
```
