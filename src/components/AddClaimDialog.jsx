import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function AddClaimDialog({ open, onOpenChange, onAdded, policies = [] }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", policy_id: "", incident_date: "" });

  useEffect(() => {
    if (open) setForm({ title: "", description: "", policy_id: policies[0]?.id || "", incident_date: "" });
  }, [open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title || !form.description) {
      toast({ title: "יש למלא כותרת ותיאור לתביעה", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const selectedPolicy = policies.find((p) => p.id === form.policy_id);
      const payload = {
        title: form.title,
        description: form.description,
        policy_id: form.policy_id || null,
        status: "preparing",
        incident_date: form.incident_date || null
      };
      const created = await base44.entities.Claim.create(payload);

      // Auto-generate a checklist
      try {
        const res = await base44.functions.invoke("generateChecklist", {
          claim_title: form.title,
          claim_description: form.description,
          policy_type: selectedPolicy?.policy_type
        });
        await base44.entities.Claim.update(created.id, { checklist: res.data.checklist });
      } catch (e) {
        // non-fatal
      }

      toast({ title: "התביעה נוצרה והצ׳קליסט מוכן" });
      onAdded?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "שגיאה ביצירת התביעה", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">פתיחת תביעה חדשה</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>כותרת התביעה *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="למשל: ניתוח ברך – החזר הוצאות" />
          </div>
          <div className="space-y-1.5">
            <Label>תיאור המקרה *</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="תארו בקצרה מה קרה, מתי, ואיזה כיסוי אתם מבקשים" rows={4} />
          </div>
          <div className="space-y-1.5">
            <Label>פוליסה מקושרת</Label>
            <Select value={form.policy_id} onValueChange={(v) => set("policy_id", v)}>
              <SelectTrigger><SelectValue placeholder="בחירת פוליסה" /></SelectTrigger>
              <SelectContent>
                {policies.length === 0 && <SelectItem value={null} disabled>אין פוליסות עדיין</SelectItem>}
                {policies.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.insurance_company} – {p.policy_type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>תאריך האירוע</Label>
            <Input type="date" value={form.incident_date} onChange={(e) => set("incident_date", e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>ביטול</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            {saving ? "יוצר ומכין צ׳קליסט…" : "פתיחת תביעה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}