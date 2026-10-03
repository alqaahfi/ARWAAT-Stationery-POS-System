import React, { useCallback, useEffect, useRef, useState } from "react";
import { UserX } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Button, Card, EmptyState, useToast } from "../../components/ui";
import { StickyActions } from "../Products/form/StickyActions";
import { StartingBalanceField } from "../Parties/StartingBalanceField";
import {
  FormSkeleton,
  RestrictedNotice,
  fixedPage,
  formBox,
  formColumns,
  formStage,
  formDivider,
  useFitHeight,
} from "../Parties/PartyParts";
import {
  SupplierActiveRow,
  SupplierAddressRow,
  SupplierContactRows,
  SupplierHeader,
  SupplierJoinedRow,
  SupplierNameRow,
  SupplierNotesRow,
} from "./parts/SupplierFormParts";

function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function SupplierForm({
  supplierId,
  onDone,
  onCancel,
  onNavigate,
}) {
  const { user } = useAuth();
  const toast = useToast();
  const isEdit = !!supplierId;

  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [joiningDate, setJoiningDate] = useState(isEdit ? "" : todayLocal());
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saved, setSaved] = useState(null);
  const [ledger, setLedger] = useState({
    loading: false,
    error: false,
    data: null,
  });
  const savingRef = useRef(false);
  const [pageRef, pageHeight] = useFitHeight();

  const loadLedger = useCallback(async () => {
    if (!supplierId) return;
    setLedger((l) => ({ ...l, loading: true, error: false }));
    try {
      const res = await window.api.suppliers.getLedger({ id: supplierId });
      setLedger({
        loading: false,
        error: !res?.success,
        data: res?.success ? res : null,
      });
    } catch {
      setLedger({ loading: false, error: true, data: null });
    }
  }, [supplierId]);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    window.api.suppliers
      .getById({ id: supplierId })
      .then((s) => {
        if (cancelled) return;
        if (!s) {
          setLoadFailed(true);
          return;
        }
        setName(s.name);
        setContactPerson(s.contact_person || "");
        setPhone(s.phone || "");
        setMobile(s.mobile || "");
        setEmail(s.email || "");
        setJoiningDate(s.joining_date || "");
        setAddress(s.address || "");
        setNotes(s.notes || "");
        setOpeningBalance(s.opening_balance);
        setIsActive(!!s.is_active);
        setSaved({
          name: s.name,
          contactPerson: s.contact_person,
          phone: s.phone,
          mobile: s.mobile,
          address: s.address,
          isActive: !!s.is_active,
        });
        setLoaded(true);
        loadLedger();
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  function focusName() {
    requestAnimationFrame(() => {
      const el = document.getElementById("supplier-name");
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    });
  }

  async function handleSave() {
    if (savingRef.current) return;
    if (!name.trim()) {
      setNameError("Supplier name is required.");
      toast.error("Please check the highlighted fields");
      focusName();
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        contactPerson: contactPerson.trim() || null,
        phone: phone.trim() || null,
        mobile: mobile.trim() || null,
        email: email.trim() || null,
        joiningDate: joiningDate || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      };

      const res = isEdit
        ? await window.api.suppliers.update({ id: supplierId, ...payload })
        : await window.api.suppliers.create({
            ...payload,
            openingBalance: Number(openingBalance) || 0,
          });

      if (!res.success) {
        if (/name/i.test(res.reason || "")) {
          setNameError(res.reason);
          focusName();
        }
        toast.error(res.reason || "Could not save supplier.");
        return;
      }
      if (isEdit && saved && isActive !== saved.isActive) {
        await window.api.suppliers.setActive({
          id: supplierId,
          isActive: isActive ? 1 : 0,
        });
      }
      toast.success("Supplier saved");
      onDone();
    } catch {
      toast.error("Could not save supplier. Please try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (user.role !== "admin") {
    return <RestrictedNotice />;
  }

  if (loadFailed) {
    return (
      <Card style={{ maxWidth: "560px", margin: "0 auto" }}>
        <EmptyState
          icon={UserX}
          color="red"
          title="We couldn't open this supplier"
          message="They may have been removed on another computer."
          action={<Button onClick={onCancel}>Back to suppliers</Button>}
        />
      </Card>
    );
  }

  if (!loaded) return <FormSkeleton />;

  // The supplier's account page holds the existing payment form.
  const openAccount = onNavigate
    ? () =>
        onNavigate("/ledgers/suppliers", { id: supplierId, name: saved?.name })
    : undefined;
  const newPurchase = onNavigate
    ? () => onNavigate("/products/purchases")
    : undefined;

  return (
    <div ref={pageRef} style={fixedPage(pageHeight)}>
      <div style={formStage}>
        <div style={formBox}>
          {isEdit && saved && (
            <SupplierHeader
              supplier={saved}
              balance={ledger.data?.balance}
              onPay={openAccount}
              onNewPurchase={newPurchase}
            />
          )}

          <SupplierNameRow
            name={name}
            onName={(v) => {
              setName(v);
              if (v.trim()) setNameError("");
            }}
            nameError={nameError}
            autoFocus={!isEdit}
          />

          <div style={formColumns}>
            <div>
              <SupplierContactRows
                contactPerson={contactPerson}
                onContactPerson={setContactPerson}
                phone={phone}
                onPhone={setPhone}
                mobile={mobile}
                onMobile={setMobile}
                email={email}
                onEmail={setEmail}
              />
            </div>
            <div>
              <SupplierAddressRow address={address} onAddress={setAddress} />
              <SupplierJoinedRow
                joiningDate={joiningDate}
                onJoiningDate={setJoiningDate}
              />
              <StartingBalanceField
                party="supplier"
                isEdit={isEdit}
                value={openingBalance}
                onChange={setOpeningBalance}
                id="supplier-opening-balance"
              />
              {isEdit && (
                <SupplierActiveRow
                  isActive={isActive}
                  onIsActive={setIsActive}
                />
              )}
            </div>
          </div>

          <div style={formDivider} />
          <SupplierNotesRow notes={notes} onNotes={setNotes} />
        </div>
      </div>

      <StickyActions
        onCancel={onCancel}
        onSave={handleSave}
        saving={saving}
        saveLabel={isEdit ? "Save changes" : "Save supplier"}
      />
    </div>
  );
}
