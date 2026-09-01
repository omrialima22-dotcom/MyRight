import React from "react";
import { Button } from "@/components/ui/button";
import { FileText, Info, ArrowLeft } from "lucide-react";

export default function StepDownload({ onNext }) {
  return (
    <div>
      <h1 className="text-2xl lg:text-3xl font-heading font-bold mb-3 leading-tight">
        עכשיו נוריד את הפוליסות
      </h1>

      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 mb-5">
        <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm leading-relaxed">
          <span className="font-semibold">מה זו פוליסה? </span>
          הפוליסה היא המסמך שמפרט מה הביטוח שלך מכסה ובאילו תנאים.
        </p>
      </div>

      <p className="text-muted-foreground text-base leading-relaxed mb-3">
        בהר הביטוח חפש את האזור שבו מופיעים מסמכי הפוליסה, והורד אותם למחשב או לטלפון.
      </p>
      <p className="text-muted-foreground text-base leading-relaxed mb-5">
        לפעמים הר הביטוח מפנה אותך לאזור האישי אצל חברת הביטוח — שם תוכל להוריד את מסמכי הפוליסה ישירות.
      </p>

      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/50 p-4 mb-7">
        <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          אם לא מצאת מסמך לביטוח מסוים, זה בסדר — נמשיך עם מה שיש.
        </p>
      </div>

      <Button onClick={onNext} size="lg" className="w-full h-12 text-base font-medium">
        הורדתי את המסמכים
        <ArrowLeft className="w-5 h-5" />
      </Button>
    </div>
  );
}