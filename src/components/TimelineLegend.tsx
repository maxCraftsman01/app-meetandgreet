export function TimelineLegend() {
  const items = [
    { label: "Blocked", className: "stripe-blocked border border-border" },
    { label: "Turnover", className: "bg-red-100 border border-red-300" },
    { label: "Checkout", className: "bg-yellow-100 border border-yellow-300" },
    { label: "Check-in", className: "bg-orange-100 border border-orange-300" },
    { label: "Cleaned", className: "bg-emerald-100 border border-emerald-300" },
    { label: "Paid", className: "bg-emerald-50 border border-emerald-200" },
    { label: "Confirmed", className: "bg-amber-50 border border-amber-200" },
    { label: "Cancelled", className: "bg-red-50 border border-red-200" },
  ];

  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div className={`w-4 h-3 rounded-sm ${item.className}`} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
