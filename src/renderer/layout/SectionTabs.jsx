import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { STOCK_CHANGED_EVENT } from '../utils/appEvents';
import { getSectionForRoute, visibleTabs } from '../config/navConfig';
import { SegmentedControl } from '../components/ui';

// The current section's sub-pages as a segmented control at the top of the
// content area. Hidden when the section has fewer than two visible tabs.
// Count badges for tabs that carry a badgeKey (e.g. Products › Needs review).
function useTabBadges(tabs) {
  const wantsReview = tabs.some((t) => t.badgeKey === 'needsReview');
  const wantsRecount = tabs.some((t) => t.badgeKey === 'recount');
  const [badges, setBadges] = useState({});
  useEffect(() => {
    if (!wantsReview && !wantsRecount) return undefined;
    let alive = true;
    const load = () => {
      if (wantsReview)
        window.api.products
          .listNeedsReview()
          .then((res) => alive && setBadges((b) => ({ ...b, needsReview: res?.rows?.length || 0 })))
          .catch(() => {});
      if (wantsRecount)
        window.api.stock
          .listRecount()
          .then((res) => alive && setBadges((b) => ({ ...b, recount: res?.count || 0 })))
          .catch(() => {});
    };
    load();
    window.addEventListener(STOCK_CHANGED_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(STOCK_CHANGED_EVENT, load);
    };
  }, [wantsReview, wantsRecount]);
  return badges;
}

export default function SectionTabs({ route, onNavigate }) {
  const { user, hasPermission } = useAuth();
  const match = getSectionForRoute(route);
  const tabs = match ? visibleTabs(match.section, user, hasPermission) : [];
  const badges = useTabBadges(tabs);
  if (!match) return null;
  if (tabs.length < 2) return null;

  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%', marginTop: '-8px', marginBottom: '20px', paddingBottom: '2px' }}>
      <SegmentedControl
        label={`${match.section.label} pages`}
        options={tabs.map((t) => ({ value: t.route, label: t.badgeKey && badges[t.badgeKey] ? `${t.label} (${badges[t.badgeKey]})` : t.label }))}
        value={match.tab?.route ?? null}
        onChange={(r) => r !== route && onNavigate(r)}
      />
    </div>
  );
}
