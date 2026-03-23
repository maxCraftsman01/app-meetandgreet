import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LogOut, RefreshCw, ChevronLeft, ChevronRight, Building2,
  CheckCircle2, Key, FileText, AlertTriangle, Clock, Sparkles,
  DollarSign, Brush,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getSession, clearSession, type PropertyAccess } from "@/lib/session";
import { getOwnerData, fetchIcal, getCleanerTasks, markAsCleaned } from "@/lib/api";
import CleaningCalendar from "@/components/CleaningCalendar";
import { toast } from "sonner";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths,
  getDay, isToday, differenceInDays, parseISO, isWithinInterval, startOfDay, endOfDay,
} from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// ─── Types ──────────────────────────────────────────
interface Booking {
  id: string; property_id: string; summary: string; start_date: string; end_date: string; status: string; source_url: string | null;
}
interface ManualReservation {
  id: string; property_id: string; guest_name: string; check_in: string; check_out: string; source: string; net_payout: number; status: string;
}
interface Property {
  id: string; name: string; owner_name: string; nightly_rate: number; currency: string; ical_urls: string[];
}
interface CleanerTask {
  property_id: string; property_name: string; keybox_code: string; cleaning_notes: string;
  status: "idle" | "same-day" | "checkout-only" | "arrival-pending" | "arrival-ready";
  reservation_id: string | null; guest_name: string | null; check_in: string | null; check_out_guest: string | null;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: typeof AlertTriangle }> = {
  "same-day": { color: "text-red-700", bg: "bg-red-50", border: "border-red-200", label: "Same-Day Turnover", icon: AlertTriangle },
  "checkout-only": { color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200", label: "Check-out Only", icon: Clock },
  "arrival-pending": { color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", label: "Arrival Pending Clean", icon: Clock },
  "arrival-ready": { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", label: "Ready for Arrival", icon: CheckCircle2 },
  idle: { color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border", label: "No Activity Today", icon: Sparkles },
};

const PLATFORM_COLORS: Record<string, string> = {
  Airbnb: "hsl(356 100% 58%)", "Booking.com": "hsl(220 80% 50%)", Vrbo: "hsl(200 70% 48%)",
  Direct: "hsl(var(--status-available))", Other: "hsl(var(--muted-foreground))",
};

// ─── Component ──────────────────────────────────────
const Dashboard = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [manualReservations, setManualReservations] = useState<ManualReservation[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [cleanerTasks, setCleanerTasks] = useState<CleanerTask[]>([]);
  const [cleaningLoading, setCleaningLoading] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<{ date: Date; info: any } | null>(null);

  useEffect(() => {
    if (!session || session.role !== "user") {
      navigate("/");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userProperties = session?.properties || [];
  const selectedAccess = userProperties.find((p) => p.id === selectedPropertyId);
  const hasFinance = selectedAccess?.can_view_finance ?? false;
  const hasCleaning = selectedAccess?.can_view_cleaning ?? false;
  const canMark = selectedAccess?.can_mark_cleaned ?? false;

  // Determine which tabs are available globally (any property)
  const hasAnyFinance = userProperties.some((p) => p.can_view_finance);
  const hasAnyCleaning = userProperties.some((p) => p.can_view_cleaning);

  const loadData = async () => {
    try {
      const data = await getOwnerData(session!.pin);
      setProperties(data.properties);
      setBookings(data.bookings);
      setManualReservations(data.manual_reservations || []);
      if (data.properties.length > 0 && !selectedPropertyId) {
        setSelectedPropertyId(data.properties[0].id);
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadCleaningTasks = async () => {
    setCleaningLoading(true);
    try {
      const data = await getCleanerTasks(session!.pin);
      setCleanerTasks(data);
    } catch {
      toast.error("Failed to load cleaning tasks");
    } finally {
      setCleaningLoading(false);
    }
  };

  const handleSync = async () => {
    if (!selectedPropertyId) return;
    setSyncing(true);
    try {
      const result = await fetchIcal(selectedPropertyId, session!.pin);
      setBookings((prev) => [
        ...prev.filter((b) => b.property_id !== selectedPropertyId),
        ...(result.bookings || []),
      ]);
      toast.success(`Synced ${result.synced} events`);
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleMarkCleaned = async (reservationId: string) => {
    setMarkingId(reservationId);
    try {
      await markAsCleaned(session!.pin, reservationId);
      toast.success("Marked as cleaned!");
      loadCleaningTasks();
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

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const propertyBookings = bookings.filter((b) => b.property_id === selectedPropertyId);
  const propertyManual = manualReservations.filter((r) => r.property_id === selectedPropertyId);

  // Calendar logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);

  const getDayInfo = (day: Date) => {
    for (const r of propertyManual) {
      if (r.status === "Cancelled") continue;
      const start = startOfDay(parseISO(r.check_in));
      const end = startOfDay(parseISO(r.check_out));
      if (isWithinInterval(day, { start, end: endOfDay(end) })) {
        return { status: "booked", label: `${r.guest_name} (${r.source})`, isManual: true, isPending: false, reservation: r };
      }
    }
    for (const b of propertyBookings) {
      const start = startOfDay(parseISO(b.start_date));
      const end = startOfDay(parseISO(b.end_date));
      if (isWithinInterval(day, { start, end: endOfDay(end) })) {
        if (b.status === "blocked") return { status: "blocked", label: "Blocked", isManual: false, isPending: false };
        return { status: "booked", label: `${b.summary || "Booked"} (Pending Verification)`, isManual: false, isPending: true, booking: b };
      }
    }
    return { status: "available", label: "Available", isManual: false, isPending: false };
  };

  const financials = useMemo(() => {
    if (!selectedProperty) return null;
    const activeManual = propertyManual.filter((r) => r.status !== "Cancelled");
    const totalRevenue = activeManual.reduce((sum, r) => sum + r.net_payout, 0);
    const totalNights = activeManual.reduce((sum, r) => sum + Math.max(0, differenceInDays(parseISO(r.check_out), parseISO(r.check_in))), 0);
    return { reservations: activeManual.length, totalNights, occupancy: Math.round((totalNights / 365) * 100), totalRevenue };
  }, [selectedPropertyId, propertyManual, selectedProperty]);

  const chartData = useMemo(() => {
    if (!selectedProperty) return [];
    const year = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, i) => {
      const m = new Date(year, i, 1);
      const mDays = eachDayOfInterval({ start: startOfMonth(m), end: endOfMonth(m) });
      let booked = 0;
      for (const day of mDays) {
        for (const r of propertyManual) {
          if (r.status === "Cancelled") continue;
          if (isWithinInterval(day, { start: startOfDay(parseISO(r.check_in)), end: endOfDay(startOfDay(parseISO(r.check_out))) })) { booked++; break; }
        }
      }
      return { month: format(m, "MMM"), occupancy: Math.round((booked / mDays.length) * 100) };
    });
  }, [selectedPropertyId, propertyManual, selectedProperty]);

  const recentPayouts = useMemo(() => {
    return [...propertyManual].filter((r) => r.status !== "Cancelled").sort((a, b) => b.check_in.localeCompare(a.check_in)).slice(0, 10);
  }, [propertyManual]);

  const statusColors: Record<string, string> = {
    booked: "bg-status-booked-light border-status-booked text-status-booked",
    available: "bg-status-available-light border-status-available text-status-available",
    blocked: "bg-status-blocked-light border-status-blocked text-status-blocked",
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Loading...</div>;
  }

  // Filter cleaning tasks to only properties this user has cleaning access to
  const cleaningPropertyIds = userProperties.filter((p) => p.can_view_cleaning).map((p) => p.id);
  const filteredTasks = cleanerTasks.filter((t) => cleaningPropertyIds.includes(t.property_id));
  const priority: Record<string, number> = { "same-day": 0, "checkout-only": 1, "arrival-pending": 2, "arrival-ready": 3, idle: 4 };
  const sortedTasks = [...filteredTasks].sort((a, b) => (priority[a.status] ?? 5) - (priority[b.status] ?? 5));
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // Default tab
  const defaultTab = hasAnyFinance ? "finance" : "cleaning";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container px-4">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-base sm:text-lg leading-tight">Dashboard</h1>
                {session?.user_name && (
                  <p className="text-xs text-muted-foreground">{session.user_name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasFinance && (
                <Button variant="outline" size="sm" className="h-10 w-10 sm:h-9 sm:w-auto sm:px-3" onClick={handleSync} disabled={syncing}>
                  <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline ml-1.5">Sync</span>
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-10 w-10" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {properties.length > 1 && (
            <div className="pb-3 sm:pb-0 sm:-mt-1 sm:mb-0">
              <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                <SelectTrigger className="w-full sm:w-48 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </header>

      <main className="container px-4 py-6 sm:py-8 pb-24">
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="h-11 sm:h-10">
            {hasAnyFinance && (
              <TabsTrigger value="finance" className="h-9 px-4 text-sm sm:h-8 sm:px-3 sm:text-xs">
                <DollarSign className="w-4 h-4 mr-1.5" />
                Finance
              </TabsTrigger>
            )}
            {hasAnyCleaning && (
              <TabsTrigger value="cleaning" className="h-9 px-4 text-sm sm:h-8 sm:px-3 sm:text-xs" onClick={() => { if (cleanerTasks.length === 0) loadCleaningTasks(); }}>
                <Brush className="w-4 h-4 mr-1.5" />
                Cleaning
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── Finance Tab ─────────────────────────── */}
          {hasAnyFinance && (
            <TabsContent value="finance" className="space-y-8">
              {!hasFinance && selectedAccess ? (
                <Card className="p-8 text-center text-muted-foreground">
                  <p>You don't have finance access for this property.</p>
                </Card>
              ) : (
                <>
                  {/* Calendar */}
                  <motion.div initial={{ opacity: 0, y: 16, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
                    <Card className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentMonth(new Date())}>Today</Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                        ))}
                        {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
                        {days.map((day) => {
                          const info = getDayInfo(day);
                          const pendingStyle = info.isPending ? "bg-orange-100 border-orange-400 text-orange-700" : statusColors[info.status];
                          const isClickable = info.isManual || info.isPending;
                          return (
                            <div key={day.toISOString()} title={info.label}
                              onClick={() => isClickable ? setSelectedDay({ date: day, info }) : null}
                              className={`relative aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-colors duration-150 ${pendingStyle} ${isToday(day) ? "ring-2 ring-foreground ring-offset-1" : ""} border ${isClickable ? "cursor-pointer hover:opacity-80" : ""}`}
                            >
                              {format(day, "d")}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border flex-wrap">
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-status-booked-light border border-status-booked" /><span className="text-xs text-muted-foreground">Confirmed</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-100 border border-orange-400" /><span className="text-xs text-muted-foreground">Pending</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-status-available-light border border-status-available" /><span className="text-xs text-muted-foreground">Available</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-status-blocked-light border border-status-blocked" /><span className="text-xs text-muted-foreground">Blocked</span></div>
                      </div>
                      {selectedDay && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 pt-4 border-t border-border">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold">{selectedDay.info.reservation?.guest_name || selectedDay.info.booking?.summary || "Guest"}</p>
                              <p className="text-xs text-muted-foreground">{format(selectedDay.date, "MMMM d, yyyy")}</p>
                              {selectedDay.info.reservation && (
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                  <span>{selectedDay.info.reservation.source}</span>
                                  <span>·</span>
                                  <span className="font-medium text-foreground">{selectedDay.info.reservation.net_payout.toLocaleString()} {selectedProperty?.currency}</span>
                                  <span>·</span>
                                  <span className={`px-1.5 py-0.5 rounded-full font-medium ${selectedDay.info.reservation.status === "Paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{selectedDay.info.reservation.status}</span>
                                </div>
                              )}
                              {selectedDay.info.isPending && <p className="text-xs text-orange-600 font-medium mt-1">Pending admin verification</p>}
                            </div>
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setSelectedDay(null)}>Close</Button>
                          </div>
                        </motion.div>
                      )}
                    </Card>
                  </motion.div>

                  {/* Financial Summary */}
                  {financials && selectedProperty && (
                    <motion.div initial={{ opacity: 0, y: 16, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[
                          { label: "Reservations", value: financials.reservations },
                          { label: "Nights Booked", value: financials.totalNights },
                          { label: "Occupancy", value: `${financials.occupancy}%` },
                          { label: "Total Revenue", value: `${financials.totalRevenue.toLocaleString()} ${selectedProperty.currency}` },
                        ].map((s) => (
                          <Card key={s.label} className="p-4 sm:p-5">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{s.label}</p>
                            <p className="text-2xl sm:text-3xl font-semibold tabular-nums">{s.value}</p>
                          </Card>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Recent Payouts */}
                  {recentPayouts.length > 0 && selectedProperty && (
                    <motion.div initial={{ opacity: 0, y: 16, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
                      <Card className="p-6">
                        <h3 className="font-semibold mb-4">Recent Payouts</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead><tr className="border-b border-border text-left">
                              <th className="pb-2 font-medium text-muted-foreground">Guest</th>
                              <th className="pb-2 font-medium text-muted-foreground">Dates</th>
                              <th className="pb-2 font-medium text-muted-foreground">Source</th>
                              <th className="pb-2 font-medium text-muted-foreground">Status</th>
                              <th className="pb-2 font-medium text-muted-foreground text-right">Payout</th>
                            </tr></thead>
                            <tbody>
                              {recentPayouts.map((r) => (
                                <tr key={r.id} className="border-b border-border/50 last:border-0">
                                  <td className="py-2.5 font-medium">{r.guest_name}</td>
                                  <td className="py-2.5 text-muted-foreground">{format(parseISO(r.check_in), "MMM d")} – {format(parseISO(r.check_out), "MMM d")}</td>
                                  <td className="py-2.5 text-muted-foreground">{r.source}</td>
                                  <td className="py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === "Paid" ? "bg-emerald-100 text-emerald-800" : r.status === "Confirmed" ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}`}>{r.status}</span></td>
                                  <td className="py-2.5 text-right font-medium tabular-nums">{r.net_payout.toLocaleString()} {selectedProperty.currency}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </motion.div>
                  )}

                  {/* Chart */}
                  {chartData.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 16, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
                      <Card className="p-6">
                        <h3 className="font-semibold mb-4">Monthly Occupancy</h3>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} domain={[0, 100]} unit="%" />
                              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "13px" }} formatter={(value: number) => [`${value}%`, "Occupancy"]} />
                              <Bar dataKey="occupancy" fill="hsl(var(--status-available))" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>
                    </motion.div>
                  )}
                </>
              )}
            </TabsContent>
          )}

          {/* ── Cleaning Tab ─────────────────────────── */}
          {hasAnyCleaning && (
            <TabsContent value="cleaning" className="space-y-6">
              <Tabs defaultValue="today" className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <TabsList className="h-11 sm:h-9">
                    <TabsTrigger value="today" className="h-9 px-4 text-sm sm:h-7 sm:px-3 sm:text-xs" onClick={() => { if (cleanerTasks.length === 0) loadCleaningTasks(); }}>Today</TabsTrigger>
                    <TabsTrigger value="calendar" className="h-9 px-4 text-sm sm:h-7 sm:px-3 sm:text-xs">Week / Month</TabsTrigger>
                  </TabsList>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-10 sm:h-9" onClick={loadCleaningTasks}>
                      <RefreshCw className="w-4 h-4 mr-1.5" />
                      Refresh
                    </Button>
                  </div>
                </div>

                {/* Today View */}
                <TabsContent value="today" className="space-y-4 mt-0">
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                    <p className="text-sm text-muted-foreground">{today}</p>
                  </motion.div>

                  {cleaningLoading ? (
                    <div className="flex justify-center py-20 text-muted-foreground">Loading...</div>
                  ) : sortedTasks.length === 0 ? (
                    <Card className="p-8 text-center text-muted-foreground">
                      <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-40" />
                      <p>No cleaning tasks for today.</p>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {sortedTasks.map((task, i) => {
                        const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.idle;
                        const Icon = cfg.icon;
                        const taskAccess = userProperties.find((p) => p.id === task.property_id);
                        const taskCanMark = taskAccess?.can_mark_cleaned ?? false;
                        return (
                          <motion.div key={task.property_id}
                            initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            transition={{ delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                          >
                            <Card className={`p-5 sm:p-5 border-2 ${cfg.border} ${cfg.bg} transition-colors duration-300`}>
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                                    <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                                  </div>
                                  <h3 className="font-semibold text-lg">{task.property_name}</h3>
                                </div>
                              </div>
                              <div className="space-y-2 text-sm">
                                {task.check_out_guest && <p className="text-muted-foreground"><span className="font-medium text-foreground">Departing:</span> {task.check_out_guest}</p>}
                                {task.guest_name && <p className="text-muted-foreground"><span className="font-medium text-foreground">Arriving:</span> {task.guest_name}</p>}
                                {task.keybox_code && <div className="flex items-center gap-1.5"><Key className="w-3.5 h-3.5 text-muted-foreground" /><span className="font-mono font-medium">{task.keybox_code}</span></div>}
                                {task.cleaning_notes && <div className="flex items-start gap-1.5"><FileText className="w-3.5 h-3.5 text-muted-foreground mt-0.5" /><span className="text-muted-foreground">{task.cleaning_notes}</span></div>}
                              </div>
                              {taskCanMark && task.reservation_id && task.status !== "arrival-ready" && (
                                <div className="mt-4">
                                  <Button className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleMarkCleaned(task.reservation_id!)} disabled={markingId === task.reservation_id}>
                                    <CheckCircle2 className="w-5 h-5 mr-2" />
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
                    </div>
                  )}
                </TabsContent>

                {/* Week/Month Calendar View */}
                <TabsContent value="calendar" className="mt-0">
                  <CleaningCalendar
                    pin={session!.pin}
                    userProperties={userProperties}
                    onMarkCleaned={handleMarkCleaned}
                    markingId={markingId}
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
