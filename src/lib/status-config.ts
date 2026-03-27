import { AlertTriangle, Clock, CheckCircle2, Sparkles } from "lucide-react";

// ─── Cleaning Status Configuration ────────────────────────

export const CLEANING_STATUS_CONFIG: Record<string, {
  color: string;
  bg: string;
  dot: string;
  border: string;
  label: string;
  icon: typeof AlertTriangle;
  cellBg: string;
  cellBorder: string;
  cellText: string;
}> = {
  "same-day":        { color: "text-red-700",     bg: "bg-red-50",     dot: "bg-red-500",     border: "border-red-200",     label: "Same-Day Turnover",    icon: AlertTriangle, cellBg: "bg-red-100",     cellBorder: "border-red-300",     cellText: "text-red-800" },
  "checkout-only":   { color: "text-yellow-700",  bg: "bg-yellow-50",  dot: "bg-yellow-500",  border: "border-yellow-200",  label: "Check-out Only",       icon: Clock,         cellBg: "bg-yellow-100",  cellBorder: "border-yellow-300",  cellText: "text-yellow-800" },
  "arrival-pending": { color: "text-orange-700",  bg: "bg-orange-50",  dot: "bg-orange-500",  border: "border-orange-200",  label: "Arrival Pending Clean", icon: Clock,        cellBg: "bg-orange-100",  cellBorder: "border-orange-300",  cellText: "text-orange-800" },
  "arrival-ready":   { color: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-500", border: "border-emerald-200", label: "Ready for Arrival",    icon: CheckCircle2,  cellBg: "bg-emerald-100", cellBorder: "border-emerald-300", cellText: "text-emerald-800" },
  idle:              { color: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-400", border: "border-emerald-200", label: "No Activity Today", icon: Sparkles, cellBg: "bg-emerald-50", cellBorder: "border-emerald-200", cellText: "text-emerald-700" },
};

export const CLEANING_STATUS_PRIORITY: Record<string, number> = {
  "same-day": 0,
  "checkout-only": 1,
  "arrival-pending": 2,
  "arrival-ready": 3,
  idle: 4,
};

// ─── Ticket Status Configuration ──────────────────────────

export const TICKET_PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-100 text-blue-800",
  urgent: "bg-red-100 text-red-800",
};

export const TICKET_STATUS_ICONS: Record<string, typeof AlertTriangle> = {
  open: AlertTriangle,
  in_progress: Clock,
  resolved: CheckCircle2,
};

export const TICKET_STATUS_COLORS: Record<string, string> = {
  open: "bg-orange-100 text-orange-800",
  in_progress: "bg-blue-100 text-blue-800",
  resolved: "bg-emerald-100 text-emerald-800",
};

// ─── Property Colors (for calendar) ──────────────────────

export const PROPERTY_COLORS = [
  "hsl(220, 70%, 55%)", "hsl(340, 65%, 50%)", "hsl(160, 55%, 42%)",
  "hsl(30, 75%, 50%)", "hsl(270, 55%, 55%)", "hsl(190, 60%, 45%)",
  "hsl(50, 70%, 45%)", "hsl(0, 60%, 50%)",
];
