import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Label, Select, Button, Banner, HelperText } from '../../components/ui';

export default function PermissionsManager({ initialUserId }) {
  const { user } = useAuth();

  const [definitions, setDefinitions] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(initialUserId ? String(initialUserId) : '');
  const [values, setValues] = useState({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.api.permissions.getDefinitions().then(setDefinitions);
    window.api.users.list().then((rows) => setCashiers(rows.filter((r) => r.role === 'cashier')));
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setValues({});
      return;
    }
    setError('');
    setSaved(false);
    window.api.permissions.getForUser({ userId: Number(selectedUserId) }).then(setValues);
  }, [selectedUserId]);

  function updateValue(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    const res = await window.api.permissions.saveForUser({ userId: Number(selectedUserId), values });
    setSaving(false);
    if (!res.success) {
      setError(res.reason || 'Could not save permissions.');
      return;
    }
    setSaved(true);
  }

  if (user.role !== 'admin') {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>This section is restricted to Admin accounts</h3>
      </Card>
    );
  }

  // Active cashiers first — deactivated ones aren't hidden, just not featured.
  const sortedCashiers = [...cashiers].sort(
    (a, b) => (b.is_active - a.is_active) || a.full_name.localeCompare(b.full_name)
  );

  return (
    <div>
      <PageHeader title="Roles & Permissions" />

      <Card style={{ marginBottom: theme.spacing.lg, maxWidth: '360px' }}>
        <Label>Cashier</Label>
        <Select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
          <option value="">Select a cashier…</option>
          {sortedCashiers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
              {!c.is_active ? ' (Inactive)' : ''}
            </option>
          ))}
        </Select>
      </Card>

      {selectedUserId && (
        <Card style={{ maxWidth: '640px' }}>
          {definitions.map((def) => (
            <div key={def.key} style={styles.row}>
              <div style={styles.rowHeader}>
                <div style={styles.rowLabel}>{def.label}</div>
                {def.type === 'boolean' ? (
                  <input type="checkbox" checked={!!values[def.key]} onChange={(e) => updateValue(def.key, e.target.checked)} />
                ) : (
                  <input
                    type="number"
                    value={values[def.key] ?? ''}
                    onChange={(e) => updateValue(def.key, e.target.value)}
                    placeholder="Shop default"
                    style={styles.numberInput}
                  />
                )}
              </div>
              <HelperText>{def.description}</HelperText>
            </div>
          ))}

          <Banner>{error}</Banner>
          {saved && !error && (
            <div style={{ color: theme.colors.success, fontSize: theme.font.sizeSm, marginTop: theme.spacing.sm }}>
              Permissions saved.
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} style={{ marginTop: theme.spacing.lg }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </Card>
      )}
    </div>
  );
}

const styles = {
  row: { padding: `${theme.spacing.sm} 0`, borderBottom: `1px solid ${theme.colors.border}` },
  rowHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { color: theme.colors.textPrimary, fontSize: theme.font.sizeBase, fontWeight: theme.font.weightMedium },
  numberInput: {
    width: '100px',
    padding: '6px 8px',
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    textAlign: 'right',
    fontSize: theme.font.sizeSm,
  },
};
