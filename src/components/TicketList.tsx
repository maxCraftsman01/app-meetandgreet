import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Trash2, Image, Mic, ChevronRight, X, Pencil, Camera } from "lucide-react";
import { updateTicket, deleteTicket, uploadTicketMedia } from "@/lib/api";
import { toast } from "sonner";
import type { Ticket } from "@/types";
import { TICKET_PRIORITY_COLORS, TICKET_STATUS_ICONS, TICKET_STATUS_COLORS } from "@/lib/status-config";
import { AlertTriangle } from "lucide-react";

interface TicketListProps {
  tickets: Ticket[];
  role: "admin" | "owner" | "cleaner";
  adminPin?: string;
  currency?: string;
  onRefresh?: () => void;
  properties?: { id: string; name: string }[];
}

type StatusFilter = "all" | "open" | "in_progress" | "resolved";

interface EditForm {
  title: string;
  description: string;
  property_id: string;
  status: string;
  priority: string;
  repair_cost: string;
  visible_to_owner: boolean;
  visible_to_cleaner: boolean;
  cost_visible_to_owner: boolean;
}

export const TicketList = ({ tickets, role, adminPin, currency = "EUR", onRefresh, properties }: TicketListProps) => {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  // Filters
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Derive properties for filter dropdown
  const propertyOptions = useMemo(() => {
    if (properties && properties.length > 0) return properties;
    const map = new Map<string, string>();
    tickets.forEach((t) => {
      if (t.property_id && t.properties?.name) map.set(t.property_id, t.properties.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [properties, tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (propertyFilter !== "all" && t.property_id !== propertyFilter) return false;
      if (statusFilter === "all") return true;
      return t.status === statusFilter;
    });
  }, [tickets, propertyFilter, statusFilter]);

  const filtersActive = propertyFilter !== "all" || statusFilter !== "all";

  const clearFilters = () => {
    setPropertyFilter("all");
    setStatusFilter("all");
  };

  const openTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setMode("view");
    setEditForm(null);
  };

  const enterEditMode = (ticket: Ticket) => {
    setEditForm({
      title: ticket.title,
      description: ticket.description || "",
      property_id: ticket.property_id,
      status: ticket.status,
      priority: ticket.priority,
      repair_cost: String(ticket.repair_cost ?? 0),
      visible_to_owner: ticket.visible_to_owner,
      visible_to_cleaner: ticket.visible_to_cleaner,
      cost_visible_to_owner: ticket.cost_visible_to_owner,
    });
    setMode("edit");
  };

  const handleQuickStatus = async (ticket: Ticket, status: string) => {
    if (!adminPin) return;
    try {
      await updateTicket(adminPin, ticket.id, { status });
      toast.success("Status updated");
      onRefresh?.();
      setSelectedTicket({ ...ticket, status });
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleSaveEdit = async () => {
    if (!adminPin || !selectedTicket || !editForm) return;
    if (!editForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateTicket(adminPin, selectedTicket.id, {
        title: editForm.title.trim(),
        description: editForm.description,
        property_id: editForm.property_id,
        status: editForm.status,
        priority: editForm.priority,
        repair_cost: parseFloat(editForm.repair_cost) || 0,
        visible_to_owner: editForm.visible_to_owner,
        visible_to_cleaner: editForm.visible_to_cleaner,
        cost_visible_to_owner: editForm.cost_visible_to_owner,
      });
      toast.success("Issue updated");
      onRefresh?.();
      // Update selected ticket with response (preserves media + property name)
      if (updated && typeof updated === "object") {
        setSelectedTicket({ ...selectedTicket, ...updated });
      }
      setMode("view");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ticket: Ticket) => {
    if (!adminPin || !confirm("Delete this issue?")) return;
    try {
      await deleteTicket(adminPin, ticket.id);
      toast.success("Issue deleted");
      setSelectedTicket(null);
      onRefresh?.();
    } catch {
      toast.error("Failed to delete");
    }
  };

  // Filters bar (desktop inline + mobile button)
  const FiltersBar = (
    <div className="mb-3 space-y-2">
      {/* Mobile: stacked dropdowns */}
      <div className="flex flex-col gap-2 sm:hidden">
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-full"><SelectValue placeholder="All properties" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All properties</SelectItem>
            {propertyOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="self-end gap-1 text-muted-foreground h-8">
            <X className="w-3.5 h-3.5" /> Clear filters
          </Button>
        )}
      </div>

      {/* Desktop: inline controls */}
      <div className="hidden sm:flex items-center gap-2 flex-wrap">
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All properties</SelectItem>
            {propertyOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {FiltersBar}

      {filteredTickets.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground space-y-3">
          <p>{tickets.length === 0 ? "No issues found." : "No issues match your filters."}</p>
          {filtersActive && tickets.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredTickets.map((ticket, i) => {
              const StatusIcon = TICKET_STATUS_ICONS[ticket.status] || AlertTriangle;
              const photos = ticket.ticket_media?.filter((m) => m.media_type === "photo") || [];
              const hasVoice = ticket.ticket_media?.some((m) => m.media_type === "voice_note");

              return (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.04, duration: 0.4 }}
                >
                  <Card
                    className="p-4 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
                    onClick={() => openTicket(ticket)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge className={`text-[10px] ${TICKET_PRIORITY_COLORS[ticket.priority]}`}>
                            {ticket.priority}
                          </Badge>
                          <Badge className={`text-[10px] ${TICKET_STATUS_COLORS[ticket.status]}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {ticket.status.replace("_", " ")}
                          </Badge>
                          {role === "admin" && (
                            ticket.visible_to_owner
                              ? <Eye className="w-3.5 h-3.5 text-emerald-600" />
                              : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <h4 className="font-medium text-sm truncate">{ticket.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {ticket.properties?.name} · {new Date(ticket.created_at).toLocaleDateString()}
                          {ticket.created_by_role === "admin" && " · by Admin"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {photos.length > 0 && <Image className="w-4 h-4 text-muted-foreground" />}
                        {hasVoice && <Mic className="w-4 h-4 text-muted-foreground" />}
                        {(role === "admin" || role === "owner") && ticket.repair_cost > 0 && (
                          <span className="text-xs font-medium text-destructive">{ticket.repair_cost} {currency}</span>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => { if (!open) { setSelectedTicket(null); setMode("view"); } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedTicket && mode === "view" && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{selectedTicket.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={TICKET_PRIORITY_COLORS[selectedTicket.priority]}>{selectedTicket.priority}</Badge>
                  <Badge className={TICKET_STATUS_COLORS[selectedTicket.status]}>
                    {selectedTicket.status.replace("_", " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {selectedTicket.properties?.name} · {new Date(selectedTicket.created_at).toLocaleDateString()}
                  </span>
                </div>

                {selectedTicket.description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedTicket.description}</p>
                )}

                {/* Photos */}
                {selectedTicket.ticket_media?.filter((m) => m.media_type === "photo").length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Photos</p>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedTicket.ticket_media
                        .filter((m) => m.media_type === "photo")
                        .map((m) => (
                          <a key={m.id} href={m.storage_path} target="_blank" rel="noopener noreferrer">
                            <img
                              src={m.storage_path}
                              alt="Issue photo"
                              className="w-full h-32 object-cover rounded-lg border border-border"
                              loading="lazy"
                            />
                          </a>
                        ))}
                    </div>
                  </div>
                )}

                {/* Voice Notes */}
                {selectedTicket.ticket_media?.filter((m) => m.media_type === "voice_note").length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Voice Notes</p>
                    {selectedTicket.ticket_media
                      .filter((m) => m.media_type === "voice_note")
                      .map((m) => (
                        <audio key={m.id} controls src={m.storage_path} className="w-full" />
                      ))}
                  </div>
                )}

                {(role === "admin" || role === "owner") && selectedTicket.repair_cost > 0 && (
                  <div className="pt-3 border-t border-border">
                    <span className="text-sm font-medium">Repair Cost: </span>
                    <span className="text-sm text-destructive">{selectedTicket.repair_cost} {currency}</span>
                  </div>
                )}

                {/* Admin footer: quick status + edit + delete */}
                {role === "admin" && adminPin && (
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Quick status update</label>
                      <Select value={selectedTicket.status} onValueChange={(v) => handleQuickStatus(selectedTicket, v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={() => enterEditMode(selectedTicket)}>
                        <Pencil className="w-4 h-4 mr-1.5" /> Edit Issue
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDelete(selectedTicket)} aria-label="Delete">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {selectedTicket && mode === "edit" && editForm && (
            <>
              <DialogHeader>
                <DialogTitle>Edit Issue</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Title</label>
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    placeholder="Issue title"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Description</label>
                  <Textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={4}
                    placeholder="Describe the issue..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Property</label>
                  <Select value={editForm.property_id} onValueChange={(v) => setEditForm({ ...editForm, property_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {propertyOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Status</label>
                    <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Priority</label>
                    <Select value={editForm.priority} onValueChange={(v) => setEditForm({ ...editForm, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Repair Cost ({currency})</label>
                  <Input
                    type="number"
                    value={editForm.repair_cost}
                    onChange={(e) => setEditForm({ ...editForm, repair_cost: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Visible to Owner</span>
                    <Switch
                      checked={editForm.visible_to_owner}
                      onCheckedChange={(c) => setEditForm({ ...editForm, visible_to_owner: c })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Visible to Cleaner</span>
                    <Switch
                      checked={editForm.visible_to_cleaner}
                      onCheckedChange={(c) => setEditForm({ ...editForm, visible_to_cleaner: c })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Cost Visible to Owner</span>
                    <Switch
                      checked={editForm.cost_visible_to_owner}
                      onCheckedChange={(c) => setEditForm({ ...editForm, cost_visible_to_owner: c })}
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setMode("view")} disabled={saving}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleSaveEdit} disabled={saving}>
                    {saving ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
