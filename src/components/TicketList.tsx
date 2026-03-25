import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Trash2, Image, Mic, ChevronRight } from "lucide-react";
import { updateTicket, deleteTicket } from "@/lib/api";
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
}

export const TicketList = ({ tickets, role, adminPin, currency = "EUR", onRefresh }: TicketListProps) => {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [editCost, setEditCost] = useState("");

  const handleToggleOwnerVisibility = async (ticket: Ticket) => {
    if (!adminPin) return;
    try {
      await updateTicket(adminPin, ticket.id, { visible_to_owner: !ticket.visible_to_owner });
      toast.success(ticket.visible_to_owner ? "Hidden from owner" : "Visible to owner");
      onRefresh?.();
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleToggleCleanerVisibility = async (ticket: Ticket) => {
    if (!adminPin) return;
    try {
      await updateTicket(adminPin, ticket.id, { visible_to_cleaner: !ticket.visible_to_cleaner });
      toast.success(ticket.visible_to_cleaner ? "Hidden from cleaner" : "Visible to cleaner");
      onRefresh?.();
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleToggleCostVisibility = async (ticket: Ticket) => {
    if (!adminPin) return;
    try {
      await updateTicket(adminPin, ticket.id, { cost_visible_to_owner: !ticket.cost_visible_to_owner });
      toast.success(ticket.cost_visible_to_owner ? "Cost hidden from owner" : "Cost visible to owner");
      onRefresh?.();
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleStatusChange = async (ticket: Ticket, status: string) => {
    if (!adminPin) return;
    try {
      await updateTicket(adminPin, ticket.id, { status });
      toast.success("Status updated");
      onRefresh?.();
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleCostSave = async (ticket: Ticket) => {
    if (!adminPin) return;
    try {
      await updateTicket(adminPin, ticket.id, { repair_cost: parseFloat(editCost) || 0 });
      toast.success("Cost updated");
      onRefresh?.();
    } catch {
      toast.error("Failed to update");
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

  if (tickets.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <p>No issues found.</p>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <AnimatePresence>
          {tickets.map((ticket, i) => {
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
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => { setSelectedTicket(ticket); setEditCost(String(ticket.repair_cost)); }}
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
                      <p className="text-xs text-muted-foreground mt-0.5">
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => { if (!open) setSelectedTicket(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedTicket.title}</DialogTitle>
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
                  <p className="text-sm text-muted-foreground">{selectedTicket.description}</p>
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

                {/* Admin Controls */}
                {role === "admin" && adminPin && (
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Visible to Owner</span>
                      <Switch
                        checked={selectedTicket.visible_to_owner}
                        onCheckedChange={() => handleToggleOwnerVisibility(selectedTicket)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Visible to Cleaner</span>
                      <Switch
                        checked={selectedTicket.visible_to_cleaner}
                        onCheckedChange={() => handleToggleCleanerVisibility(selectedTicket)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Cost Visible to Owner</span>
                      <Switch
                        checked={selectedTicket.cost_visible_to_owner}
                        onCheckedChange={() => handleToggleCostVisibility(selectedTicket)}
                      />
                    </div>

                    <div>
                      <span className="text-sm font-medium">Status</span>
                      <Select value={selectedTicket.status} onValueChange={(v) => handleStatusChange(selectedTicket, v)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <span className="text-sm font-medium">Repair Cost ({currency})</span>
                      <div className="flex gap-2 mt-1">
                        <Input
                          type="number"
                          value={editCost}
                          onChange={(e) => setEditCost(e.target.value)}
                          placeholder="0"
                        />
                        <Button size="sm" onClick={() => handleCostSave(selectedTicket)}>Save</Button>
                      </div>
                    </div>

                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => handleDelete(selectedTicket)}
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Delete Ticket
                    </Button>
                  </div>
                )}

                {role === "owner" && selectedTicket.repair_cost > 0 && (
                  <div className="pt-3 border-t border-border">
                    <span className="text-sm font-medium">Repair Cost: </span>
                    <span className="text-sm text-destructive">{selectedTicket.repair_cost} {currency}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
