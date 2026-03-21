import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, DollarSign, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  getAdminReservations,
  createReservation,
  getAdminPendingIcal,
} from "@/lib/api";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface ICalEvent {
  summary: string;
  start_date: string;
  end_date: string;
  source_url: string | null;
  property_id: string;
  property_name: string;
  currency: string;
  external_id: string;
}

interface Props {
  adminPin: string;
  properties: { id: string; name: string; currency: string }[];
  propertyId?: string;
}

const STATUSES = ["Confirmed", "Paid"];

function detectPlatform(sourceUrl: string | null): string {
  if (!sourceUrl) return "Direct";
  const url = sourceUrl.toLowerCase();
  if (url.includes("airbnb")) return "Airbnb";
  if (url.includes("booking.com")) return "Booking.com";
  if (url.includes("vrbo") || url.includes("homeaway")) return "Vrbo";
  return "Other";
}

export function PendingPayouts({ adminPin, properties, propertyId }: Props) {
  const [pendingEvents, setPendingEvents] = useState<ICalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [convertDialog, setConvertDialog] = useState<ICalEvent | null>(null);
  const [payout, setPayout] = useState("");
  const [status, setStatus] = useState("Confirmed");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAdminPendingIcal(adminPin);
      // Enrich with property info
      const enriched = (data || []).map((evt: any) => {
        const prop = properties.find((p) => p.id === evt.property_id);
        return {
          ...evt,
          property_name: prop?.name || "Unknown",
          currency: prop?.currency || "EUR",
          external_id: `${evt.property_id}_${evt.start_date}_${evt.end_date}`,
        };
      });
      const filtered = propertyId
        ? enriched.filter((e: ICalEvent) => e.property_id === propertyId)
        : enriched;
      setPendingEvents(filtered);
    } catch {
      toast.error("Failed to load pending events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (properties.length > 0) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties]);

  const handleConvert = async () => {
    if (!convertDialog) return;
    setSaving(true);
    try {
      await createReservation(adminPin, {
        property_id: convertDialog.property_id,
        guest_name: convertDialog.summary || "Guest",
        check_in: convertDialog.start_date,
        check_out: convertDialog.end_date,
        source: detectPlatform(convertDialog.source_url),
        net_payout: parseFloat(payout) || 0,
        status,
        external_id: convertDialog.external_id,
      });
      toast.success("Reservation confirmed");
      setConvertDialog(null);
      setPayout("");
      setStatus("Confirmed");
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Loading pending events...
      </div>
    );
  }

  if (pendingEvents.length === 0) {
    return (
      <div className="text-center py-12">
        <Check className="w-8 h-8 mx-auto mb-3 text-status-available" />
        <p className="text-muted-foreground text-sm">All caught up! No pending iCal events need confirmation.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <AnimatePresence>
          {pendingEvents.map((evt, i) => {
            const platform = detectPlatform(evt.source_url);
            return (
              <motion.div
                key={evt.external_id}
                initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.04, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3 sm:p-4"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{evt.summary || "Guest"}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-800">
                      Pending
                    </span>
                    {!propertyId && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {evt.property_name}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>
                      {format(parseISO(evt.start_date), "MMM d")} – {format(parseISO(evt.end_date), "MMM d, yyyy")}
                    </span>
                    <span>·</span>
                    <span>{platform}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="shrink-0 ml-2 h-8 text-xs"
                  onClick={() => {
                    setConvertDialog(evt);
                    setPayout("");
                    setStatus("Confirmed");
                  }}
                >
                  <DollarSign className="w-3 h-3 mr-1" />
                  Add Payout
                </Button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <Dialog open={!!convertDialog} onOpenChange={(o) => { if (!o) setConvertDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Reservation</DialogTitle>
          </DialogHeader>
          {convertDialog && (
            <div className="grid gap-3 py-2">
              <div>
                <Label className="text-muted-foreground text-xs">Guest</Label>
                <p className="font-medium">{convertDialog.summary || "Guest"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-muted-foreground text-xs">Check-in</Label>
                  <p className="font-medium">{format(parseISO(convertDialog.start_date), "MMM d, yyyy")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Check-out</Label>
                  <p className="font-medium">{format(parseISO(convertDialog.end_date), "MMM d, yyyy")}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-muted-foreground text-xs">Source</Label>
                  <p className="font-medium">{detectPlatform(convertDialog.source_url)}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
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
                <Label>Net Payout ({convertDialog.currency})</Label>
                <Input
                  type="number"
                  value={payout}
                  onChange={(e) => setPayout(e.target.value)}
                  placeholder="Enter payout amount"
                  autoFocus
                />
              </div>
              <Button onClick={handleConvert} disabled={saving}>
                {saving ? "Saving..." : "Confirm & Save"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
