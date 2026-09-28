import React from 'react';
import theme from '../../../config/theme';
import { useAuth } from '../../../context/AuthContext';

function greetingFor(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function GreetingHeader() {
  const { user } = useAuth();
  const now = new Date();
  const firstName = (user?.fullName || '').trim().split(/\s+/)[0];
  const date = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div>
      <div style={styles.title}>
        {greetingFor(now.getHours())}
        {firstName ? `, ${firstName}` : ''}
      </div>
      <div style={styles.date}>{date}</div>
    </div>
  );
}

const styles = {
  title: { ...theme.type.largeTitle, color: theme.colors.label },
  date: { ...theme.type.body, color: theme.colors.labelSecondary, marginTop: '2px' },
};
