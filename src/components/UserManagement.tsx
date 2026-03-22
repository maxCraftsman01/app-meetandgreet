import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Copy, Check, Users, Building2, Eye, Brush, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getAdminUsers, createUser, updateUser, deleteUser } from "@/lib/api";
import { toast } from "sonner";

interface PropertyAccess {
  property_id: string;
  property_name: string;
  can_view_finance: boolean;
  can_view_cleaning: boolean;
  can_mark_cleaned: boolean;
}

interface AppUser {
  id: string;
  name: string;
  pin: string;
  created_at: string;
  property_access: PropertyAccess[];
}

interface AvailableProperty {
  id: string;
  name: string;
}

export function UserManagement({ adminPin }: { adminPin: string }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [allProperties, setAllProperties] = useState<AvailableProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formPin, setFormPin] = useState("");
  const [formAccess, setFormAccess] = useState<Record<string, { finance: boolean; cleaning: boolean; mark: boolean }>>({});

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    try {
      const data = await getAdminUsers(adminPin);
      setUsers(data.users);
      setAllProperties(data.properties);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormPin("");
    setFormAccess({});
    setEditingUser(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (user: AppUser) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormPin(user.pin);
    const access: Record<string, { finance: boolean; cleaning: boolean; mark: boolean }> = {};
    user.property_access.forEach((pa) => {
      access[pa.property_id] = {
        finance: pa.can_view_finance,
        cleaning: pa.can_view_cleaning,
        mark: pa.can_mark_cleaned,
      };
    });
    setFormAccess(access);
    setDialogOpen(true);
  };

  const toggleAccess = (propId: string, field: "finance" | "cleaning" | "mark") => {
    setFormAccess((prev) => {
      const current = prev[propId] || { finance: false, cleaning: false, mark: false };
      const updated = { ...current, [field]: !current[field] };
      // If mark is enabled, cleaning should be too
      if (field === "mark" && updated.mark) updated.cleaning = true;
      return { ...prev, [propId]: updated };
    });
  };

  const handleSave = async () => {
    if (!formName || formPin.length !== 8) {
      toast.error("Name and 8-digit PIN required");
      return;
    }
    setSaving(true);
    try {
      const property_access = Object.entries(formAccess)
        .filter(([, v]) => v.finance || v.cleaning || v.mark)
        .map(([property_id, v]) => ({
          property_id,
          can_view_finance: v.finance,
          can_view_cleaning: v.cleaning,
          can_mark_cleaned: v.mark,
        }));

      if (editingUser) {
        await updateUser(adminPin, editingUser.id, { name: formName, pin: formPin, property_access });
        toast.success("User updated");
      } else {
        await createUser(adminPin, { name: formName, pin: formPin, property_access });
        toast.success("User created");
      }
      setDialogOpen(false);
      resetForm();
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this user? Their property access will be removed.")) return;
    try {
      await deleteUser(adminPin, id);
      toast.success("User deleted");
      load();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleCopyLink = (pin: string, userId: string) => {
    const url = `${window.location.origin}?pin=${pin}`;
    navigator.clipboard.writeText(url);
    setCopiedId(userId);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Login link copied");
  };

  if (loading) {
    return <div className="flex justify-center py-12 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            User Management
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage users and their property permissions
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingUser ? "Edit User" : "Add User"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Maria Santos" />
                </div>
                <div>
                  <Label>PIN (8 digits)</Label>
                  <Input value={formPin} onChange={(e) => setFormPin(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="12345678" maxLength={8} className="font-mono" />
                </div>
              </div>

              <div>
                <Label className="mb-3 block">Property Permissions</Label>
                <div className="space-y-3">
                  {allProperties.map((prop) => {
                    const access = formAccess[prop.id] || { finance: false, cleaning: false, mark: false };
                    return (
                      <Card key={prop.id} className="p-3">
                        <p className="font-medium text-sm mb-2 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                          {prop.name}
                        </p>
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox checked={access.finance} onCheckedChange={() => toggleAccess(prop.id, "finance")} />
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                            Finance
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox checked={access.cleaning} onCheckedChange={() => toggleAccess(prop.id, "cleaning")} />
                            <Brush className="w-3.5 h-3.5 text-muted-foreground" />
                            Cleaning
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox checked={access.mark} onCheckedChange={() => toggleAccess(prop.id, "mark")} />
                            <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                            Mark Cleaned
                          </label>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editingUser ? "Update" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {users.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>No users yet. Add your first user above.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {users.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <Card className="p-5 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold">{user.name}</h4>
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        PIN: {user.pin}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(user)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(user.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Property access list */}
                  {user.property_access.length > 0 ? (
                    <div className="space-y-2 mb-3">
                      {user.property_access.map((pa) => (
                        <div key={pa.property_id} className="flex items-center gap-2 text-xs">
                          <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{pa.property_name}</span>
                          <div className="flex gap-1 ml-auto shrink-0">
                            {pa.can_view_finance && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">$</span>
                            )}
                            {pa.can_view_cleaning && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">🧹</span>
                            )}
                            {pa.can_mark_cleaned && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">✓</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mb-3">No properties assigned</p>
                  )}

                  <div className="pt-3 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => handleCopyLink(user.pin, user.id)}
                    >
                      {copiedId === user.id ? (
                        <><Check className="w-3 h-3 mr-1" /> Copied</>
                      ) : (
                        <><Copy className="w-3 h-3 mr-1" /> Copy Login Link</>
                      )}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
