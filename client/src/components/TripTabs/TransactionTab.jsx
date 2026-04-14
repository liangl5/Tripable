import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import ThreadedComments from "../ThreadedComments.jsx";

export default function TransactionTab({ tab, tripId, userId, userRole, tripMembers }) {
  const [transactions, setTransactions] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    totalAmount: "",
    paidBy: "",
    splits: {}
  });
  const [userTotal, setUserTotal] = useState(0);

  // Load transactions
  useEffect(() => {
    const loadTransactions = async () => {
      try {
        setLoading(true);
        const { data } = await supabase
          .from("Transaction")
          .select("*")
          .eq("tabId", tab.id)
          .order("createdAt", { ascending: false });

        setTransactions(data || []);

        // Calculate user's total (batch load all splits)
        if (data && data.length > 0) {
          const transactionIds = data.map((t) => t.id);
          const { data: allSplits } = await supabase
            .from("TransactionSplit")
            .select("amount")
            .eq("userId", userId)
            .in("transactionId", transactionIds);

          const total = (allSplits || []).reduce(
            (sum, split) => sum + parseFloat(split.amount || 0),
            0
          );
          setUserTotal(total);
        } else {
          setUserTotal(0);
        }
      } catch (error) {
        console.error("Failed to load transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [tab.id, userId]);

  const handleAddTransaction = async () => {
    if (!formData.name || !formData.totalAmount) {
      console.error("Please fill in name and amount");
      return;
    }

    try {
      setLoading(true);
      const total = parseFloat(formData.totalAmount);

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
        amount: parseFloat(amount || 0),
        createdAt: new Date().toISOString()
      }));

      if (splits.length > 0) {
        const { error: splitsError } = await supabase.from("TransactionSplit").insert(splits);
        if (splitsError) throw splitsError;
      }

      setTransactions([transaction, ...transactions]);
      setFormData({ name: "", totalAmount: "", paidBy: "", splits: {} });
      setShowAddForm(false);
    } catch (error) {
      console.error("Failed to add transaction:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (transactionId) => {
    try {
      await supabase.from("TransactionSplit").delete().eq("transactionId", transactionId);
      await supabase.from("Transaction").delete().eq("id", transactionId);
      setTransactions(transactions.filter((t) => t.id !== transactionId));
    } catch (error) {
      console.error("Failed to delete transaction:", error);
    }
  };

  const handleSplitEvenly = () => {
    const amount = parseFloat(formData.totalAmount) / Object.keys(formData.splits).length;
    const newSplits = {};
    Object.keys(formData.splits).forEach((memberId) => {
      newSplits[memberId] = amount.toFixed(2);
    });
    setFormData({ ...formData, splits: newSplits });
  };

  const memberNamesById = (tripMembers || []).reduce((acc, member) => {
    acc[member.id] = member.name || member.email || "Traveler";
    return acc;
  }, {});

  if (loading) {
    return <div className="p-6" />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* User Total */}
      <div className="bg-ocean rounded-lg p-6 text-white">
        <p className="text-sm text-white/80">Your Total Cost</p>
        <p className="text-3xl font-bold">${userTotal.toFixed(2)}</p>
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
              onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
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
                    onClick={handleSplitEvenly}
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
                  setFormData({ name: "", totalAmount: "", paidBy: "", splits: {} });
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
                    Created by: {transaction.createdById} {transaction.paidByUserId && `• Paid by: ${transaction.paidByUserId}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-ink">${parseFloat(transaction.totalAmount).toFixed(2)}</p>
                </div>
              </div>

              {(userRole === "owner" || userRole === "editor") && (
                <button
                  onClick={() => handleDeleteTransaction(transaction.id)}
                  className="text-xs text-coral hover:font-semibold"
                >
                  Delete
                </button>
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

      {transactions.length === 0 && !showAddForm && (
        <p className="text-center text-slate-600 py-8">No transactions yet</p>
      )}
    </div>
  );
}
