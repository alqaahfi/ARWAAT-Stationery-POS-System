// Dev-only reference page for the design system. Loaded lazily and only when
// import.meta.env.DEV, so it never ships in production builds.
import React, { useState } from 'react';
import { ArrowRight, CalendarX, ClipboardList, Download, Inbox, Package, Plus, Printer, Search, Trash2 } from 'lucide-react';
import theme from '../../config/theme';
import appIcons from '../../config/appIcons';
import { glossaryChanges } from '../../config/glossary';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  ChipGroup,
  DataTable,
  Disclosure,
  EmptyState,
  Field,
  Icon,
  IconButton,
  IconTile,
  Kbd,
  ListRow,
  ListSection,
  Menu,
  MenuDivider,
  MenuHeader,
  MenuItem,
  Modal,
  NumberInput,
  PageHeader,
  PasswordInput,
  Popover,
  SearchField,
  SegmentedControl,
  Select,
  Skeleton,
  Spinner,
  Stepper,
  TextArea,
  TextInput,
  Toggle,
  useConfirm,
  useToast,
} from '../../components/ui';

const c = theme.colors;

const COLOR_GROUPS = [
  ['Accent', ['accent', 'accentPressed', 'accentTint']],
  ['System', ['green', 'red', 'orange', 'yellow', 'teal', 'indigo', 'purple', 'pink', 'gray']],
  ['Text variants', ['greenText', 'redText', 'orangeText', 'tealText', 'indigoText', 'purpleText']],
  ['Tints', ['greenTint', 'redTint', 'orangeTint', 'tealTint', 'indigoTint', 'purpleTint']],
  ['Surfaces', ['bg', 'surface', 'surfaceAlt', 'fill', 'fillStrong']],
  ['Labels', ['label', 'labelSecondary', 'labelTertiary']],
  ['Lines', ['separator', 'separatorStrong']],
];

const sampleRows = [
  { id: 1, name: 'Blue ball pen (box of 10)', code: 'PEN-010', stock: 42, price: 'Rs 450.00' },
  { id: 2, name: 'A4 copy paper, 500 sheets', code: 'PAP-A4', stock: 6, price: 'Rs 1,850.00' },
  { id: 3, name: 'Geometry box', code: 'GEO-01', stock: 0, price: 'Rs 320.00' },
];
const columns = [
  { key: 'name', label: 'Item' },
  { key: 'code', label: 'Item Code', width: '120px' },
  {
    key: 'stock',
    label: 'In Stock',
    numeric: true,
    render: (r) =>
      r.stock === 0 ? <Badge tone="red" size="sm">Out</Badge> : r.stock < 10 ? <Badge tone="orange" size="sm" dot>{r.stock}</Badge> : r.stock,
  },
  { key: 'price', label: 'Price', numeric: true },
];

export default function DesignGallery() {
  const toast = useToast();
  const confirm = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [toggle, setToggle] = useState(true);
  const [check, setCheck] = useState(true);
  const [segment, setSegment] = useState('retail');
  const [chip, setChip] = useState('damaged');
  const [chipSm, setChipSm] = useState('all');
  const [search, setSearch] = useState('pens');
  const [rowToggle, setRowToggle] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function askDestructive() {
    const ok = await confirm({
      title: 'Delete this product?',
      message: 'It will be removed from the list. Past sales stay as they are.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    ok ? toast.success('Product deleted') : toast.info('Nothing was deleted');
  }

  async function askNormal() {
    const ok = await confirm({ title: 'Save changes?', message: 'Prices will update on every computer.', confirmLabel: 'Save' });
    ok ? toast.success('Saved') : toast.info('Not saved');
  }

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', paddingBottom: '80px', fontFamily: theme.font.family, color: c.label }}>
      <div style={{ ...theme.type.largeTitle, marginBottom: '4px' }}>Design Gallery</div>
      <div style={{ ...theme.type.subhead, color: c.labelSecondary, marginBottom: theme.spacing.xl }}>
        Dev only · Ctrl+Shift+G · Every token and component in one place.
      </div>

      <Section title="Colors">
        {COLOR_GROUPS.map(([group, keys]) => (
          <div key={group} style={{ marginBottom: theme.spacing.md }}>
            <SubTitle>{group}</SubTitle>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.smd }}>
              {keys.map((k) => (
                <div key={k} style={{ width: '112px' }}>
                  <div style={{ height: '48px', borderRadius: theme.radius.md, backgroundColor: c[k], border: `1px solid ${c.separator}` }} />
                  <div style={{ ...theme.type.footnote, fontWeight: 600, marginTop: '4px' }}>{k}</div>
                  <div style={{ ...theme.type.caption, color: c.labelSecondary, fontWeight: 400 }}>{c[k]}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title="Type scale">
        <Card>
          {Object.entries(theme.type).map(([name, style]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'baseline', gap: theme.spacing.md, padding: '6px 0' }}>
              <div style={{ width: '160px', ...theme.type.footnote, color: c.labelSecondary }}>
                {name} · {style.fontSize}/{style.fontWeight}
              </div>
              <div style={style}>Blue ball pens, box of 10</div>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.spacing.md, padding: '6px 0' }}>
            <div style={{ width: '160px', ...theme.type.footnote, color: c.labelSecondary }}>numeric (tabular)</div>
            <div style={{ ...theme.type.title1, ...theme.font.numeric }}>Rs 1,111.00 / Rs 8,888.00</div>
          </div>
        </Card>
      </Section>

      <Section title="Radii & shadows">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {Object.entries(theme.radius).map(([k, v]) => (
            <Demo key={k} label={`radius.${k} · ${v}`}>
              <div style={{ width: '72px', height: '48px', backgroundColor: c.accentTint, borderRadius: v }} />
            </Demo>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.lg, marginTop: theme.spacing.md }}>
          {Object.entries(theme.shadow).map(([k, v]) => (
            <Demo key={k} label={`shadow.${k}`}>
              <div style={{ width: '120px', height: '64px', backgroundColor: c.surface, borderRadius: theme.radius.md, boxShadow: v }} />
            </Demo>
          ))}
        </div>
      </Section>

      <Section title="App icons (appIcons.js)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: theme.spacing.smd }}>
          {Object.entries(appIcons).map(([name, def]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
              <IconTile {...def} />
              <span style={theme.type.subhead}>{name}</span>
            </div>
          ))}
        </div>
        <SubTitle style={{ marginTop: theme.spacing.lg }}>Tile sizes & soft variant · plain Icon sizes</SubTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
          <IconTile {...appIcons.products} size="sm" />
          <IconTile {...appIcons.products} size="md" />
          <IconTile {...appIcons.products} size="lg" />
          <IconTile {...appIcons.products} size="lg" variant="soft" />
          <IconTile {...appIcons.overdue} size="lg" variant="soft" />
          {[16, 18, 20, 24].map((s) => (
            <Icon key={s} icon={Package} size={s} style={{ color: c.labelSecondary }} />
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <Row label="Variants">
          <Button icon={Plus}>Add Product</Button>
          <Button variant="tinted">Tinted</Button>
          <Button variant="plain">Plain</Button>
          <Button variant="secondary">Secondary (legacy)</Button>
          <Button variant="danger" icon={Trash2}>Delete</Button>
          <Button variant="dangerFilled">Erase Everything</Button>
        </Row>
        <Row label="Sizes">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg" iconRight={ArrowRight}>Large</Button>
        </Row>
        <Row label="States (hover / press / Tab to focus)">
          <Button>Normal</Button>
          <Button disabled>Disabled</Button>
          <Button loading>Saving</Button>
          <Button variant="tinted" loading>Loading</Button>
        </Row>
        <Row label="Full width">
          <div style={{ width: '320px' }}>
            <Button fullWidth size="lg">Complete Sale</Button>
          </div>
        </Row>
        <Row label="IconButton">
          <IconButton icon={Printer} label="Print" />
          <IconButton icon={Download} label="Download" tone="accent" />
          <IconButton icon={Trash2} label="Delete" tone="danger" />
          <IconButton icon={Search} label="Search (disabled)" disabled />
        </Row>
      </Section>

      <Section title="Fields">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `0 ${theme.spacing.lg}` }}>
          <Field label="Product name" hint="As it should appear on receipts.">
            <TextInput placeholder="e.g. Blue ball pen" />
          </Field>
          <Field label="Buying Price" required error="Enter a price above zero.">
            <NumberInput defaultValue="0" />
          </Field>
          <Field label="Auto-focused (focus ring)">
            <TextInput defaultValue="Focused on load" autoFocus />
          </Field>
          <Field label="Disabled">
            <TextInput defaultValue="Can't edit" disabled />
          </Field>
          <Field label="Category">
            <Select defaultValue="pens">
              <option value="pens">Pens</option>
              <option value="paper">Paper</option>
            </Select>
          </Field>
          <Field label="Category (error)" error="Pick a category.">
            <Select defaultValue="">
              <option value="">Choose…</option>
            </Select>
          </Field>
          <Field label="Search" hint="Esc clears.">
            <SearchField value={search} onChange={setSearch} placeholder="Search products" />
          </Field>
          <Field label="Notes">
            <TextArea placeholder="Anything to remember about this item" />
          </Field>
          <Field label="Password" hint="Eye button shows or hides it.">
            <PasswordInput defaultValue="secret123" />
          </Field>
        </div>
      </Section>

      <Section title="Toggle · Checkbox · Segmented control">
        <Row label="Toggle">
          <Toggle checked={toggle} onChange={setToggle} label="Demo toggle" />
          <Toggle checked={false} label="Off" />
          <Toggle checked disabled label="Disabled on" />
          <Toggle checked={false} disabled label="Disabled off" />
        </Row>
        <Row label="Checkbox">
          <Checkbox label="Running Low only" checked={check} onChange={(e) => setCheck(e.target.checked)} style={{ marginTop: 0 }} />
          <Checkbox label="Unchecked" checked={false} onChange={() => {}} style={{ marginTop: 0 }} />
          <Checkbox label="Disabled" checked disabled onChange={() => {}} style={{ marginTop: 0 }} />
        </Row>
        <Row label="SegmentedControl (arrow keys)">
          <SegmentedControl
            label="Sale type"
            value={segment}
            onChange={setSegment}
            options={[
              { value: 'retail', label: 'Retail' },
              { value: 'wholesale', label: 'Wholesale' },
              { value: 'return', label: 'Return' },
            ]}
          />
          <SegmentedControl
            size="sm"
            value="day"
            onChange={() => {}}
            options={[
              { value: 'day', label: 'Today' },
              { value: 'week', label: 'This week' },
              { value: 'month', label: 'This month' },
            ]}
          />
        </Row>
      </Section>

      <Section title="Badges · Banners · Kbd">
        <Row label="Badge">
          {['neutral', 'blue', 'green', 'orange', 'red', 'purple'].map((t) => (
            <Badge key={t} tone={t}>{t}</Badge>
          ))}
          <Badge tone="green" dot>Paid</Badge>
          <Badge tone="orange" dot size="sm">Running Low</Badge>
          <Badge tone="red" dot size="sm">Overdue</Badge>
        </Row>
        <div style={{ maxWidth: '560px' }}>
          <Banner tone="error">Couldn't save. Check the price and try again.</Banner>
          <Banner tone="warning">6 products are running low.</Banner>
          <Banner tone="success">Backup finished.</Banner>
          <Banner tone="info">Connected to 2 other computers.</Banner>
        </div>
        <Row label="Kbd" style={{ marginTop: theme.spacing.md }}>
          <span style={theme.type.subhead}>
            Press <Kbd>Enter</Kbd> to add, <Kbd>Esc</Kbd> to cancel, <Kbd>↑</Kbd> <Kbd>↓</Kbd> to move, <Kbd>Ctrl</Kbd>+<Kbd>K</Kbd> to search
          </span>
        </Row>
      </Section>

      <Section title="Card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
          <Card>Plain card with default padding.</Card>
          <Card title="Today's sales" footer={<Button variant="plain" size="sm">View all</Button>}>
            <div style={{ ...theme.type.largeTitle, ...theme.font.numeric }}>Rs 24,560.00</div>
          </Card>
        </div>
        <div style={{ marginTop: theme.spacing.md }}>
          <PageHeader title="PageHeader" subtitle="Optional subtitle" actions={<Button icon={Plus}>Add</Button>} />
        </div>
      </Section>

      <Section title="Grouped list (ListSection + ListRow)">
        <div style={{ maxWidth: '560px' }}>
          <ListSection title="Printing" footer="Receipts print to the thermal printer; invoices print on A4.">
            <ListRow {...appIcons.printer} title="Printers" value="EPSON TM-T82" chevron onClick={() => toast.info('Open Printers')} />
            <ListRow {...appIcons.letterhead} title="Letterheads" subtitle="2 saved" chevron onClick={() => toast.info('Open Letterheads')} />
            <ListRow {...appIcons.receiptText} title="Receipt Header & Footer" chevron onClick={() => toast.info('Open Receipt')} />
          </ListSection>
          <ListSection title="What this cashier can do">
            <ListRow title="Make sales" trailing={<Toggle checked={rowToggle} onChange={setRowToggle} label="Make sales" />} />
            <ListRow title="Receive payments" subtitle="From customers who owe money" trailing={<Toggle checked onChange={() => {}} label="Receive payments" />} />
            <ListRow title="Disabled row" disabled trailing={<Badge>Admin only</Badge>} />
          </ListSection>
          <ListSection>
            <ListRow {...appIcons.delete} title="Erase Everything & Start Over" destructive onClick={askDestructive} />
          </ListSection>
        </div>
      </Section>

      <Section title="Data table">
        <Card padding="0" style={{ overflow: 'hidden', marginBottom: theme.spacing.md }}>
          <DataTable columns={columns} rows={sampleRows} onRowClick={(r) => toast.info(`Clicked ${r.name}`)} />
        </Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
          <Card padding="0" style={{ overflow: 'hidden' }}>
            <DataTable columns={columns} rows={[]} loading dense />
          </Card>
          <Card padding="0" style={{ overflow: 'hidden' }}>
            <DataTable
              columns={columns}
              rows={[]}
              emptyState={<EmptyState icon={Inbox} title="No products yet" message="Add your first product to start selling." />}
            />
          </Card>
        </div>
      </Section>

      <Section title="Empty · Skeleton · Spinner">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
          <Card>
            <EmptyState
              {...appIcons.customers}
              title="No customers yet"
              message="Customers you add will show here."
              action={<Button icon={Plus}>Add Customer</Button>}
            />
          </Card>
          <Card>
            <Skeleton width="40%" height="20px" style={{ marginBottom: theme.spacing.md }} />
            <Skeleton lines={3} />
            <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center', marginTop: theme.spacing.lg, color: c.accent }}>
              <Spinner size={16} />
              <Spinner size={20} />
              <Spinner size={28} />
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Toasts · Modal · Confirm">
        <Row label="Toasts">
          <Button variant="tinted" onClick={() => toast.success('Sale saved')}>Success toast</Button>
          <Button variant="tinted" onClick={() => toast.error("Couldn't reach the printer")}>Error toast</Button>
          <Button variant="tinted" onClick={() => toast.info('Synced with 2 computers')}>Info toast</Button>
        </Row>
        <Row label="Overlays">
          <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
          <Button variant="danger" onClick={askDestructive}>Destructive confirm</Button>
          <Button variant="secondary" onClick={askNormal}>Normal confirm</Button>
        </Row>
      </Section>

      <Section title="Popover · Menu">
        <Row label="Anchored menu (↑/↓ + Enter, Esc closes, outside click closes)">
          <Popover
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            align="start"
            width={240}
            anchor={<Button variant="secondary" icon={Plus} onClick={() => setMenuOpen((o) => !o)}>Open menu</Button>}
          >
            {(close) => (
              <Menu label="Demo menu">
                <MenuHeader>Add</MenuHeader>
                <MenuItem {...appIcons.products} label="Add Product" onClick={() => { close(); toast.info('Add Product'); }} />
                <MenuItem {...appIcons.runningLow} label="Running Low" badge={<Badge tone="orange" size="sm">4</Badge>} onClick={close} />
                <MenuItem icon={Printer} label="Print" value="Ctrl P" onClick={close} />
                <MenuDivider />
                <MenuItem icon={Trash2} label="Delete" destructive onClick={close} />
              </Menu>
            )}
          </Popover>
        </Row>
      </Section>

      <Section title="Disclosure · Stepper">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
            <Disclosure title="Special prices" summary="None set">
              <div style={{ ...theme.type.subhead, color: c.labelSecondary }}>Collapsed by default; the summary shows while closed.</div>
            </Disclosure>
            <Disclosure title="Types" summary="2 Types" defaultOpen>
              <div style={{ ...theme.type.subhead, color: c.labelSecondary }}>Open by default. The body fades in.</div>
            </Disclosure>
          </div>
          <Card>
            <SubTitle>Step 2 of 3</SubTitle>
            <Stepper steps={['Upload', 'Check', 'Import']} current={1} />
            <SubTitle style={{ marginTop: theme.spacing.lg }}>All done</SubTitle>
            <Stepper steps={['Upload', 'Check', 'Import']} current={3} />
          </Card>
        </div>
      </Section>

      <Section title="Chip group">
        <Row label="Size lg, with icons">
          <ChipGroup
            size="lg"
            aria-label="What happened?"
            value={chip}
            onChange={setChip}
            options={[
              { value: 'damaged', label: 'Damaged', icon: Trash2 },
              { value: 'expired', label: 'Expired', icon: CalendarX },
              { value: 'recount', label: 'Recount', icon: ClipboardList },
            ]}
          />
        </Row>
        <Row label="Size md">
          <ChipGroup
            aria-label="Show"
            value={chipSm}
            onChange={setChipSm}
            options={[
              { value: 'all', label: 'All' },
              { value: 'low', label: 'Running Low' },
              { value: 'out', label: 'Out of stock' },
            ]}
          />
        </Row>
      </Section>

      <Section title="Avatar">
        <Row label="Sizes 28 · 36 · 56 (tint follows the name)">
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
            <Avatar name="Ali Traders" size={28} />
            <Avatar name="Fatima Book Depot" size={36} />
            <Avatar name="Usman" size={56} />
            <Avatar name="City School" size={36} />
            <Avatar name="Rehman Stationers" size={36} />
          </div>
        </Row>
      </Section>

      <Section title="Plain Words (Now → New)">
        <Card padding="0" style={{ overflow: 'hidden' }}>
          <DataTable
            dense
            rowKey={(r) => r[0]}
            columns={[
              { key: 'now', label: 'Now', width: '40%', render: (r) => <span style={{ color: c.labelSecondary }}>{r[0]}</span> },
              { key: 'new', label: 'New', render: (r) => <strong style={{ fontWeight: 600 }}>{r[1]}</strong> },
            ]}
            rows={glossaryChanges}
          />
        </Card>
      </Section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Receive Payment"
        subtitle="Ali Book Depot · Owes you Rs 12,400.00"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                setModalOpen(false);
                toast.success('Payment received');
              }}
            >
              Receive
            </Button>
          </>
        }
      >
        <Field label="Amount">
          <NumberInput placeholder="0.00" autoFocus />
        </Field>
        <Field label="Note" hint="Optional.">
          <TextInput placeholder="e.g. Cash at counter" />
        </Field>
      </Modal>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: theme.spacing.xxl }}>
      <div style={{ ...theme.type.title1, marginBottom: theme.spacing.md }}>{title}</div>
      {children}
    </section>
  );
}

function SubTitle({ children, style }) {
  return (
    <div style={{ ...theme.type.footnote, textTransform: 'uppercase', letterSpacing: '0.04em', color: c.labelSecondary, marginBottom: theme.spacing.sm, ...style }}>
      {children}
    </div>
  );
}

function Row({ label, children, style }) {
  return (
    <div style={{ marginBottom: theme.spacing.md, ...style }}>
      <SubTitle>{label}</SubTitle>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.smd }}>{children}</div>
    </div>
  );
}

function Demo({ label, children }) {
  return (
    <div>
      {children}
      <div style={{ ...theme.type.caption, color: c.labelSecondary, fontWeight: 400, marginTop: '6px' }}>{label}</div>
    </div>
  );
}
