import React, { useCallback, useEffect, useRef, useState } from "react";
import { UserX } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Button, Card, EmptyState, useToast } from "../../components/ui";
import { StickyActions } from "../Products/form/StickyActions";
import { StartingBalanceField } from "../Parties/StartingBalanceField";
import {
  FormSkeleton,
  IdRow,
  RestrictedNotice,
  StayOnPageCheck,
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
  SupplierJoinedRow,
  SupplierLetterheadRow,
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
  const [letterheadId, setLetterheadId] = useState("");
  const [letterheads, setLetterheads] = useState([]);
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saved, setSaved] = useState(null);
  const [nextId, setNextId] = useState(null);
  const [stayOnPage, setStayOnPage] = useState(false);
  const savingRef = useRef(false);
  const [pageRef, pageHeight] = useFitHeight();

  const loadNextId = useCallback(() => {
    if (isEdit) return;
    window.api.suppliers
      .getNextId()
      .then((res) => setNextId(res?.success ? res.id : null))
      .catch(() => setNextId(null));
  }, [isEdit]);

  useEffect(() => {
    loadNextId();
  }, [loadNextId]);

  useEffect(() => {
    window.api.letterheads.list().then((rows) => setLetterheads(rows || [])).catch(() => {});
  }, []);

  function resetForm() {
    setName("");
    setContactPerson("");
    setPhone("");
    setMobile("");
    setEmail("");
    setJoiningDate(todayLocal());
    setAddress("");
    setNotes("");
    setOpeningBalance(0);
    setLetterheadId("");
    setNameError("");
    loadNextId();
    focusName();
  }

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
        setLetterheadId(s.assigned_letterhead_id ? String(s.assigned_letterhead_id) : "");
        setSaved({
          name: s.name,
          contactPerson: s.contact_person,
          phone: s.phone,
          mobile: s.mobile,
          address: s.address,
          isActive: !!s.is_active,
        });
        setLoaded(true);
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
        assignedLetterheadId: letterheadId ? Number(letterheadId) : null,
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
      if (!isEdit && stayOnPage) resetForm();
      else onDone();
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

  return (
    <div ref={pageRef} style={fixedPage(pageHeight)}>
      <div style={formStage}>
        <div style={formBox}>
          <IdRow id={isEdit ? supplierId : nextId} />
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
              <SupplierLetterheadRow
                letterheads={letterheads}
                letterheadId={letterheadId}
                onLetterheadId={setLetterheadId}
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
        extra={
          !isEdit && (
            <StayOnPageCheck
              checked={stayOnPage}
              onChange={setStayOnPage}
              disabled={saving}
            />
          )
        }
      />
    </div>
  );
}
