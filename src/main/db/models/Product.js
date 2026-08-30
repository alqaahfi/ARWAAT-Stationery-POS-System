// Shared product queries reused by both the Products module (products.ipc.js)
// and the Reports module (reports.ipc.js) — extracted here so Low Stock /
// Dead Stock logic exists in exactly one place. Each function takes an
// already-open `db` handle rather than calling getDb() itself, so callers
// that already have one (e.g. inside a larger report query) don't open a
// second connection.

function getLowStock(db, categoryId) {
  return db
    .prepare(
      `SELECT p.id, p.name, c.name AS category_name, p.min_stock_alert,
              COALESCE(SUM(pv.stock_qty), 0) AS total_stock,
              p.min_stock_alert - COALESCE(SUM(pv.stock_qty), 0) AS deficit
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = 1
       WHERE p.is_active = 1 AND (@categoryId IS NULL OR p.category_id = @categoryId)
       GROUP BY p.id
       HAVING total_stock <= p.min_stock_alert
       ORDER BY deficit DESC`
    )
    .all({ categoryId: categoryId || null });
}

function getDeadStock(db, categoryId) {
  return db
    .prepare(
      `SELECT p.id, p.name, c.name AS category_name, p.dead_stock_days,
              COALESCE(SUM(pv.stock_qty), 0) AS total_stock,
              MAX(pv.last_sold_at) AS last_sold_at,
              CAST(
                julianday('now') - julianday(COALESCE(MAX(pv.last_sold_at), p.created_at))
                AS INTEGER
              ) AS days_since_last_sale
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = 1
       WHERE p.is_active = 1 AND p.dead_stock_days IS NOT NULL
         AND (@categoryId IS NULL OR p.category_id = @categoryId)
       GROUP BY p.id
       HAVING days_since_last_sale >= p.dead_stock_days
       ORDER BY days_since_last_sale DESC`
    )
    .all({ categoryId: categoryId || null });
}

// Pure — given a product row already carrying total_stock, min_stock_alert,
// dead_stock_days and days_since_last_sale (exactly what products:list now
// computes per row), returns the same status flags Low Stock / Dead Stock
// use, so the All Products page's badges can never drift from those pages'
// own thresholds. A product can be both low AND dead at once — callers show
// both badges rather than picking one.
function getProductStockStatus(product) {
  const totalStock = Number(product.total_stock) || 0;
  const isOutOfStock = totalStock === 0;
  const isLow = !isOutOfStock && totalStock <= Number(product.min_stock_alert);
  const isDead =
    product.dead_stock_days !== null &&
    product.dead_stock_days !== undefined &&
    Number(product.days_since_last_sale) >= Number(product.dead_stock_days);
  return { isOutOfStock, isLow, isDead };
}

module.exports = { getLowStock, getDeadStock, getProductStockStatus };
