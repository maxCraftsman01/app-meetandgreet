import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, CalendarDays, Users, DollarSign, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAdminReservations,
  createReservation,
  updateReservation,
  deleteReservation,
} from "@/lib/api";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export interface ManualReservation {
  id: string;
  property_id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  source: string;
  net_payout: number;
  status: string;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  adminPin: string;
  propertyId: string;
  propertyName: string;
  currency: string;
  onUpdate?: () => void;
}

const SOURCES = ["Airbnb", "Booking.com", "Vrbo", "Direct", "Other"];
const STATUSES = ["Confirmed", "Paid", "Cancelled"];

const emptyForm = {
  guest_name: "",
  check_in: "",
  check_out: "",
  source: "Direct",
  net_payout: "",
  status: "Confirmed",
};

export function ManageReservations({ adminPin, propertyId, propertyName, currency, onUpdate }: Props) {
  const [reservations, setReservations] = useState<ManualReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await getAdminReservations(adminPin, propertyId);
      setReservations(data);
    } catch {
      toast.error("Failed to load reservations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const handleSave = async () => {
    if (!form.guest_name || !form.check_in || !form.check_out) {
      toast.error("Fill guest name, check-in, and check-out dates.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        property_id: propertyId,
        guest_name: form.guest_name,
        check_in: form.check_in,
        check_out: form.check_out,
        source: form.source,
        net_payout: parseFloat(form.net_payout) || 0,
        status: form.status,
      };
      if (editingId) {
        await updateReservation(adminPin, editingId, payload);
        toast.success("Reservation updated");
      } else {
        await createReservation(adminPin, payload);
        toast.success("Reservation created");
      }
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      load();
      onUpdate?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (r: ManualReservation) => {
    setEditingId(r.id);
    setForm({
      guest_name: r.guest_name,
      check_in: r.check_in,
      check_out: r.check_out,
      source: r.source,
      net_payout: String(r.net_payout),
      status: r.status,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this reservation?")) return;
    try {
      await deleteReservation(adminPin, id);
      toast.success("Reservation deleted");
      load();
      onUpdate?.();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      Confirmed: "bg-amber-100 text-amber-800",
      Paid: "bg-emerald-100 text-emerald-800",
      Cancelled: "bg-red-100 text-red-800",
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || "bg-muted text-muted-foreground"}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" />
          Reservations
        </h4>
        <Dialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) { setEditingId(null); setForm(emptyForm); }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Reservation" : "Add Reservation"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div>
                <Label>Guest Name</Label>
                <Input
                  value={form.guest_name}
                  onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Check-in</Label>
                  <Input
                    type="date"
                    value={form.check_in}
                    onChange={(e) => setForm({ ...form, check_in: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Check-out</Label>
                  <Input
                    type="date"
                    value={form.check_out}
                    onChange={(e) => setForm({ ...form, check_out: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Source</Label>
                  <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Net Payout ({currency})</Label>
                <Input
                  type="number"
                  value={form.net_payout}
                  onChange={(e) => setForm({ ...form, net_payout: e.target.value })}
                  placeholder="850"
                />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : reservations.length === 0 ? (
        <p className="text-xs text-muted-foreground">No manual reservations yet.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <AnimatePresence>
            {reservations.map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{r.guest_name}</span>
                    {statusBadge(r.status)}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>{format(parseISO(r.check_in), "MMM d")} – {format(parseISO(r.check_out), "MMM d")}</span>
                    <span>·</span>
                    <span>{r.source}</span>
                    <span>·</span>
                    <span className="font-medium">{r.net_payout} {currency}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(r)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
