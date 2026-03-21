import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LogOut,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Building2,
  CalendarDays,
  DollarSign,
  TrendingUp,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSession, clearSession } from "@/lib/session";
import { getOwnerData, fetchIcal } from "@/lib/api";
import { toast } from "sonner";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  getDay,
  isToday,
  isSameMonth,
  getDaysInMonth,
  differenceInDays,
  parseISO,
  isWithinInterval,
  startOfDay,
  endOfDay,
} from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Booking {
  id: string;
  property_id: string;
  summary: string;
  start_date: string;
  end_date: string;
  status: string;
  source_url: string | null;
}

interface Property {
  id: string;
  name: string;
  owner_name: string;
  nightly_rate: number;
  currency: string;
  ical_urls: string[];
}

const PLATFORM_COLORS: Record<string, string> = {
  Airbnb: "hsl(356 100% 58%)",
  "Booking.com": "hsl(220 80% 50%)",
  Vrbo: "hsl(200 70% 48%)",
  Direct: "hsl(var(--status-available))",
  Other: "hsl(var(--muted-foreground))",
};

function detectPlatform(sourceUrl: string | null): string {
  if (!sourceUrl) return "Direct";
  const url = sourceUrl.toLowerCase();
  if (url.includes("airbnb")) return "Airbnb";
  if (url.includes("booking.com")) return "Booking.com";
  if (url.includes("vrbo") || url.includes("homeaway")) return "Vrbo";
  return "Other";
}

function PlatformBreakdown({ bookings }: { bookings: Booking[] }) {
  const activeBookings = bookings.filter((b) => b.status !== "blocked");

  const platformStats = useMemo(() => {
    const map: Record<string, { count: number; nights: number }> = {};
    for (const b of activeBookings) {
      const platform = detectPlatform(b.source_url);
      if (!map[platform]) map[platform] = { count: 0, nights: 0 };
      map[platform].count++;
      const nights = Math.max(
        0,
        differenceInDays(parseISO(b.end_date), parseISO(b.start_date))
      );
      map[platform].nights += nights;
    }
    return Object.entries(map)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.nights - a.nights);
  }, [activeBookings]);

  const totalNights = platformStats.reduce((s, p) => s + p.nights, 0);

  if (platformStats.length === 0) {
    return <p className="text-sm text-muted-foreground">No bookings to analyze.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Bar visualization */}
      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
        {platformStats.map((p) => (
          <div
            key={p.name}
            style={{
              width: `${totalNights > 0 ? (p.nights / totalNights) * 100 : 0}%`,
              backgroundColor: PLATFORM_COLORS[p.name] || PLATFORM_COLORS.Other,
            }}
            className="transition-all duration-500"
          />
        ))}
      </div>

      {/* Platform rows */}
      <div className="space-y-3">
        {platformStats.map((p) => {
          const pct = totalNights > 0 ? Math.round((p.nights / totalNights) * 100) : 0;
          const color = PLATFORM_COLORS[p.name] || PLATFORM_COLORS.Other;
          return (
            <div key={p.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm font-medium">{p.name}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground tabular-nums">
                  {p.count} booking{p.count !== 1 ? "s" : ""}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {p.nights} night{p.nights !== 1 ? "s" : ""}
                </span>
                <span className="font-semibold tabular-nums w-12 text-right">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const Portal = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!session || session.role !== "owner") {
      navigate("/");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      const data = await getOwnerData(session!.pin);
      setProperties(data.properties);
      setBookings(data.bookings);
      if (data.properties.length > 0 && !selectedPropertyId) {
        setSelectedPropertyId(data.properties[0].id);
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
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

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const propertyBookings = bookings.filter((b) => b.property_id === selectedPropertyId);

  // Calendar logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart); // 0=Sun

  const getStatusForDay = (day: Date) => {
    for (const b of propertyBookings) {
      const start = startOfDay(parseISO(b.start_date));
      const end = startOfDay(parseISO(b.end_date));
      if (isWithinInterval(day, { start, end: endOfDay(end) })) {
        return b.status === "blocked" ? "blocked" : "booked";
      }
    }
    return "available";
  };

  // Financial summary
  const financials = useMemo(() => {
    if (!selectedProperty) return null;
    const daysInMonth = getDaysInMonth(currentMonth);
    let bookedNights = 0;

    for (const day of days) {
      const status = getStatusForDay(day);
      if (status === "booked") bookedNights++;
    }

    const occupancy = Math.round((bookedNights / daysInMonth) * 100);
    const revenue = bookedNights * selectedProperty.nightly_rate;

    return { bookedNights, occupancy, revenue, daysInMonth };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId, currentMonth, propertyBookings, selectedProperty]);

  // Chart data - full year (Jan–Dec)
  const chartData = useMemo(() => {
    if (!selectedProperty) return [];
    const months = [];
    const year = new Date().getFullYear();
    for (let i = 0; i < 12; i++) {
      const m = new Date(year, i, 1);
      const mStart = startOfMonth(m);
      const mEnd = endOfMonth(m);
      const mDays = eachDayOfInterval({ start: mStart, end: mEnd });
      let booked = 0;
      for (const day of mDays) {
        for (const b of propertyBookings) {
          const bStart = startOfDay(parseISO(b.start_date));
          const bEnd = startOfDay(parseISO(b.end_date));
          if (isWithinInterval(day, { start: bStart, end: endOfDay(bEnd) }) && b.status !== "blocked") {
            booked++;
            break;
          }
        }
      }
      months.push({
        month: format(m, "MMM"),
        occupancy: Math.round((booked / mDays.length) * 100),
      });
    }
    return months;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId, propertyBookings, selectedProperty]);

  const handleLogout = () => {
    clearSession();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading...
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    booked: "bg-status-booked-light border-status-booked text-status-booked",
    available: "bg-status-available-light border-status-available text-status-available",
    blocked: "bg-status-blocked-light border-status-blocked text-status-blocked",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="font-semibold text-lg">Owner Portal</h1>
          </div>
          <div className="flex items-center gap-2">
            {properties.length > 1 && (
              <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
              Sync
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-8 space-y-8">
        {/* Calendar */}
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentMonth(new Date())}>
                  Today
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {d}
                </div>
              ))}
              {Array.from({ length: startPad }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {days.map((day) => {
                const status = getStatusForDay(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`relative aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-colors duration-150 ${
                      statusColors[status]
                    } ${isToday(day) ? "ring-2 ring-foreground ring-offset-1" : ""} border`}
                  >
                    {format(day, "d")}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-status-booked-light border border-status-booked" />
                <span className="text-xs text-muted-foreground">Booked</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-status-available-light border border-status-available" />
                <span className="text-xs text-muted-foreground">Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-status-blocked-light border border-status-blocked" />
                <span className="text-xs text-muted-foreground">Blocked</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Financial Summary */}
        {financials && selectedProperty && (
          <motion.div
            initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-status-booked-light flex items-center justify-center">
                    <CalendarDays className="w-5 h-5 text-status-booked" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Booked Nights</p>
                    <p className="text-2xl font-semibold tabular-nums">
                      {financials.bookedNights}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{financials.daysInMonth}
                      </span>
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-status-available-light flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-status-available" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Occupancy</p>
                    <p className="text-2xl font-semibold tabular-nums">{financials.occupancy}%</p>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Est. Revenue</p>
                    <p className="text-2xl font-semibold tabular-nums">
                      {selectedProperty.currency === "EUR" ? "€" : selectedProperty.currency}{" "}
                      {financials.revenue.toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </motion.div>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Monthly Occupancy</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      domain={[0, 100]}
                      unit="%"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "13px",
                      }}
                      formatter={(value: number) => [`${value}%`, "Occupancy"]}
                    />
                    <Bar dataKey="occupancy" fill="hsl(var(--status-available))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Platform Breakdown */}
        {propertyBookings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Platform Breakdown</h3>
              <PlatformBreakdown bookings={propertyBookings} />
            </Card>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Portal;
