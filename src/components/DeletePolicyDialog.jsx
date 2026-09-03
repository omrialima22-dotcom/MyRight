import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { base44 } from "@/api/base44Client";
import { Loader2, Trash2 } from "lucide-react";

export default function DeletePolicyDialog({ open, onOpenChange, policy, onDeleted }) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!policy?.id || deleting) return;
    setDeleting(true);
    try {
      await base44.entities.Policy.delete(policy.id);
      onOpenChange(false);
      onDeleted?.();
    } catch {}
    setDeleting(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-right">מחיקת פוליסה</AlertDialogTitle>
          <AlertDialogDescription className="text-right">
            האם אתה בטוח שברצונך למחוק את הפוליסה{policy?.insurance_company ? ` של ${policy.insurance_company}` : ""}? הפעולה בלתי הפיכה.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-start">
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {deleting ? "מוחק…" : "מחיקה"}
          </AlertDialogAction>
          <AlertDialogCancel disabled={deleting}>ביטול</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}