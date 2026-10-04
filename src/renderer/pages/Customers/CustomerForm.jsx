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
  ActiveRow,
  AddressRow,
  ContactRows,
  CreditRows,
  NameRow,
  NotesRow,
  PricingRows,
  TypeRow,
} from "./parts/CustomerFormParts";

function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CustomerForm({
  customerId,
  onDone,
  onCancel,
}) {
  const { user } = useAuth();
  const toast = useToast();
  const isEdit = !!customerId;

  const [letterheads, setLetterheads] = useState([]);
  const [name, setName] = useState("");
  const [customerType, setCustomerType] = useState("retail");
  const [tier, setTier] = useState("");
  const [assignedLetterheadId, setAssignedLetterheadId] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [creditLimit, setCreditLimit] = useState(0);
  const [joiningDate, setJoiningDate] = useState(isEdit ? "" : todayLocal());
  const [notes, setNotes] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);
  const [loadFailed, setLoadFailed] = useState(false);
  // The record as last loaded — drives the header, so it doesn't change while typing.
  const [saved, setSaved] = useState(null);
  const [nextId, setNextId] = useState(null);
  const [stayOnPage, setStayOnPage] = useState(false);
  const savingRef = useRef(false);
  const [pageRef, pageHeight] = useFitHeight();

  const loadNextId = useCallback(() => {
    if (isEdit) return;
    window.api.customers
      .getNextId()
      .then((res) => setNextId(res?.success ? res.id : null))
      .catch(() => setNextId(null));
  }, [isEdit]);

  useEffect(() => {
    loadNextId();
  }, [loadNextId]);

  function resetForm() {
    setName("");
    setCustomerType("retail");
    setTier("");
    setAssignedLetterheadId("");
    setPhone("");
    setMobile("");
    setEmail("");
    setAddress("");
    setCreditLimit(0);
    setJoiningDate(todayLocal());
    setNotes("");
    setOpeningBalance(0);
    setNameError("");
    loadNextId();
    focusName();
  }

  useEffect(() => {
    window.api.letterheads
      .list()
      .then((rows) => setLetterheads(rows || []))
      .catch(() => setLetterheads([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    window.api.customers
      .getById({ id: customerId })
      .then((c) => {
        if (cancelled) return;
        if (!c) {
          setLoadFailed(true);
          return;
        }
        setName(c.name);
        setCustomerType(c.customer_type);
        setTier(c.tier || "");
        setAssignedLetterheadId(c.assigned_letterhead_id || "");
        setPhone(c.phone || "");
        setMobile(c.mobile || "");
        setEmail(c.email || "");
        setAddress(c.address || "");
        setCreditLimit(c.credit_limit || 0);
        setJoiningDate(c.joining_date || "");
        setNotes(c.notes || "");
        setOpeningBalance(c.opening_balance);
        setIsActive(!!c.is_active);
        setSaved({
          name: c.name,
          customerType: c.customer_type,
          tier: c.tier,
          phone: c.phone,
          mobile: c.mobile,
          address: c.address,
          isActive: !!c.is_active,
        });
        setLoaded(true);
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  function focusName() {
    requestAnimationFrame(() => {
      const el = document.getElementById("customer-name");
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    });
  }

  async function handleSave() {
    if (savingRef.current) return;
    if (!name.trim()) {
      setNameError("Customer name is required.");
      toast.error("Please check the highlighted fields");
      focusName();
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        customerType,
        tier: tier || null,
        assignedLetterheadId: assignedLetterheadId
          ? Number(assignedLetterheadId)
          : null,
        phone: phone.trim() || null,
        mobile: mobile.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        creditLimit: Math.max(0, Number(creditLimit) || 0),
        joiningDate: joiningDate || null,
        notes: notes.trim() || null,
      };

      const res = isEdit
        ? await window.api.customers.update({ id: customerId, ...payload })
        : await window.api.customers.create({
            ...payload,
            openingBalance: Number(openingBalance) || 0,
          });

      if (!res.success) {
        if (/name/i.test(res.reason || "")) {
          setNameError(res.reason);
          focusName();
        }
        toast.error(res.reason || "Could not save customer.");
        return;
      }
      if (isEdit && saved && isActive !== saved.isActive) {
        await window.api.customers.setActive({
          id: customerId,
          isActive: isActive ? 1 : 0,
        });
      }
      toast.success("Customer saved");
      if (!isEdit && stayOnPage) resetForm();
      else onDone();
    } catch {
      toast.error("Could not save customer. Please try again.");
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
          title="We couldn't open this customer"
          message="They may have been removed on another computer."
          action={<Button onClick={onCancel}>Back to customers</Button>}
        />
      </Card>
    );
  }

  if (!loaded) {
    return <FormSkeleton />;
  }

  return (
    <div ref={pageRef} style={fixedPage(pageHeight)}>
      <div style={formStage}>
        <div style={formBox}>
          <IdRow id={isEdit ? customerId : nextId} />
          <NameRow
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
              <TypeRow
                customerType={customerType}
                onCustomerType={setCustomerType}
              />
              <ContactRows
                phone={phone}
                onPhone={setPhone}
                mobile={mobile}
                onMobile={setMobile}
                email={email}
                onEmail={setEmail}
              />
              <AddressRow address={address} onAddress={setAddress} />
            </div>
            <div>
              <PricingRows
                tier={tier}
                onTier={setTier}
                customerType={customerType}
                letterheads={letterheads}
                letterheadId={assignedLetterheadId}
                onLetterheadId={setAssignedLetterheadId}
              />
              <CreditRows
                creditLimit={creditLimit}
                onCreditLimit={setCreditLimit}
                joiningDate={joiningDate}
                onJoiningDate={setJoiningDate}
              />
              <StartingBalanceField
                party="customer"
                isEdit={isEdit}
                value={openingBalance}
                onChange={setOpeningBalance}
                id="customer-opening-balance"
              />
              {isEdit && (
                <ActiveRow isActive={isActive} onIsActive={setIsActive} />
              )}
            </div>
          </div>

          <div style={formDivider} />
          <NotesRow notes={notes} onNotes={setNotes} />
        </div>
      </div>

      <StickyActions
        onCancel={onCancel}
        onSave={handleSave}
        saving={saving}
        saveLabel={isEdit ? "Save changes" : "Save customer"}
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
