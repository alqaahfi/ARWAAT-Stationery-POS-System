import React, { useState } from 'react';
import { Check, ChevronDown, FileUp, TriangleAlert, X } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Badge, Button, Card, FieldError, Icon, IconTile, Spinner } from '../../../components/ui';
import useInteraction from '../../../components/kit/useInteraction';

const c = theme.colors;

// ---------- Step 1: Upload ----------

export function UploadStep({ fileInputRef, onFileChange, onDropFile, onDownloadTemplate, checking, error }) {
  const [dragOver, setDragOver] = useState(false);
  const { hovered, handlers } = useInteraction(checking);
  const active = dragOver || hovered;

  return (
    <Card>
      <button
        type="button"
        disabled={checking}
        onClick={() => fileInputRef.current.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) onDropFile(file);
        }}
        {...handlers}
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: theme.spacing.sm,
          padding: '40px 24px',
          border: `2px dashed ${active ? c.accent : c.separatorStrong}`,
          borderRadius: theme.radius.lg,
          backgroundColor: active ? c.accentTint : c.surfaceAlt,
          color: c.label,
          fontFamily: theme.font.family,
          cursor: checking ? 'progress' : 'pointer',
          transition: `background-color ${theme.motion.fast} ease, border-color ${theme.motion.fast} ease`,
        }}
      >
        {checking ? <Spinner size={28} style={{ color: c.accent }} /> : <IconTile icon={FileUp} color="blue" size="lg" variant="soft" />}
        <span style={theme.type.headline}>{checking ? 'Checking your file…' : 'Drag a .csv file here, or click to choose'}</span>
        <span style={{ ...theme.type.subhead, color: c.labelSecondary }}>Save your spreadsheet as CSV first (File › Save As › CSV).</span>
      </button>
      <input ref={fileInputRef} type="file" accept=".csv" onChange={onFileChange} style={{ display: 'none' }} />
      {error && (
        <div role="alert">
          <FieldError>{error}</FieldError>
        </div>
      )}

      <ul style={{ margin: `${theme.spacing.md} 0 0`, paddingLeft: '20px', ...theme.type.subhead, color: c.labelSecondary, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <li>One row for each pack size of each Type.</li>
        <li>Rows with the same item code (or name) are grouped into one product.</li>
        <li>Categories must already exist.</li>
      </ul>
      <Button variant="plain" size="sm" onClick={onDownloadTemplate} style={{ marginTop: theme.spacing.smd, marginLeft: '-10px' }}>
        Download the template
      </Button>
    </Card>
  );
}

// ---------- Step 2: Check ----------

export function CheckStep({ groups, onImport, onChooseAnother }) {
  const ready = groups.filter((g) => g.errors.length === 0).length;
  const needFix = groups.length - ready;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
        <SummaryTile color="green" icon={Check} value={ready} label={`product${ready === 1 ? '' : 's'} ready`} />
        <SummaryTile color="red" icon={TriangleAlert} value={needFix} label={needFix === 1 ? 'needs fixing' : 'need fixing'} />
      </div>

      <Card padding="0" style={{ overflow: 'hidden', marginTop: theme.spacing.md }}>
        <div style={{ ...rowGrid, height: '34px', backgroundColor: c.surfaceAlt, borderBottom: `1px solid ${c.separator}`, ...theme.type.footnote, fontWeight: theme.font.weightSemibold, color: c.labelSecondary }}>
          <span>Product</span>
          <span>Category</span>
          <span style={{ textAlign: 'right' }}>{glossary.types}</span>
          <span style={{ textAlign: 'right' }}>{glossary.packSizes}</span>
          <span>Status</span>
        </div>
        {groups.map((g, i) => (
          <GroupRow key={i} group={g} />
        ))}
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.md, flexWrap: 'wrap' }}>
        <Button variant="plain" onClick={onChooseAnother}>
          Choose another file
        </Button>
        {needFix > 0 ? (
          <Button disabled>Fix the file and upload it again</Button>
        ) : (
          <Button onClick={onImport}>
            Import {ready} product{ready === 1 ? '' : 's'}
          </Button>
        )}
      </div>
    </>
  );
}

const rowGrid = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.2fr) 64px 84px 130px',
  gap: theme.spacing.smd,
  alignItems: 'center',
  padding: `0 ${theme.spacing.md}`,
};

function SummaryTile({ color, icon, value, label }) {
  return (
    <Card style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.smd }}>
      <IconTile icon={icon} color={color} size="lg" variant="soft" />
      <div>
        <div style={{ ...theme.type.title1, ...theme.font.numeric, color: c[`${color}Text`] }}>{value}</div>
        <div style={{ ...theme.type.subhead, color: c.labelSecondary }}>{label}</div>
      </div>
    </Card>
  );
}

function GroupRow({ group: g }) {
  const hasErrors = g.errors.length > 0;
  const [open, setOpen] = useState(hasErrors);
  const { hovered, handlers } = useInteraction(!hasErrors);

  const cells = (
    <>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: theme.font.weightMedium, color: g.name ? c.label : c.redText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {g.name || '(no name)'}
        </span>
        {g.sku && <span style={{ display: 'block', ...theme.type.footnote, color: c.labelSecondary }}>{g.sku}</span>}
      </span>
      <span style={{ color: c.labelSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.categoryName || '—'}</span>
      <span style={{ ...theme.font.numeric, textAlign: 'right' }}>{g.variants.length}</span>
      <span style={{ ...theme.font.numeric, textAlign: 'right' }}>{g.units.length}</span>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
        {hasErrors ? (
          <Badge tone="red" size="sm">
            <Icon icon={X} size={12} />
            {g.errors.length} problem{g.errors.length === 1 ? '' : 's'}
          </Badge>
        ) : (
          <Badge tone="green" size="sm">
            <Icon icon={Check} size={12} />
            Ready
          </Badge>
        )}
        {hasErrors && (
          <Icon icon={ChevronDown} size={16} style={{ color: c.labelTertiary, transform: open ? 'rotate(180deg)' : 'none', transition: `transform ${theme.motion.base} ${theme.motion.easing}` }} />
        )}
      </span>
    </>
  );

  const base = { ...rowGrid, minHeight: '48px', padding: `6px ${theme.spacing.md}`, boxSizing: 'border-box', ...theme.type.subhead, color: c.label };

  return (
    <div style={{ borderBottom: `1px solid ${c.separator}` }}>
      {hasErrors ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          {...handlers}
          style={{ ...base, width: '100%', border: 'none', textAlign: 'left', fontFamily: theme.font.family, cursor: 'pointer', backgroundColor: hovered ? c.surfaceAlt : c.surface }}
        >
          {cells}
        </button>
      ) : (
        <div style={base}>{cells}</div>
      )}
      {hasErrors && open && (
        <ul role="alert" style={{ margin: 0, padding: `0 ${theme.spacing.md} ${theme.spacing.smd} 36px`, ...theme.type.footnote, color: c.redText, animation: `fade-in ${theme.motion.base} ease` }}>
          {g.errors.map((err, j) => (
            <li key={j} style={{ marginTop: '2px' }}>
              {err}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Step 3: Import ----------

export function ImportStep({ result, onViewProducts, onImportMore, onBackToCheck }) {
  const centered = { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: theme.spacing.sm, padding: '32px 16px' };

  if (!result) {
    return (
      <Card>
        <div role="status" style={centered}>
          <Spinner size={32} style={{ color: c.accent }} />
          <div style={theme.type.headline}>Importing… please don't close the app.</div>
        </div>
      </Card>
    );
  }

  if (result.success) {
    const n = result.results.length;
    return (
      <Card>
        <div role="status" style={centered}>
          <IconTile icon={Check} color="green" size="xl" variant="soft" />
          <div style={{ ...theme.type.title2, ...theme.font.numeric, marginTop: theme.spacing.xs }}>
            {n} product{n === 1 ? '' : 's'} imported
          </div>
          <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
            <Button variant="plain" onClick={onImportMore}>
              Import more
            </Button>
            <Button onClick={onViewProducts}>View products</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div role="alert" style={centered}>
        <IconTile icon={TriangleAlert} color="red" size="xl" variant="soft" />
        <div style={{ ...theme.type.title2, marginTop: theme.spacing.xs }}>Nothing was imported.</div>
        {result.reason && <div style={{ ...theme.type.subhead, color: c.labelSecondary, maxWidth: '480px' }}>{result.reason}</div>}
        <Button variant="tinted" onClick={onBackToCheck} style={{ marginTop: theme.spacing.sm }}>
          Back to check
        </Button>
      </div>
    </Card>
  );
}
