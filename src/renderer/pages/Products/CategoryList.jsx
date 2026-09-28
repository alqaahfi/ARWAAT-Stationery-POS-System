import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Card, EmptyState, ListSection, Skeleton, useConfirm, useToast } from '../../components/ui';
import theme from '../../config/theme';
import appIcons from '../../config/appIcons';
import { CategoryModal, CategoryRow } from './categories/CategoryParts';

const emptyForm = { id: null, name: '', parentId: '' };

export default function CategoryList() {
  const toast = useToast();
  const confirm = useConfirm();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(null); // null = sheet closed
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    window.api.categories.list().then((res) => {
      setCategories(res);
      setLoading(false);
    });
  }

  // Parents in name order, each followed by its children. A child whose
  // parent is missing is shown as a top-level row.
  const groups = useMemo(() => {
    const ids = new Set(categories.map((cat) => cat.id));
    const tops = categories.filter((cat) => !cat.parent_id || !ids.has(cat.parent_id));
    return tops.map((parent) => ({ parent, children: categories.filter((cat) => cat.parent_id === parent.id) }));
  }, [categories]);

  function startAdd() {
    setError('');
    setForm({ ...emptyForm });
  }

  function startEdit(cat) {
    setError('');
    setForm({ id: cat.id, name: cat.name, parentId: cat.parent_id || '' });
  }

  async function handleSave() {
    if (saving) return;
    setError('');
    if (!form.name.trim()) {
      setError('Enter a name for this category.');
      return;
    }
    setSaving(true);
    const payload = { name: form.name, parentId: form.parentId ? Number(form.parentId) : null };
    const res = form.id ? await window.api.categories.update({ id: form.id, ...payload }) : await window.api.categories.create(payload);
    setSaving(false);
    if (!res.success) {
      setError(res.reason || 'Could not save the category.');
      return;
    }
    toast.success(form.id ? 'Category saved' : 'Category added');
    setForm(null);
    load();
  }

  async function handleDelete(cat) {
    if (cat.product_count > 0) {
      const n = cat.product_count;
      toast.error(`${n} product${n === 1 ? ' uses' : 's use'} "${cat.name}". Move ${n === 1 ? 'it' : 'them'} to another category first.`);
      return;
    }
    const ok = await confirm({
      title: `Delete "${cat.name}"?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const res = await window.api.categories.delete({ id: cat.id });
    if (!res.success) {
      toast.error(res.reason || 'Could not delete the category.');
      return;
    }
    toast.success('Category deleted');
    load();
  }

  const editingHasChildren = !!form?.id && categories.some((cat) => cat.parent_id === form.id);
  const parentOptions = categories.filter((cat) => !cat.parent_id && cat.id !== form?.id);

  let body;
  if (loading) {
    body = (
      <Card>
        <Skeleton lines={4} />
      </Card>
    );
  } else if (categories.length === 0) {
    body = (
      <Card>
        <EmptyState
          {...appIcons.categories}
          title="No categories yet"
          message="Categories group your products, like Pens, Notebooks or Books."
          action={
            <Button icon={Plus} onClick={startAdd}>
              Add Category
            </Button>
          }
        />
      </Card>
    );
  } else {
    body = (
      <ListSection>
        {groups.flatMap(({ parent, children }) => [
          <CategoryRow key={parent.id} category={parent} onEdit={startEdit} onDelete={handleDelete} />,
          ...children.map((child) => <CategoryRow key={child.id} category={child} isChild onEdit={startEdit} onDelete={handleDelete} />),
        ])}
      </ListSection>
    );
  }

  return (
    <div style={{ maxWidth: '720px', paddingBottom: theme.spacing.xxl }}>
      {!loading && categories.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
          <span style={{ ...theme.type.footnote, ...theme.font.numeric, color: theme.colors.labelSecondary }}>
            {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
          </span>
          <Button icon={Plus} onClick={startAdd}>
            Add Category
          </Button>
        </div>
      )}
      {body}
      <CategoryModal
        form={form}
        parents={parentOptions}
        hasChildren={editingHasChildren}
        error={error}
        saving={saving}
        onChange={setForm}
        onSave={handleSave}
        onClose={() => setForm(null)}
      />
    </div>
  );
}
