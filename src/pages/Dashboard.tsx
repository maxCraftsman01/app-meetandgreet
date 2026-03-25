import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LogOut, RefreshCw, Building2,
  CheckCircle2, Key, FileText, Sparkles,
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
import type { Booking, ManualReservation, Property, CleanerTask, Ticket } from "@/types";
import { CLEANING_STATUS_CONFIG, CLEANING_STATUS_PRIORITY } from "@/lib/status-config";
import BottomNav from "@/components/BottomNav";

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
  const [ownerTickets, setOwnerTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportPropertyId, setReportPropertyId] = useState<string>("");

  const userProperties = session?.properties || [];
  const hasAnyFinance = userProperties.some((p) => p.can_view_finance);
  const hasAnyCleaning = userProperties.some((p) => p.can_view_cleaning);
  const defaultTab = hasAnyFinance ? "finance" : "cleaning";
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!session || session.role !== "user") {
      navigate("/");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedAccess = userProperties.find((p) => p.id === selectedPropertyId);
  const hasFinance = selectedAccess?.can_view_finance ?? false;

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
      toast.error("Failed to load issues");
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "cleaning" && cleanerTasks.length === 0) loadCleaningTasks();
    if (tab === "tickets" && ownerTickets.length === 0) loadOwnerTickets();
  };

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Loading...</div>;
  }

  const cleaningPropertyIds = userProperties.filter((p) => p.can_view_cleaning).map((p) => p.id);
  const filteredTasks = cleanerTasks.filter((t) => cleaningPropertyIds.includes(t.property_id));
  const sortedTasks = [...filteredTasks].sort((a, b) => (CLEANING_STATUS_PRIORITY[a.status] ?? 5) - (CLEANING_STATUS_PRIORITY[b.status] ?? 5));
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

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
          {/* Desktop header actions */}
          <div className="hidden md:flex items-center gap-2">
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

      <main className="container px-4 py-4 md:py-8 pb-24 md:pb-8">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          {/* Desktop-only top tabs */}
          <div className="hidden md:flex flex-row items-center justify-between gap-3">
            <TabsList>
              {hasAnyFinance &&
              <TabsTrigger value="finance">
                  <DollarSign className="w-4 h-4 mr-1.5" />
                  Finance
                </TabsTrigger>
              }
              {hasAnyCleaning &&
              <TabsTrigger value="cleaning">
                  <Brush className="w-4 h-4 mr-1.5" />
                  Cleaning
                </TabsTrigger>
              }
              {hasAnyFinance &&
              <TabsTrigger value="tickets">
                  <Wrench className="w-4 h-4 mr-1.5" />
                   Issues
                </TabsTrigger>
              }
            </TabsList>
            {hasAnyCleaning && (
              <Button size="sm" variant="outline" onClick={() => {
                setReportPropertyId(userProperties.find(p => p.can_view_cleaning)?.id || "");
                setReportDialogOpen(true);
              }}>
                <Wrench className="w-4 h-4 mr-1.5" />
                Report Issue
              </Button>
            )}
          </div>

          {/* ── Finance Tab ─────────────────────────── */}
          {hasAnyFinance &&
          <TabsContent value="finance" className="space-y-8">
              {(() => {
                const financeProperties = userProperties.filter(p => p.can_view_finance);
                const financePropertyData = properties.filter(p => financeProperties.some(fp => fp.id === p.id));
                return (
                  <>
                    {financePropertyData.length > 1 && (
                      <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Select property" />
                        </SelectTrigger>
                        <SelectContent>
                          {financePropertyData.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
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
                  </>
                );
              })()}
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
                    const cfg = CLEANING_STATUS_CONFIG[task.status] || CLEANING_STATUS_CONFIG.idle;
                    const Icon = cfg.icon;
                    const taskAccess = userProperties.find((p) => p.id === task.property_id);
                    const taskCanMark = taskAccess?.can_mark_cleaned ?? false;
                    return (
                      <motion.div key={task.property_id}
                      initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                        
                            <Card className={`p-5 border-2 ${cfg.border} ${cfg.bg} transition-all duration-300 active:scale-[0.98] cursor-pointer`}>
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
                                  <Button className="w-full" onClick={(e) => { e.stopPropagation(); handleMarkCleaned(task.reservation_id!); }} disabled={markingId === task.reservation_id}>
                                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                    {markingId === task.reservation_id ? "Updating..." : "Mark as Cleaned"}
                                  </Button>
                                </div>
                          }
                              {task.status === "arrival-ready" && taskCanMark && task.reservation_id &&
                          <div className="mt-4 flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-emerald-700">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span className="text-sm font-medium">Cleaning completed</span>
                                  </div>
                                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleRevertCleaning(task.reservation_id!); }} disabled={markingId === task.reservation_id}>
                                    {markingId === task.reservation_id ? "Updating..." : "Mark as Pending"}
                                  </Button>
                                </div>
                          }
                              {task.status === "arrival-ready" && !taskCanMark &&
                          <div className="mt-4 flex items-center gap-2 text-emerald-700">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span className="text-sm font-medium">Cleaning completed</span>
                                </div>
                          }
                              <div className="mt-3">
                                <Button variant="outline" size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); setReportPropertyId(task.property_id); setReportDialogOpen(true); }}>
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
                  onRevertCleaning={handleRevertCleaning}
                  markingId={markingId} />
                </TabsContent>

                {/* Month Calendar View */}
                <TabsContent value="month" className="mt-0">
                   <CleaningCalendar
                  view="month"
                  pin={session!.pin}
                  userProperties={userProperties}
                  onMarkCleaned={handleMarkCleaned}
                  onRevertCleaning={handleRevertCleaning}
                  markingId={markingId} />
                </TabsContent>
              </Tabs>

            </TabsContent>
          }

          {/* ── Tickets Tab (Owner) ─────────────────────────── */}
          {hasAnyFinance &&
          <TabsContent value="tickets" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Property Issues</h2>
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

      {/* Mobile Bottom Nav */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        hasAnyFinance={hasAnyFinance}
        hasAnyCleaning={hasAnyCleaning}
        onLogout={handleLogout}
        onSync={handleSync}
        syncing={syncing}
        onReportIssue={() => {
          setReportPropertyId(userProperties.find(p => p.can_view_cleaning)?.id || "");
          setReportDialogOpen(true);
        }}
      />
    </div>);

};

export default Dashboard;
