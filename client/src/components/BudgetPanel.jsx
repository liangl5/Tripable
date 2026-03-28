import { useState } from "react";
import { formatCurrency, getBudgetSummary, normalizeListName } from "../lib/tripPlanning.js";

const initialExpense = {
  title: "",
  amount: "",
  paidBy: "",
  category: "General",
  notes: ""
};

export default function BudgetPanel({ trip, onChange, onPersistMeta }) {
  const [expenseForm, setExpenseForm] = useState(initialExpense);
  const summary = getBudgetSummary(trip);

  const handleBudgetChange = (event) => {
    const nextBudgetTotal = event.target.value === "" ? "" : String(event.target.value);
    onChange({ budgetTotal: nextBudgetTotal });
    const persistence = onPersistMeta?.({ budgetTotal: nextBudgetTotal });
    if (persistence?.catch) {
      persistence.catch(() => {});
    }
  };

  const handleExpenseChange = (event) => {
    const { name, value } = event.target;
    setExpenseForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddExpense = (event) => {
    event.preventDefault();
    const nextExpense = {
      id: crypto.randomUUID(),
      title: String(expenseForm.title || "").trim(),
      amount: Number(expenseForm.amount) || 0,
      paidBy: String(expenseForm.paidBy || "").trim() || "Group",
      category: normalizeListName(expenseForm.category) || "General",
      notes: String(expenseForm.notes || "").trim(),
      createdAt: new Date().toISOString()
    };

    if (!nextExpense.title || nextExpense.amount <= 0) {
      return;
    }

    const nextExpenses = [nextExpense, ...(Array.isArray(trip.expenses) ? trip.expenses : [])];
    onChange({ expenses: nextExpenses });
    const persistence = onPersistMeta?.({ expenses: nextExpenses });
    if (persistence?.catch) {
      persistence.catch(() => {});
    }
    setExpenseForm(initialExpense);
  };

  const handleRemoveExpense = (expenseId) => {
    const nextExpenses = (Array.isArray(trip.expenses) ? trip.expenses : []).filter((expense) => expense.id !== expenseId);
    onChange({ expenses: nextExpenses });
    const persistence = onPersistMeta?.({ expenses: nextExpenses });
    if (persistence?.catch) {
      persistence.catch(() => {});
    }
  };

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Budgeting</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">Group budget and expenses</h2>
          <p className="mt-2 text-sm text-slate-500">
            Set a shared budget, then log the expenses the group actually commits to.
          </p>
        </div>
        <span className="rounded-full bg-mist px-3 py-2 text-xs font-semibold text-slate-600">
          {trip.memberCount || 1} travelers
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-mist px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Budget</p>
          <input
            value={trip.budgetTotal || ""}
            onChange={handleBudgetChange}
            inputMode="numeric"
            placeholder="0"
            className="mt-3 w-full border-0 bg-transparent p-0 text-2xl font-semibold text-ink outline-none"
          />
        </div>
        <div className="rounded-2xl bg-[#EEF9F0] px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5A8A64]">Spent</p>
          <p className="mt-3 text-2xl font-semibold text-ink">{formatCurrency(summary.spent)}</p>
        </div>
        <div className={`rounded-2xl px-4 py-4 ${summary.remaining < 0 ? "bg-[#FFF1F1]" : "bg-[#EEF2FF]"}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Remaining</p>
          <p className="mt-3 text-2xl font-semibold text-ink">{formatCurrency(summary.remaining)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-[#FCFDFE] px-4 py-4">
        <p className="text-sm font-semibold text-ink">Current split</p>
        <p className="mt-2 text-sm text-slate-500">
          Average per person: {formatCurrency(summary.perPerson)}
        </p>
      </div>

      <form onSubmit={handleAddExpense} className="mt-6 grid gap-3">
        <div className="grid gap-3 md:grid-cols-[1.2fr,0.8fr,0.8fr]">
          <input
            name="title"
            value={expenseForm.title}
            onChange={handleExpenseChange}
            placeholder="Expense title"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          />
          <input
            name="amount"
            value={expenseForm.amount}
            onChange={handleExpenseChange}
            inputMode="decimal"
            placeholder="Amount"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          />
          <input
            name="paidBy"
            value={expenseForm.paidBy}
            onChange={handleExpenseChange}
            placeholder="Paid by"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-[0.8fr,1.2fr,auto]">
          <input
            name="category"
            value={expenseForm.category}
            onChange={handleExpenseChange}
            placeholder="Category"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          />
          <input
            name="notes"
            value={expenseForm.notes}
            onChange={handleExpenseChange}
            placeholder="Notes (optional)"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          />
          <button
            type="submit"
            className="rounded-2xl bg-ocean px-5 py-3 text-sm font-semibold text-white"
          >
            Add expense
          </button>
        </div>
      </form>

      <div className="mt-6 grid gap-3">
        {summary.expenses.length ? (
          summary.expenses.map((expense) => (
            <div
              key={expense.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-ink">{expense.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {expense.paidBy} | {expense.category}
                  {expense.notes ? ` | ${expense.notes}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-ink">{formatCurrency(expense.amount)}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveExpense(expense.id)}
                  className="rounded-full bg-[#FFF1F1] px-3 py-1 text-xs font-semibold text-[#C34D4D]"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-mist px-4 py-5 text-sm text-slate-500">
            No expenses logged yet. Start with flights, hotel holds, or tickets.
          </div>
        )}
      </div>
    </section>
  );
}
