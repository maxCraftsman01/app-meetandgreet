import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Mic, MicOff, X, Upload } from "lucide-react";
import { uploadTicketMedia, createTicket } from "@/lib/api";
import { toast } from "sonner";

interface TicketFormProps {
  pin: string;
  role: "admin" | "user";
  properties: { id: string; name: string }[];
  preselectedPropertyId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const TicketForm = ({ pin, role, properties, preselectedPropertyId, onSuccess, onCancel }: TicketFormProps) => {
  const [propertyId, setPropertyId] = useState(preselectedPropertyId || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [photos, setPhotos] = useState<File[]>([]);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setVoiceBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos((prev) => [...prev, ...files].slice(0, 5));
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (!propertyId || !title.trim()) {
      toast.error("Property and title are required");
      return;
    }
    setSubmitting(true);
    try {
      // Upload media files first to get storage paths
      const tempId = crypto.randomUUID();
      const mediaEntries: { media_type: string; storage_path: string }[] = [];

      for (const photo of photos) {
        const url = await uploadTicketMedia(photo, tempId);
        mediaEntries.push({ media_type: "photo", storage_path: url });
      }

      if (voiceBlob) {
        const voiceFile = new File([voiceBlob], "voice-note.webm", { type: "audio/webm" });
        const url = await uploadTicketMedia(voiceFile, tempId);
        mediaEntries.push({ media_type: "voice_note", storage_path: url });
      }

      // Create ticket with media — edge function handles ticket_media inserts server-side
      await createTicket(pin, role, {
        property_id: propertyId,
        title: title.trim(),
        description: description.trim(),
        priority,
        media: mediaEntries.length > 0 ? mediaEntries : undefined,
      });

      toast.success("Issue created!");
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to create issue");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {!preselectedPropertyId && (
        <div>
          <Label>Property</Label>
          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
            <SelectContent>
              {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Broken shower head" />
      </div>

      <div>
        <Label>Description</Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue..."
          rows={3}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <Label>Priority</Label>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Photos */}
      <div>
        <Label>Photos (max 5)</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {photos.map((f, i) => (
            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
              <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {photos.length < 5 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Camera className="w-5 h-5" />
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handlePhotoAdd}
        />
      </div>

      {/* Voice Note */}
      <div>
        <Label>Voice Note</Label>
        <div className="flex items-center gap-2 mt-1">
          {!voiceBlob ? (
            <Button
              type="button"
              variant={recording ? "destructive" : "outline"}
              size="sm"
              onClick={recording ? stopRecording : startRecording}
            >
              {recording ? <><MicOff className="w-4 h-4 mr-1.5" />Stop Recording</> : <><Mic className="w-4 h-4 mr-1.5" />Record</>}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <audio controls src={URL.createObjectURL(voiceBlob)} className="h-8" />
              <Button variant="ghost" size="sm" onClick={() => setVoiceBlob(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        {onCancel && <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>}
        <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
          {submitting ? "Submitting..." : "Submit Issue"}
          {!submitting && <Upload className="w-4 h-4 ml-1.5" />}
        </Button>
      </div>
    </div>
  );
};
