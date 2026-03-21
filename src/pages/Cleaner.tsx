import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, CheckCircle2, Key, FileText, AlertTriangle, Clock, Sparkles, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSession, clearSession } from "@/lib/session";
import { getCleanerTasks, markAsCleaned } from "@/lib/api";
import { toast } from "sonner";

interface CleanerTask {
  property_id: string;
  property_name: string;
  keybox_code: string;
  cleaning_notes: string;
  status: "idle" | "same-day" | "checkout-only" | "arrival-pending" | "arrival-ready";
  reservation_id: string | null;
  guest_name: string | null;
  check_in: string | null;
  check_out_guest: string | null;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: typeof AlertTriangle }> = {
  "same-day": {
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    label: "Same-Day Turnover",
    icon: AlertTriangle,
  },
  "checkout-only": {
    color: "text-yellow-700",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    label: "Check-out Only",
    icon: Clock,
  },
  "arrival-pending": {
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    label: "Arrival Pending Clean",
    icon: Clock,
  },
  "arrival-ready": {
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    label: "Ready for Arrival",
    icon: CheckCircle2,
  },
  idle: {
    color: "text-muted-foreground",
    bg: "bg-muted/50",
    border: "border-border",
    label: "No Activity Today",
    icon: Sparkles,
  },
};

const Cleaner = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [tasks, setTasks] = useState<CleanerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!session || session.role !== "cleaner") {
      navigate("/");
      return;
    }
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTasks = async () => {
    try {
      const data = await getCleanerTasks(session!.pin);
      setTasks(data);
    } catch {
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkCleaned = async (reservationId: string) => {
    setMarkingId(reservationId);
    try {
      await markAsCleaned(session!.pin, reservationId);
      toast.success("Marked as cleaned!");
      loadTasks();
    } catch {
      toast.error("Failed to update");
    } finally {
      setMarkingId(null);
    }
  };

  const handleLogout = () => {
    clearSession();
    navigate("/");
  };

  // Sort: same-day first, then checkout-only, arrival-pending, arrival-ready, idle last
  const priority: Record<string, number> = { "same-day": 0, "checkout-only": 1, "arrival-pending": 2, "arrival-ready": 3, idle: 4 };
  const sorted = [...tasks].sort((a, b) => (priority[a.status] ?? 5) - (priority[b.status] ?? 5));

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="font-semibold text-lg">Cleaner Portal</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="container px-4 py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-xl font-semibold mb-1">Today's Tasks</h2>
          <p className="text-sm text-muted-foreground">{today}</p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-20 text-muted-foreground">Loading...</div>
        ) : sorted.length === 0 ? (
          <p className="text-center py-20 text-muted-foreground">No properties assigned.</p>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {sorted.map((task, i) => {
                const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.idle;
                const Icon = cfg.icon;
                return (
                  <motion.div
                    key={task.property_id}
                    initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Card className={`p-5 border-2 ${cfg.border} ${cfg.bg} transition-colors duration-300`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={`w-4 h-4 ${cfg.color}`} />
                            <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </div>
                          <h3 className="font-semibold text-lg">{task.property_name}</h3>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 text-sm">
                        {task.check_out_guest && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Departing:</span> {task.check_out_guest}
                          </p>
                        )}
                        {task.guest_name && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Arriving:</span> {task.guest_name}
                          </p>
                        )}
                        {task.keybox_code && (
                          <div className="flex items-center gap-1.5">
                            <Key className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-mono font-medium">{task.keybox_code}</span>
                          </div>
                        )}
                        {task.cleaning_notes && (
                          <div className="flex items-start gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                            <span className="text-muted-foreground">{task.cleaning_notes}</span>
                          </div>
                        )}
                      </div>

                      {/* Action button */}
                      {task.reservation_id && task.status !== "arrival-ready" && (
                        <div className="mt-4">
                          <Button
                            className="w-full"
                            onClick={() => handleMarkCleaned(task.reservation_id!)}
                            disabled={markingId === task.reservation_id}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1.5" />
                            {markingId === task.reservation_id ? "Updating..." : "Mark as Cleaned"}
                          </Button>
                        </div>
                      )}

                      {task.status === "arrival-ready" && (
                        <div className="mt-4 flex items-center gap-2 text-emerald-700">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-sm font-medium">Cleaning completed</span>
                        </div>
                      )}
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
};

export default Cleaner;
