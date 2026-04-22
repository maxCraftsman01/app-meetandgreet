import { useMemo } from "react";
import { differenceInDays, parseISO, format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  rowIndex?: number;
  totalRows?: number;
}

function getBarColor(res: TimelineBarProps["reservation"]): string {
  // Blocked / unavailable → striped grey
  if (res.is_blocked || (res.summary || "").toLowerCase().includes("not available")) {
    return "stripe-blocked border-border";
  }

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
  if (status === "cancelled" || status === "cancelled-ical") return "bg-red-50 text-red-600 border-red-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function getSourceLabel(source?: string): string | null {
  if (!source) return null;
  const s = source.toLowerCase();
  if (s.includes("airbnb")) return "Airbnb";
  if (s.includes("booking")) return "Booking";
  if (s.includes("ical")) return "iCal";
  if (s === "manual") return "Manual";
  return null;
}

export function TimelineBar({ reservation, rangeStart, totalDays, onClick, rowIndex = 0, totalRows = 1 }: TimelineBarProps) {
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
  const sourceLabel = getSourceLabel(reservation.source);

  const checkIn = reservation.check_in || reservation.start_date || "";
  const checkOut = reservation.check_out || reservation.end_date || "";

  // Stacking: divide row height among overlapping bars
  const heightPct = totalRows > 1 ? `${100 / totalRows}%` : "calc(100% - 4px)";
  const topPx = totalRows > 1 ? `${(rowIndex / totalRows) * 100}%` : "2px";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`absolute rounded border cursor-pointer truncate px-1.5 flex items-center text-[11px] font-medium transition-opacity hover:opacity-80 ${colorClasses}`}
            style={{
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              minWidth: "20px",
              top: topPx,
              height: heightPct,
            }}
            onClick={onClick}
          >
            <span className="truncate">
              {sourceLabel && <span className="opacity-60 mr-1">{sourceLabel}</span>}
              {label}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[220px]">
          <p className="font-semibold">{label}</p>
          <p className="text-muted-foreground">{checkIn} → {checkOut}</p>
          {reservation.status && <p>Status: {reservation.status}</p>}
          {reservation.cleaning_status && <p>Cleaning: {reservation.cleaning_status}</p>}
          {sourceLabel && <p>Source: {sourceLabel}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
