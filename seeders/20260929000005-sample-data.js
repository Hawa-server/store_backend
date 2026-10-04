/*
 * Seeder: SAMPLE / DEMO DATA ONLY.
 *
 * Adds 3 verified sample shoppers, one Delivered order each (with items and
 * status history), and a few reviews, so product pages and order history aren't
 * empty in the demo. These are not real customers or real payments.
 *
 * All sample shoppers share the demo password below (documented in the README).
 * Efua's order includes the 12-Piece Makeup Brush Set, which she has NOT
 * reviewed, so she can be used to test writing a review (BE18).
 *
 * Products and users are found by name and email, never by assumed ids.
 * Seeding these orders does not change stock, so stock matches docs/catalogue.md exactly.
 * Product names must match docs/catalogue.md (the products seeder reads it).
 */
'use strict';

require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DEMO_PASSWORD = 'DemoShopper123';
const DELIVERY_FEE = 2000; // pesewas, same as the deliveryFee setting

const SHOPPERS = [
  { name: 'Ama Mensah', email: 'ama.mensah@example.com' },
  { name: 'Kwame Boateng', email: 'kwame.boateng@example.com' },
  { name: 'Efua Owusu', email: 'efua.owusu@example.com' },
];

// One Delivered order per shopper. `daysAgo` is when the order was placed.
const ORDERS = [
  {
    email: 'ama.mensah@example.com', orderNumber: 'ORD-DEMO-000001', daysAgo: 30,
    phone: '0241234567', address: '12 Oxford Street, Osu, Accra',
    items: [{ product: 'Black Canvas Tote Bag', quantity: 1 }, { product: 'Pink Lip Gloss', quantity: 2 }],
  },
  {
    email: 'kwame.boateng@example.com', orderNumber: 'ORD-DEMO-000002', daysAgo: 20,
    phone: '0201234567', address: '5 Ring Road, Adum, Kumasi',
    items: [{ product: 'Classic Black Sunglasses', quantity: 1 }, { product: 'Slim Leather Wallet', quantity: 1 }],
  },
  {
    email: 'efua.owusu@example.com', orderNumber: 'ORD-DEMO-000003', daysAgo: 12,
    phone: '0551234567', address: '8 Castle Road, Cape Coast',
    items: [
      { product: 'Gold-Plated Hoop Earrings', quantity: 1 },
      { product: 'Black Canvas Tote Bag', quantity: 1 },
      { product: '12-Piece Makeup Brush Set', quantity: 1 },
    ],
  },
];

const REVIEWS = [
  { email: 'ama.mensah@example.com', product: 'Black Canvas Tote Bag', rating: 5,
    text: 'Beautiful bag and very strong. It fits my laptop and still looks smart.' },
  { email: 'ama.mensah@example.com', product: 'Pink Lip Gloss', rating: 4,
    text: 'Nice shine and not sticky. Wish the tube was a bit bigger.' },
  { email: 'kwame.boateng@example.com', product: 'Classic Black Sunglasses', rating: 4,
    text: 'Bought these as a gift and she loves them.' },
  { email: 'kwame.boateng@example.com', product: 'Slim Leather Wallet', rating: 5, text: null },
  { email: 'efua.owusu@example.com', product: 'Black Canvas Tote Bag', rating: 4,
    text: 'Good quality canvas. The strap took a few days to soften.' },
  { email: 'efua.owusu@example.com', product: 'Gold-Plated Hoop Earrings', rating: 5,
    text: 'Light and comfortable, I wear them every day.' },
];

/*
 * daysAgo(days, extraDays)
 * Receives: how many days ago the order was placed, plus an optional offset.
 * Returns: a Date (UTC) at that point in time.
 */
function daysAgo(days, extraDays = 0) {
  return new Date(Date.now() - (days - extraDays) * 24 * 60 * 60 * 1000);
}

module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;
    const now = new Date();

    // 1. Sample shoppers (verified, so they can log in straight away).
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    await queryInterface.bulkInsert(
      'Users',
      SHOPPERS.map((s) => ({
        ...s, passwordHash, isAdmin: false, emailVerifiedAt: now, createdAt: now, updatedAt: now,
      }))
    );

    // Look up the ids we need by email and product name.
    const [users] = await q.query('SELECT id, email FROM Users WHERE email IN (:emails)', {
      replacements: { emails: SHOPPERS.map((s) => s.email) },
    });
    const userIdByEmail = Object.fromEntries(users.map((u) => [u.email, u.id]));

    const [products] = await q.query('SELECT id, name, priceGhs FROM Products');
    const productByName = Object.fromEntries(products.map((p) => [p.name, p]));

    // Status changes are credited to the admin if one exists (else NULL = system).
    const [admins] = await q.query('SELECT id FROM Users WHERE isAdmin = true ORDER BY id LIMIT 1');
    const adminId = admins.length ? admins[0].id : null;

    for (const order of ORDERS) {
      const shopper = SHOPPERS.find((s) => s.email === order.email);
      const placedAt = daysAgo(order.daysAgo);
      const shippedAt = daysAgo(order.daysAgo, 2);
      const deliveredAt = daysAgo(order.daysAgo, 5);

      // Money: prices come from the Products table and stay whole pesewas.
      const items = order.items.map(({ product, quantity }) => {
        const p = productByName[product];
        if (!p) throw new Error(`Product "${product}" not found. Run the products seeder first.`);
        return { productId: p.id, productName: p.name, unitPrice: p.priceGhs, quantity };
      });
      const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

      // 2. The order itself.
      await queryInterface.bulkInsert('Orders', [
        {
          orderNumber: order.orderNumber,
          userId: userIdByEmail[order.email],
          email: order.email,
          name: shopper.name,
          phone: order.phone,
          address: order.address,
          subtotal,
          deliveryFee: DELIVERY_FEE,
          total: subtotal + DELIVERY_FEE,
          currency: 'GHS',
          paymentMethod: 'mobile_money',
          paymentReference: `demo-${order.orderNumber.toLowerCase()}`,
          confirmationToken: crypto.randomBytes(32).toString('hex'),
          status: 'Delivered',
          createdAt: placedAt,
          updatedAt: deliveredAt,
        },
      ]);
      const [[{ id: orderId }]] = await q.query('SELECT id FROM Orders WHERE orderNumber = :n', {
        replacements: { n: order.orderNumber },
      });

      // 3. Its items and its Pending → Shipped → Delivered history.
      await queryInterface.bulkInsert(
        'OrderItems',
        items.map((i) => ({ ...i, orderId, createdAt: placedAt, updatedAt: placedAt }))
      );
      await queryInterface.bulkInsert('OrderStatusChanges', [
        { orderId, fromStatus: null, toStatus: 'Pending', changedByUserId: null, createdAt: placedAt },
        { orderId, fromStatus: 'Pending', toStatus: 'Shipped', changedByUserId: adminId, createdAt: shippedAt },
        { orderId, fromStatus: 'Shipped', toStatus: 'Delivered', changedByUserId: adminId, createdAt: deliveredAt },
      ]);
    }

    // 4. Reviews (each shopper only reviews products from their own Delivered order).
    await queryInterface.bulkInsert(
      'Reviews',
      REVIEWS.map((r) => ({
        productId: productByName[r.product].id,
        userId: userIdByEmail[r.email],
        rating: r.rating,
        text: r.text,
        isHidden: false,
        createdAt: now,
        updatedAt: now,
      }))
    );
  },

  async down(queryInterface) {
    const q = queryInterface.sequelize;
    const [users] = await q.query('SELECT id FROM Users WHERE email IN (:emails)', {
      replacements: { emails: SHOPPERS.map((s) => s.email) },
    });
    const userIds = users.map((u) => u.id);

    // Orders first: their items and status history are removed with them (CASCADE).
    // Deleting the users then also removes their reviews and carts (CASCADE).
    await queryInterface.bulkDelete('Orders', { orderNumber: ORDERS.map((o) => o.orderNumber) });
    if (userIds.length) await queryInterface.bulkDelete('Users', { id: userIds });
  },
};
