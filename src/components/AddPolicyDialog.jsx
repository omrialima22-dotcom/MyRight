import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { policyTypeOptions } from "@/lib/hebrew";
import { useToast } from "@/components/ui/use-toast";

export default function AddPolicyDialog({ open, onOpenChange, onAdded }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
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
        notes: form.notes
      };
      const created = await base44.entities.Policy.create(payload);

      // Kick off AI analysis in the background
      setAnalyzing(true);
      try {
        const res = await base44.functions.invoke("analyzePolicy", payload);
        await base44.entities.Policy.update(created.id, { analysis: res.data.analysis });
        toast({ title: "הפוליסה נוספה ונותחה בהצלחה" });
      } catch (e) {
        toast({ title: "הפוליסה נוספה, אך הניתוח נכשל – ניתן לנסות שוב מאוחר יותר", variant: "destructive" });
      }
      setAnalyzing(false);
      onAdded?.();
      onOpenChange(false);
      setForm({ insurance_company: "", policy_type: "health", policy_number: "", start_date: "", end_date: "", coverage_amount: "", monthly_premium: "", notes: "" });
    } catch (e) {
      toast({ title: "שגיאה בשמירת הפוליסה", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">הוספת פוליסה חדשה</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || analyzing}>ביטול</Button>
          <Button onClick={handleSubmit} disabled={saving || analyzing}>
            {(saving || analyzing) && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            {analyzing ? "מנתח את הפוליסה…" : saving ? "שומר…" : "שמירה וניתוח"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}