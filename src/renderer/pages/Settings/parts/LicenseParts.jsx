import React from 'react';
import { BadgeCheck, CalendarCheck, Fingerprint, Monitor, Network, Store, UserCog } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Badge, ListRow, ListSection } from '../../../components/ui';
import { formatDateOnly } from '../../../utils/format';
import { CodeText, CopyButton } from './SettingsParts';
import { roleLabel } from './SyncParts';

const c = theme.colors;

function Value({ children }) {
  return <span style={{ ...theme.type.body, color: c.labelSecondary, textAlign: 'right', overflowWrap: 'anywhere' }}>{children || '—'}</span>;
}

// Read-only: exactly the fields license:get-status returns.
export function LicenseSections({ status }) {
  return (
    <>
      <ListSection title="This shop">
        {status.shopName && <ListRow icon={Store} color="blue" title="Shop name" trailing={<Value>{status.shopName}</Value>} />}
        <ListRow icon={Monitor} color="gray" title={glossary.computerName} trailing={<Value>{status.stationCode}</Value>} />
        <ListRow icon={UserCog} color="teal" title="Role" trailing={<Value>{roleLabel(status.role)}</Value>} />
        {status.adminHost && <ListRow icon={Network} color="indigo" title="Main computer address" trailing={<Value>{status.adminHost}</Value>} />}
      </ListSection>

      <ListSection title="Activation" footer="Read out the Computer ID if support ever asks for it.">
        <ListRow
          icon={BadgeCheck}
          color={status.activated ? 'green' : 'red'}
          title="Status"
          trailing={
            status.activated ? (
              <Badge tone="green" dot>
                Activated
              </Badge>
            ) : (
              <Badge tone="red" dot>
                Not activated
              </Badge>
            )
          }
        />
        <ListRow icon={CalendarCheck} color="green" title="Activated on" trailing={<Value>{status.activatedAt ? formatDateOnly(status.activatedAt) : null}</Value>} />
        <ListRow
          icon={Fingerprint}
          color="gray"
          title={glossary.computerId}
          subtitle={<CodeText size="sm">{status.machineId || '—'}</CodeText>}
          trailing={<CopyButton text={status.machineId} label={`Copy ${glossary.computerId}`} />}
        />
      </ListSection>
    </>
  );
}
