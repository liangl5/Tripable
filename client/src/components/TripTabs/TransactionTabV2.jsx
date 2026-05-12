import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import ThreadedComments from "../ThreadedComments.jsx";
import ConfirmModal from "../ConfirmModal.jsx";
import { buildUserAvatarColorsById, buildUserNamesById, fetchUserProfilesByIds } from "../../lib/userProfiles.js";
import TransactionComposerModal from "./TransactionComposerModal.jsx";
import ExpenseSettlementModal from "./ExpenseSettlementModal.jsx";

function toCurrency(value) {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100) / 100;
}

function isMissingTableError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("relation") || message.includes("does not exist") || message.includes("pgrst204") || message.includes("not found");
}

function canManageTransaction(transaction, userId, userRole) {
  if (!transaction || !userId) return false;
  if (userRole === "owner" || userRole === "editor") return true;
  if (!transaction.paidByUserId) return true;
  return transaction.paidByUserId === userId;
}

function getTransactionState(transaction, splits, settlementBySplitId) {
  if (!transaction.paidByUserId) return "unclaimed";
  const allSplitsPaid = splits.every((split) => {
    // Payer's own split doesn't need a settlement record
    if (split.userId === transaction.paidByUserId) return true;
    
    const settlement = settlementBySplitId[split.id];
    return settlement && settlement.status !== "rejected" && settlement.status !== "void";
  });
  return allSplitsPaid ? "completed" : "claimed";
}

function buildExpenseSettlementSummary({ transactions, splitsByTransaction, settlements, currentUserId, memberNamesById }) {
  const directedBalances = new Map();
  const rowsByPerson = new Map();
  const settlementBySplitId = {};
  const transactionById = new Map();
  const personTotals = {};
  let grossUserTotal = 0;
  let tripTotal = 0;
  let unclaimedTripTotal = 0;

  (transactions || []).forEach((transaction) => {
    transactionById.set(transaction.id, transaction);
  });

  const addDirected = (fromUserId, toUserId, delta) => {
    if (!fromUserId || !toUserId || fromUserId === toUserId || !Number.isFinite(delta) || delta === 0) return;
    const key = `${fromUserId}__${toUserId}`;
    directedBalances.set(key, (directedBalances.get(key) || 0) + delta);
  };

  const ensureRow = (personId) => {
    if (!rowsByPerson.has(personId)) {
      rowsByPerson.set(personId, {
        personId,
        personName: memberNamesById[personId] || "Traveler",
        expenseItems: [],
        settlementItems: []
      });
    }
    return rowsByPerson.get(personId);
  };

  (settlements || []).forEach((settlement) => {
    if (settlement?.sourceSplitId && settlement.status !== "rejected" && settlement.status !== "void") {
      settlementBySplitId[settlement.sourceSplitId] = settlement;
    }
  });

  (transactions || []).forEach((transaction) => {
    const creditorId = transaction.paidByUserId || null;
    const transactionSplits = splitsByTransaction[transaction.id] || [];
    tripTotal += toCurrency(transaction.totalAmount);

    if (!transaction.paidByUserId) {
      unclaimedTripTotal += toCurrency(transaction.totalAmount);
    }

    transactionSplits.forEach((split) => {
      const amount = toCurrency(split.amount);
      const debtorId = split.userId;

      // Count all splits assigned to current user as their total cost (claimed, unclaimed, completed)
      if (debtorId === currentUserId && amount > 0) {
        grossUserTotal += amount;
      }
    });

    if (!creditorId) return;

    transactionSplits.forEach((split) => {
      const amount = toCurrency(split.amount);
      const debtorId = split.userId;
      if (!debtorId || !creditorId || debtorId === creditorId || amount <= 0) return;

      addDirected(debtorId, creditorId, amount);
      personTotals[debtorId] = (personTotals[debtorId] || 0) + amount;

      if (debtorId === currentUserId || creditorId === currentUserId) {
        const otherId = debtorId === currentUserId ? creditorId : debtorId;
        const row = ensureRow(otherId);
        row.expenseItems.push({
          splitId: split.id,
          transactionId: transaction.id,
          transactionName: transaction.name,
          amount,
          debtorId,
          creditorId,
          debtorName: memberNamesById[debtorId] || "Traveler",
          creditorName: memberNamesById[creditorId] || "Traveler",
          createdAt: split.createdAt || transaction.createdAt,
          settlement: settlementBySplitId[split.id] || null,
          settlementStatus: settlementBySplitId[split.id]?.status || "outstanding"
        });
      }
    });
  });

  (settlements || []).forEach((settlement) => {
    const amount = toCurrency(settlement.amount);
    if (!settlement?.fromUserId || !settlement?.toUserId || settlement.fromUserId === settlement.toUserId || amount <= 0) return;
    if (settlement.status === "rejected" || settlement.status === "void") return;

    addDirected(settlement.fromUserId, settlement.toUserId, -amount);

    if (settlement.fromUserId === currentUserId || settlement.toUserId === currentUserId) {
      const otherId = settlement.fromUserId === currentUserId ? settlement.toUserId : settlement.fromUserId;
      const row = ensureRow(otherId);
      row.settlementItems.push({
        id: settlement.id,
        amount,
        fromUserId: settlement.fromUserId,
        toUserId: settlement.toUserId,
        fromName: memberNamesById[settlement.fromUserId] || "Traveler",
        toName: memberNamesById[settlement.toUserId] || "Traveler",
        note: settlement.note || "",
        status: settlement.status,
        createdAt: settlement.createdAt,
        createdByName: memberNamesById[settlement.createdById] || "Traveler"
      });
    }
  });

  const balanceRows = Array.from(rowsByPerson.values())
    .map((row) => {
      const currentToOther = directedBalances.get(`${currentUserId}__${row.personId}`) || 0;
      const otherToCurrent = directedBalances.get(`${row.personId}__${currentUserId}`) || 0;
      const netAmount = toCurrency(currentToOther - otherToCurrent);
      return {
        ...row,
        netAmount,
        expenseItems: row.expenseItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        settlementItems: row.settlementItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      };
    })
    .filter((row) => row.expenseItems.length || row.settlementItems.length || Math.abs(row.netAmount) > 0.01)
    .sort((a, b) => Math.abs(b.netAmount) - Math.abs(a.netAmount));

  const settlementSplitIds = new Set(Object.keys(settlementBySplitId));
  const youOwe = balanceRows.reduce((sum, row) => (row.netAmount > 0 ? sum + row.netAmount : sum), 0);
  const youAreOwed = balanceRows.reduce((sum, row) => (row.netAmount < 0 ? sum + Math.abs(row.netAmount) : sum), 0);

  return {
    balanceRows,
    settlementBySplitId,
    settlementSplitIds,
    grossUserTotal,
    tripTotal,
    unclaimedTripTotal,
    personTotals,
    youOwe,
    youAreOwed,
    netBalance: youAreOwed - youOwe,
    transactionById
  };
}

export default function TransactionTabV2({ tab, tripId, userId, userRole, tripMembers, isActive, onReadyChange }) {
  const [transactions, setTransactions] = useState([]);
  const [splitsByTransaction, setSplitsByTransaction] = useState({});
  const [settlements, setSettlements] = useState([]);
  const [settlementTableReady, setSettlementTableReady] = useState(true);
  const [expandedTransactions, setExpandedTransactions] = useState({});
  const [actionMenuOpenId, setActionMenuOpenId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingTransactionId, setSavingTransactionId] = useState("");
  const [savingSettlement, setSavingSettlement] = useState(false);
  const [composerState, setComposerState] = useState({ open: false, mode: "add", transaction: null });
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [historicalUserNamesById, setHistoricalUserNamesById] = useState({});

  useEffect(() => {
    if (!isActive) return;
    onReadyChange?.(!loading);
  }, [isActive, loading, onReadyChange]);

  const memberNamesById = useMemo(
    () => ({
      ...historicalUserNamesById,
      ...buildUserNamesById(tripMembers)
    }),
    [historicalUserNamesById, tripMembers]
  );
  const memberAvatarColorsById = useMemo(() => buildUserAvatarColorsById(tripMembers), [tripMembers]);
  const transactionIndex = useMemo(
    () => Object.fromEntries(transactions.map((transaction) => [transaction.id, transaction])),
    [transactions]
  );
  const splitIndex = useMemo(() => {
    const nextIndex = {};
    Object.values(splitsByTransaction).forEach((splits) => {
      (splits || []).forEach((split) => {
        nextIndex[split.id] = split;
      });
    });
    return nextIndex;
  }, [splitsByTransaction]);

  const currentTripSummary = useMemo(
    () => buildExpenseSettlementSummary({
      transactions,
      splitsByTransaction,
      settlements,
      currentUserId: userId,
      memberNamesById
    }),
    [memberNamesById, settlements, splitsByTransaction, transactions, userId]
  );

  const sortedTransactions = useMemo(
    () => [...transactions].sort((left, right) => {
      const leftSplits = splitsByTransaction[left.id] || [];
      const rightSplits = splitsByTransaction[right.id] || [];
      const leftState = getTransactionState(left, leftSplits, currentTripSummary.settlementBySplitId);
      const rightState = getTransactionState(right, rightSplits, currentTripSummary.settlementBySplitId);
      
      const stateOrder = { unclaimed: 0, claimed: 1, completed: 2 };
      if (stateOrder[leftState] !== stateOrder[rightState]) {
        return stateOrder[leftState] - stateOrder[rightState];
      }
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }),
    [transactions, splitsByTransaction, currentTripSummary.settlementBySplitId]
  );

  const loadTransactions = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent && !transactions.length) {
        setLoading(true);
      }
      const { data: transactionRows, error: transactionError } = await supabase
        .from("Transaction")
        .select("*")
        .eq("tabId", tab.id)
        .order("createdAt", { ascending: false });

      if (transactionError) throw transactionError;

      const rows = transactionRows || [];
      const transactionIds = rows.map((row) => row.id);

      const { data: splitRows, error: splitError } = transactionIds.length
        ? await supabase
            .from("TransactionSplit")
            .select("id, transactionId, userId, amount, createdAt")
            .in("transactionId", transactionIds)
        : { data: [], error: null };

      if (splitError) throw splitError;

      let settlementRows = [];
      let nextSettlementTableReady = true;
      try {
        const { data: fetchedSettlements, error: settlementError } = await supabase
          .from("TransactionSettlement")
          .select("id, tripId, sourceSplitId, fromUserId, toUserId, amount, note, status, createdById, markedPaidAt, confirmedByUserId, confirmedAt, createdAt, updatedAt")
          .eq("tripId", tripId)
          .order("createdAt", { ascending: false });

        if (settlementError) throw settlementError;
        settlementRows = fetchedSettlements || [];
      } catch (error) {
        if (isMissingTableError(error)) {
          nextSettlementTableReady = false;
          settlementRows = [];
        } else {
          throw error;
        }
      }

      const splitMap = {};
      (splitRows || []).forEach((split) => {
        if (!splitMap[split.transactionId]) splitMap[split.transactionId] = [];
        splitMap[split.transactionId].push(split);
      });

      const referencedUserIds = Array.from(
        new Set(
          [
            ...rows.flatMap((transaction) => [transaction.createdById, transaction.paidByUserId]),
            ...(splitRows || []).map((split) => split.userId),
            ...(settlementRows || []).flatMap((settlement) => [
              settlement.fromUserId,
              settlement.toUserId,
              settlement.createdById,
              settlement.confirmedByUserId
            ])
          ].filter(Boolean)
        )
      );

      const missingUserIds = referencedUserIds.filter((uid) => !memberNamesById[uid]);
      if (missingUserIds.length) {
        const profiles = await fetchUserProfilesByIds(missingUserIds);
        setHistoricalUserNamesById((current) => ({
          ...current,
          ...buildUserNamesById(profiles)
        }));
      }

      setTransactions(rows);
      setSplitsByTransaction(splitMap);
      setSettlements(settlementRows);
      setSettlementTableReady(nextSettlementTableReady);
    } catch (error) {
      console.error("Failed to load transactions:", error);
    } finally {
      setLoading(false);
    }
  }, [memberNamesById, tab.id, tripId, transactions.length]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const handleSaveTransaction = async (payload) => {
    try {
      setSavingTransactionId(composerState.transaction?.id || "new");
      const nextTransaction = composerState.transaction;

      if (composerState.mode === "edit" && nextTransaction) {
        const { error: updateError } = await supabase
          .from("Transaction")
          .update({
            name: payload.name,
            totalAmount: payload.totalAmount,
            paidByUserId: payload.paidBy
          })
          .eq("id", nextTransaction.id);

        if (updateError) throw updateError;

        const { error: deleteSplitsError } = await supabase
          .from("TransactionSplit")
          .delete()
          .eq("transactionId", nextTransaction.id);

        if (deleteSplitsError) throw deleteSplitsError;

        const nextSplits = payload.splits.map((split) => ({
          id: crypto.randomUUID(),
          transactionId: nextTransaction.id,
          userId: split.userId,
          amount: split.amount,
          createdAt: new Date().toISOString()
        }));

        if (nextSplits.length) {
          const { error: insertSplitsError } = await supabase.from("TransactionSplit").insert(nextSplits);
          if (insertSplitsError) throw insertSplitsError;
        }
      } else {
        const transactionId = crypto.randomUUID();
        const { error: transactionError } = await supabase.from("Transaction").insert([
          {
            id: transactionId,
            tripId,
            tabId: tab.id,
            name: payload.name,
            totalAmount: payload.totalAmount,
            paidByUserId: payload.paidBy,
            createdById: userId,
            createdAt: new Date().toISOString()
          }
        ]);

        if (transactionError) throw transactionError;

        const nextSplits = payload.splits.map((split) => ({
          id: crypto.randomUUID(),
          transactionId,
          userId: split.userId,
          amount: split.amount,
          createdAt: new Date().toISOString()
        }));

        if (nextSplits.length) {
          const { error: insertSplitsError } = await supabase.from("TransactionSplit").insert(nextSplits);
          if (insertSplitsError) throw insertSplitsError;
        }
      }

      await loadTransactions({ silent: true });
      setComposerState({ open: false, mode: "add", transaction: null });
    } catch (error) {
      console.error("Failed to save transaction:", error);
    } finally {
      setSavingTransactionId("");
    }
  };

  const handleSaveSettlementSelections = async (selectedSplitIds) => {
    if (!settlementTableReady) return;
    setSavingSettlement(true);

    const nextSelected = new Set(selectedSplitIds || []);
    const existingSelected = new Set(
      settlements
        .filter((settlement) => settlement.sourceSplitId && settlement.status !== "rejected" && settlement.status !== "void")
        .map((settlement) => settlement.sourceSplitId)
    );

    const addedSplitIds = Array.from(nextSelected).filter((splitId) => !existingSelected.has(splitId));
    const removedSplitIds = Array.from(existingSelected).filter((splitId) => !nextSelected.has(splitId));

    try {
      if (removedSplitIds.length) {
        const { error: deleteError } = await supabase
          .from("TransactionSettlement")
          .delete()
          .in("sourceSplitId", removedSplitIds);

        if (deleteError) throw deleteError;
      }

      const now = new Date().toISOString();
      const rowsToInsert = addedSplitIds
        .map((splitId) => {
          const split = splitIndex[splitId];
          if (!split) return null;
          const transaction = transactionIndex[split.transactionId];
          const creditorId = transaction?.paidByUserId || transaction?.createdById || null;
          if (!creditorId || creditorId === split.userId) return null;

          return {
            id: crypto.randomUUID(),
            tripId,
            sourceSplitId: splitId,
            fromUserId: split.userId,
            toUserId: creditorId,
            amount: toCurrency(split.amount),
            note: "",
            status: "pending",
            createdById: userId,
            markedPaidAt: now,
            confirmedByUserId: null,
            confirmedAt: null,
            createdAt: now,
            updatedAt: now
          };
        })
        .filter(Boolean);

      if (rowsToInsert.length) {
        const { error: insertError } = await supabase.from("TransactionSettlement").insert(rowsToInsert);
        if (insertError) throw insertError;
      }

      await loadTransactions({ silent: true });
      setSettlementModalOpen(false);
    } catch (error) {
      console.error("Failed to save settlements:", error);
    } finally {
      setSavingSettlement(false);
    }
  };

  const handleDeleteTransaction = async (transactionId) => {
    try {
      setLoading(true);
      const { error: deleteSplitsError } = await supabase.from("TransactionSplit").delete().eq("transactionId", transactionId);
      if (deleteSplitsError) throw deleteSplitsError;

      const { error: deleteTransactionError } = await supabase.from("Transaction").delete().eq("id", transactionId);
      if (deleteTransactionError) throw deleteTransactionError;

      await loadTransactions();
      setDeleteConfirm(null);
      setActionMenuOpenId("");
    } catch (error) {
      console.error("Failed to delete transaction:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpandTransaction = (transactionId) => {
    setExpandedTransactions((current) => ({
      ...current,
      [transactionId]: !current[transactionId]
    }));
  };

  if (loading) {
    return <div className="p-6" />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-card">
          <button
            type="button"
            onClick={() => setSettlementModalOpen(true)}
            disabled={!settlementTableReady}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <p className="text-sm font-semibold text-slate-500">Balances</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">Who owes what</h2>
            </div>
          </button>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-[#EEF9F0] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5A8A64]">Owed to you</p>
              <p className="mt-2 text-lg font-semibold text-ink">${currentTripSummary.youAreOwed.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl bg-[#FFF7E8] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A6B17]">You owe</p>
              <p className="mt-2 text-lg font-semibold text-ink">${currentTripSummary.youOwe.toFixed(2)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSettlementModalOpen(true)}
            disabled={!settlementTableReady}
            className="mt-4 w-full rounded-2xl bg-ocean px-4 py-2 text-sm font-semibold text-white transition hover:bg-ocean/90 disabled:cursor-not-allowed disabled:bg-ocean/50"
          >
            {settlementTableReady ? "Settle up" : "Run migration"}
          </button>
        </div>

        <div className="rounded-[28px] bg-ocean p-6 text-white shadow-card lg:col-span-1">
          <div>
            <p className="text-sm text-white/80">Your Total Cost</p>
            <p className="mt-2 text-3xl font-bold">${currentTripSummary.grossUserTotal.toFixed(2)}</p>
          </div>
        </div>

        <div className="rounded-[28px] bg-ink p-6 text-white shadow-card">
          <p className="text-sm text-white/70">Total Trip Expenses</p>
          <p className="mt-2 text-3xl font-bold">${currentTripSummary.tripTotal.toFixed(2)}</p>
          <p className="mt-2 text-sm text-white/75">
            Unclaimed: ${currentTripSummary.unclaimedTripTotal.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-card">
        <button
          type="button"
          onClick={() => setComposerState({ open: true, mode: "add", transaction: null })}
          className="flex w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-ocean hover:text-ink"
        >
          + Add transaction
        </button>
      </div>

      {sortedTransactions.length > 0 ? (
        <div className="space-y-3">
          {sortedTransactions.map((transaction) => {
            const splits = splitsByTransaction[transaction.id] || [];
            const state = getTransactionState(transaction, splits, currentTripSummary.settlementBySplitId);
            const canClaim = state === "unclaimed" && canManageTransaction(transaction, userId, userRole);
            
            const stateConfig = {
              unclaimed: { bg: "bg-amber-50/40", border: "border-dashed border-amber-300", badge: "bg-amber-100 text-amber-800", label: "Unclaimed" },
              claimed: { bg: "bg-white", border: "border-slate-200", badge: "bg-blue-100 text-blue-700", label: "Claimed" },
              completed: { bg: "bg-emerald-50/40", border: "border-dashed border-emerald-300", badge: "bg-emerald-100 text-emerald-700", label: "Completed" }
            };
            const config = stateConfig[state];
            
            return (
              <div
                key={transaction.id}
                className={`rounded-[28px] border bg-white p-5 shadow-card ${config.border} ${config.bg}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-semibold text-ink">{transaction.name}</h4>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${config.badge}`}
                      >
                        {config.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Created by {memberNamesById[transaction.createdById] || "Traveler"}
                      {transaction.paidByUserId ? ` • Claimed by ${memberNamesById[transaction.paidByUserId] || "Traveler"}` : ""}
                    </p>
                  </div>
                  <div className="relative text-right">
                    <p className="text-xl font-semibold text-ink">${toCurrency(transaction.totalAmount).toFixed(2)}</p>
                    <div className="mt-2 flex items-center justify-end gap-2">
                      {canClaim ? (
                        <button
                          type="button"
                          onClick={() => {
                            setComposerState({ open: true, mode: "edit", transaction: { ...transaction, paidByUserId: userId, splits } });
                            setActionMenuOpenId("");
                          }}
                          className="rounded-full bg-amber-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-600"
                        >
                          Claim
                        </button>
                      ) : null}
                      {canManageTransaction(transaction, userId, userRole) ? (
                        <button
                          type="button"
                          onClick={() => setActionMenuOpenId((current) => (current === transaction.id ? "" : transaction.id))}
                          className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                          aria-label="More actions"
                        >
                          ...
                        </button>
                      ) : null}
                    </div>
                    {actionMenuOpenId === transaction.id ? (
                      <div className="absolute right-0 z-10 mt-2 w-36 rounded-2xl border border-slate-200 bg-white shadow-lg">
                        {canManageTransaction(transaction, userId, userRole) ? (
                          <button
                            type="button"
                            onClick={() => {
                              setComposerState({ open: true, mode: "edit", transaction: { ...transaction, splits } });
                              setActionMenuOpenId("");
                            }}
                            className="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-slate-50"
                          >
                            Edit
                          </button>
                        ) : null}
                        {canManageTransaction(transaction, userId, userRole) ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteConfirm(transaction);
                              setActionMenuOpenId("");
                            }}
                            className="block w-full px-4 py-2 text-left text-sm text-coral hover:bg-slate-50"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleExpandTransaction(transaction.id)}
                  className="mt-3 text-xs font-semibold text-ocean hover:underline"
                >
                  {expandedTransactions[transaction.id] ? "Hide split details" : "Show split details"}
                </button>

                {expandedTransactions[transaction.id] ? (
                  <div className="mt-3 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    {splits.length ? splits.map((split) => {
                      const settlement = currentTripSummary.settlementBySplitId[split.id] || null;
                      const statusLabel = settlement
                        ? settlement.status === "confirmed"
                          ? "Paid"
                          : settlement.status === "pending"
                            ? "Marked paid"
                            : settlement.status
                        : "Outstanding";

                      return (
                        <div key={split.id} className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-ink">{memberNamesById[split.userId] || "Traveler"}</p>
                            <p className="mt-1 text-xs text-slate-500">{settlement ? `Marked by ${memberNamesById[settlement.createdById] || "Traveler"}` : "Not yet marked paid"}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-ink">${toCurrency(split.amount).toFixed(2)}</p>
                            <p className="mt-1 text-xs font-semibold text-ocean">{statusLabel}</p>
                          </div>
                        </div>
                      );
                    }) : (
                      <p className="text-sm text-slate-600">No split details yet.</p>
                    )}
                  </div>
                ) : null}

                <div className="mt-4">
                  <ThreadedComments
                    tableName="TransactionComment"
                    resourceColumn="transactionId"
                    resourceId={transaction.id}
                    userId={userId}
                    userNamesById={memberNamesById}
                    userAvatarColorsById={memberAvatarColorsById}
                    canDeleteAnyComment={userRole === "owner"}
                    title="Comments"
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500 shadow-card">
          No transactions yet.
        </p>
      )}

      <TransactionComposerModal
        open={composerState.open}
        mode={composerState.mode}
        tripMembers={tripMembers || []}
        initialTransaction={composerState.transaction}
        submitLabel={composerState.mode === "edit" ? "Save changes" : "Save transaction"}
        onClose={() => setComposerState({ open: false, mode: "add", transaction: null })}
        onSave={handleSaveTransaction}
      />

      <ExpenseSettlementModal
        open={settlementModalOpen}
        currentUserId={userId}
        memberNamesById={memberNamesById}
        balanceRows={currentTripSummary.balanceRows}
        initialSelectedSplitIds={Array.from(currentTripSummary.settlementSplitIds)}
        onClose={() => setSettlementModalOpen(false)}
        onSave={handleSaveSettlementSelections}
      />

      <ConfirmModal
        open={Boolean(deleteConfirm)}
        title="Delete this expense?"
        message={deleteConfirm ? `${deleteConfirm.name} will be removed permanently, including all split details and marked payments.` : ""}
        confirmText="Delete"
        cancelText="Cancel"
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => handleDeleteTransaction(deleteConfirm.id)}
      />

      {(savingTransactionId || savingSettlement) ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[130] flex justify-center px-4">
          <div className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-2xl">
            Saving changes...
          </div>
        </div>
      ) : null}
    </div>
  );
}