import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getSession } from "@/lib/session";
import {
  createExpense,
  updateExpense,
  getAdminProperties,
  getAdminUsers,
  getTickets,
} from "@/lib/api";
import type { Expense, Property, Ticket } from "@/types";

interface AppUser {
  id: string;
  name: string;
}

const CATEGORIES: Expense["category"][] = [
  "cleaning",
  "maintenance",
  "repair",
  "shopping",
  "supplies",
  "other",
];

const PAYMENT_STATUSES: Expense["payment_status"][] = [
  "pending",
  "paid",
  "invoiced",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
  onSaved?: () => void;
}

interface FormState {
  property_id: string;
  date: Date | undefined;
  category: Expense["category"];
  title: string;
  description: string;
  amount: string;
  payment_status: Expense["payment_status"];
  paid_at: string | null;
  visible_to_owner: boolean;
  assigned_to: string | null;
  linked_ticket_id: string | null;
}

const emptyForm: FormState = {
  property_id: "",
  date: new Date(),
  category: "other",
  title: "",
  description: "",
  amount: "",
  payment_status: "pending",
  paid_at: null,
  visible_to_owner: false,
  assigned_to: null,
  linked_ticket_id: null,
};

export function ExpenseFormDialog({ open, onOpenChange, expense, onSaved }: Props) {
  const { toast } = useToast();
  const editing = !!expense;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // Load dropdown data when dialog opens
  useEffect(() => {
    if (!open) return;
    const session = getSession();
    if (!session || session.role !== "admin") return;
    (async () => {
      try {
        const [props, usrs, tkts] = await Promise.all([
          getAdminProperties(session.pin),
          getAdminUsers(session.pin),
          getTickets(session.pin, "admin"),
        ]);
        setProperties(Array.isArray(props) ? props : []);
        setUsers(Array.isArray(usrs?.users) ? usrs.users : Array.isArray(usrs) ? usrs : []);
        setTickets(Array.isArray(tkts) ? tkts : []);
      } catch (err) {
        console.error("Failed to load form data", err);
      }
    })();
  }, [open]);

  // Sync form state with editing target
  useEffect(() => {
    if (!open) return;
    if (expense) {
      setForm({
        property_id: expense.property_id,
        date: expense.date ? new Date(expense.date) : new Date(),
        category: expense.category,
        title: expense.title,
        description: expense.description ?? "",
        amount: expense.amount != null ? String(expense.amount) : "",
        payment_status: expense.payment_status,
        paid_at: expense.paid_at,
        visible_to_owner: expense.visible_to_owner,
        assigned_to: expense.assigned_to,
        linked_ticket_id: expense.linked_ticket_id,
      });
    } else {
      setForm(emptyForm);
    }
  }, [expense, open]);

  const handleSave = async () => {
    if (!form.property_id) {
      toast({ title: "Property required", variant: "destructive" });
      return;
    }
    if (!form.date) {
      toast({ title: "Date required", variant: "destructive" });
      return;
    }
    if (!form.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const session = getSession();
      const payload = {
        property_id: form.property_id,
        date: format(form.date, "yyyy-MM-dd"),
        category: form.category,
        title: form.title.trim(),
        description: form.description,
        amount: form.amount.trim() === "" ? null : Number(form.amount),
        payment_status: form.payment_status,
        paid_at:
          form.payment_status === "paid"
            ? form.paid_at ?? new Date().toISOString()
            : null,
        visible_to_owner: form.visible_to_owner,
        assigned_to: form.assigned_to,
        linked_ticket_id: form.linked_ticket_id,
        created_by: session?.user_id ?? "",
      };

      if (editing && expense) {
        await updateExpense(expense.id, payload);
        toast({ title: "Expense updated" });
      } else {
        await createExpense(payload);
        toast({ title: "Expense created" });
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Expense" : "Add Expense"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Property + Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Property *</Label>
              <Select
                value={form.property_id}
                onValueChange={(v) => setForm({ ...form, property_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.date ? format(form.date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.date}
                    onSelect={(d) => setForm({ ...form, date: d ?? undefined })}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Category + Payment Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm({ ...form, category: v as Expense["category"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Payment Status</Label>
              <Select
                value={form.payment_status}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    payment_status: v as Expense["payment_status"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title */}
          <div>
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Replace bathroom faucet"
            />
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>

          {/* Amount */}
          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Leave blank if unknown"
            />
          </div>

          {/* Assigned To */}
          <div>
            <Label>Assigned To</Label>
            <Select
              value={form.assigned_to ?? "none"}
              onValueChange={(v) =>
                setForm({ ...form, assigned_to: v === "none" ? null : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Linked Ticket */}
          <div>
            <Label>Linked Ticket</Label>
            <Select
              value={form.linked_ticket_id ?? "none"}
              onValueChange={(v) =>
                setForm({ ...form, linked_ticket_id: v === "none" ? null : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {tickets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                    {t.properties?.name ? ` — ${t.properties.name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Visible to Owner */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm">Visible to Owner</Label>
              <p className="text-xs text-muted-foreground">
                Show this expense in the owner's finance view
              </p>
            </div>
            <Switch
              checked={form.visible_to_owner}
              onCheckedChange={(v) => setForm({ ...form, visible_to_owner: v })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
