import { useState } from "react";
import { DollarSign, Brush, Wrench, MoreHorizontal, LogOut, RefreshCw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  hasAnyFinance: boolean;
  hasAnyCleaning: boolean;
  onLogout: () => void;
  onSync?: () => void;
  syncing?: boolean;
  onReportIssue?: () => void;
}

export default function BottomNav({
  activeTab,
  onTabChange,
  hasAnyFinance,
  hasAnyCleaning,
  onLogout,
  onSync,
  syncing,
  onReportIssue,
}: BottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const items: { key: string; label: string; icon: typeof DollarSign; show: boolean }[] = [
    { key: "finance", label: "Finance", icon: DollarSign, show: hasAnyFinance },
    { key: "cleaning", label: "Cleaning", icon: Brush, show: hasAnyCleaning },
    { key: "tickets", label: "Issues", icon: Wrench, show: hasAnyFinance },
  ];

  const visibleItems = items.filter((i) => i.show);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border pb-safe z-50 md:hidden">
      <div className="flex justify-around items-center h-16">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onTabChange(item.key)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}

        {/* More / Profile */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground transition-colors">
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-safe">
            <SheetHeader>
              <SheetTitle>More Actions</SheetTitle>
            </SheetHeader>
            <div className="space-y-2 mt-4">
              {onSync && hasAnyFinance && (
                <Button
                  variant="outline"
                  className="w-full justify-start h-12"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSync();
                    setMoreOpen(false);
                  }}
                  disabled={syncing}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                  Sync Calendar
                </Button>
              )}
              {onReportIssue && hasAnyCleaning && (
                <Button
                  variant="outline"
                  className="w-full justify-start h-12"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReportIssue();
                    setMoreOpen(false);
                  }}
                >
                  <Wrench className="w-4 h-4 mr-2" />
                  Report Issue
                </Button>
              )}
              <Button
                variant="ghost"
                className="w-full justify-start h-12 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onLogout();
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log Out
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
