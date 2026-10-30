import React, { useEffect, useRef, useState } from 'react';
import { UserX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, EmptyState, useConfirm, useToast } from '../../components/ui';
import { StickyActions } from '../Products/form/StickyActions';
import { FormSkeleton, RestrictedNotice, pageWrap } from '../Parties/PartyParts';
import { AccountCard, CashierHeader, PermissionsCard } from './parts/CashierFormParts';
import { ResetPasswordModal } from './parts/ResetPasswordModal';

const FIELD_IDS = {
  fullName: 'cashier-full-name',
  username: 'cashier-username',
  password: 'cashier-password',
  confirmPassword: 'cashier-confirm-password',
};
const FIELD_ORDER = ['fullName', 'username', 'password', 'confirmPassword'];

const column = { width: '100%', maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '48px' };

// Create mode collects username + password + permissions all in one form;
// Edit mode touches Full Name, Active status and permissions — username is
// fixed after creation and password changes go through the separate Reset
// Password action, never here.
export default function CashierForm({ cashierId, onDone, onCancel }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isEdit = !!cashierId;

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState({});

  const [definitions, setDefinitions] = useState([]);
  const [definitionsLoading, setDefinitionsLoading] = useState(true);
  const [permissionValues, setPermissionValues] = useState({});

  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);
  const [loadFailed, setLoadFailed] = useState(false);
  // The record as last loaded — drives the header, so it doesn't change while typing.
  const [savedName, setSavedName] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    window.api.permissions
      .getDefinitions()
      .then((defs) => {
        setDefinitions(defs || []);
        // A new cashier starts with the permissions that are on by default (e.g. Add missing items at the counter).
        if (!cashierId) {
          const defaults = {};
          for (const d of defs || []) if (d.defaultForNewCashier) defaults[d.key] = true;
          setPermissionValues((prev) => ({ ...defaults, ...prev }));
        }
      })
      .catch(() => toast.error('Couldn’t load the permission list.'))
      .finally(() => setDefinitionsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadCashier() {
    setLoadFailed(false);
    Promise.all([
      window.api.users.list().then((rows) => rows.find((r) => r.id === cashierId)),
      window.api.permissions.getForUser({ userId: cashierId }),
    ])
      .then(([target, perms]) => {
        if (!target) {
          setLoadFailed(true);
          return;
        }
        setFullName(target.full_name);
        setSavedName(target.full_name);
        setUsername(target.username);
        setIsActive(!!target.is_active);
        setPermissionValues(perms || {});
        setLoaded(true);
      })
      .catch(() => setLoadFailed(true));
  }

  useEffect(() => {
    if (isEdit) loadCashier();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cashierId]);

  async function handleUsernameBlur() {
    if (isEdit || !username.trim()) return;
    try {
      const res = await window.api.users.checkUsernameUnique({ username: username.trim() });
      setUsernameError(res.unique ? '' : 'That username is already taken.');
    } catch {
      // The server re-checks on save.
    }
  }

  function handleFieldChange(field, value) {
    if (field === 'fullName') setFullName(value);
    if (field === 'username') {
      setUsername(value);
      setUsernameError('');
    }
    if (field === 'password') setPassword(value);
    if (field === 'confirmPassword') setConfirmPassword(value);
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  function updatePermission(key, value) {
    setPermissionValues((prev) => ({ ...prev, [key]: value }));
  }

  function showErrors(next) {
    setErrors(next);
    const first = FIELD_ORDER.find((f) => next[f]);
    toast.error('Please check the highlighted fields');
    if (!first) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(FIELD_IDS[first]);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.focus({ preventScroll: true });
    });
  }

  // Server reasons are plain words; route them to the field they're about.
  function fieldForReason(reason = '') {
    if (/username/i.test(reason)) return 'username';
    if (/full name/i.test(reason)) return 'fullName';
    if (/password/i.test(reason)) return 'password';
    return null;
  }

  function validate() {
    const next = {};
    if (!fullName.trim()) next.fullName = 'Full name is required.';
    if (!isEdit) {
      if (!username.trim()) next.username = 'Username is required.';
      else if (usernameError) next.username = usernameError;
      if (password.length < 6) next.password = 'Password must be at least 6 characters.';
      else if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match.';
    }
    return next;
  }

  async function handleSave() {
    if (savingRef.current) return;
    const problems = validate();
    if (Object.keys(problems).length) return showErrors(problems);

    savingRef.current = true;
    setSaving(true);
    try {
      let targetId = cashierId;

      if (isEdit) {
        const res = await window.api.users.update({ id: cashierId, fullName: fullName.trim() });
        if (!res.success) return failWith(res.reason || 'Could not update cashier.');
        const activeRes = await window.api.users.setActive({ id: cashierId, isActive });
        if (!activeRes.success) return failWith(activeRes.reason || 'Could not update status.');
      } else {
        const res = await window.api.users.createCashier({ fullName: fullName.trim(), username: username.trim(), password });
        if (!res.success) return failWith(res.reason || 'Could not create cashier account.');
        targetId = res.id;
      }

      const permsRes = await window.api.permissions.saveForUser({ userId: targetId, values: permissionValues });
      if (!permsRes.success) {
        toast.error(permsRes.reason || 'Cashier saved, but permissions could not be saved.');
        return;
      }
      toast.success('Cashier saved');
      onDone();
    } catch {
      toast.error('Could not save cashier. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function failWith(reason) {
    const field = fieldForReason(reason);
    if (field) showErrors({ [field]: reason });
    else toast.error(reason);
  }

  // Header Activate / Deactivate acts straight away (it revokes sessions on
  // the server), the same call the list's switch makes.
  async function handleToggleActive() {
    const next = !isActive;
    if (!next) {
      const ok = await confirm({
        title: `Deactivate ${savedName}?`,
        message: 'They’ll be signed out and won’t be able to log in until you reactivate them.',
        confirmLabel: 'Deactivate',
      });
      if (!ok) return;
    }
    setTogglingActive(true);
    try {
      const res = await window.api.users.setActive({ id: cashierId, isActive: next });
      if (!res.success) {
        toast.error(res.reason || 'Could not update status.');
        return;
      }
      setIsActive(next);
      toast.success(next ? `${savedName} can log in again` : `${savedName} is now inactive`);
    } catch {
      toast.error('Could not update status. Please try again.');
    } finally {
      setTogglingActive(false);
    }
  }

  if (user.role !== 'admin') return <RestrictedNotice />;

  if (loadFailed) {
    return (
      <Card style={{ maxWidth: '560px', margin: '0 auto' }}>
        <EmptyState
          icon={UserX}
          color="red"
          title="We couldn't open this cashier"
          message="Check your connection to the shop's data and try again."
          action={
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <Button variant="plain" onClick={onCancel}>
                Back to cashiers
              </Button>
              <Button variant="tinted" onClick={loadCashier}>
                Try again
              </Button>
            </div>
          }
        />
      </Card>
    );
  }

  if (!loaded) return <FormSkeleton />;

  return (
    <div style={pageWrap}>
      <div style={column}>
        {isEdit && (
          <CashierHeader
            name={savedName}
            username={username}
            isActive={isActive}
            onResetPassword={() => setResetOpen(true)}
            onToggleActive={handleToggleActive}
            togglingActive={togglingActive}
          />
        )}

        <AccountCard
          isEdit={isEdit}
          values={{ fullName, username, password, confirmPassword }}
          errors={{ ...errors, username: errors.username || usernameError }}
          onChange={handleFieldChange}
          onUsernameBlur={handleUsernameBlur}
        />

        <PermissionsCard definitions={definitions} values={permissionValues} onChange={updatePermission} loading={definitionsLoading} />
      </div>

      <StickyActions onCancel={onCancel} onSave={handleSave} saving={saving} saveLabel={isEdit ? 'Save changes' : 'Save cashier'} />

      {resetOpen && <ResetPasswordModal user={{ id: cashierId, full_name: savedName }} onClose={() => setResetOpen(false)} />}
    </div>
  );
}
