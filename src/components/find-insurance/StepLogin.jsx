import React from "react";
import { Button } from "@/components/ui/button";
import { Lock, ArrowLeft } from "lucide-react";

export default function StepLogin({ onNext }) {
  return (
    <div>
      <h1 className="text-2xl lg:text-3xl font-heading font-bold mb-3 leading-tight">
        כניסה להר הביטוח
      </h1>
      <p className="text-muted-foreground text-base lg:text-lg leading-relaxed mb-5">
        מצוין. עכשיו היכנס להר הביטוח באמצעות ההזדהות שהאתר מבקש.
      </p>

      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/50 p-4 mb-7">
        <Lock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          אל תזין פרטי התחברות בתוך MyRight. ההזדהות נעשית רק מול האתר הרשמי של הר הביטוח.
        </p>
      </div>

      <Button onClick={onNext} size="lg" className="w-full h-12 text-base font-medium">
        נכנסתי
        <ArrowLeft className="w-5 h-5" />
      </Button>
    </div>
  );
}