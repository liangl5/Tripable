import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";

function toCurrency(value) {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100) / 100;
}

function splitEvenly(totalAmount, selectedMemberIds) {
  const totalCents = Math.round(toCurrency(totalAmount) * 100);
  if (!selectedMemberIds.length || totalCents <= 0) return {};

  const base = Math.floor(totalCents / selectedMemberIds.length);
  let remainder = totalCents - base * selectedMemberIds.length;
  const result = {};

  selectedMemberIds.forEach((memberId) => {
    const extraCent = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    result[memberId] = ((base + extraCent) / 100).toFixed(2);
  });

  return result;
}

const EMPTY_FORM = {
  name: "",
  totalAmount: "",
  paidBy: "",
  splits: {}
};

export default function TransactionComposerModal({
  open,
  mode = "add",
  tripMembers = [],
  initialTransaction = null,
  submitLabel,
  onClose,
  onSave
}) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [warning, setWarning] = useState("");
  const [saving, setSaving] = useState(false);

  const memberIds = useMemo(() => (tripMembers || []).map((member) => member.id).filter(Boolean), [tripMembers]);
  const selectedMemberIds = Object.keys(formData.splits || {});
  const allSelected = memberIds.length > 0 && memberIds.every((memberId) => Object.prototype.hasOwnProperty.call(formData.splits, memberId));
  const canSplitEvenly = Number.parseFloat(formData.totalAmount) > 0 && selectedMemberIds.length > 0;

  useEffect(() => {
    if (!open) return;

    if (initialTransaction) {
      const nextSplits = Array.isArray(initialTransaction.splits)
        ? initialTransaction.splits.reduce((accumulator, split) => {
            accumulator[split.userId] = toCurrency(split.amount).toFixed(2);
            return accumulator;
          }, {})
        : initialTransaction.splits || {};

      setFormData({
        name: initialTransaction.name || "",
        totalAmount: initialTransaction.totalAmount ? toCurrency(initialTransaction.totalAmount).toFixed(2) : "",
        paidBy: initialTransaction.paidByUserId || "",
        splits: nextSplits
      });
    } else {
      setFormData(EMPTY_FORM);
    }

    setWarning("");
    setSaving(false);
  }, [initialTransaction, open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const handleSelectAll = () => {
    setWarning("");
    setFormData((current) => {
      if (allSelected) {
        return { ...current, splits: {} };
      }

      const nextSplits = {};
      memberIds.forEach((memberId) => {
        nextSplits[memberId] = current.splits[memberId] || "0";
      });
      return { ...current, splits: nextSplits };
    });
  };

  const handleSplitEvenly = () => {
    if (!canSplitEvenly) return;
    setWarning("");
    setFormData((current) => ({
      ...current,
      splits: splitEvenly(current.totalAmount, Object.keys(current.splits || {}))
    }));
  };

  const handleSave = async () => {
    const trimmedName = String(formData.name || "").trim();
    const total = Number.parseFloat(formData.totalAmount);
    const splitEntries = Object.entries(formData.splits || {});

    if (!trimmedName) {
      setWarning("Please enter a transaction name.");
      return;
    }

    if (!Number.isFinite(total) || total <= 0) {
      setWarning("Enter a valid cost before splitting the bill.");
      return;
    }

    if (!splitEntries.length) {
      setWarning("Select at least one traveler to split this expense.");
      return;
    }

    let splitSum = 0;
    for (const [, amountValue] of splitEntries) {
      const numericAmount = Number.parseFloat(amountValue);
      if (!Number.isFinite(numericAmount) || numericAmount < 0) {
        setWarning("Split values must sum to the total amount.");
        return;
      }
      splitSum += numericAmount;
    }

    if (Math.abs(Math.round(splitSum * 100) - Math.round(total * 100)) > 1) {
      setWarning("Split values must sum to the total amount.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: trimmedName,
        totalAmount: total,
        paidBy: String(formData.paidBy || "").trim() || null,
        splits: splitEntries.map(([memberId, amount]) => ({
          userId: memberId,
          amount: toCurrency(amount)
        }))
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/45 px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {mode === "edit" ? "Edit expense" : "Add expense"}
            </p>
            <h3 className="mt-1 text-2xl font-semibold text-ink">
              {mode === "edit" ? "Update transaction" : "Add a new transaction"}
            </h3>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <input
            value={formData.name}
            onChange={(event) => {
              setWarning("");
              setFormData((current) => ({ ...current, name: event.target.value }));
            }}
            placeholder="Transaction name"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          />

          <div className="grid gap-4 md:grid-cols-[1fr,1fr]">
            <input
              value={formData.totalAmount}
              onChange={(event) => {
                setWarning("");
                setFormData((current) => ({ ...current, totalAmount: event.target.value }));
              }}
              inputMode="decimal"
              placeholder="Total amount"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />

            <select
              value={formData.paidBy}
              onChange={(event) => {
                setWarning("");
                setFormData((current) => ({ ...current, paidBy: event.target.value }));
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              <option value="">Who paid? (optional)</option>
              {tripMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">Split among</p>
                <p className="text-xs text-slate-500">Select the travelers included in this expense.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-ocean hover:text-ocean"
                >
                  {allSelected ? "Clear all" : "Select all"}
                </button>
                <button
                  type="button"
                  onClick={handleSplitEvenly}
                  disabled={!canSplitEvenly}
                  className="rounded-full bg-ocean px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Split evenly
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {tripMembers.map((member) => {
                const checked = Object.prototype.hasOwnProperty.call(formData.splits, member.id);
                return (
                  <label key={member.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        setWarning("");
                        const nextSplits = { ...formData.splits };
                        if (event.target.checked) {
                          nextSplits[member.id] = nextSplits[member.id] || "0";
                        } else {
                          delete nextSplits[member.id];
                        }
                        setFormData((current) => ({ ...current, splits: nextSplits }));
                      }}
                      className="h-4 w-4"
                    />
                    <span className="flex-1 text-sm font-medium text-ink">{member.name}</span>
                    {checked ? (
                      <input
                        type="number"
                        value={formData.splits[member.id]}
                        onChange={(event) => {
                          setWarning("");
                          setFormData((current) => ({
                            ...current,
                            splits: {
                              ...current.splits,
                              [member.id]: event.target.value
                            }
                          }));
                        }}
                        inputMode="decimal"
                        placeholder="0.00"
                        className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>

          {warning ? <p className="text-sm font-semibold text-coral">{warning}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-slate-200 px-5 py-3 text-sm font-semibold text-ink hover:bg-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-2xl bg-ocean px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitLabel || (mode === "edit" ? "Save changes" : "Save transaction")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}