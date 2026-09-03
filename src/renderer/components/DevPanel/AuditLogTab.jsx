import React, { useEffect, useState } from 'react';
import theme from './devPanelTheme';
import { PanelInput, PanelSelect, PanelButton, PaginationBar, DataTable } from './shared';

const AUDIT_COLUMNS = ['occurred_at', 'channel', 'user_id', 'user_role', 'station_code', 'success', 'duration_ms', 'args_summary', 'error_message'];

export default function AuditLogTab() {
  const [filters, setFilters] = useState({ channel: '', userId: '', dateFrom: '', dateTo: '', outcome: 'all' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ rows: [], total: 0, pageSize: 50 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function load(targetPage) {
    setLoading(true);
    setPage(targetPage);
    window.api.devpanel
      .getAuditLog({
        channel: filters.channel || undefined,
        userId: filters.userId ? Number(filters.userId) : undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        outcome: filters.outcome === 'all' ? undefined : filters.outcome,
        page: targetPage,
        pageSize: 50,
      })
      .then(setResult)
      .finally(() => setLoading(false));
  }

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap', marginBottom: theme.spacing.sm }}>
        <PanelInput placeholder="channel contains…" value={filters.channel} onChange={(e) => setFilter('channel', e.target.value)} />
        <PanelInput placeholder="user id" style={{ width: 90 }} value={filters.userId} onChange={(e) => setFilter('userId', e.target.value)} />
        <PanelInput type="datetime-local" value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} />
        <PanelInput type="datetime-local" value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} />
        <PanelSelect value={filters.outcome} onChange={(e) => setFilter('outcome', e.target.value)}>
          <option value="all">all outcomes</option>
          <option value="success">success only</option>
          <option value="fail">failed only</option>
        </PanelSelect>
        <PanelButton onClick={() => load(page)}>{loading ? 'loading…' : 'refresh'}</PanelButton>
      </div>
      <DataTable columns={AUDIT_COLUMNS} rows={result.rows} emptyLabel="No audit log rows match these filters." />
      <PaginationBar page={result.page || page} pageSize={result.pageSize} total={result.total} onPageChange={load} />
    </div>
  );
}
