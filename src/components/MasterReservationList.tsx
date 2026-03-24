import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { List, Pencil, Trash2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

  return (
    <div className="space-y-2">
      {reservations.map((r, i) => (
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
  );
}
