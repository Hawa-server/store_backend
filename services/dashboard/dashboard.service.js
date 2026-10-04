/*
 * services/dashboard/dashboard.service.js
 *
 * The admin dashboard (BE20): sales, refunds, recent orders, counts and
 * stock warnings, for a period in Ghana time (today, 7d, 30d or all).
 *
 * Definitions (all money in pesewas):
 *   revenue        totals of orders PLACED in the period, minus the refunds
 *                  (requested + processed) that belong to THOSE orders, even
 *                  if a refund happened later. So a past week's revenue
 *                  stays stable, and a cancelled order adds 0 (its total
 *                  in, its full refund out).
 *   orderCount     orders placed in the period, Cancelled ones excluded.
 *   average        revenue ÷ orderCount, rounded to the nearest pesewa,
 *                  or null when there are no orders.
 *   refundedInPeriod  refunds (requested + processed) CREATED in the period,
 *                  by refund date, including "paid but sold out" refunds.
 *   failedRefunds  refunds that are 'failed' right now (they need attention).
 *
 * Everything is worked out with SUM/COUNT queries in the database, and
 * calculated live on every request, so nothing can get out of date.
 */
const { Op, QueryTypes } = require('sequelize');
const { sequelize, Order, Refund, Review, Product } = require('../../models');
const { COUNTED_REFUND_STATUSES } = require('../refund/refund.service');
const { getLowStockThreshold } = require('../settings/settings.service');
const { accraDayRange, accraToday, accraDaysAgo } = require('../../utils/dates');

// How many days back each period starts (today counts as day 0).
const PERIOD_DAYS = { today: 0, '7d': 6, '30d': 29 };

/*
 * periodRange(name)
 * Receives: 'today' | '7d' | '30d' | 'all'.
 * Returns: { name, from, to, start } where from/to are Ghana dates
 *          ('YYYY-MM-DD', from is null for 'all') and start is the UTC
 *          moment the period begins (null for 'all'). The period runs to now.
 */
function periodRange(name) {
  if (name === 'all') return { name, from: null, to: accraToday(), start: null };
  const from = accraDaysAgo(PERIOD_DAYS[name]);
  return { name, from, to: accraToday(), start: accraDayRange(from).start };
}

/*
 * averageOrderValue(revenue, orderCount)
 * Receives: revenue in pesewas and the number of orders.
 * Returns: the average in whole pesewas (rounded to the nearest), or null
 *          when there are no orders (we can't divide by zero).
 */
function averageOrderValue(revenue, orderCount) {
  return orderCount ? Math.round(revenue / orderCount) : null;
}

/*
 * salesFigures(start)
 * Receives: the period's start (a Date) or null for all time.
 * Returns: { revenueGhs, orderCount, averageOrderValueGhs }.
 */
async function salesFigures(start) {
  const placed = start ? { createdAt: { [Op.gte]: start } } : {};
  const ordersTotal = Number(await Order.sum('total', { where: placed })) || 0;
  const orderCount = await Order.count({ where: { ...placed, status: { [Op.ne]: 'Cancelled' } } });

  // Refunds that belong to orders placed in the period (whenever they were
  // made). A join in plain SQL: the same query you can run in Workbench.
  const [row] = await sequelize.query(
    `SELECT COALESCE(SUM(r.amount), 0) AS total
       FROM Refunds r
       JOIN Orders o ON o.id = r.orderId
      WHERE r.status IN (:statuses)
        AND (:start IS NULL OR o.createdAt >= :start)`,
    { replacements: { statuses: COUNTED_REFUND_STATUSES, start }, type: QueryTypes.SELECT }
  );
  const revenue = ordersTotal - Number(row.total);

  return { revenueGhs: revenue, orderCount, averageOrderValueGhs: averageOrderValue(revenue, orderCount) };
}

/*
 * stockWarnings()
 * Receives: nothing.
 * Returns: { lowStockThreshold, lowStockCount, lowStock, outOfStock }.
 *          lowStock: active products with 1..threshold left (fewest first);
 *          outOfStock: active products with none left. The badge count
 *          (lowStockCount) is both together: everything that needs restocking.
 */
async function stockWarnings() {
  const threshold = await getLowStockThreshold();
  const attributes = ['id', 'name', 'stock'];
  const lowStock = threshold >= 1
    ? await Product.findAll({
      where: { isActive: true, stock: { [Op.between]: [1, threshold] } },
      attributes,
      order: [['stock', 'ASC'], ['name', 'ASC']],
      raw: true,
    })
    : [];
  const outOfStock = await Product.findAll({ where: { isActive: true, stock: 0 }, attributes, order: [['name', 'ASC']], raw: true });
  return { lowStockThreshold: threshold, lowStockCount: lowStock.length + outOfStock.length, lowStock, outOfStock };
}

/*
 * getDashboard(periodName)
 * Receives: 'today' | '7d' | '30d' | 'all' (validated; default '7d').
 * Returns: { period, sales, refunds, recentOrders, counts, stock }.
 */
async function getDashboard(periodName) {
  const range = periodRange(periodName);
  const created = range.start ? { createdAt: { [Op.gte]: range.start } } : {};

  const [sales, refundedInPeriod, failedRefunds, recent, pendingOrders, hiddenReviews, stock] = await Promise.all([
    salesFigures(range.start),
    Refund.sum('amount', { where: { ...created, status: COUNTED_REFUND_STATUSES } }),
    Refund.count({ where: { status: 'failed' } }),
    Order.findAll({
      attributes: ['id', 'orderNumber', 'createdAt', 'name', 'total', 'status'],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: 5,
    }),
    Order.count({ where: { status: 'Pending' } }),
    Review.count({ where: { isHidden: true } }),
    stockWarnings(),
  ]);

  return {
    period: { name: range.name, from: range.from, to: range.to },
    sales,
    refunds: { refundedInPeriodGhs: Number(refundedInPeriod) || 0, failedRefunds },
    recentOrders: recent.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      placedAt: o.createdAt,
      customerName: o.name,
      totalGhs: o.total,
      status: o.status,
    })),
    counts: { pendingOrders, hiddenReviews },
    stock,
  };
}

module.exports = { getDashboard, averageOrderValue, periodRange };
