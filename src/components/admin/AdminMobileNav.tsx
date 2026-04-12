import { MoreHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface TabDef {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
}

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pinnedTabs: TabDef[];
  moreTabs: TabDef[];
  moreSheetOpen: boolean;
  setMoreSheetOpen: (open: boolean) => void;
}

export function AdminMobileNav({ activeTab, setActiveTab, pinnedTabs, moreTabs, moreSheetOpen, setMoreSheetOpen }: Props) {
  return (
    <>
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-background border-t border-border z-50 flex justify-around items-stretch pb-[env(safe-area-inset-bottom)]">
        {pinnedTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 h-14 gap-0.5 transition-colors relative ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {isActive && <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />}
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.shortLabel}</span>
            </button>
          );
        })}
        <button
          onClick={() => setMoreSheetOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 h-14 gap-0.5 transition-colors ${
            moreTabs.some((t) => t.id === activeTab) ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>

      <Sheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen}>
        <SheetContent side="bottom" className="pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="py-2">
            {moreTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setMoreSheetOpen(false); }}
                  className={`flex items-center gap-3 w-full px-3 py-3 rounded-lg transition-colors ${
                    isActive ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/50"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
