import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Bell, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDailyOperations, adminMarkCleaned, adminResetCleaningStatus } from "@/lib/api";
import { toast } from "sonner";
import type { PropertyStatus } from "@/types";
import { CLEANING_STATUS_CONFIG, CLEANING_STATUS_PRIORITY } from "@/lib/status-config";

const DOT_COLORS = Object.fromEntries(
  Object.entries(CLEANING_STATUS_CONFIG).map(([k, v]) => [k, v.dot])
);
const STATUS_LABELS = Object.fromEntries(
  Object.entries(CLEANING_STATUS_CONFIG).map(([k, v]) => [k, v.label])
);

export function DailyOperations({ adminPin }: { adminPin: string }) {
  const [properties, setProperties] = useState<PropertyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getDailyOperations(adminPin);
      setProperties(data);
    } catch {
      toast.error("Failed to load daily operations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNotifyOwner = (prop: PropertyStatus) => {
    toast.success(`Notification sent to ${prop.owner_name}: ${prop.name} is ready!`);
  };

  const handleMarkCleaned = async (prop: PropertyStatus) => {
    const resId = prop.arrival_reservation?.id;
    if (!resId) return;
    setMarkingId(resId);
    try {
      await adminMarkCleaned(adminPin, resId);
      toast.success(`${prop.name} marked as cleaned`);
      await load();
    } catch {
      toast.error("Failed to update cleaning status");
    } finally {
      setMarkingId(null);
    }
  };

  const handleRevertCleaning = async (prop: PropertyStatus) => {
    const resId = prop.arrival_reservation?.id;
    if (!resId) return;
    setMarkingId(resId);
    try {
      await adminResetCleaningStatus(adminPin, resId);
      toast.success(`${prop.name} reverted to pending`);
      await load();
    } catch {
      toast.error("Failed to revert cleaning status");
    } finally {
      setMarkingId(null);
    }
  };

  const counts = {
    "same-day": properties.filter((p) => p.status === "same-day").length,
    "checkout-only": properties.filter((p) => p.status === "checkout-only").length,
    "arrival-pending": properties.filter((p) => p.status === "arrival-pending").length,
    "arrival-ready": properties.filter((p) => p.status === "arrival-ready").length,
    idle: properties.filter((p) => p.status === "idle").length,
  };

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  if (loading) {
    return <div className="flex justify-center py-12 text-muted-foreground">Loading...</div>;
  }

  const cleaningNeeded = properties.filter((p) => p.status === "same-day" || p.status === "arrival-pending");
  const readyForGuest = properties.filter((p) => p.status === "arrival-ready");
  const otherActivity = properties.filter((p) => p.status === "checkout-only");

  const priority: Record<string, number> = { "same-day": 0, "arrival-pending": 1 };
  cleaningNeeded.sort((a, b) => (priority[a.status] ?? 2) - (priority[b.status] ?? 2));

  const allSorted = [...properties].sort(
    (a, b) => (CLEANING_STATUS_PRIORITY[a.status] ?? 5) - (CLEANING_STATUS_PRIORITY[b.status] ?? 5)
  );

  const renderCard = (p: PropertyStatus, i: number) => {
    return (
      <motion.div
        key={p.id}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.06, duration: 0.4 }}
      >
        <Card className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full shrink-0 ${DOT_COLORS[p.status]}`} />
            <div>
              <p className="font-medium text-sm">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {STATUS_LABELS[p.status]}
                {p.arrival_reservation && ` · ${p.arrival_reservation.guest_name}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {(p.status === "same-day" || p.status === "arrival-pending") && p.arrival_reservation?.id && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={markingId === p.arrival_reservation.id}
                onClick={() => handleMarkCleaned(p)}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                {markingId === p.arrival_reservation.id ? "Updating..." : "Confirm Cleaning"}
              </Button>
            )}
            {p.status === "arrival-ready" && (
              <>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => handleRevertCleaning(p)} disabled={markingId === p.arrival_reservation?.id}>
                  {markingId === p.arrival_reservation?.id ? "Updating..." : "Revert to Pending"}
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => handleNotifyOwner(p)}>
                  <Bell className="w-3.5 h-3.5 mr-1" />
                  Notify Owner
                </Button>
              </>
            )}
          </div>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Daily Operations</h3>
          <p className="text-sm text-muted-foreground">{today}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Summary counters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(["same-day", "checkout-only", "arrival-pending", "arrival-ready", "idle"] as const).map((status) => (
          <Card key={status} className="p-3 text-center">
            <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${DOT_COLORS[status]}`} />
            <p className="text-2xl font-semibold tabular-nums">{counts[status]}</p>
            <p className="text-xs text-muted-foreground">{STATUS_LABELS[status]}</p>
          </Card>
        ))}
      </div>

      {/* Live Map */}
      <Card className="p-5">
        <h4 className="text-sm font-medium mb-4">Property Map</h4>
        <div className="flex flex-wrap gap-3">
          {allSorted.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04, duration: 0.4 }}
              className="group relative"
            >
              <div
                className={`w-10 h-10 rounded-full ${DOT_COLORS[p.status]} flex items-center justify-center text-white text-xs font-bold cursor-default transition-transform duration-150 hover:scale-110`}
                title={`${p.name}: ${STATUS_LABELS[p.status]}`}
              >
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                <div className="bg-card border border-border rounded-lg shadow-lg p-3 whitespace-nowrap text-xs">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-muted-foreground">{STATUS_LABELS[p.status]}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* Cleaning Needed section */}
      {cleaningNeeded.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Cleaning Needed ({cleaningNeeded.length})
          </h4>
          {cleaningNeeded.map((p, i) => renderCard(p, i))}
        </div>
      )}

      {/* Ready for Guest section */}
      {readyForGuest.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Ready for Guest ({readyForGuest.length})
          </h4>
          {readyForGuest.map((p, i) => renderCard(p, i))}
        </div>
      )}

      {/* Other Activity section */}
      {otherActivity.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-500" />
            Check-outs Only ({otherActivity.length})
          </h4>
          {otherActivity.map((p, i) => renderCard(p, i))}
        </div>
      )}
    </div>
  );
}
