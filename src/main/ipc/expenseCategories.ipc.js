const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');

// Read-only for now — just enough for the Expense Report's category filter to
// function. A full Expense Categories management UI is a separate module
// (the "Expenses" nav section is still a placeholder).
function list() {
  const db = getDb();
  return db.prepare('SELECT id, name FROM expense_categories ORDER BY name').all();
}

function registerExpenseCategoriesIpc() {
  ipcMain.handle('expense-categories:list', () => list());
}

module.exports = { registerExpenseCategoriesIpc };
