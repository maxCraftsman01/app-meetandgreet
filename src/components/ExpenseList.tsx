import { useEffect, useMemo, useState } from "react";
import { Receipt, CheckCircle, BarChart2, Plus, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fetchExpenses, deleteExpense } from "@/lib/api";
import { ExpenseFormDialog } from "./ExpenseFormDialog";
import type { Expense } from "@/types";

const fmtEUR = (n: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);

const CATEGORY_LABEL: Record<Expense["category"], string> = {
  cleaning: "Cleaning",
  maintenance: "Maintenance",
  repair: "Repair",
  shopping: "Shopping",
  supplies: "Supplies",
  other: "Other",
};

export function ExpenseList() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchExpenses();
      setExpenses(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ─── Summary calculations ───────────────────────────────
  const summary = useMemo(() => {
    const pending = expenses.filter((e) => e.payment_status === "pending");
    const pendingKnown = pending.filter((e) => e.amount != null);
    const pendingTotal = pendingKnown.reduce((s, e) => s + (e.amount ?? 0), 0);
    const pendingHasUnknown = pending.length > pendingKnown.length;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const paidThisMonth = expenses
      .filter((e) => {
        if (e.payment_status !== "paid" || !e.paid_at || e.amount == null) return false;
        const d = new Date(e.paid_at);
        return d >= monthStart && d < monthEnd;
      })
      .reduce((s, e) => s + (e.amount ?? 0), 0);

    const byCategoryMap = new Map<Expense["category"], { count: number; total: number }>();
    for (const e of expenses) {
      const cur = byCategoryMap.get(e.category) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += e.amount ?? 0;
      byCategoryMap.set(e.category, cur);
    }
    const byCategory = Array.from(byCategoryMap.entries())
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.total - a.total);

    return { pendingTotal, pendingHasUnknown, paidThisMonth, byCategory };
  }, [expenses]);

  const handleEdit = (e: Expense) => {
    setEditing(e);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleDelete = async (e: Expense) => {
    if (!confirm(`Delete expense "${e.title}"?`)) return;
    try {
      await deleteExpense(e.id);
      toast.success("Expense deleted");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-4">
      {/* ─── Summary Cards ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Pending */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Receipt className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Pending Expenses</p>
              <p className="text-2xl font-semibold">{fmtEUR(summary.pendingTotal)}</p>
              {summary.pendingHasUnknown && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  some amounts unknown
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Paid this month */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-muted p-2">
              <CheckCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Paid This Month</p>
              <p className="text-2xl font-semibold">{fmtEUR(summary.paidThisMonth)}</p>
            </div>
          </div>
        </Card>

        {/* By Category */}
        <Card className="p-4 sm:col-span-2 lg:col-span-1">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-muted p-2">
              <BarChart2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">By Category</p>
              {summary.byCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet</p>
              ) : (
                <ul className="space-y-0.5">
                  {summary.byCategory.map((c) => (
                    <li key={c.category} className="text-sm">
                      <span className="font-medium">{CATEGORY_LABEL[c.category]}:</span>{" "}
                      <span className="text-muted-foreground">
                        {c.count} {c.count === 1 ? "task" : "tasks"} · {fmtEUR(c.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Header Actions ─── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Expenses</h2>
        <Button onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Expense
        </Button>
      </div>

      {/* ─── List ─── */}
      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">Loading...</div>
      ) : expenses.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No expenses yet. Click "Add Expense" to create one.
        </Card>
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <Card key={e.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium truncate">{e.title}</p>
                  <Badge variant="outline" className="capitalize text-xs">
                    {e.category}
                  </Badge>
                  <Badge
                    variant={e.payment_status === "paid" ? "default" : "secondary"}
                    className="capitalize text-xs"
                  >
                    {e.payment_status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {e.date} · {e.amount != null ? fmtEUR(e.amount) : "amount unknown"}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleEdit(e)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(e)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <ExpenseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={editing}
        onSaved={load}
      />
    </div>
  );
}
