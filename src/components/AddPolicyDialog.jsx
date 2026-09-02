import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UploadCloud, FileText, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { policyTypeOptions } from "@/lib/hebrew";
import { useToast } from "@/components/ui/use-toast";

export default function AddPolicyDialog({ open, onOpenChange, onAdded }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState("");
  const [form, setForm] = useState({
    insurance_company: "",
    policy_type: "health",
    policy_number: "",
    start_date: "",
    end_date: "",
    coverage_amount: "",
    monthly_premium: "",
    notes: ""
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type && f.type !== "application/pdf") {
      toast({ title: "נא להעלות קובץ PDF בלבד", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file: f });
      setFile(f);
      setFileUrl(res.file_url);
    } catch (err) {
      toast({ title: "העלאת הקובץ נכשלה", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  };

  const clearFile = () => {
    setFile(null);
    setFileUrl("");
  };

  const handleSubmit = async () => {
    if (!form.insurance_company) {
      toast({ title: "יש למלא את שם חברת הביטוח", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        insurance_company: form.insurance_company,
        policy_type: form.policy_type,
        policy_number: form.policy_number,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        coverage_amount: form.coverage_amount ? Number(form.coverage_amount) : null,
        monthly_premium: form.monthly_premium ? Number(form.monthly_premium) : null,
        notes: form.notes,
        file_url: fileUrl || null,
        extraction_status: fileUrl ? "pending" : "pending"
      };
      const created = await base44.entities.Policy.create(payload);
      onAdded?.();
      setForm({ insurance_company: "", policy_type: "health", policy_number: "", start_date: "", end_date: "", coverage_amount: "", monthly_premium: "", notes: "" });
      clearFile();
      onOpenChange(false);
      // With a file attached, go to the live reading experience — the engine
      // reads the PDF there and surfaces real discoveries as they're saved.
      if (fileUrl) {
        navigate(`/analysis?ids=${created.id}`);
      } else {
        toast({ title: "הפוליסה נשמרה" });
      }
    } catch (e) {
      toast({ title: "שגיאה בשמירת הפוליסה", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const busy = saving || uploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">הוספת פוליסה חדשה</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* File upload */}
          <div className="space-y-1.5">
            <Label>קובץ פוליסה (PDF)</Label>
            {file ? (
              <div className="flex items-center justify-between bg-muted/60 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-sm truncate">{file.name}</span>
                </div>
                <button onClick={clearFile} className="text-muted-foreground hover:text-foreground shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl py-7 cursor-pointer hover:bg-muted/40 transition-colors">
                {uploading ? (
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                ) : (
                  <UploadCloud className="w-6 h-6 text-muted-foreground" />
                )}
                <span className="text-sm text-muted-foreground">{uploading ? "מעלה…" : "לחצו להעלות קובץ PDF"}</span>
                <input type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
              </label>
            )}
            <p className="text-xs text-muted-foreground">כדי ש-MyRight תנתח את הפוליסה, יש לצרף קובץ. אנחנו קוראים את תוכן המסמך עצמו.</p>
          </div>

          <div className="space-y-1.5">
            <Label>חברת ביטוח *</Label>
            <Input value={form.insurance_company} onChange={(e) => set("insurance_company", e.target.value)} placeholder="למשל: מגדל, כלל, הראל" />
          </div>
          <div className="space-y-1.5">
            <Label>סוג ביטוח</Label>
            <Select value={form.policy_type} onValueChange={(v) => set("policy_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {policyTypeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>מספר פוליסה</Label>
              <Input value={form.policy_number} onChange={(e) => set("policy_number", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>סכום כיסוי (₪)</Label>
              <Input type="number" value={form.coverage_amount} onChange={(e) => set("coverage_amount", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>תחילת הפוליסה</Label>
              <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>סיום הפוליסה</Label>
              <Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>פרמיה חודשית (₪)</Label>
            <Input type="number" value={form.monthly_premium} onChange={(e) => set("monthly_premium", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>הערות נוספות</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="פרטים נוספים שחשוב לך לשמור על הפוליסה" rows={3} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>ביטול</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            {uploading ? "מעלה…" : saving ? "שומר…" : "שמירה וניתוח"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}