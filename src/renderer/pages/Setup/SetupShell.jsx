import React from 'react';
import theme from '../../config/theme';
import BrandMark from '../../components/BrandMark';
import { IconTile } from '../../components/ui';
import useInteraction from '../../components/kit/useInteraction';

const c = theme.colors;

// Full-window layout for every setup screen and Login: plain gray page, one
// centered card, "Powered by ARWAAT" underneath. Pass `onSubmit` to make the
// card a form (Enter submits). `stepKey` changes re-run the fade-in.
export default function SetupShell({ step, totalSteps, title, subtitle, stepKey, onSubmit, footer, children }) {
  const Box = onSubmit ? 'form' : 'div';
  const formProps = onSubmit
    ? {
        noValidate: true,
        onSubmit: (e) => {
          e.preventDefault();
          onSubmit();
        },
      }
    : {};

  return (
    <div style={styles.page}>
      <Box {...formProps} style={styles.card}>
        <div style={styles.header}>
          <BrandMark size={48} />
          {step && totalSteps ? <StepIndicator step={step} total={totalSteps} /> : null}
        </div>
        <div key={stepKey ?? title} style={styles.fade}>
          <h1 style={styles.title}>{title}</h1>
          {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
          <div style={styles.body}>{children}</div>
          {footer && <div style={styles.footer}>{footer}</div>}
        </div>
      </Box>
      <div style={styles.powered}>Powered by ARWAAT</div>
    </div>
  );
}

export function StepIndicator({ step, total }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: theme.spacing.sm }}>
      <div style={{ display: 'flex', gap: '6px' }} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const current = n === step;
          return (
            <span
              key={n}
              style={{
                width: current ? '18px' : '6px',
                height: '6px',
                borderRadius: theme.radius.pill,
                backgroundColor: n <= step ? c.accent : c.fillStrong,
                transition: `width ${theme.motion.base} ${theme.motion.easing}`,
              }}
            />
          );
        })}
      </div>
      <span style={{ ...theme.type.footnote, color: c.labelSecondary }}>
        Step {step} of {total}
      </span>
    </div>
  );
}

// Large selectable card (used for the role choice). A real button.
export function ChoiceCard({ icon, color = 'blue', title, description, selected, onClick, onDoubleClick }) {
  const { hovered, handlers } = useInteraction();
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      {...handlers}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: theme.spacing.smd,
        width: '100%',
        padding: theme.spacing.md,
        textAlign: 'left',
        fontFamily: theme.font.family,
        borderRadius: theme.radius.lg,
        border: `1.5px solid ${selected ? c.accent : c.separator}`,
        backgroundColor: selected ? c.accentTint : hovered ? c.surfaceAlt : c.surface,
        cursor: 'pointer',
        transition: `background-color ${theme.motion.fast} ease, border-color ${theme.motion.fast} ease`,
      }}
    >
      <IconTile icon={icon} color={color} size="lg" />
      <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <span style={{ ...theme.type.headline, color: c.label }}>{title}</span>
        <span style={{ ...theme.type.subhead, color: c.labelSecondary }}>{description}</span>
      </span>
    </button>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    // Extra bottom room keeps the corner free for the Dev Panel trigger.
    padding: `${theme.spacing.xl} ${theme.spacing.md} ${theme.spacing.xxl}`,
    backgroundColor: c.bg,
    fontFamily: theme.font.family,
    color: c.label,
  },
  card: {
    width: '440px',
    maxWidth: '100%',
    boxSizing: 'border-box',
    padding: theme.spacing.xl,
    borderRadius: theme.radius.xl,
    backgroundColor: c.surface,
    boxShadow: theme.shadow.popover,
    margin: 0,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  fade: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '240px',
    animation: `fade-in ${theme.motion.base} ${theme.motion.easing}`,
  },
  title: { ...theme.type.title1, color: c.label, margin: 0, textAlign: 'center' },
  subtitle: { ...theme.type.body, color: c.labelSecondary, margin: `${theme.spacing.xs} 0 0`, textAlign: 'center' },
  body: { flex: 1, marginTop: theme.spacing.lg },
  footer: { display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  powered: { ...theme.type.caption, color: c.labelTertiary, marginTop: theme.spacing.md },
};
