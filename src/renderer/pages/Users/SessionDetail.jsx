import React, { useCallback, useEffect, useState } from 'react';
import { CircleAlert, RotateCw } from 'lucide-react';
import theme from '../../config/theme';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, EmptyState } from '../../components/ui';
import { RestrictedNotice } from '../Parties/PartyParts';
import { ActivityTimeline, SessionDetailSkeleton, SessionHeader } from './parts/SessionParts';

// The drill-down behind one row of Cashiers > Session Activity — everything
// that cashier did (login, sales made, logout, ...) during that one session,
// in the order it happened.
export default function SessionDetail({ sessionId, onNavigate }) {
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(() => {
    if (!sessionId) return;
    setLoading(true);
    setLoadFailed(false);
    window.api.sessions
      .getDetail({ id: sessionId })
      .then(setData)
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  if (user.role !== 'admin') return <RestrictedNotice />;

  const column = { maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: theme.spacing.md, paddingBottom: '48px' };

  if (loading) {
    return (
      <div style={column}>
        <SessionDetailSkeleton />
      </div>
    );
  }

  if (loadFailed || !data || !data.success) {
    return (
      <Card style={{ maxWidth: '560px', margin: '0 auto' }}>
        <EmptyState
          icon={CircleAlert}
          color="red"
          title={loadFailed ? "Couldn't load this session" : 'Session not found'}
          message={loadFailed ? 'Something went wrong while loading.' : data?.reason || 'It may have been removed.'}
          action={
            <div style={{ display: 'flex', gap: theme.spacing.sm, justifyContent: 'center' }}>
              <Button variant="plain" onClick={() => onNavigate('/cashiers/sessions')}>
                Back to Session Activity
              </Button>
              {loadFailed && (
                <Button variant="tinted" icon={RotateCw} onClick={load}>
                  Try again
                </Button>
              )}
            </div>
          }
        />
      </Card>
    );
  }

  const { session, activities } = data;

  return (
    <div style={column}>
      <SessionHeader session={session} activityCount={activities.length} />
      <Card title="What happened">
        <ActivityTimeline activities={activities} />
      </Card>
    </div>
  );
}
