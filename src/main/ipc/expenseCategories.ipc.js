const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');

function list() {
  const db = getDb();
  return db
    .prepare(
      `SELECT ec.id, ec.name,
              (SELECT COUNT(*) FROM expenses WHERE category_id = ec.id) AS expense_count
       FROM expense_categories ec
       ORDER BY ec.name`
    )
    .all();
}

function create({ name }) {
  const db = getDb();
  if (!name || !name.trim()) return { success: false, reason: 'Category name is required.' };

  try {
    const result = db.prepare('INSERT INTO expense_categories (name) VALUES (?)').run(name.trim());
    return { success: true, id: result.lastInsertRowid };
  } catch (err) {
    if (/UNIQUE/.test(err.message)) return { success: false, reason: 'A category with that name already exists.' };
    return { success: false, reason: 'Could not create category.' };
  }
}

function update({ id, name }) {
  const db = getDb();
  if (!name || !name.trim()) return { success: false, reason: 'Category name is required.' };

  try {
    db.prepare('UPDATE expense_categories SET name = ? WHERE id = ?').run(name.trim(), id);
    return { success: true };
  } catch (err) {
    if (/UNIQUE/.test(err.message)) return { success: false, reason: 'A category with that name already exists.' };
    return { success: false, reason: 'Could not update category.' };
  }
}

function remove({ id }) {
  const db = getDb();
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM expenses WHERE category_id = ?').get(id);
  if (count > 0) {
    return { success: false, reason: `Reassign ${count} expense${count === 1 ? '' : 's'} before deleting this category.` };
  }
  db.prepare('DELETE FROM expense_categories WHERE id = ?').run(id);
  return { success: true };
}

function registerExpenseCategoriesIpc() {
  ipcMain.handle('expense-categories:list', () => list());
  ipcMain.handle('expense-categories:create', (event, payload) => create(payload || {}));
  ipcMain.handle('expense-categories:update', (event, payload) => update(payload || {}));
  ipcMain.handle('expense-categories:delete', (event, payload) => remove(payload || {}));
}

module.exports = { registerExpenseCategoriesIpc };
