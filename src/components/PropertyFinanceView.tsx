import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOwnerReservation } from "@/lib/api";
import { toast } from "sonner";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths,
  getDay, isToday, differenceInDays, parseISO, isWithinInterval, startOfDay, endOfDay,
  isBefore, isAfter, isSameDay
} from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

interface Booking {
  id: string; property_id: string; summary: string; start_date: string; end_date: string; status: string; source_url: string | null;
}
interface ManualReservation {
  id: string; property_id: string; guest_name: string; check_in: string; check_out: string; source: string; net_payout: number; status: string;
}
interface Property {
  id: string; name: string; owner_name: string; nightly_rate: number; currency: string; ical_urls: string[];
}

interface PropertyFinanceViewProps {
  property: Property;
  bookings: Booking[];
  manualReservations: ManualReservation[];
  pin: string;
  onDataChanged?: () => void;
}

export const PropertyFinanceView = ({ property, bookings, manualReservations, pin, onDataChanged }: PropertyFinanceViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<{ date: Date; info: any } | null>(null);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingType, setBookingType] = useState<"block" | "reservation">("block");
  const [bookingGuestName, setBookingGuestName] = useState("");
  const [bookingPayout, setBookingPayout] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  const propertyBookings = bookings.filter((b) => b.property_id === property.id);
  const propertyManual = manualReservations.filter((r) => r.property_id === property.id);

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

  const handleCalendarDayClick = (day: Date, info: any) => {
    if (info.isManual || info.isPending) {
      setSelectedDay({ date: day, info });
      return;
    }
    if (!rangeStart) {
      setRangeStart(day);
      setRangeEnd(null);
      setSelectedDay(null);
    } else if (isSameDay(day, rangeStart)) {
      setRangeStart(null);
      setRangeEnd(null);
    } else if (isBefore(day, rangeStart)) {
      setRangeStart(day);
      setRangeEnd(null);
    } else {
      setRangeEnd(day);
      setBookingDialogOpen(true);
    }
  };

  const cancelSelection = () => { setRangeStart(null); setRangeEnd(null); };

  const isInSelectedRange = (day: Date) => {
    if (!rangeStart) return false;
    if (rangeEnd) {
      return (isAfter(day, rangeStart) || isSameDay(day, rangeStart)) &&
             (isBefore(day, rangeEnd) || isSameDay(day, rangeEnd));
    }
    return isSameDay(day, rangeStart);
  };

  const handleBookingSubmit = async () => {
    if (!rangeStart || !rangeEnd) return;
    setBookingSubmitting(true);
    try {
      await createOwnerReservation(pin, {
        property_id: property.id,
        check_in: format(rangeStart, "yyyy-MM-dd"),
        check_out: format(rangeEnd, "yyyy-MM-dd"),
        is_blocked: bookingType === "block",
        guest_name: bookingType === "reservation" ? bookingGuestName || "Private Guest" : "Blocked",
        net_payout: bookingType === "reservation" ? parseFloat(bookingPayout) || 0 : 0,
      });
      toast.success(bookingType === "block" ? "Dates blocked!" : "Reservation added!");
      setBookingDialogOpen(false);
      setRangeStart(null);
      setRangeEnd(null);
      setBookingGuestName("");
      setBookingPayout("");
      onDataChanged?.();
    } catch {
      toast.error("Failed to save");
    } finally {
      setBookingSubmitting(false);
    }
  };

  const financials = useMemo(() => {
    const activeManual = propertyManual.filter((r) => r.status !== "Cancelled");
    const totalRevenue = activeManual.reduce((sum, r) => sum + r.net_payout, 0);
    const totalNights = activeManual.reduce((sum, r) => sum + Math.max(0, differenceInDays(parseISO(r.check_out), parseISO(r.check_in))), 0);
    return { reservations: activeManual.length, totalNights, occupancy: Math.round(totalNights / 365 * 100), totalRevenue };
  }, [propertyManual]);

  const chartData = useMemo(() => {
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
      return { month: format(m, "MMM"), occupancy: Math.round(booked / mDays.length * 100) };
    });
  }, [propertyManual]);

  const recentPayouts = useMemo(() => {
    return [...propertyManual].filter((r) => r.status !== "Cancelled").sort((a, b) => b.check_in.localeCompare(a.check_in)).slice(0, 10);
  }, [propertyManual]);

  const statusColors: Record<string, string> = {
    booked: "bg-status-booked-light border-status-booked text-status-booked",
    available: "bg-status-available-light border-status-available text-status-available",
    blocked: "bg-status-blocked-light border-status-blocked text-status-blocked"
  };

  return (
    <div className="space-y-8">
      {/* Calendar */}
      <motion.div initial={{ opacity: 0, y: 16, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-10 w-10 sm:h-9 sm:w-9 rounded-full" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="w-5 h-5 sm:w-4 sm:h-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-10 sm:h-9 px-4 text-sm font-medium" onClick={() => setCurrentMonth(new Date())}>Today</Button>
              <Button variant="outline" size="icon" className="h-10 w-10 sm:h-9 sm:w-9 rounded-full" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="w-5 h-5 sm:w-4 sm:h-4" />
              </Button>
            </div>
          </div>
          {rangeStart && (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs text-primary font-medium">
                Selecting: {format(rangeStart, "MMM d")}
                {rangeEnd ? ` → ${format(rangeEnd, "MMM d")}` : " → tap end date"}
              </span>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={cancelSelection}>
                <X className="w-3 h-3 mr-1" />Cancel
              </Button>
            </div>
          )}
          <div className="grid grid-cols-7 gap-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) =>
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            )}
            {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
            {days.map((day) => {
              const info = getDayInfo(day);
              const pendingStyle = info.isPending ? "bg-orange-100 border-orange-400 text-orange-700" : statusColors[info.status];
              const inRange = isInSelectedRange(day);
              const rangeHighlight = inRange ? "ring-2 ring-primary bg-primary/10" : "";
              const isClickable = info.isManual || info.isPending || info.status === "available";
              return (
                <div key={day.toISOString()} title={info.label}
                  onClick={() => handleCalendarDayClick(day, info)}
                  className={`relative aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-colors duration-150 ${pendingStyle} ${rangeHighlight} ${isToday(day) && !inRange ? "ring-2 ring-foreground ring-offset-1" : ""} border ${isClickable ? "cursor-pointer hover:opacity-80" : ""}`}>
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
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-primary/10 ring-1 ring-primary" /><span className="text-xs text-muted-foreground">Selected</span></div>
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
                      <span className="font-medium text-foreground">{selectedDay.info.reservation.net_payout.toLocaleString()} {property.currency}</span>
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
      <motion.div initial={{ opacity: 0, y: 16, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Reservations", value: financials.reservations },
            { label: "Nights Booked", value: financials.totalNights },
            { label: "Occupancy", value: `${financials.occupancy}%` },
            { label: "Total Revenue", value: `${financials.totalRevenue.toLocaleString()} ${property.currency}` }
          ].map((s) =>
            <Card key={s.label} className="p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{s.label}</p>
              <p className="text-2xl sm:text-3xl font-semibold tabular-nums">{s.value}</p>
            </Card>
          )}
        </div>
      </motion.div>

      {/* Recent Payouts */}
      {recentPayouts.length > 0 && (
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
                  {recentPayouts.map((r) =>
                    <tr key={r.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 font-medium">{r.guest_name}</td>
                      <td className="py-2.5 text-muted-foreground">{format(parseISO(r.check_in), "MMM d")} – {format(parseISO(r.check_out), "MMM d")}</td>
                      <td className="py-2.5 text-muted-foreground">{r.source}</td>
                      <td className="py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === "Paid" ? "bg-emerald-100 text-emerald-800" : r.status === "Confirmed" ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}`}>{r.status}</span></td>
                      <td className="py-2.5 text-right font-medium tabular-nums">{r.net_payout.toLocaleString()} {property.currency}</td>
                    </tr>
                  )}
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

      {/* Booking/Block Dialog */}
      <Dialog open={bookingDialogOpen} onOpenChange={(open) => {
        if (!open) { setBookingDialogOpen(false); setRangeStart(null); setRangeEnd(null); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {rangeStart && rangeEnd ? `${format(rangeStart, "MMM d")} → ${format(rangeEnd, "MMM d")}` : "Select dates"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button variant={bookingType === "block" ? "default" : "outline"} className="flex-1" onClick={() => setBookingType("block")}>
                Block Dates
              </Button>
              <Button variant={bookingType === "reservation" ? "default" : "outline"} className="flex-1" onClick={() => setBookingType("reservation")}>
                Private Reservation
              </Button>
            </div>
            {bookingType === "reservation" && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="guest-name">Guest Name</Label>
                  <Input id="guest-name" placeholder="Guest name" value={bookingGuestName} onChange={(e) => setBookingGuestName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="payout">Net Payout ({property.currency})</Label>
                  <Input id="payout" type="number" placeholder="0" value={bookingPayout} onChange={(e) => setBookingPayout(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBookingDialogOpen(false); setRangeStart(null); setRangeEnd(null); }}>Cancel</Button>
            <Button onClick={handleBookingSubmit} disabled={bookingSubmitting}>
              {bookingSubmitting ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
