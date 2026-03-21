import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Bell, CheckCircle2, AlertTriangle, Clock, Sparkles, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDailyOperations } from "@/lib/api";
import { toast } from "sonner";

interface PropertyStatus {
  id: string;
  name: string;
  owner_name: string;
  status: "idle" | "same-day" | "checkout-only" | "arrival-pending" | "arrival-ready";
  today_checkout: boolean;
  today_checkin: boolean;
  cleaning_done: boolean;
  arrival_reservation: any;
  keybox_code: string;
  cleaning_notes: string;
}

const DOT_COLORS: Record<string, string> = {
  "same-day": "bg-red-500",
  "checkout-only": "bg-yellow-500",
  "arrival-pending": "bg-orange-500",
  "arrival-ready": "bg-emerald-500",
  idle: "bg-muted-foreground/30",
};

const STATUS_LABELS: Record<string, string> = {
  "same-day": "Same-Day Turnover",
  "checkout-only": "Check-out Only",
  "arrival-pending": "Arrival Pending",
  "arrival-ready": "Ready",
  idle: "No Activity",
};

const STATUS_ICONS: Record<string, typeof AlertTriangle> = {
  "same-day": AlertTriangle,
  "checkout-only": Clock,
  "arrival-pending": Clock,
  "arrival-ready": CheckCircle2,
  idle: Sparkles,
};

export function DailyOperations({ adminPin }: { adminPin: string }) {
  const [properties, setProperties] = useState<PropertyStatus[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Sort: urgent first
  const priority: Record<string, number> = { "same-day": 0, "checkout-only": 1, "arrival-pending": 2, "arrival-ready": 3, idle: 4 };
  const sorted = [...properties].sort((a, b) => (priority[a.status] ?? 5) - (priority[b.status] ?? 5));

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

      {/* Live Map: colored dots grid */}
      <Card className="p-5">
        <h4 className="text-sm font-medium mb-4">Property Map</h4>
        <div className="flex flex-wrap gap-3">
          {sorted.map((p, i) => (
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

      {/* Detailed list */}
      <div className="space-y-3">
        {sorted.filter((p) => p.status !== "idle").map((p, i) => {
          const Icon = STATUS_ICONS[p.status] || Sparkles;
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
                {p.status === "arrival-ready" && (
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => handleNotifyOwner(p)}>
                    <Bell className="w-3.5 h-3.5 mr-1" />
                    Notify Owner
                  </Button>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
