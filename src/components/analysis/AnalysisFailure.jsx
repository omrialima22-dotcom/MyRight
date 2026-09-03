import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function AnalysisFailure({ count, onReupload }) {
  return (
    <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-100 mb-3">
        <AlertTriangle className="w-6 h-6 text-amber-600" />
      </div>
      <p className="font-semibold mb-1">
        לא הצלחנו לקרוא {count === 1 ? "פוליסה אחת" : `${count} פוליסות`}
      </p>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4 leading-relaxed">
        אנחנו לא רוצים לנחש. נסה להעלות גרסה ברורה יותר של המסמך (PDF עם שכבת טקסט).
      </p>
      <Button variant="outline" onClick={onReupload}>העלאת מסמך מחדש</Button>
    </div>
  );
}