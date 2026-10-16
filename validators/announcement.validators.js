/*
 * validators/announcement.validators.js
 *
 * Zod schema for PUT /api/admin/announcement (BE30). The whole announcement
 * is sent each time (it replaces what was saved). Rules that depend on other
 * data (the code exists, the date isn't in the past, a message is needed to
 * switch it on) are checked in announcement.service.js.
 */
const { z } = require('zod');

const MESSAGE_RULE = 'The message must be 5–120 characters, on one line.';

const announcementBody = z.object({
  enabled: z.boolean({ error: 'enabled must be true or false.' }),
  // Plain text, trimmed. Empty is allowed (e.g. while the bar is off);
  // otherwise 5–120 characters and no line breaks (it's a thin, one-line bar).
  // HTML isn't removed or changed: it's stored as the characters typed, and
  // the frontend always shows it as text.
  message: z
    .preprocess((value) => (value === null || value === undefined ? '' : value), z.string({ error: MESSAGE_RULE }))
    .transform((value) => value.trim())
    .refine((value) => value === '' || (value.length >= 5 && value.length <= 120), { error: MESSAGE_RULE })
    .refine((value) => !/[\r\n]/.test(value), { error: MESSAGE_RULE }),
  codeId: z
    .number({ error: 'Choose an existing discount code.' })
    .int({ error: 'Choose an existing discount code.' })
    .positive({ error: 'Choose an existing discount code.' })
    .nullable()
    .default(null),
  // A Ghana day, 'YYYY-MM-DD', included (the bar hides from the next midnight).
  endsAt: z
    .string({ error: 'Use a date like 2026-12-31.' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Use a date like 2026-12-31.' })
    .refine((value) => {
      const [y, m, d] = value.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
    }, { error: "That date doesn't exist." })
    .nullable()
    .default(null),
});

module.exports = { announcementBody };
