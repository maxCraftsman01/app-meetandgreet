import { motion, AnimatePresence } from "framer-motion";
import { Copy, Pencil, Trash2, Check, BarChart3, ChevronDown, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ManageReservations } from "@/components/ManageReservations";
import { PendingPayouts } from "@/components/PendingPayouts";
import type { Property } from "@/types";

interface Props {
  properties: Property[];
  loading: boolean;
  adminPin: string;
  copiedId: string | null;
  pendingCounts: Record<string, number>;
  onEdit: (p: Property) => void;
  onDelete: (id: string) => void;
  onCopyLink: (pin: string, id: string) => void;
  onOpenFinance: (p: Property) => void;
  onAddClick: () => void;
}

export function PropertyGrid({
  properties, loading, adminPin, copiedId, pendingCounts,
  onEdit, onDelete, onCopyLink, onOpenFinance, onAddClick,
}: Props) {
  if (loading) {
    return <div className="flex justify-center py-20 text-muted-foreground">Loading...</div>;
  }

  if (properties.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
        <p className="text-muted-foreground mb-4">No properties yet. Add your first one.</p>
        <Button onClick={onAddClick}>
          <Plus className="w-4 h-4 mr-1.5" />Add Property
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence>
        {properties.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="p-5 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-sm text-muted-foreground">{p.owner_name}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenFinance(p)} title="View Dashboard">
                    <BarChart3 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(p)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(p.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{p.nightly_rate} {p.currency}/night</span>
                <span className="text-muted-foreground">{p.active_bookings} active booking{p.active_bookings !== 1 ? "s" : ""}</span>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <ManageReservations adminPin={adminPin} propertyId={p.id} propertyName={p.name} currency={p.currency} />
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full group">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Pending Payouts</span>
                      {(pendingCounts[p.id] || 0) > 0 && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-800">
                          {pendingCounts[p.id]}
                        </span>
                      )}
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <PendingPayouts
                      adminPin={adminPin}
                      properties={properties.map((pr) => ({ id: pr.id, name: pr.name, currency: pr.currency }))}
                      propertyId={p.id}
                    />
                  </CollapsibleContent>
                </Collapsible>
              </div>

              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-mono">{p.owner_pin}</code>
                <Button variant="ghost" size="sm" onClick={() => onCopyLink(p.owner_pin, p.id)}>
                  {copiedId === p.id ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copiedId === p.id ? "Copied" : "Copy Link"}
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
