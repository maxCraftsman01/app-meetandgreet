import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LogOut, RefreshCw, Building2,
  CheckCircle2, Key, FileText, AlertTriangle, Clock, Sparkles,
  DollarSign, Brush, Wrench } from
"lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from
"@/components/ui/select";
import { getSession, clearSession } from "@/lib/session";
import { getOwnerData, fetchIcal, getCleanerTasks, markAsCleaned, resetCleaningStatus, getTickets } from "@/lib/api";
import CleaningCalendar from "@/components/CleaningCalendar";
import { PropertyFinanceView } from "@/components/PropertyFinanceView";
import { TicketList } from "@/components/TicketList";
import { TicketForm } from "@/components/TicketForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────
interface Booking {
  id: string;property_id: string;summary: string;start_date: string;end_date: string;status: string;source_url: string | null;
}
interface ManualReservation {
  id: string;property_id: string;guest_name: string;check_in: string;check_out: string;source: string;net_payout: number;status: string;
}
interface Property {
  id: string;name: string;owner_name: string;nightly_rate: number;currency: string;ical_urls: string[];
}
interface CleanerTask {
  property_id: string;property_name: string;keybox_code: string;cleaning_notes: string;
  status: "idle" | "same-day" | "checkout-only" | "arrival-pending" | "arrival-ready";
  reservation_id: string | null;guest_name: string | null;check_in: string | null;check_out_guest: string | null;
}

const STATUS_CONFIG: Record<string, {color: string;bg: string;border: string;label: string;icon: typeof AlertTriangle;}> = {
  "same-day": { color: "text-red-700", bg: "bg-red-50", border: "border-red-200", label: "Same-Day Turnover", icon: AlertTriangle },
  "checkout-only": { color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200", label: "Check-out Only", icon: Clock },
  "arrival-pending": { color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", label: "Arrival Pending Clean", icon: Clock },
  "arrival-ready": { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", label: "Ready for Arrival", icon: CheckCircle2 },
  idle: { color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border", label: "No Activity Today", icon: Sparkles }
};

// ─── Component ──────────────────────────────────────
const Dashboard = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [manualReservations, setManualReservations] = useState<ManualReservation[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [cleanerTasks, setCleanerTasks] = useState<CleanerTask[]>([]);
  const [cleaningLoading, setCleaningLoading] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [ownerTickets, setOwnerTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportPropertyId, setReportPropertyId] = useState<string>("");

  useEffect(() => {
    if (!session || session.role !== "user") {
      navigate("/");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userProperties = session?.properties || [];
  const selectedAccess = userProperties.find((p) => p.id === selectedPropertyId);
  const hasFinance = selectedAccess?.can_view_finance ?? false;

  const hasAnyFinance = userProperties.some((p) => p.can_view_finance);
  const hasAnyCleaning = userProperties.some((p) => p.can_view_cleaning);

  const loadData = async () => {
    try {
      const data = await getOwnerData(session!.pin);
      setProperties(data.properties);
      setBookings(data.bookings);
      setManualReservations(data.manual_reservations || []);
      if (data.properties.length > 0 && !selectedPropertyId) {
        setSelectedPropertyId(data.properties[0].id);
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadCleaningTasks = async () => {
    setCleaningLoading(true);
    try {
      const data = await getCleanerTasks(session!.pin);
      setCleanerTasks(data);
    } catch {
      toast.error("Failed to load cleaning tasks");
    } finally {
      setCleaningLoading(false);
    }
  };

  const handleSync = async () => {
    if (!selectedPropertyId) return;
    setSyncing(true);
    try {
      const result = await fetchIcal(selectedPropertyId, session!.pin);
      setBookings((prev) => [
        ...prev.filter((b) => b.property_id !== selectedPropertyId),
        ...(result.bookings || [])
      ]);
      toast.success(`Synced ${result.synced} events`);
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleMarkCleaned = async (reservationId: string) => {
    setMarkingId(reservationId);
    try {
      await markAsCleaned(session!.pin, reservationId);
      toast.success("Marked as cleaned!");
      loadCleaningTasks();
    } catch {
      toast.error("Failed to update");
    } finally {
      setMarkingId(null);
    }
  };

  const handleRevertCleaning = async (reservationId: string) => {
    setMarkingId(reservationId);
    try {
      await resetCleaningStatus(session!.pin, reservationId);
      toast.success("Reverted to pending");
      loadCleaningTasks();
    } catch {
      toast.error("Failed to update");
    } finally {
      setMarkingId(null);
    }
  };

  const handleLogout = () => {
    clearSession();
    navigate("/");
  };

  const loadOwnerTickets = async () => {
    setTicketsLoading(true);
    try {
      const data = await getTickets(session!.pin, "user");
      setOwnerTickets(data);
    } catch {
      toast.error("Failed to load tickets");
    } finally {
      setTicketsLoading(false);
    }
  };

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Loading...</div>;
  }

  const cleaningPropertyIds = userProperties.filter((p) => p.can_view_cleaning).map((p) => p.id);
  const filteredTasks = cleanerTasks.filter((t) => cleaningPropertyIds.includes(t.property_id));
  const priority: Record<string, number> = { "same-day": 0, "checkout-only": 1, "arrival-pending": 2, "arrival-ready": 3, idle: 4 };
  const sortedTasks = [...filteredTasks].sort((a, b) => (priority[a.status] ?? 5) - (priority[b.status] ?? 5));
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const defaultTab = hasAnyFinance ? "finance" : "cleaning";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-lg leading-tight">Welcome  </h1>
              {session?.user_name &&
              <p className="text-xs text-muted-foreground">{session.user_name}</p>
              }
            </div>
          </div>
          <div className="flex items-center gap-2">
            {properties.length > 1 &&
            <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) =>
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                )}
                </SelectContent>
              </Select>
            }
            {hasFinance &&
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
                Sync
              </Button>
            }
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-8">
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList>
            {hasAnyFinance &&
            <TabsTrigger value="finance">
                <DollarSign className="w-4 h-4 mr-1.5" />
                Finance
              </TabsTrigger>
            }
            {hasAnyCleaning &&
            <TabsTrigger value="cleaning" onClick={() => {if (cleanerTasks.length === 0) loadCleaningTasks();}}>
                <Brush className="w-4 h-4 mr-1.5" />
                Cleaning
              </TabsTrigger>
            }
            {hasAnyFinance &&
            <TabsTrigger value="tickets" onClick={() => {if (ownerTickets.length === 0) loadOwnerTickets();}}>
                <Wrench className="w-4 h-4 mr-1.5" />
                Tickets
              </TabsTrigger>
            }
          </TabsList>

          {/* ── Finance Tab ─────────────────────────── */}
          {hasAnyFinance &&
          <TabsContent value="finance" className="space-y-8">
              {!hasFinance && selectedAccess ?
            <Card className="p-8 text-center text-muted-foreground">
                  <p>You don't have finance access for this property.</p>
                </Card> :
            selectedProperty ?
              <PropertyFinanceView
                property={selectedProperty}
                bookings={bookings}
                manualReservations={manualReservations}
                pin={session!.pin}
                onDataChanged={loadData}
              /> :
              null
            }
            </TabsContent>
          }

          {/* ── Cleaning Tab ─────────────────────────── */}
          {hasAnyCleaning &&
          <TabsContent value="cleaning" className="space-y-6">
              <Tabs defaultValue="today" className="space-y-4">
                <div className="flex flex-row items-center justify-between gap-3">
                  <TabsList className="h-9">
                    <TabsTrigger value="today" className="text-xs px-3" onClick={() => {if (cleanerTasks.length === 0) loadCleaningTasks();}}>Today</TabsTrigger>
                    <TabsTrigger value="week" className="text-xs px-3">Week</TabsTrigger>
                    <TabsTrigger value="month" className="text-xs px-3">Month</TabsTrigger>
                  </TabsList>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadCleaningTasks}>
                      <RefreshCw className="w-4 h-4 mr-1.5" />
                      Refresh
                    </Button>
                  </div>
                </div>

                {/* Today View */}
                <TabsContent value="today" className="space-y-4 mt-0">
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                    <p className="text-sm text-muted-foreground">{today}</p>
                  </motion.div>

                  {cleaningLoading ?
                <div className="flex justify-center py-20 text-muted-foreground">Loading...</div> :
                sortedTasks.length === 0 ?
                <Card className="p-8 text-center text-muted-foreground">
                      <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-40" />
                      <p>No cleaning tasks for today.</p>
                    </Card> :

                <div className="space-y-4">
                      {sortedTasks.map((task, i) => {
                    const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.idle;
                    const Icon = cfg.icon;
                    const taskAccess = userProperties.find((p) => p.id === task.property_id);
                    const taskCanMark = taskAccess?.can_mark_cleaned ?? false;
                    return (
                      <motion.div key={task.property_id}
                      initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                        
                            <Card className={`p-5 border-2 ${cfg.border} ${cfg.bg} transition-colors duration-300`}>
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                                    <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                                  </div>
                                  <h3 className="font-semibold text-lg">{task.property_name}</h3>
                                </div>
                              </div>
                              <div className="space-y-2 text-sm">
                                {task.check_out_guest && <p className="text-muted-foreground"><span className="font-medium text-foreground">Departing:</span> {task.check_out_guest}</p>}
                                {task.guest_name && <p className="text-muted-foreground"><span className="font-medium text-foreground">Arriving:</span> {task.guest_name}</p>}
                                {task.keybox_code && <div className="flex items-center gap-1.5"><Key className="w-3.5 h-3.5 text-muted-foreground" /><span className="font-mono font-medium">{task.keybox_code}</span></div>}
                                {task.cleaning_notes && <div className="flex items-start gap-1.5"><FileText className="w-3.5 h-3.5 text-muted-foreground mt-0.5" /><span className="text-muted-foreground">{task.cleaning_notes}</span></div>}
                              </div>
                              {taskCanMark && task.reservation_id && task.status !== "arrival-ready" &&
                          <div className="mt-4">
                                  <Button className="w-full" onClick={() => handleMarkCleaned(task.reservation_id!)} disabled={markingId === task.reservation_id}>
                                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                    {markingId === task.reservation_id ? "Updating..." : "Mark as Cleaned"}
                                  </Button>
                                </div>
                          }
                              {task.status === "arrival-ready" &&
                          <div className="mt-4 flex items-center gap-2 text-emerald-700">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span className="text-sm font-medium">Cleaning completed</span>
                                </div>
                          }
                              <div className="mt-3">
                                <Button variant="outline" size="sm" className="w-full" onClick={() => { setReportPropertyId(task.property_id); setReportDialogOpen(true); }}>
                                  <Wrench className="w-4 h-4 mr-1.5" />
                                  Report Issue
                                </Button>
                              </div>
                            </Card>
                          </motion.div>);

                  })}
                    </div>
                }
                </TabsContent>

                {/* Week Calendar View */}
                <TabsContent value="week" className="mt-0">
                  <CleaningCalendar
                  view="week"
                  pin={session!.pin}
                  userProperties={userProperties}
                  onMarkCleaned={handleMarkCleaned}
                  markingId={markingId} />
                </TabsContent>

                {/* Month Calendar View */}
                <TabsContent value="month" className="mt-0">
                  <CleaningCalendar
                  view="month"
                  pin={session!.pin}
                  userProperties={userProperties}
                  onMarkCleaned={handleMarkCleaned}
                  markingId={markingId} />
                </TabsContent>
              </Tabs>

              {/* Floating Report Issue Button */}
              <Button
                className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg h-12 px-5 gap-2"
                onClick={() => {
                  setReportPropertyId(userProperties.find(p => p.can_view_cleaning)?.id || "");
                  setReportDialogOpen(true);
                }}
              >
                <Wrench className="w-5 h-5" />
                Report Issue
              </Button>
            </TabsContent>
          }

          {/* ── Tickets Tab (Owner) ─────────────────────────── */}
          {hasAnyFinance &&
          <TabsContent value="tickets" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Property Tickets</h2>
                <Button variant="outline" size="sm" onClick={loadOwnerTickets}>
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                  Refresh
                </Button>
              </div>
              {ticketsLoading ? (
                <div className="flex justify-center py-20 text-muted-foreground">Loading...</div>
              ) : (
                <TicketList
                  tickets={ownerTickets}
                  role="owner"
                  currency={selectedProperty?.currency}
                />
              )}
            </TabsContent>
          }

          {/* Cleaner Report Issue Dialog */}
          <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Report Issue</DialogTitle>
              </DialogHeader>
              <TicketForm
                pin={session!.pin}
                role="user"
                properties={userProperties.map((p) => ({ id: p.id, name: p.name }))}
                preselectedPropertyId={reportPropertyId}
                onSuccess={() => { setReportDialogOpen(false); }}
                onCancel={() => setReportDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </Tabs>
      </main>
    </div>);

};

export default Dashboard;
