import { useEffect, useMemo, useState } from "react";
import { Printer, FileText } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { fetchExpenses } from "@/lib/api";
import type { Property, Expense } from "@/types";

interface OwnerExpenseStatementProps {
  properties: Property[];
}

const STATUS_VARIANT: Record<Expense["payment_status"], "default" | "secondary" | "destructive" | "outline"> = {
  pending: "destructive",
  paid: "default",
  invoiced: "secondary",
};

const fmtAmount = (n: number | null, currency: string) =>
  n == null ? "—" : `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;

export const OwnerExpenseStatement = ({ properties }: OwnerExpenseStatementProps) => {
  const [selectedOwner, setSelectedOwner] = useState<string>("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [groupByMonth, setGroupByMonth] = useState(false);

  // Unique owners from properties
  const owners = useMemo(() => {
    const set = new Set<string>();
    for (const p of properties) if (p.owner_name) set.add(p.owner_name);
    return Array.from(set).sort();
  }, [properties]);

  // Properties belonging to the selected owner
  const ownerProperties = useMemo(
    () => properties.filter((p) => p.owner_name === selectedOwner),
    [properties, selectedOwner],
  );

  // Load expenses for the selected owner's properties
  useEffect(() => {
    if (!selectedOwner || ownerProperties.length === 0) {
      setExpenses([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all(ownerProperties.map((p) => fetchExpenses({ property_id: p.id })))
      .then((results) => {
        if (cancelled) return;
        const merged = results.flat();
        // de-dup by id (in case of overlap)
        const map = new Map<string, Expense>();
        for (const e of merged) map.set(e.id, e);
        setExpenses(Array.from(map.values()));
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load expenses");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOwner, ownerProperties.length]);

  // Grand totals
  const grand = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    let pending = 0;
    let paidThisMonth = 0;
    for (const e of expenses) {
      if (e.payment_status === "pending" && e.amount != null) pending += e.amount;
      if (e.payment_status === "paid" && e.paid_at && e.amount != null) {
        const d = parseISO(e.paid_at);
        if (d >= monthStart && d <= monthEnd) paidThisMonth += e.amount;
      }
    }
    return { pending, paidThisMonth };
  }, [expenses]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Print-only styles: hide everything except this statement */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #owner-statement-print, #owner-statement-print * { visibility: visible !important; }
          #owner-statement-print {
            position: absolute !important;
            left: 0; top: 0; width: 100%;
            padding: 24px;
            background: white !important;
            color: black !important;
          }
          .no-print { display: none !important; }
          .print-card { box-shadow: none !important; border: 1px solid #ddd !important; break-inside: avoid; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        }
      `}</style>

      <div className="space-y-4">
        {/* Controls (hidden in print) */}
        <Card className="p-4 no-print">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground">Owner</Label>
              <Select value={selectedOwner} onValueChange={setSelectedOwner}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select an owner..." />
                </SelectTrigger>
                <SelectContent>
                  {owners.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No owners found</div>
                  ) : (
                    owners.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 sm:pb-2">
              <Switch id="group-month" checked={groupByMonth} onCheckedChange={setGroupByMonth} />
              <Label htmlFor="group-month" className="text-sm cursor-pointer">Group by month</Label>
            </div>
            <Button
              variant="outline"
              onClick={handlePrint}
              disabled={!selectedOwner || expenses.length === 0}
            >
              <Printer className="w-4 h-4 mr-1.5" /> Print / Export
            </Button>
          </div>
        </Card>

        {/* Statement body */}
        <div id="owner-statement-print" className="space-y-4">
          {!selectedOwner ? (
            <Card className="p-12 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Select an owner to generate a statement.</p>
            </Card>
          ) : loading ? (
            <Card className="p-12 text-center text-muted-foreground">Loading...</Card>
          ) : (
            <>
              {/* Statement header */}
              <Card className="p-6 print-card">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Expense Statement</p>
                    <h2 className="text-2xl font-semibold mt-1">{selectedOwner}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {ownerProperties.length} {ownerProperties.length === 1 ? "property" : "properties"} · Generated {format(new Date(), "MMMM d, yyyy")}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-right">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Pending Total</p>
                      <p className="text-xl font-semibold tabular-nums mt-1">{grand.pending.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Paid This Month</p>
                      <p className="text-xl font-semibold tabular-nums mt-1">{grand.paidThisMonth.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Per-property sections */}
              {ownerProperties.map((property) => {
                const propExpenses = expenses
                  .filter((e) => e.property_id === property.id)
                  .sort((a, b) => b.date.localeCompare(a.date));

                const subPending = propExpenses
                  .filter((e) => e.payment_status === "pending" && e.amount != null)
                  .reduce((s, e) => s + (e.amount ?? 0), 0);
                const subPaid = propExpenses
                  .filter((e) => e.payment_status === "paid" && e.amount != null)
                  .reduce((s, e) => s + (e.amount ?? 0), 0);

                return (
                  <Card key={property.id} className="p-6 print-card">
                    <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
                      <h3 className="font-semibold text-lg">{property.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {propExpenses.length} {propExpenses.length === 1 ? "expense" : "expenses"}
                      </p>
                    </div>

                    {propExpenses.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">No expenses recorded.</p>
                    ) : groupByMonth ? (
                      <MonthlyGrouped expenses={propExpenses} currency={property.currency} />
                    ) : (
                      <ExpenseTable expenses={propExpenses} currency={property.currency} />
                    )}

                    {propExpenses.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border flex justify-end gap-6 text-sm">
                        <div>
                          <span className="text-muted-foreground">Pending: </span>
                          <span className="font-semibold tabular-nums">{subPending.toLocaleString(undefined, { maximumFractionDigits: 2 })} {property.currency}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Paid: </span>
                          <span className="font-semibold tabular-nums">{subPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })} {property.currency}</span>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}

              {ownerProperties.length === 0 && (
                <Card className="p-8 text-center text-muted-foreground print-card">
                  This owner has no properties.
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

// ============================================================
// Helpers
// ============================================================
const ExpenseTable = ({ expenses, currency }: { expenses: Expense[]; currency: string }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left">
          <th className="pb-2 font-medium text-muted-foreground">Date</th>
          <th className="pb-2 font-medium text-muted-foreground">Category</th>
          <th className="pb-2 font-medium text-muted-foreground">Title</th>
          <th className="pb-2 font-medium text-muted-foreground">Status</th>
          <th className="pb-2 font-medium text-muted-foreground text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {expenses.map((e) => (
          <tr key={e.id} className="border-b border-border/50 last:border-0">
            <td className="py-2.5 text-muted-foreground whitespace-nowrap">{format(parseISO(e.date), "MMM d, yyyy")}</td>
            <td className="py-2.5">
              <Badge variant="secondary" className="capitalize font-normal">{e.category}</Badge>
            </td>
            <td className="py-2.5 font-medium">{e.title}</td>
            <td className="py-2.5">
              <Badge variant={STATUS_VARIANT[e.payment_status]} className="capitalize font-normal">{e.payment_status}</Badge>
            </td>
            <td className="py-2.5 text-right font-medium tabular-nums whitespace-nowrap">{fmtAmount(e.amount, currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const MonthlyGrouped = ({ expenses, currency }: { expenses: Expense[]; currency: string }) => {
  // Group by YYYY-MM
  const groups = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of expenses) {
      const key = e.date.slice(0, 7);
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [expenses]);

  return (
    <div className="space-y-4">
      {groups.map(([key, items]) => {
        const monthLabel = format(parseISO(`${key}-01`), "MMMM yyyy");
        const subPending = items.filter((e) => e.payment_status === "pending" && e.amount != null).reduce((s, e) => s + (e.amount ?? 0), 0);
        const subPaid = items.filter((e) => e.payment_status === "paid" && e.amount != null).reduce((s, e) => s + (e.amount ?? 0), 0);
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between mb-2 pb-1 border-b border-border">
              <h4 className="font-semibold text-sm">{monthLabel}</h4>
              <p className="text-xs text-muted-foreground tabular-nums">
                Pending {subPending.toLocaleString(undefined, { maximumFractionDigits: 2 })} · Paid {subPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
              </p>
            </div>
            <ExpenseTable expenses={items} currency={currency} />
          </div>
        );
      })}
    </div>
  );
};
