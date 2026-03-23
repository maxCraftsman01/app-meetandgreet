import { useMemo } from "react";
import { differenceInDays, parseISO, isEqual, format } from "date-fns";

interface TimelineBarProps {
  reservation: {
    id: string;
    guest_name?: string;
    summary?: string;
    check_in?: string;
    check_out?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
    cleaning_status?: string;
    is_blocked?: boolean;
    source?: string;
    net_payout?: number;
  };
  rangeStart: Date;
  totalDays: number;
  onClick: () => void;
}

function getBarColor(res: TimelineBarProps["reservation"]): string {
  if (res.is_blocked) return "bg-muted text-muted-foreground border-border";
  const cleanStatus = res.cleaning_status || "";
  if (cleanStatus === "cleaned") return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (cleanStatus === "pending") {
    const checkIn = res.check_in || res.start_date || "";
    const checkOut = res.check_out || res.end_date || "";
    const today = format(new Date(), "yyyy-MM-dd");
    if (checkOut === today && checkIn === today) return "bg-red-100 text-red-800 border-red-300";
    if (checkOut === today) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (checkIn === today) return "bg-orange-100 text-orange-800 border-orange-300";
  }
  const status = (res.status || "").toLowerCase();
  if (status === "paid") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "cancelled") return "bg-red-50 text-red-600 border-red-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export function TimelineBar({ reservation, rangeStart, totalDays, onClick }: TimelineBarProps) {
  const { leftPct, widthPct, label } = useMemo(() => {
    const startStr = reservation.check_in || reservation.start_date || "";
    const endStr = reservation.check_out || reservation.end_date || "";
    const start = parseISO(startStr);
    const end = parseISO(endStr);

    const offsetDays = Math.max(0, differenceInDays(start, rangeStart));
    const spanDays = Math.max(1, differenceInDays(end, start));
    const clampedOffset = Math.min(offsetDays, totalDays);
    const clampedSpan = Math.min(spanDays, totalDays - clampedOffset);

    return {
      leftPct: (clampedOffset / totalDays) * 100,
      widthPct: (clampedSpan / totalDays) * 100,
      label: reservation.guest_name || reservation.summary || (reservation.is_blocked ? "Blocked" : "Booking"),
    };
  }, [reservation, rangeStart, totalDays]);

  const colorClasses = getBarColor(reservation);

  return (
    <div
      className={`absolute top-1 bottom-1 rounded border cursor-pointer truncate px-1.5 flex items-center text-[11px] font-medium transition-opacity hover:opacity-80 ${colorClasses}`}
      style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: "20px" }}
      onClick={onClick}
      title={label}
    >
      <span className="truncate">{label}</span>
    </div>
  );
}
