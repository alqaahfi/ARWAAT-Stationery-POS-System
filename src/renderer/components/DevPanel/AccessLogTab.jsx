import React, { useEffect, useState } from 'react';
import { PaginationBar, DataTable } from './shared';

const COLUMNS = ['id', 'occurred_at', 'station_code', 'success'];

export default function AccessLogTab() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ rows: [], total: 0, pageSize: 50 });

  useEffect(() => {
    load(1);
  }, []);

  function load(targetPage) {
    setPage(targetPage);
    window.api.devpanel.getAccessLog({ page: targetPage, pageSize: 50 }).then(setResult);
  }

  return (
    <div>
      <DataTable columns={COLUMNS} rows={result.rows} emptyLabel="No Dev Panel unlock attempts recorded yet." />
      <PaginationBar page={result.page || page} pageSize={result.pageSize} total={result.total} onPageChange={load} />
    </div>
  );
}
