/*
 * validators/delivery.validators.js
 *
 * Zod schemas for the admin delivery-area endpoints (BE24). (The checkout's
 * region and town fields are in checkout.validators.js.)
 *
 * Fees are whole pesewas from 0 to 100,000 (GH₵ 0–1,000), as real JSON
 * numbers. 0 is allowed: free delivery to that area.
 */
const { z } = require('zod');

const FEE_MESSAGE = 'Enter a fee from 0 to 100000 pesewas (GH₵ 0–1,000).';

const feePesewas = z
  .number({ error: FEE_MESSAGE })
  .int({ error: 'The fee must be a whole number of pesewas.' })
  .min(0, { error: FEE_MESSAGE })
  .max(100000, { error: FEE_MESSAGE });

const townName = z
  .string({ error: 'Enter the town name (2–80 characters).' })
  .trim()
  .min(2, { error: 'Enter the town name (2–80 characters).' })
  .max(80, { error: 'Enter the town name (2–80 characters).' });

const isActive = z.boolean({ error: 'isActive must be true or false.' });

/*
 * idParams(label)
 * Receives: what the id is for, e.g. 'Region'.
 * Returns: a schema for the URL's :id ("12" → 12, a positive whole number).
 */
function idParams(label) {
  return z.object({
    id: z.coerce
      .number({ error: `${label} id must be a number.` })
      .int({ error: `${label} id must be a whole number.` })
      .positive({ error: `${label} id must be a positive number.` }),
  });
}

/*
 * atLeastOne(fields)
 * Receives: the field names an edit can change.
 * Returns: a refinement that refuses an empty edit (nothing to change).
 */
function atLeastOne(fields) {
  return (body, ctx) => {
    if (!fields.some((field) => body[field] !== undefined)) {
      ctx.addIssue({ code: 'custom', path: ['_'], message: 'Send at least one field to change.' });
    }
  };
}

// PATCH /api/admin/delivery-regions/:id
const regionParams = idParams('Region');
const updateRegionBody = z
  .object({ feePesewas: feePesewas.optional(), isActive: isActive.optional() })
  .superRefine(atLeastOne(['feePesewas', 'isActive']));

// POST /api/admin/delivery-towns. feePesewas missing or null = use the region's fee.
const createTownBody = z.object({
  regionId: z.number({ error: 'Choose a region.' }).int({ error: 'Choose a region.' }).positive({ error: 'Choose a region.' }),
  name: townName,
  feePesewas: feePesewas.nullable().default(null),
});

// PATCH /api/admin/delivery-towns/:id. feePesewas: null = go back to the region's fee.
const townParams = idParams('Town');
const updateTownBody = z
  .object({ name: townName.optional(), feePesewas: feePesewas.nullable().optional(), isActive: isActive.optional() })
  .superRefine(atLeastOne(['name', 'feePesewas', 'isActive']));

module.exports = { regionParams, updateRegionBody, createTownBody, townParams, updateTownBody };
