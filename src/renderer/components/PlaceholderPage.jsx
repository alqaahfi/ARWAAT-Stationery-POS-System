import React from 'react';
import { Hammer } from 'lucide-react';
import { Card, EmptyState } from './ui';

// Stand-in for every nav destination that doesn't have a real screen yet, so
// the sidebar is fully wired end-to-end while each module gets built out.
export default function PlaceholderPage({ title }) {
  return (
    <Card padding="0">
      <EmptyState
        icon={Hammer}
        color="orange"
        title="Coming soon"
        message={`${title ? `${title} isn't` : "This page isn't"} ready yet. It will be added in a later update.`}
        style={{ padding: '56px 24px' }}
      />
    </Card>
  );
}
