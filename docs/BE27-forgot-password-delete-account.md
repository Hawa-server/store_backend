# BE27: Forgot Password and Delete Account

An extra task. Shoppers can **reset a forgotten password by email** and **delete their own account**.

It is **separate from `docs/backend-plan.md`**; follow `CLAUDE.md` and the plan's existing rules (error format, Zod validation, CSRF header, rate limits, hashed one-use tokens, emails sent after commit, comments for learning).

**Email must be working first** (the Brevo change). In development, print reset links to the console, like login codes; never in production.

---

## Part 1: Signing out everywhere (`sessionVersion`)

Both features must **end every existing login** (on every phone and browser). Today a login cookie stays valid until it expires (1 day), so add:

- `User.sessionVersion` (INT, default 0), migration.
- The login token includes `sv` (the user's `sessionVersion` when they logged in).
- `requireAuth` already loads the user on every request; it now also refuses the token if `sv` doesn't match (401 "Please log in again."). Tokens from before this change have no `sv` and are treated as 0, so nobody is logged out by the deployment itself.
- Increasing `sessionVersion` by 1 signs the user out everywhere.

---

## Part 2: Forgot password

### Endpoints

```text
POST /api/auth/forgot-password    { email }
POST /api/auth/reset-password     { token, password }
```

### `POST /api/auth/forgot-password`

- **Always answers 200** with the same message, whether or not an account exists: "If an account exists for this email, we've sent a link to reset your password." This stops anyone using the form to find out who has an account.
- If a (non-deleted) account exists: create a secure random token (32 bytes), store **only its hash** as an `EmailToken` with type `passwordReset` (add it to the type list), **30-minute expiry**, one use. Asking again cancels any earlier unused reset token. Email the link `{CLIENT_URL}/reset-password?token=<token>`.
- The email says: the link expires in 30 minutes; if you didn't ask, ignore this email and your password stays the same.
- **Rate limits:** 5 per hour per IP address, and 3 per hour per email (extra requests still get the same 200 answer, but no email is sent).
- The response time should be similar whether or not the account exists (send the email after responding, or always do the same work).

### `POST /api/auth/reset-password`

- Validate the new password with the **same rules as registration**.
- The token must exist (compare hashes), be type `passwordReset`, unused and unexpired. Otherwise 400 `RESET_LINK_INVALID`: "This link has expired or has already been used. Please ask for a new one."
- In one transaction: save the new bcrypt hash, mark the token used, cancel the user's other unused tokens (reset and login codes), **increase `sessionVersion`** (signs out everywhere), and, if the email wasn't verified yet, set `emailVerifiedAt` (the link proves they own the inbox).
- After commit: send a "Your password was changed" email (time in Ghana time, and "If this wasn't you, reset your password again and contact us").
- **Doesn't log the user in.** They go to the login page and sign in with the new password (the login code step still applies if it's on).
- Rate limit: 10 per 15 minutes per IP address.

---

## Part 3: Delete account

### Endpoint

```text
DELETE /api/account    { password, confirm: "DELETE" }
```

Logged in only (`requireAuth`), with the CSRF header.

### Rules

- **Checks:** the current password must be correct (401 `WRONG_PASSWORD` otherwise), and `confirm` must be exactly `DELETE`. Rate limit: 5 per 15 minutes per user.
- **Admins can't delete their account this way** (403): the store must never lose its last admin by accident.
- **Orders in progress block deletion:** if any of the user's orders are **Pending** or **Shipped**, answer 409 `ORDERS_IN_PROGRESS`: "You have orders that haven't been delivered yet. You can delete your account once they're delivered or cancelled."

### What happens (one transaction)

| Data | What happens | Why |
|---|---|---|
| **User** | Kept as an empty shell: name → "Deleted user", email → `deleted-<uuid>@deleted.invalid`, password hash → a random unusable hash, `deletedAt` set (new column), `sessionVersion` + 1 | Past orders and logs point to the user's ID; the real email is freed so it can be used again |
| **Orders** | **Kept**, with their delivery details, still linked to the empty user | The store needs sales and refund records; they no longer appear in any account |
| **Reviews** | **Deleted** (product ratings update automatically) | They showed the shopper's name |
| **Cart** | Deleted | Not needed |
| **Email tokens** | Deleted | Not needed |

- **Before** removing the email, send "Your Adorn account has been deleted" to the real address (send after commit, using the email captured before the change).
- Clear the login cookie in the response (200 "Your account has been deleted.").
- Deleted users can't log in, ask for a reset link, or be found by guest-order linking (BE25 must skip users with `deletedAt`).
- **Registering again** with the same email creates a brand-new, empty account. The old orders are **not** relinked (they stay with the deleted shell).
- Admin order pages show "Deleted user" for these orders, with the delivery details kept on the order.

**Privacy note for the README:** deleting an account removes the login, the reviews, and the cart; order records are kept for the store's accounts.

---

## Done when

- [ ] "Forgot password" gives the same answer for an existing and a non-existing email, and only an existing account gets an email.
- [ ] The reset link works once, expires after 30 minutes, and a newer link cancels the older one.
- [ ] After a reset, the new password works, the old one doesn't, every other session is logged out, and a "password changed" email is sent.
- [ ] Deleting an account needs the correct password and "DELETE"; admins and users with Pending or Shipped orders are refused.
- [ ] After deletion: the user can't log in, their reviews are gone, their orders are kept (as "Deleted user"), sessions are ended, and the email can register a new, empty account.
- [ ] Rate limits work for forgot, reset, and delete.
- [ ] `docs/api.md`, `docs/backend-guide.md`, and the README are updated.

## Testing

A script (cleans up after itself): forgot password for an existing and an unknown email (same answer); reset with a good, used, expired and replaced token; log in on two "devices" (two cookies), reset, and check both are logged out; delete with a wrong password, without "DELETE", as an admin, and with a Pending order; delete successfully and check the user, orders, reviews, cart and login; register again with the same email. Then test the reset email once on the live site with your own inbox.

---

## Prompt for Claude Code

```
Start the extra task in docs/BE27-forgot-password-delete-account.md (it's
not in backend-plan.md). Follow CLAUDE.md and the plan's existing rules.
Explain your plan first and wait for my OK.
```
