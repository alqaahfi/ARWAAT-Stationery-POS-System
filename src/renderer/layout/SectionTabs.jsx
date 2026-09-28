import React from 'react';
import { useAuth } from '../context/AuthContext';
import { getSectionForRoute, visibleTabs } from '../config/navConfig';
import { SegmentedControl } from '../components/ui';

// The current section's sub-pages as a segmented control at the top of the
// content area. Hidden when the section has fewer than two visible tabs.
export default function SectionTabs({ route, onNavigate }) {
  const { user, hasPermission } = useAuth();
  const match = getSectionForRoute(route);
  if (!match) return null;
  const tabs = visibleTabs(match.section, user, hasPermission);
  if (tabs.length < 2) return null;

  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%', marginTop: '-8px', marginBottom: '20px', paddingBottom: '2px' }}>
      <SegmentedControl
        label={`${match.section.label} pages`}
        options={tabs.map((t) => ({ value: t.route, label: t.label }))}
        value={match.tab?.route ?? null}
        onChange={(r) => r !== route && onNavigate(r)}
      />
    </div>
  );
}
