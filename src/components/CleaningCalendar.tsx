import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Key, FileText, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCleanerSchedule, markAsCleaned } from "@/lib/api";
import { toast } from "sonner";
import {
  format, startOfWeek, endOfWeek, addWeeks, subWeeks,
  startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths,
  getDay, isToday, parseISO,
} from "date-fns";
import type { PropertyAccess } from "@/lib/session";
import type { CalendarEvent, Expense } from "@/types";
import { CLEANING_STATUS_CONFIG, CLEANING_STATUS_PRIORITY, PROPERTY_COLORS } from "@/lib/status-config";

interface Props {
  pin: string;
  userProperties: PropertyAccess[];
  onMarkCleaned: (reservationId: string) => Promise<void>;
  onRevertCleaning?: (reservationId: string) => Promise<void>;
  markingId: string | null;
  view: "week" | "month";
  adhocExpenses?: Expense[];
}

export default function CleaningCalendar({ pin, userProperties, onMarkCleaned, onRevertCleaning, markingId, view, adhocExpenses = [] }: Props) {
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

  const adhocForDay = (dateStr: string) =>
    adhocExpenses.filter(
      (e) => e.date === dateStr && cleaningPropertyIds.includes(e.property_id)
    );

  const navigate = (dir: -1 | 1) => {
    if (view === "week") setRefDate(dir === 1 ? addWeeks(refDate, 1) : subWeeks(refDate, 1));
    else setRefDate(dir === 1 ? addMonths(refDate, 1) : subMonths(refDate, 1));
  };

  const headerLabel = view === "week"
    ? `${format(range.start, "MMM d")} – ${format(range.end, "MMM d, yyyy")}`
    : format(refDate, "MMMM yyyy");

  const monthStartPad = view === "month" ? getDay(range.start) : 0;

  const getHighestPriorityStatus = (dayEvents: CalendarEvent[]) => {
    if (dayEvents.length === 0) return null;
    let best = dayEvents[0].status;
    let bestPriority = CLEANING_STATUS_PRIORITY[best] ?? 99;
    for (const evt of dayEvents) {
      const p = CLEANING_STATUS_PRIORITY[evt.status] ?? 99;
      if (p < bestPriority) {
        best = evt.status;
        bestPriority = p;
      }
    }
    return best;
  };

  return (
    <Card className="p-6 space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">{headerLabel}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-10 w-10 sm:h-9 sm:w-9 rounded-full" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-5 h-5 sm:w-4 sm:h-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-10 sm:h-9 px-4 text-sm font-medium" onClick={() => { setRefDate(new Date()); setExpandedDay(null); }}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10 sm:h-9 sm:w-9 rounded-full" onClick={() => navigate(1)}>
            <ChevronRight className="w-5 h-5 sm:w-4 sm:h-4" />
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
                  const dayAdhoc = adhocForDay(dateStr);
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
                          const cfg = CLEANING_STATUS_CONFIG[evt.status];
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
                        {dayAdhoc.map((exp) => {
                          const propName = userProperties.find((p) => p.id === exp.property_id)?.name ?? "Property";
                          return (
                            <div
                              key={`adhoc-${exp.id}`}
                              className="text-[10px] leading-tight rounded px-1.5 py-1 font-medium truncate bg-amber-50 text-amber-700 border border-amber-300 flex items-center gap-1"
                              title={`Ad-hoc: ${exp.title} – ${propName}`}
                            >
                              <Receipt className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{exp.title}</span>
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
                  const todayRing = isToday(day) ? "ring-2 ring-foreground ring-offset-1" : "";
                  const hasEvents = dayEvents.length > 0;
                  const topStatus = getHighestPriorityStatus(dayEvents);
                  const cfg = topStatus ? CLEANING_STATUS_CONFIG[topStatus] : null;

                  const cellStyle = hasEvents && cfg
                    ? `${cfg.cellBg} ${cfg.cellBorder} ${cfg.cellText} cursor-pointer hover:opacity-80 border-2`
                    : "border-transparent text-muted-foreground";

                  return (
                    <div
                      key={dateStr}
                      onClick={() => hasEvents ? setExpandedDay(isExpanded ? null : dateStr) : null}
                      className={`relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors duration-150 ${todayRing} ${cellStyle}`}
                    >
                      <span className={hasEvents ? "font-bold" : "font-medium"}>{format(day, "d")}</span>
                      {hasEvents && cfg && (
                        <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-3/5 rounded-full ${cfg.dot}`} />
                      )}
                      {dayEvents.length > 1 && (
                        <Badge variant="secondary" className="absolute top-0.5 right-0.5 h-4 min-w-[16px] px-1 text-[10px] leading-none">
                          {dayEvents.length}
                        </Badge>
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
                      const cfg = CLEANING_STATUS_CONFIG[evt.status] || CLEANING_STATUS_CONFIG["arrival-pending"];
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
                            <div className="mt-3 flex items-center justify-between">
                              <div className="flex items-center gap-2 text-emerald-700">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-sm font-medium">Cleaning completed</span>
                              </div>
                              {canMark && evt.reservation_id && onRevertCleaning && (
                                <Button variant="outline" size="sm" onClick={() => onRevertCleaning(evt.reservation_id!)} disabled={markingId === evt.reservation_id}>
                                  {markingId === evt.reservation_id ? "Updating…" : "Mark as Pending"}
                                </Button>
                              )}
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
            {Object.entries(CLEANING_STATUS_CONFIG).filter(([key]) => key !== "idle").map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`w-4 h-4 rounded-sm ${cfg.cellBg} border-2 ${cfg.cellBorder}`} />
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
    </Card>
  );
}
