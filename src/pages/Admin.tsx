import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, LogOut, RefreshCw, Building2, List, Activity, Users, CalendarRange, Wrench, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSession, clearSession } from "@/lib/session";
import { getAdminProperties, createProperty, updateProperty, deleteProperty, fetchIcal, getAdminPendingIcal, getOwnerData, getTickets } from "@/lib/api";
import { toast } from "sonner";
import { MasterReservationList } from "@/components/MasterReservationList";
import { DailyOperations } from "@/components/DailyOperations";
import { UserManagement } from "@/components/UserManagement";
import { MasterTimeline } from "@/components/MasterTimeline";
import { PropertyFinanceView } from "@/components/PropertyFinanceView";
import { TicketForm } from "@/components/TicketForm";
import { TicketList } from "@/components/TicketList";
import { PropertyFormDialog, emptyForm, type PropertyFormData } from "@/components/admin/PropertyFormDialog";
import { PropertyGrid } from "@/components/admin/PropertyGrid";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { ExpenseList } from "@/components/ExpenseList";
import { OwnerExpenseStatement } from "@/components/OwnerExpenseStatement";
import type { Property, Booking, ManualReservation, Ticket } from "@/types";

const adminTabs = [
  { id: "daily-ops", label: "Daily Ops", shortLabel: "Ops", icon: Activity },
  { id: "timeline", label: "Timeline", shortLabel: "Time", icon: CalendarRange },
  { id: "tickets", label: "Issues", shortLabel: "Issues", icon: Wrench },
  { id: "expenses", label: "Expenses", shortLabel: "Exp", icon: Receipt },
  { id: "properties", label: "Properties", shortLabel: "Props", icon: Building2 },
  { id: "users", label: "Users", shortLabel: "Users", icon: Users },
  { id: "master-list", label: "All Reservations", shortLabel: "Reserv", icon: List },
];

const pinnedTabs = adminTabs.slice(0, 4);
const moreTabs = adminTabs.slice(4);

const Admin = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PropertyFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("properties");
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  const [financeProperty, setFinanceProperty] = useState<Property | null>(null);
  const [financeData, setFinanceData] = useState<{ bookings: Booking[]; manual_reservations: ManualReservation[] } | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [adminTickets, setAdminTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketFormOpen, setTicketFormOpen] = useState(false);

  useEffect(() => {
    if (!session || session.role !== "admin") { navigate("/"); return; }
    loadProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session || properties.length === 0) return;
    getAdminPendingIcal(session.pin).then((data) => {
      const counts: Record<string, number> = {};
      (data || []).forEach((evt: any) => { counts[evt.property_id] = (counts[evt.property_id] || 0) + 1; });
      setPendingCounts(counts);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties]);

  if (!session || session.role !== "admin") return null;

  const loadProperties = async () => {
    try { setProperties(await getAdminProperties(session!.pin)); }
    catch { toast.error("Failed to load properties"); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.name || !form.owner_name || !form.owner_pin) { toast.error("Name, owner name, and owner PIN are required."); return; }
    if (form.owner_pin.length !== 8 || !/^\d{8}$/.test(form.owner_pin)) { toast.error("Owner PIN must be exactly 8 digits."); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name, owner_name: form.owner_name, owner_pin: form.owner_pin,
        cleaner_pin: form.cleaner_pin,
        ical_urls: form.ical_urls.split("\n").map((u) => u.trim()).filter(Boolean),
        nightly_rate: parseFloat(form.nightly_rate) || 0, currency: form.currency,
        keybox_code: form.keybox_code, cleaning_notes: form.cleaning_notes,
        listing_urls: form.listing_urls.split("\n").map((u) => u.trim()).filter(Boolean),
      };
      if (editingId) { await updateProperty(session!.pin, editingId, payload); toast.success("Property updated"); }
      else { await createProperty(session!.pin, payload); toast.success("Property created"); }
      setDialogOpen(false); setEditingId(null); setForm(emptyForm); loadProperties();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this property?")) return;
    try { await deleteProperty(session!.pin, id); toast.success("Property deleted"); loadProperties(); }
    catch { toast.error("Failed to delete"); }
  };

  const handleEdit = (p: Property) => {
    setEditingId(p.id);
    setForm({
      name: p.name, owner_name: p.owner_name, owner_pin: p.owner_pin,
      cleaner_pin: (p as any).cleaner_pin || "",
      ical_urls: (p.ical_urls || []).join("\n"),
      nightly_rate: String(p.nightly_rate), currency: p.currency,
      keybox_code: (p as any).keybox_code || "", cleaning_notes: (p as any).cleaning_notes || "",
      listing_urls: (p.listing_urls || []).join("\n"),
    });
    setDialogOpen(true);
  };

  const handleCopyLink = (pin: string, id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}?pin=${pin}`);
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
    toast.success("Owner link copied");
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try { await Promise.all(properties.map((p) => fetchIcal(p.id, session!.pin))); toast.success("All calendars synced"); loadProperties(); }
    catch { toast.error("Sync failed"); }
    finally { setSyncing(false); }
  };

  const handleLogout = () => { clearSession(); navigate("/"); };

  const handleOpenFinance = async (p: Property) => {
    setFinanceProperty(p); setFinanceLoading(true); setFinanceData(null);
    try {
      const data = await getOwnerData(session!.pin, p.id);
      setFinanceData({ bookings: data.bookings || [], manual_reservations: data.manual_reservations || [] });
    } catch { toast.error("Failed to load finance data"); }
    finally { setFinanceLoading(false); }
  };

  const loadTickets = async () => {
    setTicketsLoading(true);
    try { setAdminTickets(await getTickets(session!.pin, "admin")); }
    catch { toast.error("Failed to load issues"); }
    finally { setTicketsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="font-semibold text-lg">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSyncAll} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />Sync All
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-8 pb-24 md:pb-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="hidden md:flex">
            {adminTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id} onClick={() => { if (tab.id === "tickets" && adminTickets.length === 0) loadTickets(); }}>
                  <Icon className="w-4 h-4 mr-1.5" />{tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="properties">
            <PropertyFormDialog
              open={dialogOpen}
              onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingId(null); setForm(emptyForm); } }}
              editingId={editingId}
              form={form}
              setForm={setForm}
              saving={saving}
              onSave={handleSave}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Managed Properties</h2>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="w-4 h-4 mr-1.5" />Add Property</Button>
                </DialogTrigger>
              </div>
              <PropertyGrid
                properties={properties}
                loading={loading}
                adminPin={session!.pin}
                copiedId={copiedId}
                pendingCounts={pendingCounts}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onCopyLink={handleCopyLink}
                onOpenFinance={handleOpenFinance}
                onAddClick={() => setDialogOpen(true)}
              />
            </PropertyFormDialog>
          </TabsContent>

          <TabsContent value="users">
            <Card className="p-6"><UserManagement adminPin={session!.pin} /></Card>
          </TabsContent>

          <TabsContent value="master-list">
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><List className="w-4 h-4" />All Manual Reservations</h3>
              <MasterReservationList adminPin={session!.pin} properties={properties.map((p) => ({ id: p.id, name: p.name, currency: p.currency }))} />
            </Card>
          </TabsContent>

          <TabsContent value="timeline"><MasterTimeline adminPin={session!.pin} /></TabsContent>

          <TabsContent value="daily-ops"><Card className="p-6"><DailyOperations adminPin={session!.pin} /></Card></TabsContent>

          <TabsContent value="tickets" className="mt-0 sm:mt-6">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Maintenance Issues</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={loadTickets}><RefreshCw className="w-4 h-4 mr-1.5" />Refresh</Button>
                  <Dialog open={ticketFormOpen} onOpenChange={setTicketFormOpen}>
                    <Button size="sm" onClick={() => setTicketFormOpen(true)}><Plus className="w-4 h-4 mr-1.5" />New Issue</Button>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader><DialogTitle>Create Issue</DialogTitle></DialogHeader>
                      <TicketForm pin={session!.pin} role="admin" properties={properties.map((p) => ({ id: p.id, name: p.name }))} onSuccess={() => { setTicketFormOpen(false); loadTickets(); }} onCancel={() => setTicketFormOpen(false)} />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              {ticketsLoading ? (
                <div className="flex justify-center py-20 text-muted-foreground">Loading...</div>
              ) : (
                <TicketList tickets={adminTickets} role="admin" adminPin={session!.pin} onRefresh={loadTickets} properties={properties.map((p) => ({ id: p.id, name: p.name }))} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="expenses">
            <Tabs defaultValue="all-expenses" className="space-y-4">
              <TabsList>
                <TabsTrigger value="all-expenses">All Expenses</TabsTrigger>
                <TabsTrigger value="statement">Owner Statement</TabsTrigger>
              </TabsList>
              <TabsContent value="all-expenses">
                <ExpenseList />
              </TabsContent>
              <TabsContent value="statement">
                <OwnerExpenseStatement properties={properties} />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </main>

      {/* Finance Dialog */}
      <Dialog open={!!financeProperty} onOpenChange={(open) => { if (!open) setFinanceProperty(null); }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{financeProperty?.name} — Dashboard</DialogTitle></DialogHeader>
          {financeLoading ? (
            <div className="flex justify-center py-20 text-muted-foreground">Loading...</div>
          ) : financeData && financeProperty ? (
            <PropertyFinanceView
              property={{ id: financeProperty.id, name: financeProperty.name, owner_name: financeProperty.owner_name, nightly_rate: financeProperty.nightly_rate, currency: financeProperty.currency, ical_urls: financeProperty.ical_urls }}
              bookings={financeData.bookings}
              manualReservations={financeData.manual_reservations}
              pin={session!.pin}
              onDataChanged={() => handleOpenFinance(financeProperty)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AdminMobileNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pinnedTabs={pinnedTabs}
        moreTabs={moreTabs}
        moreSheetOpen={moreSheetOpen}
        setMoreSheetOpen={setMoreSheetOpen}
      />
    </div>
  );
};

export default Admin;
