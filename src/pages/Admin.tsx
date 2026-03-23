import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, LogOut, Copy, RefreshCw, Pencil, Trash2, Check, Building2, List, Clock, ChevronDown, Activity, Users, CalendarRange, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getSession, clearSession } from "@/lib/session";
import { getAdminProperties, createProperty, updateProperty, deleteProperty, fetchIcal, getAdminPendingIcal, getOwnerData } from "@/lib/api";
import { toast } from "sonner";
import { ManageReservations } from "@/components/ManageReservations";
import { MasterReservationList } from "@/components/MasterReservationList";
import { PendingPayouts } from "@/components/PendingPayouts";
import { DailyOperations } from "@/components/DailyOperations";
import { UserManagement } from "@/components/UserManagement";
import { MasterTimeline } from "@/components/MasterTimeline";
import { PropertyFinanceView } from "@/components/PropertyFinanceView";

interface Property {
  id: string;
  name: string;
  owner_name: string;
  owner_pin: string;
  ical_urls: string[];
  nightly_rate: number;
  currency: string;
  active_bookings: number;
}

const emptyForm = {
  name: "",
  owner_name: "",
  owner_pin: "",
  cleaner_pin: "",
  ical_urls: "",
  nightly_rate: "",
  currency: "EUR",
  keybox_code: "",
  cleaning_notes: "",
};

const Admin = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("properties");
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  const [financeProperty, setFinanceProperty] = useState<Property | null>(null);
  const [financeData, setFinanceData] = useState<{ bookings: any[]; manual_reservations: any[] } | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);

  const session = getSession();

  useEffect(() => {
    if (!session || session.role !== "admin") {
      navigate("/");
      return;
    }
    loadProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session || properties.length === 0) return;
    getAdminPendingIcal(session.pin).then((data) => {
      const counts: Record<string, number> = {};
      (data || []).forEach((evt: any) => {
        counts[evt.property_id] = (counts[evt.property_id] || 0) + 1;
      });
      setPendingCounts(counts);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties]);

  if (!session || session.role !== "admin") {
    return null;
  }

  const loadProperties = async () => {
    try {
      const data = await getAdminProperties(session!.pin);
      setProperties(data);
    } catch {
      toast.error("Failed to load properties");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.owner_name || !form.owner_pin) {
      toast.error("Name, owner name, and owner PIN are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        owner_name: form.owner_name,
        owner_pin: form.owner_pin,
        cleaner_pin: form.cleaner_pin,
        ical_urls: form.ical_urls.split("\n").map((u) => u.trim()).filter(Boolean),
        nightly_rate: parseFloat(form.nightly_rate) || 0,
        currency: form.currency,
        keybox_code: form.keybox_code,
        cleaning_notes: form.cleaning_notes,
      };
      if (editingId) {
        await updateProperty(session!.pin, editingId, payload);
        toast.success("Property updated");
      } else {
        await createProperty(session!.pin, payload);
        toast.success("Property created");
      }
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      loadProperties();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this property?")) return;
    try {
      await deleteProperty(session!.pin, id);
      toast.success("Property deleted");
      loadProperties();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleEdit = (p: Property) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      owner_name: p.owner_name,
      owner_pin: p.owner_pin,
      cleaner_pin: (p as any).cleaner_pin || "",
      ical_urls: (p.ical_urls || []).join("\n"),
      nightly_rate: String(p.nightly_rate),
      currency: p.currency,
      keybox_code: (p as any).keybox_code || "",
      cleaning_notes: (p as any).cleaning_notes || "",
    });
    setDialogOpen(true);
  };

  const handleCopyLink = (pin: string, id: string) => {
    const url = `${window.location.origin}?pin=${pin}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Owner link copied");
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      await Promise.all(
        properties.map((p) => fetchIcal(p.id, session!.pin))
      );
      toast.success("All calendars synced");
      loadProperties();
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    navigate("/");
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
              <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
              Sync All
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingId(null); setForm(emptyForm); } }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Property
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Edit Property" : "Add Property"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Property Name</Label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Beach Villa" />
                    </div>
                    <div>
                      <Label>Owner Name</Label>
                      <Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} placeholder="John Smith" />
                    </div>
                  </div>
                  <div>
                    <Label>Owner PIN</Label>
                    <Input value={form.owner_pin} onChange={(e) => setForm({ ...form, owner_pin: e.target.value })} placeholder="12345678" className="font-mono" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Nightly Rate</Label>
                      <div className="flex gap-2">
                        <Input value={form.nightly_rate} onChange={(e) => setForm({ ...form, nightly_rate: e.target.value })} placeholder="120" type="number" />
                        <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-20" placeholder="EUR" />
                      </div>
                    </div>
                    <div>
                      <Label>Keybox Code</Label>
                      <Input value={form.keybox_code} onChange={(e) => setForm({ ...form, keybox_code: e.target.value })} placeholder="1234" className="font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label>iCal URLs (one per line)</Label>
                    <textarea
                      value={form.ical_urls}
                      onChange={(e) => setForm({ ...form, ical_urls: e.target.value })}
                      placeholder={"https://airbnb.com/calendar.ics\nhttps://booking.com/calendar.ics"}
                      rows={3}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <Label>Cleaning Notes</Label>
                    <textarea
                      value={form.cleaning_notes}
                      onChange={(e) => setForm({ ...form, cleaning_notes: e.target.value })}
                      placeholder="Special instructions for cleaning..."
                      rows={2}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : editingId ? "Update" : "Create"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="properties">
              <Building2 className="w-4 h-4 mr-1.5" />
              Properties
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-1.5" />
              Users
            </TabsTrigger>
            <TabsTrigger value="master-list">
              <List className="w-4 h-4 mr-1.5" />
              All Reservations
            </TabsTrigger>
            <TabsTrigger value="timeline">
              <CalendarRange className="w-4 h-4 mr-1.5" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="daily-ops">
              <Activity className="w-4 h-4 mr-1.5" />
              Daily Ops
            </TabsTrigger>
          </TabsList>

          <TabsContent value="properties">
            {loading ? (
              <div className="flex justify-center py-20 text-muted-foreground">Loading...</div>
            ) : properties.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20"
              >
                <p className="text-muted-foreground mb-4">No properties yet. Add your first one.</p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Property
                </Button>
              </motion.div>
            ) : (
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
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(p)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {p.nightly_rate} {p.currency}/night
                          </span>
                          <span className="text-muted-foreground">
                            {p.active_bookings} active booking{p.active_bookings !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {/* Manual Reservations Section */}
                        <div className="mt-4 pt-4 border-t border-border">
                          <ManageReservations
                            adminPin={session!.pin}
                            propertyId={p.id}
                            propertyName={p.name}
                            currency={p.currency}
                          />
                        </div>

                        {/* Pending Payouts Section */}
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
                                adminPin={session!.pin}
                                properties={properties.map((pr) => ({ id: pr.id, name: pr.name, currency: pr.currency }))}
                                propertyId={p.id}
                              />
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          <TabsContent value="users">
            <Card className="p-6">
              <UserManagement adminPin={session!.pin} />
            </Card>
          </TabsContent>

          <TabsContent value="master-list">
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <List className="w-4 h-4" />
                All Manual Reservations
              </h3>
              <MasterReservationList
                adminPin={session!.pin}
                properties={properties.map((p) => ({ id: p.id, name: p.name, currency: p.currency }))}
              />
            </Card>
          </TabsContent>

          <TabsContent value="timeline">
            <MasterTimeline adminPin={session!.pin} />
          </TabsContent>

          <TabsContent value="daily-ops">
            <Card className="p-6">
              <DailyOperations adminPin={session!.pin} />
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
