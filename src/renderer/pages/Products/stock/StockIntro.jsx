import React from 'react';
import { CircleAlert, RotateCw } from 'lucide-react';
import theme from '../../../config/theme';
import { Button, EmptyState } from '../../../components/ui';

// One-line page intro under the shell's title.
export function StockIntro({ children }) {
  return <p style={{ ...theme.type.body, color: theme.colors.labelSecondary, margin: `0 0 ${theme.spacing.md}` }}>{children}</p>;
}

// "Couldn't load" state with a retry button, used wherever these pages load data.
export function LoadError({ message = 'Something went wrong while loading. Check the app and try again.', onRetry }) {
  return (
    <EmptyState
      icon={CircleAlert}
      color="red"
      title="Couldn't load this"
      message={message}
      action={onRetry && <Button variant="tinted" icon={RotateCw} onClick={onRetry}>Try again</Button>}
    />
  );
}
