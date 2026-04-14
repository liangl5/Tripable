import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import ThreadedComments from "../ThreadedComments.jsx";

const DEFAULT_FORM = {
  name: "",
  totalAmount: "",
  paidBy: "",
  splits: {}
};

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

function canEditTransaction(transaction, userId, userRole) {
  if (!transaction || !userId) return false;
  if (userRole === "owner" || userRole === "editor") return true;
  return transaction.createdById === userId;
}

function canDeleteTransaction(transaction, userId, userRole) {
  if (!transaction || !userId) return false;
  if (userRole === "owner" || userRole === "editor") return true;
  return transaction.createdById === userId;
}

export default function TransactionTab({ tab, tripId, userId, userRole, tripMembers }) {
  const [transactions, setTransactions] = useState([]);
  const [splitsByTransaction, setSplitsByTransaction] = useState({});
  const [personTotals, setPersonTotals] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState("");
  const [expandedTransactions, setExpandedTransactions] = useState({});
  const [actionMenuOpenId, setActionMenuOpenId] = useState("");
  const [showPersonTotals, setShowPersonTotals] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [editFormData, setEditFormData] = useState(DEFAULT_FORM);
  const [formWarning, setFormWarning] = useState("");
  const [editWarning, setEditWarning] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [userTotal, setUserTotal] = useState(0);
  const [tripTotal, setTripTotal] = useState(0);

  const memberNamesById = useMemo(
    () =>
      (tripMembers || []).reduce((acc, member) => {
        acc[member.id] = member.name || member.email || "Traveler";
        return acc;
      }, {}),
    [tripMembers]
  );

  const validateTransaction = (candidate) => {
    if (!String(candidate.name || "").trim()) {
      return "Please enter a transaction name";
    }

    const total = Number.parseFloat(candidate.totalAmount);
    if (!Number.isFinite(total) || total <= 0) {
      return "Enter a valid cost";
    }

    const splitEntries = Object.entries(candidate.splits || {});
    if (splitEntries.length === 0) {
      return "Split values must sum to total amount";
    }

    let splitSum = 0;
    for (const [, amountValue] of splitEntries) {
      const numericAmount = Number.parseFloat(amountValue);
      if (!Number.isFinite(numericAmount) || numericAmount < 0) {
        return "Split values must sum to total amount";
      }
      splitSum += numericAmount;
    }

    const roundedTotal = Math.round(total * 100);
    const roundedSplitSum = Math.round(splitSum * 100);
    if (Math.abs(roundedSplitSum - roundedTotal) > 1) {
      return "Split values must sum to total amount";
    }

    return "";
  };

  const getTransactionWithSplits = useCallback(async (transactionRows) => {
    const transactionIds = (transactionRows || []).map((row) => row.id);
    if (!transactionIds.length) {
      return {
        splitMap: {},
        nextUserTotal: 0,
        nextTripTotal: 0,
        nextPersonTotals: {}
      };
    }

    const { data: splitRows, error: splitError } = await supabase
      .from("TransactionSplit")
      .select("id, transactionId, userId, amount")
      .in("transactionId", transactionIds);

    if (splitError) throw splitError;

    const splitMap = {};
    let nextUserTotal = 0;
    const nextPersonTotals = {};

    (splitRows || []).forEach((split) => {
      if (!splitMap[split.transactionId]) splitMap[split.transactionId] = [];
      splitMap[split.transactionId].push(split);

      const splitAmount = toCurrency(split.amount);
      if (split.userId === userId) {
        nextUserTotal += splitAmount;
      }
      nextPersonTotals[split.userId] = (nextPersonTotals[split.userId] || 0) + splitAmount;
    });

    const nextTripTotal = (transactionRows || []).reduce(
      (sum, row) => sum + toCurrency(row.totalAmount),
      0
    );

    return {
      splitMap,
      nextUserTotal,
      nextTripTotal,
      nextPersonTotals
    };
  }, [userId]);

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("Transaction")
        .select("*")
        .eq("tabId", tab.id)
        .order("createdAt", { ascending: false });

      if (error) throw error;

      const rows = data || [];
      const {
        splitMap,
        nextUserTotal,
        nextTripTotal,
        nextPersonTotals
      } = await getTransactionWithSplits(rows);

      setTransactions(rows);
      setSplitsByTransaction(splitMap);
      setUserTotal(nextUserTotal);
      setTripTotal(nextTripTotal);
      setPersonTotals(nextPersonTotals);
    } catch (error) {
      console.error("Failed to load transactions:", error);
    } finally {
      setLoading(false);
    }
  }, [getTransactionWithSplits, tab.id]);

  // Load transactions
  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const handleAddTransaction = async () => {
    const warning = validateTransaction(formData);
    setFormWarning(warning);
    if (warning) return;

    try {
      setLoading(true);
      const total = toCurrency(formData.totalAmount);

      // Create transaction
      const { data: transaction, error: txnError } = await supabase
        .from("Transaction")
        .insert([
          {
            id: crypto.randomUUID(),
            tripId,
            tabId: tab.id,
            name: formData.name,
            totalAmount: total,
            paidByUserId: formData.paidBy || null,
            createdById: userId,
            createdAt: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (txnError) throw txnError;

      // Create splits
      const splits = Object.entries(formData.splits).map(([memberId, amount]) => ({
        id: crypto.randomUUID(),
        transactionId: transaction.id,
        userId: memberId,
        amount: toCurrency(amount),
        createdAt: new Date().toISOString()
      }));

      if (splits.length > 0) {
        const { error: splitsError } = await supabase.from("TransactionSplit").insert(splits);
        if (splitsError) throw splitsError;
      }

      await loadTransactions();
      setFormData(DEFAULT_FORM);
      setFormWarning("");
      setShowAddForm(false);
    } catch (error) {
      console.error("Failed to add transaction:", error);
    } finally {
      setLoading(false);
    }
  };

  const startEditTransaction = (transaction) => {
    const currentSplits = splitsByTransaction[transaction.id] || [];
    const splitDraft = currentSplits.reduce((acc, split) => {
      acc[split.userId] = toCurrency(split.amount).toFixed(2);
      return acc;
    }, {});

    setEditingTransactionId(transaction.id);
    setEditFormData({
      name: transaction.name || "",
      totalAmount: toCurrency(transaction.totalAmount).toFixed(2),
      paidBy: transaction.paidByUserId || "",
      splits: splitDraft
    });
    setEditWarning("");
    setActionMenuOpenId("");
  };

  const cancelEditTransaction = () => {
    setEditingTransactionId("");
    setEditFormData(DEFAULT_FORM);
    setEditWarning("");
  };

  const handleSaveTransactionEdit = async (transaction) => {
    const warning = validateTransaction(editFormData);
    setEditWarning(warning);
    if (warning) return;

    try {
      setLoading(true);

      const { error: updateTxnError } = await supabase
        .from("Transaction")
        .update({
          name: editFormData.name,
          totalAmount: toCurrency(editFormData.totalAmount),
          paidByUserId: editFormData.paidBy || null
        })
        .eq("id", transaction.id);

      if (updateTxnError) throw updateTxnError;

      const { error: deleteSplitsError } = await supabase
        .from("TransactionSplit")
        .delete()
        .eq("transactionId", transaction.id);

      if (deleteSplitsError) throw deleteSplitsError;

      const nextSplits = Object.entries(editFormData.splits).map(([memberId, amount]) => ({
        id: crypto.randomUUID(),
        transactionId: transaction.id,
        userId: memberId,
        amount: toCurrency(amount),
        createdAt: new Date().toISOString()
      }));

      if (nextSplits.length) {
        const { error: insertSplitsError } = await supabase
          .from("TransactionSplit")
          .insert(nextSplits);
        if (insertSplitsError) throw insertSplitsError;
      }

      await loadTransactions();
      cancelEditTransaction();
    } catch (error) {
      console.error("Failed to update transaction:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (transactionId) => {
    try {
      setLoading(true);
      await supabase.from("TransactionSplit").delete().eq("transactionId", transactionId);
      await supabase.from("Transaction").delete().eq("id", transactionId);
      await loadTransactions();
      setDeleteConfirm(null);
      setActionMenuOpenId("");
    } catch (error) {
      console.error("Failed to delete transaction:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSplitEvenly = (target, setter) => {
    const selectedIds = Object.keys(target.splits || {});
    const evenSplits = splitEvenly(target.totalAmount, selectedIds);
    setter({ ...target, splits: evenSplits });
  };

  const toggleExpandTransaction = (transactionId) => {
    setExpandedTransactions((current) => ({
      ...current,
      [transactionId]: !current[transactionId]
    }));
  };

  const personTotalRows = Object.entries(personTotals)
    .map(([memberId, amount]) => ({
      memberId,
      amount
    }))
    .sort((a, b) => b.amount - a.amount);

  if (loading) {
    return <div className="p-6" />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Totals */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-ocean rounded-lg p-6 text-white">
          <p className="text-sm text-white/80">Your Total Cost</p>
          <p className="text-3xl font-bold">${userTotal.toFixed(2)}</p>
        </div>
        <div className="bg-ink rounded-lg p-6 text-white">
          <p className="text-sm text-white/70">Total Trip Expenses</p>
          <p className="text-3xl font-bold">${tripTotal.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <button
          onClick={() => setShowPersonTotals((current) => !current)}
          className="w-full flex items-center justify-between text-left"
        >
          <p className="text-sm font-semibold text-ink">Split totals by traveler</p>
          <span className="text-xs font-semibold text-ocean">
            {showPersonTotals ? "Hide" : "Show"}
          </span>
        </button>
        {showPersonTotals && (
          <div className="mt-3 max-h-52 overflow-y-auto space-y-2 pr-1">
            {personTotalRows.length > 0 ? (
              personTotalRows.map((entry) => (
                <div
                  key={entry.memberId}
                  className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
                >
                  <span className="text-sm text-ink">{memberNamesById[entry.memberId] || "Traveler"}</span>
                  <span className="text-sm font-semibold text-ink">${entry.amount.toFixed(2)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">No splits recorded yet.</p>
            )}
          </div>
        )}
      </div>

      {/* Add Transaction Form */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ink">
            {showAddForm ? "Add Transaction" : "Recent Transactions"}
          </h3>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="rounded-lg bg-ocean px-3 py-1 text-sm font-semibold text-white hover:bg-blue-600"
            >
              + Add
            </button>
          )}
        </div>

        {showAddForm && (
          <div className="space-y-4 mb-4">
            <input
              type="text"
              placeholder="Transaction name (e.g., Dinner at...)"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            <input
              type="number"
              placeholder="Total amount"
              value={formData.totalAmount}
              onChange={(e) => {
                setFormWarning("");
                setFormData({ ...formData, totalAmount: e.target.value });
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            <select
              value={formData.paidBy}
              onChange={(e) => setFormData({ ...formData, paidBy: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">Who paid? (optional)</option>
              {tripMembers?.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-ink">Split Among:</label>
                {Object.keys(formData.splits).length > 0 && (
                  <button
                    onClick={() => handleSplitEvenly(formData, setFormData)}
                    className="text-xs text-ocean font-semibold hover:underline"
                  >
                    Split Evenly
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {tripMembers?.map((member) => (
                  <label key={member.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!formData.splits[member.id]}
                      onChange={(e) => {
                        setFormWarning("");
                        const newSplits = { ...formData.splits };
                        if (e.target.checked) {
                          newSplits[member.id] = "0";
                        } else {
                          delete newSplits[member.id];
                        }
                        setFormData({ ...formData, splits: newSplits });
                      }}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-ink flex-1">{member.name}</span>
                    {formData.splits[member.id] && (
                      <input
                        type="number"
                        value={formData.splits[member.id]}
                        onChange={(e) => {
                          setFormWarning("");
                          const newSplits = { ...formData.splits };
                          newSplits[member.id] = e.target.value;
                          setFormData({ ...formData, splits: newSplits });
                        }}
                        placeholder="0.00"
                        className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>

            {formWarning && (
              <p className="text-sm font-semibold text-coral">{formWarning}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleAddTransaction}
                disabled={loading}
                className="flex-1 rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                Save Transaction
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setFormData(DEFAULT_FORM);
                  setFormWarning("");
                }}
                className="flex-1 rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transactions List */}
      {transactions.length > 0 && (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-ink">{transaction.name}</h4>
                  <p className="text-xs text-slate-600">
                    Created by: {memberNamesById[transaction.createdById] || "Traveler"}
                    {transaction.paidByUserId && ` • Paid by: ${memberNamesById[transaction.paidByUserId] || "Traveler"}`}
                  </p>
                </div>
                <div className="text-right relative">
                  <p className="text-lg font-semibold text-ink">${parseFloat(transaction.totalAmount).toFixed(2)}</p>

                  {(canEditTransaction(transaction, userId, userRole) || canDeleteTransaction(transaction, userId, userRole)) && (
                    <>
                      <button
                        onClick={() =>
                          setActionMenuOpenId((current) =>
                            current === transaction.id ? "" : transaction.id
                          )
                        }
                        className="text-sm text-slate-600 hover:text-ink"
                      >
                        ...
                      </button>
                      {actionMenuOpenId === transaction.id && (
                        <div className="absolute right-0 mt-1 w-36 rounded-md border border-slate-200 bg-white shadow-lg z-10">
                          {canEditTransaction(transaction, userId, userRole) && (
                            <button
                              onClick={() => startEditTransaction(transaction)}
                              className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-slate-50"
                            >
                              Edit
                            </button>
                          )}
                          {canDeleteTransaction(transaction, userId, userRole) && (
                            <button
                              onClick={() => {
                                setDeleteConfirm(transaction);
                                setActionMenuOpenId("");
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-coral hover:bg-slate-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {editingTransactionId === transaction.id && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-3 space-y-3">
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => {
                      setEditWarning("");
                      setEditFormData({ ...editFormData, name: e.target.value });
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Transaction name"
                  />
                  <input
                    type="number"
                    value={editFormData.totalAmount}
                    onChange={(e) => {
                      setEditWarning("");
                      setEditFormData({ ...editFormData, totalAmount: e.target.value });
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Total amount"
                  />
                  <select
                    value={editFormData.paidBy}
                    onChange={(e) => {
                      setEditWarning("");
                      setEditFormData({ ...editFormData, paidBy: e.target.value });
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Who paid? (optional)</option>
                    {tripMembers?.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-ink">Split Among:</label>
                      {Object.keys(editFormData.splits).length > 0 && (
                        <button
                          onClick={() => handleSplitEvenly(editFormData, setEditFormData)}
                          className="text-xs text-ocean font-semibold hover:underline"
                        >
                          Split Evenly
                        </button>
                      )}
                    </div>
                    {tripMembers?.map((member) => (
                      <label key={member.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!editFormData.splits[member.id]}
                          onChange={(e) => {
                            setEditWarning("");
                            const nextSplits = { ...editFormData.splits };
                            if (e.target.checked) {
                              nextSplits[member.id] = "0";
                            } else {
                              delete nextSplits[member.id];
                            }
                            setEditFormData({ ...editFormData, splits: nextSplits });
                          }}
                          className="h-4 w-4"
                        />
                        <span className="text-sm text-ink flex-1">{member.name}</span>
                        {editFormData.splits[member.id] && (
                          <input
                            type="number"
                            value={editFormData.splits[member.id]}
                            onChange={(e) => {
                              setEditWarning("");
                              const nextSplits = { ...editFormData.splits };
                              nextSplits[member.id] = e.target.value;
                              setEditFormData({ ...editFormData, splits: nextSplits });
                            }}
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          />
                        )}
                      </label>
                    ))}
                  </div>

                  {editWarning && (
                    <p className="text-sm font-semibold text-coral">{editWarning}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveTransactionEdit(transaction)}
                      className="rounded-lg bg-ocean px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEditTransaction}
                      className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => toggleExpandTransaction(transaction.id)}
                className="text-xs text-ocean font-semibold hover:underline mb-2"
              >
                {expandedTransactions[transaction.id] ? "Hide split details" : "Show split details"}
              </button>

              {expandedTransactions[transaction.id] && (
                <div className="mb-3 max-h-48 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2">
                  {(splitsByTransaction[transaction.id] || []).length > 0 ? (
                    (splitsByTransaction[transaction.id] || []).map((split) => (
                      <div key={split.id} className="flex items-center justify-between">
                        <span className="text-sm text-ink">{memberNamesById[split.userId] || "Traveler"}</span>
                        <span className="text-sm font-semibold text-ink">${toCurrency(split.amount).toFixed(2)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-600">No split details yet.</p>
                  )}
                </div>
              )}

              <ThreadedComments
                tableName="TransactionComment"
                resourceColumn="transactionId"
                resourceId={transaction.id}
                userId={userId}
                userNamesById={memberNamesById}
                title="Comments"
              />
            </div>
          ))}
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-ink">Delete this expense?</h3>
            <p className="mt-2 text-sm text-slate-600">
              {deleteConfirm.name} will be removed permanently, including all split details.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteTransaction(deleteConfirm.id)}
                className="rounded-lg bg-coral px-3 py-2 text-sm font-semibold text-white hover:brightness-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {transactions.length === 0 && !showAddForm && (
        <p className="text-center text-slate-600 py-8">No transactions yet</p>
      )}
    </div>
  );
}
