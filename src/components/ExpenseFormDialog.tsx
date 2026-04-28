import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Check, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  linked_ticket_ids: string[];
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
  linked_ticket_ids: [],
};

export function ExpenseFormDialog({ open, onOpenChange, expense, onSaved }: Props) {
  const { toast } = useToast();
  const editing = !!expense;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketPickerOpen, setTicketPickerOpen] = useState(false);

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
        linked_ticket_ids: expense.linked_ticket_ids ?? [],
      });
    } else {
      setForm(emptyForm);
    }
  }, [expense, open]);

  // When property changes, drop linked tickets that don't belong to it
  useEffect(() => {
    if (!form.property_id || tickets.length === 0) return;
    setForm((prev) => {
      const allowed = new Set(
        tickets.filter((t) => t.property_id === prev.property_id).map((t) => t.id),
      );
      const filtered = prev.linked_ticket_ids.filter((id) => allowed.has(id));
      if (filtered.length === prev.linked_ticket_ids.length) return prev;
      return { ...prev, linked_ticket_ids: filtered };
    });
  }, [form.property_id, tickets]);

  // Tickets restricted to the selected property
  const availableTickets = useMemo(
    () => (form.property_id ? tickets.filter((t) => t.property_id === form.property_id) : []),
    [tickets, form.property_id],
  );

  const ticketsById = useMemo(() => {
    const m = new Map<string, Ticket>();
    for (const t of tickets) m.set(t.id, t);
    return m;
  }, [tickets]);

  const toggleTicket = (id: string) => {
    setForm((prev) => {
      const has = prev.linked_ticket_ids.includes(id);
      return {
        ...prev,
        linked_ticket_ids: has
          ? prev.linked_ticket_ids.filter((x) => x !== id)
          : [...prev.linked_ticket_ids, id],
      };
    });
  };

  const removeTicket = (id: string) => {
    setForm((prev) => ({
      ...prev,
      linked_ticket_ids: prev.linked_ticket_ids.filter((x) => x !== id),
    }));
  };

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
        linked_ticket_ids: form.linked_ticket_ids,
        created_by: session?.user_id ?? "",
      };

      if (editing && expense) {
        await updateExpense(expense.id, payload);
        toast({ title: "Expense updated" });
      } else {
        await createExpense(payload as any);
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

          {/* Linked Tickets — multi-select chips */}
          <div>
            <Label>Linked Issues</Label>
            <p className="text-xs text-muted-foreground mb-2">
              {form.property_id
                ? "Link one or more maintenance issues to this expense."
                : "Select a property first to link issues."}
            </p>

            {form.linked_ticket_ids.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.linked_ticket_ids.map((id) => {
                  const t = ticketsById.get(id);
                  return (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="pl-2 pr-1 py-1 gap-1 max-w-[260px]"
                    >
                      <span className="truncate">{t?.title ?? "Unknown issue"}</span>
                      <button
                        type="button"
                        onClick={() => removeTicket(id)}
                        className="rounded-full hover:bg-background/60 p-0.5"
                        aria-label={`Remove ${t?.title ?? "ticket"}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}

            <Popover open={ticketPickerOpen} onOpenChange={setTicketPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  disabled={!form.property_id}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  {form.linked_ticket_ids.length > 0 ? "Add or remove issues" : "Link issues"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search issues..." />
                  <CommandList>
                    <CommandEmpty>
                      {availableTickets.length === 0
                        ? "No issues for this property."
                        : "No issues match."}
                    </CommandEmpty>
                    <CommandGroup>
                      {availableTickets.map((t) => {
                        const checked = form.linked_ticket_ids.includes(t.id);
                        return (
                          <CommandItem
                            key={t.id}
                            value={`${t.title} ${t.status}`}
                            onSelect={() => toggleTicket(t.id)}
                            className="flex items-center gap-2"
                          >
                            <div
                              className={cn(
                                "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                                checked
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-input",
                              )}
                            >
                              {checked && <Check className="h-3 w-3" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm">{t.title}</p>
                              <p className="text-[10px] text-muted-foreground capitalize">
                                {t.status.replace("_", " ")} · {t.priority}
                              </p>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
