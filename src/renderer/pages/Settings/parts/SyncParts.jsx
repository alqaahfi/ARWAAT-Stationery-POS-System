import React from 'react';
import { KeyRound, Monitor, RefreshCw, TriangleAlert } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Badge, Button, Card, DataTable, Disclosure, EmptyState, IconTile, ListRow, ListSection } from '../../../components/ui';
import { formatDateTime } from '../../../utils/format';
import { CodeText, CopyButton } from './SettingsParts';

const c = theme.colors;

export function roleLabel(role) {
  if (role === 'admin') return glossary.mainComputer;
  if (role === 'cashier') return glossary.counterComputer;
  return role || 'Unknown';
}

export function ConnectionCodeCard({ code }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.smd, marginBottom: theme.spacing.smd }}>
        <IconTile icon={KeyRound} color="blue" size="lg" variant="soft" />
        <div style={{ flex: 1 }}>
          <h2 style={{ ...theme.type.headline, color: c.label, margin: 0 }}>Your {glossary.connectionCode}</h2>
          <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>Share this code with a new computer so it can connect.</div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.sm,
          padding: `${theme.spacing.smd} ${theme.spacing.md}`,
          borderRadius: theme.radius.md,
          backgroundColor: c.surfaceAlt,
          border: `1px solid ${c.separator}`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <CodeText>{code || '—'}</CodeText>
        </div>
        <CopyButton text={code} label={`Copy ${glossary.connectionCode}`} />
      </div>
    </Card>
  );
}

function Stat({ label, children }) {
  return (
    <div>
      <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{label}</div>
      <div style={{ ...theme.type.body, ...theme.font.numeric, color: c.label, fontWeight: theme.font.weightMedium, marginTop: '2px' }}>{children}</div>
    </div>
  );
}

export function ThisComputerCard({ status, syncingAll, syncDisabled, onSyncAll }) {
  const pc = status.thisPc;
  const last = status.lastSync;
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.smd, flexWrap: 'wrap' }}>
        <IconTile icon={Monitor} color="gray" size="lg" variant="soft" />
        <div style={{ flex: 1, minWidth: '180px' }}>
          <h2 style={{ ...theme.type.headline, color: c.label, margin: 0 }}>This computer{pc?.stationCode ? ` · ${pc.stationCode}` : ''}</h2>
          <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{pc ? `${roleLabel(pc.role)} · ${pc.shopName || ''}` : 'Not activated.'}</div>
        </div>
        <Button icon={RefreshCw} onClick={onSyncAll} loading={syncingAll} disabled={syncDisabled}>
          Sync now
        </Button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: theme.spacing.md,
          marginTop: theme.spacing.md,
          paddingTop: theme.spacing.md,
          borderTop: `1px solid ${c.separator}`,
        }}
      >
        <Stat label="Changes waiting to send">{status.outboxCount}</Stat>
        <Stat label="Last sync">
          {last ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm }}>
              {formatDateTime(last.created_at)}
              <Badge size="sm" tone={last.status === 'success' ? 'green' : 'red'}>
                {last.status === 'success' ? 'Worked' : 'Failed'}
              </Badge>
            </span>
          ) : (
            'Never'
          )}
        </Stat>
      </div>
    </Card>
  );
}

function StatusDot({ online }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: '10px', height: '10px', borderRadius: theme.radius.pill, backgroundColor: online ? c.green : c.gray, flexShrink: 0 }}
    />
  );
}

function PeerRow({ peer, syncing, disabled, onSync, separator }) {
  const subtitle = [
    peer.versionPaused ? 'Sync paused' : null,
    peer.online ? 'Connected' : 'Not seen recently',
    peer.lastSyncSuccessAt ? `Last synced ${formatDateTime(peer.lastSyncSuccessAt)}` : 'Never synced',
    peer.ip,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <ListRow
      separator={separator}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
          <StatusDot online={peer.online} />
          <span style={{ fontWeight: theme.font.weightMedium }}>{peer.stationCode || 'Unnamed computer'}</span>
          <Badge size="sm" tone={peer.role === 'admin' ? 'purple' : 'blue'}>
            {roleLabel(peer.role)}
          </Badge>
        </span>
      }
      subtitle={
        <span style={{ paddingLeft: '18px', display: 'block' }}>
          {subtitle}
          {peer.versionPaused && <span style={{ display: 'block', color: c.orangeText, marginTop: '2px' }}>{peer.versionPaused}</span>}
        </span>
      }
      trailing={
        <Button size="sm" variant="secondary" onClick={onSync} loading={syncing} disabled={disabled}>
          Sync now
        </Button>
      }
    />
  );
}

export function PeerList({ peers, syncingPeer, onSync }) {
  if (!peers.length) {
    return (
      <Card>
        <EmptyState icon={Monitor} title="No other computers yet" message="Computers on the same network show up here once they’re set up with your Connection Code." />
      </Card>
    );
  }
  return (
    <ListSection title="Other computers" style={{ marginBottom: 0 }}>
      {peers.map((p) => (
        <PeerRow key={p.machineId} peer={p} syncing={syncingPeer === p.machineId} disabled={syncingPeer !== null} onSync={() => onSync(p.machineId)} />
      ))}
    </ListSection>
  );
}

export function StockWarningsCard({ warnings, onFix }) {
  if (!warnings.length) return null;
  return (
    <Card padding="0" style={{ overflow: 'hidden', borderLeft: `4px solid ${c.orange}` }}>
      <div style={{ display: 'flex', gap: theme.spacing.smd, padding: theme.spacing.md }}>
        <IconTile icon={TriangleAlert} color="orange" size="lg" variant="soft" />
        <div>
          <h2 style={{ ...theme.type.headline, color: c.label, margin: 0 }}>Stock went below zero</h2>
          <div style={{ ...theme.type.subhead, color: c.labelSecondary, marginTop: '2px' }}>
            Two computers probably sold the last item while they weren’t connected. Count these and fix the stock.
          </div>
        </div>
      </div>
      <DataTable
        dense
        rowKey="variantId"
        columns={[
          { key: 'product', label: 'Product', render: (w) => `${w.productName}${w.sku ? ` (${w.sku})` : ''}` },
          { key: 'variantName', label: glossary.types },
          { key: 'stockQty', label: 'In stock', numeric: true, render: (w) => <span style={{ color: c.redText, fontWeight: theme.font.weightSemibold }}>{w.stockQty}</span> },
          {
            key: 'fix',
            label: '',
            align: 'right',
            render: (w) =>
              onFix && (
                <Button size="sm" variant="tinted" onClick={() => onFix(w)}>
                  {glossary.fixStockCount}
                </Button>
              ),
          },
        ]}
        rows={warnings}
      />
    </Card>
  );
}

export function SyncLog({ log }) {
  return (
    <Disclosure title="Sync history" summary={log.length ? `${log.length} recent` : 'Nothing yet'}>
      <DataTable
        dense
        maxHeight="360px"
        columns={[
          { key: 'when', label: 'When', width: '150px', render: (e) => formatDateTime(e.created_at) },
          { key: 'peer', label: 'Computer', width: '140px', render: (e) => e.peer_station_code || e.peer_machine_id || '—' },
          {
            key: 'status',
            label: 'Result',
            width: '100px',
            render: (e) => <Badge size="sm" tone={e.status === 'success' ? 'green' : e.status === 'failed' ? 'red' : 'neutral'}>{e.status === 'success' ? 'Worked' : e.status === 'failed' ? 'Failed' : e.status}</Badge>,
          },
          { key: 'message', label: 'Details', render: (e) => e.message || '—' },
        ]}
        rows={log}
        emptyState={<div style={{ ...theme.type.body, color: c.labelSecondary, padding: '24px', textAlign: 'center' }}>No sync activity recorded yet.</div>}
      />
    </Disclosure>
  );
}
