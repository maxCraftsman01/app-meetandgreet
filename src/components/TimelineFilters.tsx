import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from "lucide-react";
import { format } from "date-fns";

interface TimelineFiltersProps {
  rangeStart: Date;
  rangeDays: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onRangeChange: (days: number) => void;
  properties: { id: string; name: string }[];
  selectedProperties: Set<string>;
  onToggleProperty: (id: string) => void;
  cleaners: { id: string; name: string }[];
  selectedCleaner: string;
  onCleanerChange: (id: string) => void;
  cleanerPropertyMap: Map<string, Set<string>>;
}

export function TimelineFilters({
  rangeStart,
  rangeDays,
  onPrev,
  onNext,
  onToday,
  onRangeChange,
  properties,
  selectedProperties,
  onToggleProperty,
  cleaners,
  selectedCleaner,
  onCleanerChange,
}: TimelineFiltersProps) {
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + rangeDays - 1);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-card border border-border rounded-lg p-3">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onPrev}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday}>
          <CalIcon className="w-3.5 h-3.5 mr-1" />
          Today
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onNext}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium text-foreground ml-2">
          {format(rangeStart, "MMM d")} – {format(rangeEnd, "MMM d, yyyy")}
        </span>
      </div>

      {/* Range toggle */}
      <div className="flex items-center gap-1.5">
        {[7, 14, 30].map((d) => (
          <Button
            key={d}
            variant={rangeDays === d ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onRangeChange(d)}
          >
            {d === 7 ? "Week" : d === 14 ? "2 Weeks" : "Month"}
          </Button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={selectedCleaner}
          onChange={(e) => onCleanerChange(e.target.value)}
        >
          <option value="">All Cleaners</option>
          {cleaners.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {properties.length <= 10 && (
          <div className="flex items-center gap-1 flex-wrap">
            {properties.map((p) => (
              <button
                key={p.id}
                onClick={() => onToggleProperty(p.id)}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                  selectedProperties.has(p.id)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
