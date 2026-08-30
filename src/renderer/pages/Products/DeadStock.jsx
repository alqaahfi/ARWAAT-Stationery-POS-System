import React, { useEffect, useState } from 'react';
import { Card, PageHeader, Button, tableStyles, Tr } from '../../components/ui';
import theme from '../../config/theme';
import { formatCount } from '../../utils/format';

export default function DeadStock({ onNavigate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.api.products.getDeadStock().then((res) => {
      setRows(res);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader title="Dead Stock" />
      <Card style={{ padding: 0 }}>
        {loading ? (
          <div style={tableStyles.emptyState}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={tableStyles.emptyState}>No dead stock right now.</div>
        ) : (
          <div style={tableStyles.scroll}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Name</th>
                  <th style={tableStyles.th}>Category</th>
                  <th style={tableStyles.th}>Current Stock</th>
                  <th style={tableStyles.th}>Days Since Last Sale</th>
                  <th style={tableStyles.th}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <td style={tableStyles.td}>{r.name}</td>
                    <td style={{ ...tableStyles.td, color: theme.colors.textSecondary }}>{r.category_name || '—'}</td>
                    <td style={tableStyles.td}>{formatCount(r.total_stock)}</td>
                    <td style={{ ...tableStyles.td, color: theme.colors.warning }}>
                      {formatCount(r.days_since_last_sale)} days{r.last_sold_at ? '' : ' (never sold)'}
                    </td>
                    <td style={{ ...tableStyles.td, textAlign: 'right' }}>
                      <Button
                        variant="ghost"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => onNavigate('/products/edit', { id: r.id })}
                      >
                        Go to Product
                      </Button>
                    </td>
                  </Tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
