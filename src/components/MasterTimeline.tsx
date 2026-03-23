import { useState, useEffect, useMemo, useCallback } from "react";
import { addDays, format, startOfDay, differenceInDays, parseISO, isToday } from "date-fns";
import { getAdminTimeline } from "@/lib/api";
import { toast } from "sonner";
import { TimelineBar } from "./TimelineBar";
import { TimelineFilters } from "./TimelineFilters";
import { TimelineDetailModal } from "./TimelineDetailModal";
import { TimelineLegend } from "./TimelineLegend";

interface Props {
  adminPin: string;
}

export function MasterTimeline({ adminPin }: Props) {
  const [rangeDays, setRangeDays] = useState(14);
  const [rangeStart, setRangeStart] = useState(() => startOfDay(new Date()));
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [selectedProperties, setSelectedProperties] = useState<Set<string>>(new Set());
  const [selectedCleaner, setSelectedCleaner] = useState("");
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const rangeEnd = useMemo(() => addDays(rangeStart, rangeDays), [rangeStart, rangeDays]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAdminTimeline(adminPin, format(rangeStart, "yyyy-MM-dd"), format(rangeEnd, "yyyy-MM-dd"));
      setData(result);
      // Select all properties by default
      if (selectedProperties.size === 0 && result.properties?.length) {
        setSelectedProperties(new Set(result.properties.map((p: any) => p.id)));
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load timeline");
    } finally {
      setLoading(false);
    }
  }, [adminPin, rangeStart, rangeEnd]);

  useEffect(() => { load(); }, [load]);

  const cleanerPropertyMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    (data?.access || []).forEach((a: any) => {
      if (!map.has(a.user_id)) map.set(a.user_id, new Set());
      map.get(a.user_id)!.add(a.property_id);
    });
    return map;
  }, [data?.access]);

  const visibleProperties = useMemo(() => {
    let props = data?.properties || [];
    if (selectedCleaner && cleanerPropertyMap.has(selectedCleaner)) {
      const cleanerProps = cleanerPropertyMap.get(selectedCleaner)!;
      props = props.filter((p: any) => cleanerProps.has(p.id));
    }
    return props.filter((p: any) => selectedProperties.has(p.id));
  }, [data?.properties, selectedProperties, selectedCleaner, cleanerPropertyMap]);

  const propertyNameMap = useMemo(() => {
    const m = new Map<string, string>();
    (data?.properties || []).forEach((p: any) => m.set(p.id, p.name));
    return m;
  }, [data?.properties]);

  // Merge reservations + bookings per property
  const reservationsByProperty = useMemo(() => {
    const map = new Map<string, any[]>();
    (data?.reservations || []).forEach((r: any) => {
      if (!map.has(r.property_id)) map.set(r.property_id, []);
      map.get(r.property_id)!.push(r);
    });
    (data?.bookings || []).forEach((b: any) => {
      if (!map.has(b.property_id)) map.set(b.property_id, []);
      map.get(b.property_id)!.push({
        ...b,
        check_in: b.start_date,
        check_out: b.end_date,
        guest_name: b.summary || "iCal Booking",
      });
    });
    return map;
  }, [data?.reservations, data?.bookings]);

  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < rangeDays; i++) arr.push(addDays(rangeStart, i));
    return arr;
  }, [rangeStart, rangeDays]);

  const toggleProperty = (id: string) => {
    setSelectedProperties((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBarClick = (res: any, propertyId: string) => {
    setSelectedReservation({ ...res, property_name: propertyNameMap.get(propertyId) });
    setModalOpen(true);
  };

  const todayOffset = differenceInDays(startOfDay(new Date()), rangeStart);

  return (
    <div className="space-y-4">
      <TimelineFilters
        rangeStart={rangeStart}
        rangeDays={rangeDays}
        onPrev={() => setRangeStart((s) => addDays(s, -rangeDays))}
        onNext={() => setRangeStart((s) => addDays(s, rangeDays))}
        onToday={() => setRangeStart(startOfDay(new Date()))}
        onRangeChange={setRangeDays}
        properties={data?.properties || []}
        selectedProperties={selectedProperties}
        onToggleProperty={toggleProperty}
        cleaners={data?.users || []}
        selectedCleaner={selectedCleaner}
        onCleanerChange={setSelectedCleaner}
        cleanerPropertyMap={cleanerPropertyMap}
      />

      <TimelineLegend />

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">Loading timeline…</div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            <div
              className="min-w-[600px]"
              style={{
                display: "grid",
                gridTemplateColumns: `minmax(120px, 150px) repeat(${rangeDays}, minmax(60px, 1fr))`,
              }}
            >
              {/* Header row */}
              <div className="sticky left-0 z-20 bg-muted border-b border-r border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
                Property
              </div>
              {days.map((d, i) => (
                <div
                  key={i}
                  className={`border-b border-r border-border px-1 py-2 text-center text-[11px] font-medium ${
                    isToday(d) ? "bg-primary/10 text-primary font-bold" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <div>{format(d, "EEE")}</div>
                  <div>{format(d, "d")}</div>
                </div>
              ))}

              {/* Property rows */}
              {visibleProperties.map((prop: any) => {
                const propReservations = reservationsByProperty.get(prop.id) || [];
                // Overlap detection: assign row indices
                const sorted = [...propReservations].sort((a: any, b: any) => {
                  const aStart = a.check_in || a.start_date || "";
                  const bStart = b.check_in || b.start_date || "";
                  return aStart.localeCompare(bStart);
                });
                const rows: number[] = [];
                const ends: string[] = []; // track end dates per row
                sorted.forEach((r: any) => {
                  const rStart = r.check_in || r.start_date || "";
                  let placed = false;
                  for (let i = 0; i < ends.length; i++) {
                    if (rStart >= ends[i]) {
                      rows.push(i);
                      ends[i] = r.check_out || r.end_date || "";
                      placed = true;
                      break;
                    }
                  }
                  if (!placed) {
                    rows.push(ends.length);
                    ends.push(r.check_out || r.end_date || "");
                  }
                });
                const totalRows = Math.max(1, ends.length);
                const rowHeight = Math.max(40, totalRows * 24);

                return (
                  <div key={prop.id} className="contents">
                    <div className="sticky left-0 z-10 bg-card border-b border-r border-border px-3 py-2 text-sm font-medium text-foreground truncate flex items-center">
                      {prop.name}
                    </div>
                    <div
                      className="relative border-b border-border"
                      style={{ gridColumn: `2 / span ${rangeDays}`, minHeight: `${rowHeight}px` }}
                    >
                      <div className="absolute inset-0 flex">
                        {days.map((d, i) => (
                          <div
                            key={i}
                            className={`flex-1 border-r border-border ${isToday(d) ? "bg-primary/5" : ""}`}
                          />
                        ))}
                      </div>
                      {todayOffset >= 0 && todayOffset < rangeDays && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-primary z-[5]"
                          style={{ left: `${((todayOffset + 0.5) / rangeDays) * 100}%` }}
                        />
                      )}
                      {sorted.map((r: any, idx: number) => (
                        <TimelineBar
                          key={r.id}
                          reservation={r}
                          rangeStart={rangeStart}
                          totalDays={rangeDays}
                          onClick={() => handleBarClick(r, prop.id)}
                          rowIndex={rows[idx]}
                          totalRows={totalRows}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {visibleProperties.length === 0 && (
                <div
                  className="col-span-full text-center py-8 text-muted-foreground text-sm"
                >
                  No properties to display
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <TimelineDetailModal
        reservation={selectedReservation}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}
