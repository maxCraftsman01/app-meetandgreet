import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export interface PropertyFormData {
  name: string;
  owner_name: string;
  owner_pin: string;
  cleaner_pin: string;
  ical_urls: string;
  nightly_rate: string;
  currency: string;
  keybox_code: string;
  cleaning_notes: string;
  listing_urls: string;
}

export const emptyForm: PropertyFormData = {
  name: "",
  owner_name: "",
  owner_pin: "",
  cleaner_pin: "",
  ical_urls: "",
  nightly_rate: "",
  currency: "EUR",
  keybox_code: "",
  cleaning_notes: "",
  listing_urls: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  form: PropertyFormData;
  setForm: (form: PropertyFormData) => void;
  saving: boolean;
  onSave: () => void;
  children?: React.ReactNode;
}

export function PropertyFormDialog({ open, onOpenChange, editingId, form, setForm, saving, onSave, children }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
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
            <Input value={form.owner_pin} onChange={(e) => setForm({ ...form, owner_pin: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder="12345678" maxLength={8} className="font-mono" />
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
          <div>
            <Label>Listing URLs (one per line)</Label>
            <textarea
              value={form.listing_urls}
              onChange={(e) => setForm({ ...form, listing_urls: e.target.value })}
              placeholder={"https://airbnb.com/rooms/12345\nhttps://booking.com/hotel/abc"}
              rows={3}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
