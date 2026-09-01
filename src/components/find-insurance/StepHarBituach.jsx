import React from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, ShieldAlert, ArrowLeft } from "lucide-react";

const HAR_BITUACH_URL = "https://harb.cma.gov.il/";

export default function StepHarBituach({ onNext }) {
  const openSite = () => window.open(HAR_BITUACH_URL, "_blank", "noopener,noreferrer");

  return (
    <div>
      <h1 className="text-2xl lg:text-3xl font-heading font-bold mb-3 leading-tight">
        נתחיל בהר הביטוח
      </h1>
      <p className="text-muted-foreground text-base lg:text-lg leading-relaxed mb-5">
        הר הביטוח הוא שירות ממשלתי שמאפשר לך לראות במקום אחד אילו מוצרי ביטוח רשומים על שמך.
      </p>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 mb-7">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-900 leading-relaxed font-medium">
          MyRight לעולם לא תבקש ממך את הסיסמה שלך להר הביטוח. הכניסה מתבצעת רק באתר הרשמי.
        </p>
      </div>

      <div className="space-y-3">
        <Button onClick={openSite} size="lg" className="w-full h-12 text-base font-medium">
          <ExternalLink className="w-5 h-5 ml-2" />
          פתח את הר הביטוח
        </Button>
        <Button onClick={onNext} variant="outline" size="lg" className="w-full h-12 text-base font-medium">
          פתחתי, מה עכשיו?
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}