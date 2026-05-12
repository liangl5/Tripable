import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function getSetFromValue(values) {
  return new Set(Array.isArray(values) ? values : []);
}

function toCurrency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100) / 100;
}

export default function ExpenseSettlementModal({
  open,
  currentUserId,
  memberNamesById = {},
  balanceRows = [],
  initialSelectedSplitIds = [],
  onClose,
  onSave
}) {
  const [draftSelectedSplitIds, setDraftSelectedSplitIds] = useState(() => getSetFromValue(initialSelectedSplitIds));
  const [expandedPersonIds, setExpandedPersonIds] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  const previewState = useMemo(() => {
    const rows = balanceRows
      .map((row) => {
        let delta = 0;

        const mappedExpenseItems = (row.expenseItems || []).map((item) => {
          const currentlySettled = Boolean(item.settlement && item.settlement.status !== "rejected" && item.settlement.status !== "void");
          const willBeSettled = draftSelectedSplitIds.has(item.splitId);
          const effect = item.debtorId === currentUserId ? -item.amount : item.amount;

          if (willBeSettled !== currentlySettled) {
            delta += willBeSettled ? effect : -effect;
          }

          return {
            ...item,
            willBeSettled,
            currentlySettled,
            statusLabel: willBeSettled
              ? currentlySettled
                ? "Paid"
                : "Marked paid"
              : currentlySettled
                ? "Will reopen"
                : "Outstanding"
          };
        });

        return {
          ...row,
          previewNetAmount: toCurrency(row.netAmount + delta),
          expenseItems: mappedExpenseItems
        };
      })
      .sort((a, b) => Math.abs(b.previewNetAmount) - Math.abs(a.previewNetAmount));

    const youOwe = rows.reduce((sum, row) => (row.previewNetAmount > 0 ? sum + row.previewNetAmount : sum), 0);
    const youAreOwed = rows.reduce((sum, row) => (row.previewNetAmount < 0 ? sum + Math.abs(row.previewNetAmount) : sum), 0);

    return {
      rows,
      youOwe: toCurrency(youOwe),
      youAreOwed: toCurrency(youAreOwed),
      net: toCurrency(youAreOwed - youOwe)
    };
  }, [balanceRows, currentUserId, draftSelectedSplitIds]);

  useEffect(() => {
    if (!open) return;
    setDraftSelectedSplitIds(getSetFromValue(initialSelectedSplitIds));
    setExpandedPersonIds(new Set(balanceRows[0]?.personId ? [balanceRows[0].personId] : []));
    setSaving(false);
  }, [balanceRows, initialSelectedSplitIds, open]);

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

  const toggleExpanded = (personId) => {
    setExpandedPersonIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  };

  const toggleSplit = (splitId, checked) => {
    setDraftSelectedSplitIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(splitId);
      } else {
        next.delete(splitId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(Array.from(draftSelectedSplitIds));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 px-3 py-4 sm:px-4 sm:py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex h-[92vh] w-full max-w-6xl flex-col rounded-[30px] bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Settle up</p>
            <h3 className="mt-1 text-2xl font-semibold text-ink">Mark expense splits as paid</h3>
            <p className="mt-2 text-sm text-slate-500">
              Check the splits that have been paid. The balance preview updates immediately, and saving creates the settlement records.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.45fr)_360px]">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-slate-50/60">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
              <p className="text-sm font-semibold text-ink">Expense splits</p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              {previewState.rows.length ? previewState.rows.map((row) => {
                const expanded = expandedPersonIds.has(row.personId);
                const currentAmount = formatMoney(Math.abs(row.netAmount));
                const previewAmount = formatMoney(Math.abs(row.previewNetAmount));
                const directionText = row.previewNetAmount > 0 ? `You owe ${row.personName}` : `${row.personName} owes you`;
                const changed = Math.abs(row.previewNetAmount - row.netAmount) > 0.01;

                return (
                  <div key={row.personId} className="rounded-[22px] border border-slate-200 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(row.personId)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{row.personName}</p>
                        <p className="mt-1 text-xs text-slate-500">{directionText}</p>
                        {changed ? (
                          <p className="mt-1 text-xs font-semibold text-ocean">
                            {formatMoney(Math.abs(row.netAmount))} to {previewAmount}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-ink">{previewAmount}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {changed ? `Now ${directionText}` : currentAmount}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-ocean">{expanded ? "Hide" : "Details"}</p>
                      </div>
                    </button>

                    {expanded ? (
                      <div className="border-t border-slate-200 px-4 py-4 sm:px-5">
                        <div className="space-y-2">
                          {row.expenseItems.length ? row.expenseItems.map((item) => {
                            return (
                              <label
                                key={item.splitId}
                                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                              >
                                <input
                                  type="checkbox"
                                  checked={item.willBeSettled}
                                  onChange={(event) => toggleSplit(item.splitId, event.target.checked)}
                                  className="mt-1 h-4 w-4"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-ink">{item.transactionName}</p>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {item.debtorName} owes {item.creditorName}
                                      </p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                      <p className="text-sm font-semibold text-ink">{formatMoney(item.amount)}</p>
                                      <p className="mt-1 text-xs font-semibold text-ocean">{item.statusLabel}</p>
                                    </div>
                                  </div>
                                </div>
                              </label>
                            );
                          }) : (
                            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                              No expense splits for this person yet.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              }) : (
                <div className="rounded-[22px] border border-dashed border-slate-300 bg-white px-5 py-8 text-sm text-slate-500">
                  No balances found yet.
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-0">
            <p className="text-sm font-semibold text-ink">Live preview</p>
            <p className="mt-1 text-xs text-slate-500">
              This reflects the expense splits you have checked, before you save.
            </p>

            <div className="mt-4 rounded-[20px] bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Balance after save</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{formatMoney(previewState.net)}</p>
              <p className="mt-2 text-sm text-slate-500">
                Owes {formatMoney(previewState.youOwe)} · Owed {formatMoney(previewState.youAreOwed)}
              </p>
            </div>

            <div className="mt-5 flex gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl bg-slate-200 px-5 py-3 text-sm font-semibold text-ink hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-2xl bg-ocean px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}