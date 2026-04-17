import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Pencil, Trash2, Check, BarChart3, ChevronDown, Clock, Plus, Settings2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
  const [manageProperty, setManageProperty] = useState<Property | null>(null);

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
    <>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {properties.map((p, i) => {
            const pending = pendingCounts[p.id] || 0;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <Card className="p-4 sm:p-5 hover:shadow-md transition-shadow duration-200 overflow-hidden">
                  {/* Header: name + owner */}
                  <div className="min-w-0 mb-3">
                    <h3 className="font-semibold text-base truncate">{p.name}</h3>
                    <p className="text-sm text-foreground/70 font-medium truncate">{p.owner_name}</p>
                  </div>

                  {/* Compact summary chips */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-muted text-foreground/80">
                      <CalendarDays className="w-3 h-3" />
                      Reservations: {p.active_bookings ?? 0}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                        pending > 0
                          ? "bg-orange-100 text-orange-800"
                          : "bg-muted text-foreground/60"
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      Pending payouts: {pending}
                    </span>
                  </div>

                  {/* Primary CTA */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="flex-1 min-w-0"
                      onClick={() => onOpenFinance(p)}
                    >
                      <BarChart3 className="w-4 h-4 mr-1.5 shrink-0" />
                      <span className="truncate">View Dashboard</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setManageProperty(p)}
                      aria-label="Manage property"
                    >
                      <Settings2 className="w-4 h-4 mr-1.5 shrink-0" />
                      Manage
                    </Button>
                  </div>

                  {/* Desktop / tablet: keep richer details inline (hidden on mobile) */}
                  <div className="hidden sm:block">
                    <div className="mt-4 pt-4 border-t border-border">
                      <ManageReservations
                        adminPin={adminPin}
                        propertyId={p.id}
                        propertyName={p.name}
                        currency={p.currency}
                      />
                    </div>

                    <div className="mt-4 pt-4 border-t border-border">
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center justify-between w-full group">
                          <div className="flex items-center gap-2 min-w-0">
                            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium truncate">Pending Payouts</span>
                            {pending > 0 && (
                              <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-800 shrink-0">
                                {pending}
                              </span>
                            )}
                          </div>
                          <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 shrink-0" />
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

                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
                      <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-mono truncate">
                        {p.owner_pin}
                      </code>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(p)} aria-label="Edit property">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(p.id)} aria-label="Delete property">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onCopyLink(p.owner_pin, p.id)}>
                          {copiedId === p.id ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                          {copiedId === p.id ? "Copied" : "Copy Link"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Mobile Manage drawer */}
      <Drawer open={!!manageProperty} onOpenChange={(o) => { if (!o) setManageProperty(null); }}>
        <DrawerContent className="max-h-[90vh]">
          {manageProperty && (
            <>
              <DrawerHeader className="text-left">
                <DrawerTitle className="truncate">{manageProperty.name}</DrawerTitle>
                <DrawerDescription className="truncate">{manageProperty.owner_name}</DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-6 overflow-y-auto space-y-5">
                {/* Reservations */}
                <section>
                  <h4 className="text-sm font-semibold mb-2">Reservations</h4>
                  <ManageReservations
                    adminPin={adminPin}
                    propertyId={manageProperty.id}
                    propertyName={manageProperty.name}
                    currency={manageProperty.currency}
                  />
                </section>

                {/* Pending payouts */}
                <section className="pt-4 border-t border-border">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Pending Payouts
                    <span
                      className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                        (pendingCounts[manageProperty.id] || 0) > 0
                          ? "bg-orange-100 text-orange-800"
                          : "bg-muted text-foreground/60"
                      }`}
                    >
                      {pendingCounts[manageProperty.id] || 0}
                    </span>
                  </h4>
                  <PendingPayouts
                    adminPin={adminPin}
                    properties={properties.map((pr) => ({ id: pr.id, name: pr.name, currency: pr.currency }))}
                    propertyId={manageProperty.id}
                  />
                </section>

                {/* Admin utilities */}
                <section className="pt-4 border-t border-border space-y-3">
                  <h4 className="text-sm font-semibold">Admin</h4>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">Owner PIN</p>
                      <code className="text-xs text-foreground bg-muted px-2 py-1 rounded font-mono">
                        {manageProperty.owner_pin}
                      </code>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onCopyLink(manageProperty.owner_pin, manageProperty.id)}
                    >
                      {copiedId === manageProperty.id ? (
                        <Check className="w-3.5 h-3.5 mr-1" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 mr-1" />
                      )}
                      {copiedId === manageProperty.id ? "Copied" : "Copy Link"}
                    </Button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 min-w-0"
                      onClick={() => { onEdit(manageProperty); setManageProperty(null); }}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1.5" />
                      Edit Property
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 min-w-0 text-destructive hover:text-destructive"
                      onClick={() => { onDelete(manageProperty.id); setManageProperty(null); }}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Delete
                    </Button>
                  </div>
                </section>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
