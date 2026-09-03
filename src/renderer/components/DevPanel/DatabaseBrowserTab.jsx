import React, { useEffect, useState } from 'react';
import theme from './devPanelTheme';
import { PanelButton, PaginationBar, DataTable } from './shared';

export default function DatabaseBrowserTab() {
  const [mode, setMode] = useState('tables'); // 'tables' | 'query'
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState({ columns: [], rows: [], total: 0, pageSize: 50 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState('SELECT * FROM sqlite_master LIMIT 20');
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState('');
  const [queryRunning, setQueryRunning] = useState(false);

  useEffect(() => {
    window.api.devpanel.listTables().then(setTables);
  }, []);

  function openTable(name) {
    setSelectedTable(name);
    loadTable(name, 1);
  }

  function loadTable(name, targetPage) {
    setLoading(true);
    setPage(targetPage);
    window.api.devpanel
      .getTableRows({ table: name, page: targetPage, pageSize: 50 })
      .then(setTableData)
      .finally(() => setLoading(false));
  }

  function runQuery() {
    setQueryRunning(true);
    setQueryError('');
    window.api.devpanel
      .runSelectQuery({ query })
      .then((res) => setQueryResult(res))
      .catch((err) => setQueryError(err?.message || 'Query failed.'))
      .finally(() => setQueryRunning(false));
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
        <PanelButton variant={mode === 'tables' ? 'primary' : 'default'} onClick={() => setMode('tables')}>Tables</PanelButton>
        <PanelButton variant={mode === 'query' ? 'primary' : 'default'} onClick={() => setMode('query')}>Query Console</PanelButton>
      </div>

      {mode === 'tables' && (
        <div style={{ display: 'flex', gap: theme.spacing.md }}>
          <div style={{ width: 220, flexShrink: 0, border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.sm, maxHeight: 480, overflowY: 'auto' }}>
            {tables.map((t) => (
              <div
                key={t.name}
                onClick={() => openTable(t.name)}
                style={{
                  padding: '7px 10px',
                  fontFamily: theme.font.mono,
                  fontSize: theme.font.sizeXs,
                  color: t.name === selectedTable ? theme.colors.textOnSidebarActive : theme.colors.panelText,
                  backgroundColor: t.name === selectedTable ? theme.colors.primary : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{t.name}</span>
                <span style={{ opacity: 0.6 }}>{t.rowCount}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {!selectedTable ? (
              <div style={{ color: theme.colors.panelTextSecondary, fontFamily: theme.font.mono, fontSize: theme.font.sizeSm }}>
                Select a table on the left.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: theme.spacing.xs, color: theme.colors.panelTextSecondary, fontFamily: theme.font.mono, fontSize: theme.font.sizeXs }}>
                  {loading ? 'loading…' : `${selectedTable}`}
                </div>
                <DataTable columns={tableData.columns} rows={tableData.rows} />
                <PaginationBar page={tableData.page || page} pageSize={tableData.pageSize} total={tableData.total} onPageChange={(p) => loadTable(selectedTable, p)} />
              </>
            )}
          </div>
        </div>
      )}

      {mode === 'query' && (
        <div>
          <div style={{ color: theme.colors.panelTextSecondary, fontFamily: theme.font.mono, fontSize: theme.font.sizeXs, marginBottom: theme.spacing.xs }}>
            SELECT statements only — enforced in the main process, not just here.
          </div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={4}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: theme.spacing.sm,
              borderRadius: theme.radius.sm,
              border: `1px solid ${theme.colors.panelBorder}`,
              backgroundColor: theme.colors.panelBackgroundAlt,
              color: theme.colors.panelText,
              fontFamily: theme.font.mono,
              fontSize: theme.font.sizeSm,
              resize: 'vertical',
              outline: 'none',
            }}
          />
          <div style={{ marginTop: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
            <PanelButton variant="primary" onClick={runQuery} disabled={queryRunning}>{queryRunning ? 'running…' : 'Run query'}</PanelButton>
          </div>
          {queryError && (
            <div style={{ color: theme.colors.danger, fontFamily: theme.font.mono, fontSize: theme.font.sizeSm, marginBottom: theme.spacing.sm }}>
              {queryError}
            </div>
          )}
          {queryResult && (
            <>
              {queryResult.truncated && (
                <div style={{ color: theme.colors.warning, fontFamily: theme.font.mono, fontSize: theme.font.sizeXs, marginBottom: theme.spacing.xs }}>
                  Result truncated to {queryResult.rowCount} rows.
                </div>
              )}
              <DataTable columns={queryResult.columns} rows={queryResult.rows} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
