/*
 * Seeder: the products and their photos, read from docs/catalogue.md.
 *
 * docs/catalogue.md is the single list of everything the store sells (41
 * products in 6 categories), written as tables people can read and edit.
 * This seeder reads that file at seed time, so the list in the docs and the
 * data in the database can never disagree.
 *
 * Every row is checked before anything is saved: the pesewas value must be
 * exactly GH₵ × 100 (money is whole pesewas), stock must be a whole number,
 * and the photo must be an ImageKit address. A mistake stops the seeder with
 * a message naming the row, instead of putting wrong prices in the shop.
 *
 * Each product gets one photo, saved as its main ProductImage (sortOrder 1).
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Found relative to THIS file (not the current folder), so seeding works
// whichever folder the command is run from.
const CATALOGUE_PATH = path.join(__dirname, '..', 'docs', 'catalogue.md');

/*
 * parseCatalogue(markdown)
 * Receives: the text of docs/catalogue.md.
 * Returns: [{ category, name, priceGhs, stock, description, imageUrl, altText }],
 *          with priceGhs in whole pesewas.
 * Throws: an Error naming the line if any row is wrong.
 *
 * The file's shape: a heading per category, e.g.
 *   ## Bags (`bags`): 8 products
 * followed by a table whose rows are:
 *   | Name | Price (GH₵) | Pesewas | Stock | Description | Image URL | Alt text |
 */
function parseCatalogue(markdown) {
  const products = [];
  const counts = new Map(); // slug → { expected, found }
  let slug = null;

  markdown.split('\n').forEach((line, index) => {
    const where = `docs/catalogue.md line ${index + 1}`;

    // A category heading: "## Bags (`bags`)", optionally ending ": 8 products".
    const heading = line.match(/^##\s+.+?\(`([a-z0-9-]+)`\)\s*(?::\s*(\d+)\s+products?)?\s*$/);
    if (heading) {
      slug = heading[1];
      counts.set(slug, { expected: heading[2] === undefined ? null : Number(heading[2]), found: 0 });
      return;
    }
    if (line.startsWith('## ')) { slug = null; return; } // another kind of section
    if (!slug || !line.trim().startsWith('|')) return;

    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (cells[0] === 'Product' || /^:?-{3,}/.test(cells[0])) return; // header or separator row
    if (cells.length !== 7) throw new Error(`${where}: expected 7 columns, found ${cells.length}.`);

    const [name, ghs, pesewas, stockText, description, urlCell, altText] = cells;
    const imageUrl = urlCell.replace(/`/g, '');
    const priceGhs = Number(pesewas);
    const stock = Number((stockText.match(/^\d+/) || [''])[0]);

    if (!name || name.length > 150) throw new Error(`${where}: the product name must be 1–150 characters.`);
    // Money check: whole pesewas, exactly GH₵ × 100 (rounded to dodge float noise like 0.1 × 100).
    if (!Number.isInteger(priceGhs) || priceGhs <= 0 || priceGhs !== Math.round(Number(ghs) * 100)) {
      throw new Error(`${where}: "${name}" has GH₵ ${ghs} but ${pesewas} pesewas (must be GH₵ × 100).`);
    }
    if (!Number.isInteger(stock) || stock < 0 || stockText === '') {
      throw new Error(`${where}: "${name}" stock must be a whole number of 0 or more.`);
    }
    if (!imageUrl.startsWith('https://ik.imagekit.io/')) {
      throw new Error(`${where}: "${name}" image must be an ImageKit address (https://ik.imagekit.io/…).`);
    }
    if (!altText || altText.length > 200) throw new Error(`${where}: "${name}" alt text must be 1–200 characters.`);
    if (!description) throw new Error(`${where}: "${name}" needs a description.`);
    if (products.some((p) => p.name === name)) throw new Error(`${where}: "${name}" is listed twice.`);

    products.push({ category: slug, name, priceGhs, stock, description, imageUrl, altText });
    counts.get(slug).found += 1;
  });

  // Each heading's "N products" must match the rows under it.
  for (const [s, { expected, found }] of counts) {
    if (expected !== null && expected !== found) {
      throw new Error(`docs/catalogue.md: the "${s}" heading says ${expected} products but has ${found} rows.`);
    }
  }
  if (!products.length) throw new Error('docs/catalogue.md: no products found.');
  return products;
}

/*
 * readCatalogue()
 * Receives: nothing. Returns: the parsed products from docs/catalogue.md.
 */
function readCatalogue() {
  return parseCatalogue(fs.readFileSync(CATALOGUE_PATH, 'utf8'));
}

module.exports = {
  async up(queryInterface) {
    const products = readCatalogue();

    // Look up category ids by slug, so this works whatever ids MySQL assigned.
    const [categories] = await queryInterface.sequelize.query('SELECT id, slug FROM Categories');
    const idBySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

    const now = new Date();
    await queryInterface.bulkInsert(
      'Products',
      products.map((p) => {
        if (!idBySlug[p.category]) throw new Error(`Category "${p.category}" not found. Run the categories seeder first.`);
        return {
          categoryId: idBySlug[p.category],
          name: p.name,
          description: p.description,
          priceGhs: p.priceGhs,
          stock: p.stock,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
      })
    );

    // Each product's photo, saved as its main image.
    const [rows] = await queryInterface.sequelize.query('SELECT id, name FROM Products WHERE name IN (:names)', {
      replacements: { names: products.map((p) => p.name) },
    });
    const idByName = Object.fromEntries(rows.map((r) => [r.name, r.id]));
    await queryInterface.bulkInsert(
      'ProductImages',
      products.map((p) => ({
        productId: idByName[p.name],
        url: p.imageUrl,
        altText: p.altText,
        sortOrder: 1,
        isMain: true,
        createdAt: now,
        updatedAt: now,
      }))
    );
  },

  async down(queryInterface) {
    const names = readCatalogue().map((p) => p.name);
    const [rows] = await queryInterface.sequelize.query('SELECT id FROM Products WHERE name IN (:names)', {
      replacements: { names },
    });
    const ids = rows.map((r) => r.id);
    if (ids.length) await queryInterface.bulkDelete('ProductImages', { productId: ids });
    await queryInterface.bulkDelete('Products', { name: names });
  },

  // Exported for checking the file without touching the database.
  parseCatalogue,
};
