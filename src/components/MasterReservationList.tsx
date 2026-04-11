import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getAdminReservations, deleteReservation, updateReservation } from "@/lib/api";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import type { ManualReservation } from "./ManageReservations";

interface Props {
  adminPin: string;
  properties: { id: string; name: string; currency: string }[];
}

export function MasterReservationList({ adminPin, properties }: Props) {
  const [reservations, setReservations] = useState<(ManualReservation & { property_name?: string; currency?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ guest_name: "", check_in: "", check_out: "", source: "", net_payout: 0, status: "Confirmed" });

  const load = async () => {
    try {
      const data: ManualReservation[] = await getAdminReservations(adminPin);
      const enriched = data
        .map((r) => {
          const prop = properties.find((p) => p.id === r.property_id);
          return { ...r, property_name: prop?.name || "Unknown", currency: prop?.currency || "EUR" };
        })
        .sort((a, b) => a.check_in.localeCompare(b.check_in));
      setReservations(enriched);
    } catch {
      toast.error("Failed to load reservations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (properties.length > 0) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this reservation?")) return;
    try {
      await deleteReservation(adminPin, id);
      toast.success("Deleted");
      load();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleEdit = (r: ManualReservation) => {
    setEditingId(r.id);
    setForm({
      guest_name: r.guest_name,
      check_in: r.check_in,
      check_out: r.check_out,
      source: r.source,
      net_payout: r.net_payout,
      status: r.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingId) return;
    try {
      await updateReservation(adminPin, editingId, form);
      toast.success("Reservation updated");
      setDialogOpen(false);
      setEditingId(null);
      load();
    } catch {
      toast.error("Failed to update");
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

  if (loading) {
    return <p className="text-muted-foreground text-sm py-4">Loading master list...</p>;
  }

  if (reservations.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-4">No manual reservations across any property.</p>
    );
  }

  const filteredReservations = selectedProperty
    ? reservations.filter((r) => r.property_id === selectedProperty)
    : reservations;

  const editingReservation = editingId ? reservations.find((r) => r.id === editingId) : null;

  return (
    <div className="space-y-3">
      <select
        value={selectedProperty}
        onChange={(e) => setSelectedProperty(e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
      >
        <option value="">All Properties</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      <div className="space-y-2">
      {filteredReservations.map((r, i) => (
         <motion.div
          key={r.id}
          initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: i * 0.04, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className={`flex items-center justify-between rounded-lg border border-border p-3 sm:p-4 ${r.is_blocked ? "bg-muted/50 opacity-70" : "bg-card"}`}
        >
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-medium text-sm truncate ${r.is_blocked ? "line-through text-muted-foreground" : ""}`}>{r.guest_name}</span>
              {r.is_blocked ? (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">Blocked</span>
              ) : statusBadge(r.status)}
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{r.property_name}</span>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              <span>
                {format(parseISO(r.check_in), "MMM d")} – {format(parseISO(r.check_out), "MMM d, yyyy")}
              </span>
              <span>·</span>
              <span>{r.source}</span>
              {!r.is_blocked && (
                <>
                  <span>·</span>
                  <span className="font-medium">{r.net_payout} {r.currency}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-1 shrink-0 ml-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              title="Edit"
              onClick={() => handleEdit(r)}
            >
              <Pencil className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 ${r.is_blocked ? "text-zinc-500" : "text-muted-foreground"}`}
              title={r.is_blocked ? "Unblock" : "Mark as Blocked"}
              onClick={async () => {
                try {
                  await updateReservation(adminPin, r.id, { is_blocked: !r.is_blocked });
                  toast.success(r.is_blocked ? "Unblocked" : "Marked as blocked");
                  load();
                } catch { toast.error("Failed to update"); }
              }}
            >
              <Ban className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(r.id)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </motion.div>
      ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Reservation</DialogTitle>
          </DialogHeader>
          {editingReservation && (
            <p className="text-xs text-muted-foreground">Property: {editingReservation.property_name}</p>
          )}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Guest Name</Label>
              <Input value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Check-in</Label>
                <Input type="date" value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Check-out</Label>
                <Input type="date" value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Source</Label>
                <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option>Confirmed</option>
                  <option>Paid</option>
                  <option>Cancelled</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Net Payout</Label>
              <Input type="number" value={form.net_payout} onChange={(e) => setForm({ ...form, net_payout: Number(e.target.value) })} className="h-8 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
