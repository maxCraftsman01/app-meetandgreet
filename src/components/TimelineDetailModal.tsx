import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";

interface Reservation {
  id: string;
  guest_name?: string;
  summary?: string;
  check_in?: string;
  check_out?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  cleaning_status?: string;
  is_blocked?: boolean;
  source?: string;
  net_payout?: number;
  property_name?: string;
}

interface TimelineDetailModalProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "paid") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Paid</Badge>;
  if (s === "cancelled") return <Badge className="bg-red-100 text-red-700 border-red-200">Cancelled</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 border-amber-200">{status}</Badge>;
}

function cleaningBadge(status: string) {
  if (status === "cleaned") return <Badge className="bg-emerald-100 text-emerald-800">Cleaned</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
}

export function TimelineDetailModal({ reservation, open, onOpenChange }: TimelineDetailModalProps) {
  if (!reservation) return null;
  const r = reservation;
  const checkIn = r.check_in || r.start_date || "";
  const checkOut = r.check_out || r.end_date || "";
  const name = r.guest_name || r.summary || (r.is_blocked ? "Blocked" : "Booking");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {name}
            {r.is_blocked && <Badge variant="outline">Blocked</Badge>}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {r.property_name && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Property</span>
              <span className="font-medium">{r.property_name}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Check-in</span>
            <span>{checkIn ? format(parseISO(checkIn), "MMM d, yyyy") : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Check-out</span>
            <span>{checkOut ? format(parseISO(checkOut), "MMM d, yyyy") : "—"}</span>
          </div>
          {r.source && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Source</span>
              <span>{r.source}</span>
            </div>
          )}
          {r.status && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              {statusBadge(r.status)}
            </div>
          )}
          {r.cleaning_status && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Cleaning</span>
              {cleaningBadge(r.cleaning_status)}
            </div>
          )}
          {r.net_payout != null && r.net_payout > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payout</span>
              <span className="font-medium">€{r.net_payout}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
