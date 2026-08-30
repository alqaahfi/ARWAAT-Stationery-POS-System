const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');

function list() {
  const db = getDb();
  return db
    .prepare(
      `SELECT c.id, c.name, c.parent_id,
              p.name AS parent_name,
              (SELECT COUNT(*) FROM products WHERE category_id = c.id) AS product_count
       FROM categories c
       LEFT JOIN categories p ON p.id = c.parent_id
       ORDER BY c.name`
    )
    .all();
}

function create(name, parentId) {
  const db = getDb();
  if (!name || !name.trim()) return { success: false, reason: 'Category name is required.' };

  try {
    const result = db
      .prepare('INSERT INTO categories (name, parent_id) VALUES (?, ?)')
      .run(name.trim(), parentId || null);
    return { success: true, id: result.lastInsertRowid };
  } catch (err) {
    if (/UNIQUE/.test(err.message)) return { success: false, reason: 'A category with that name already exists.' };
    return { success: false, reason: 'Could not create category.' };
  }
}

function update(id, name, parentId) {
  const db = getDb();
  if (!name || !name.trim()) return { success: false, reason: 'Category name is required.' };
  if (parentId === id) return { success: false, reason: 'A category cannot be its own parent.' };

  try {
    db.prepare('UPDATE categories SET name = ?, parent_id = ? WHERE id = ?').run(name.trim(), parentId || null, id);
    return { success: true };
  } catch (err) {
    if (/UNIQUE/.test(err.message)) return { success: false, reason: 'A category with that name already exists.' };
    return { success: false, reason: 'Could not update category.' };
  }
}

function remove(id) {
  const db = getDb();
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM products WHERE category_id = ?').get(id);
  if (count > 0) {
    return { success: false, reason: `Reassign ${count} product${count === 1 ? '' : 's'} before deleting this category.` };
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return { success: true };
}

function registerCategoriesIpc() {
  ipcMain.handle('categories:list', () => list());
  ipcMain.handle('categories:create', (event, { name, parentId } = {}) => create(name, parentId));
  ipcMain.handle('categories:update', (event, { id, name, parentId } = {}) => update(id, name, parentId));
  ipcMain.handle('categories:delete', (event, { id } = {}) => remove(id));
}

module.exports = { registerCategoriesIpc };
