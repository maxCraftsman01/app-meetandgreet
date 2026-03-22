import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Key, FileText,
  AlertTriangle, Clock, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCleanerSchedule, markAsCleaned } from "@/lib/api";
import { toast } from "sonner";
import {
  format, startOfWeek, endOfWeek, addWeeks, subWeeks,
  startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths,
  getDay, isToday, parseISO,
} from "date-fns";
import type { PropertyAccess } from "@/lib/session";

interface CalendarEvent {
  date: string;
  property_id: string;
  property_name: string;
  status: string;
  guest_name: string | null;
  check_out_guest: string | null;
  reservation_id: string | null;
  keybox_code: string | null;
  cleaning_notes: string | null;
}

interface Props {
  pin: string;
  userProperties: PropertyAccess[];
  onMarkCleaned: (reservationId: string) => Promise<void>;
  markingId: string | null;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; dot: string; border: string; label: string; icon: typeof AlertTriangle }> = {
  "same-day":        { color: "text-red-700",     bg: "bg-red-50",     dot: "bg-red-500",     border: "border-red-200",     label: "Same-Day Turnover",    icon: AlertTriangle },
  "checkout-only":   { color: "text-yellow-700",  bg: "bg-yellow-50",  dot: "bg-yellow-500",  border: "border-yellow-200",  label: "Check-out Only",       icon: Clock },
  "arrival-pending": { color: "text-orange-700",  bg: "bg-orange-50",  dot: "bg-orange-500",  border: "border-orange-200",  label: "Arrival Pending Clean", icon: Clock },
  "arrival-ready":   { color: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-500", border: "border-emerald-200", label: "Ready for Arrival",    icon: CheckCircle2 },
};

const PROPERTY_COLORS = [
  "hsl(220, 70%, 55%)", "hsl(340, 65%, 50%)", "hsl(160, 55%, 42%)",
  "hsl(30, 75%, 50%)", "hsl(270, 55%, 55%)", "hsl(190, 60%, 45%)",
  "hsl(50, 70%, 45%)", "hsl(0, 60%, 50%)",
];

export default function CleaningCalendar({ pin, userProperties, onMarkCleaned, markingId }: Props) {
  const [view, setView] = useState<"week" | "month">("week");
  const [refDate, setRefDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const cleaningPropertyIds = userProperties.filter((p) => p.can_view_cleaning).map((p) => p.id);

  const range = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(refDate, { weekStartsOn: 1 });
      const end = endOfWeek(refDate, { weekStartsOn: 1 });
      return { start, end };
    }
    return { start: startOfMonth(refDate), end: endOfMonth(refDate) };
  }, [view, refDate]);

  const days = useMemo(() => eachDayOfInterval(range), [range]);

  useEffect(() => {
    loadSchedule();
  }, [range]);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const from = format(range.start, "yyyy-MM-dd");
      const to = format(range.end, "yyyy-MM-dd");
      const data = await getCleanerSchedule(pin, from, to);
      const filtered = (data as CalendarEvent[]).filter((e) => cleaningPropertyIds.includes(e.property_id));
      setEvents(filtered);
    } catch {
      toast.error("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  const propertyColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    const uniqueIds = [...new Set(events.map((e) => e.property_id))];
    uniqueIds.forEach((id, i) => {
      map[id] = PROPERTY_COLORS[i % PROPERTY_COLORS.length];
    });
    return map;
  }, [events]);

  const eventsForDay = (dateStr: string) => events.filter((e) => e.date === dateStr);

  const navigate = (dir: -1 | 1) => {
    if (view === "week") setRefDate(dir === 1 ? addWeeks(refDate, 1) : subWeeks(refDate, 1));
    else setRefDate(dir === 1 ? addMonths(refDate, 1) : subMonths(refDate, 1));
  };

  const headerLabel = view === "week"
    ? `${format(range.start, "MMM d")} – ${format(range.end, "MMM d, yyyy")}`
    : format(refDate, "MMMM yyyy");

  const monthStartPad = view === "month" ? getDay(range.start) : 0;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => { setView(v as "week" | "month"); setExpandedDay(null); }}>
          <TabsList className="h-9">
            <TabsTrigger value="week" className="text-xs px-3">Week</TabsTrigger>
            <TabsTrigger value="month" className="text-xs px-3">Month</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[160px] text-center">{headerLabel}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs ml-1" onClick={() => { setRefDate(new Date()); setExpandedDay(null); }}>
            Today
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">Loading schedule…</div>
      ) : (
        <>
          {/* Week View */}
          {view === "week" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              <div className="grid grid-cols-7 gap-1">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                ))}
                {days.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsForDay(dateStr);
                  const isExpanded = expandedDay === dateStr;
                  const todayRing = isToday(day) ? "ring-2 ring-primary ring-offset-1" : "";

                  return (
                    <div
                      key={dateStr}
                      onClick={() => setExpandedDay(isExpanded ? null : dateStr)}
                      className={`min-h-[100px] rounded-lg border border-border bg-card p-2 cursor-pointer hover:bg-accent/30 transition-colors duration-150 ${todayRing}`}
                    >
                      <div className="text-xs font-medium text-muted-foreground mb-1.5">
                        {format(day, "d")}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.map((evt, i) => {
                          const cfg = STATUS_CONFIG[evt.status];
                          if (!cfg) return null;
                          return (
                            <div
                              key={`${evt.property_id}-${i}`}
                              className={`text-[10px] leading-tight rounded px-1.5 py-1 font-medium truncate ${cfg.bg} ${cfg.color} border ${cfg.border}`}
                              style={{ borderLeftWidth: 3, borderLeftColor: propertyColorMap[evt.property_id] }}
                              title={`${evt.property_name} – ${cfg.label}`}
                            >
                              {evt.property_name}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Month View */}
          {view === "month" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              <div className="grid grid-cols-7 gap-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                ))}
                {Array.from({ length: monthStartPad }).map((_, i) => <div key={`pad-${i}`} />)}
                {days.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsForDay(dateStr);
                  const isExpanded = expandedDay === dateStr;
                  const todayRing = isToday(day) ? "ring-2 ring-primary ring-offset-1" : "";
                  const hasEvents = dayEvents.length > 0;

                  return (
                    <div
                      key={dateStr}
                      onClick={() => hasEvents ? setExpandedDay(isExpanded ? null : dateStr) : null}
                      className={`aspect-square rounded-lg border flex flex-col items-center justify-center gap-1 text-sm font-medium transition-colors duration-150 ${todayRing} ${hasEvents ? "cursor-pointer hover:bg-accent/30 border-border bg-card" : "border-transparent text-muted-foreground"}`}
                    >
                      {format(day, "d")}
                      {hasEvents && (
                        <div className="flex gap-0.5 flex-wrap justify-center">
                          {dayEvents.map((evt, i) => {
                            const cfg = STATUS_CONFIG[evt.status];
                            return (
                              <div
                                key={`${evt.property_id}-${i}`}
                                className={`w-2 h-2 rounded-full ${cfg?.dot || "bg-muted-foreground"}`}
                                title={`${evt.property_name} – ${cfg?.label}`}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Expanded Day Details */}
          {expandedDay && (
            <motion.div
              initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card className="p-5 border-2 border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">
                    {format(parseISO(expandedDay), "EEEE, MMMM d")}
                  </h3>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setExpandedDay(null)}>
                    Close
                  </Button>
                </div>
                {eventsForDay(expandedDay).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks this day.</p>
                ) : (
                  <div className="space-y-3">
                    {eventsForDay(expandedDay).map((evt, i) => {
                      const cfg = STATUS_CONFIG[evt.status] || STATUS_CONFIG["arrival-pending"];
                      const Icon = cfg.icon;
                      const taskAccess = userProperties.find((p) => p.id === evt.property_id);
                      const canMark = taskAccess?.can_mark_cleaned ?? false;

                      return (
                        <div
                          key={`${evt.property_id}-${i}`}
                          className={`p-4 rounded-lg border-2 ${cfg.border} ${cfg.bg}`}
                          style={{ borderLeftWidth: 4, borderLeftColor: propertyColorMap[evt.property_id] }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className={`w-4 h-4 ${cfg.color}`} />
                            <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                          </div>
                          <h4 className="font-semibold text-base">{evt.property_name}</h4>
                          <div className="space-y-1.5 text-sm mt-2">
                            {evt.check_out_guest && (
                              <p className="text-muted-foreground"><span className="font-medium text-foreground">Departing:</span> {evt.check_out_guest}</p>
                            )}
                            {evt.guest_name && (
                              <p className="text-muted-foreground"><span className="font-medium text-foreground">Arriving:</span> {evt.guest_name}</p>
                            )}
                            {evt.keybox_code && (
                              <div className="flex items-center gap-1.5">
                                <Key className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="font-mono font-medium">{evt.keybox_code}</span>
                              </div>
                            )}
                            {evt.cleaning_notes && (
                              <div className="flex items-start gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                                <span className="text-muted-foreground">{evt.cleaning_notes}</span>
                              </div>
                            )}
                          </div>
                          {canMark && evt.reservation_id && evt.status !== "arrival-ready" && (
                            <div className="mt-3">
                              <Button size="sm" className="w-full" onClick={() => onMarkCleaned(evt.reservation_id!)} disabled={markingId === evt.reservation_id}>
                                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                {markingId === evt.reservation_id ? "Updating…" : "Mark as Cleaned"}
                              </Button>
                            </div>
                          )}
                          {evt.status === "arrival-ready" && (
                            <div className="mt-3 flex items-center gap-2 text-emerald-700">
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="text-sm font-medium">Cleaning completed</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground pt-2">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                <span>{cfg.label}</span>
              </div>
            ))}
          </div>

          {/* Property color legend */}
          {Object.keys(propertyColorMap).length > 1 && (
            <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
              {Object.entries(propertyColorMap).map(([id, color]) => {
                const name = events.find((e) => e.property_id === id)?.property_name || id;
                return (
                  <div key={id} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                    <span>{name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
