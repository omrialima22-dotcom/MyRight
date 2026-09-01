import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, ArrowRight } from "lucide-react";

export default function WizardShell({ stepIndex, steps, onBack, children }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const current = steps[stepIndex] || {};

  return (
    <div className="relative min-h-[calc(100vh-60px)]">
      <div className="max-w-2xl mx-auto px-5 py-8 lg:py-12 pb-28">
        {/* Where am I + progress */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3 text-sm">
            <span className="text-muted-foreground">איפה אני?</span>
            <span className="font-medium">{current.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {steps.map((s, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i <= stepIndex ? "bg-primary flex-1" : "bg-muted flex-1"
                }`}
              />
            ))}
          </div>
        </div>

        {children}
      </div>

      {/* Back button */}
      {stepIndex > 0 && (
        <button
          onClick={onBack}
          className="fixed bottom-6 right-6 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-card border border-border shadow-sm text-sm font-medium hover:bg-muted transition-colors z-30"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה
        </button>
      )}

      {/* Help button */}
      <button
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-6 left-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground shadow-lg text-sm font-medium hover:opacity-90 transition-opacity z-30"
      >
        <HelpCircle className="w-4 h-4" />
        אני צריך עזרה
      </button>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right">בוא נסביר את השלב הזה</DialogTitle>
          </DialogHeader>
          <p className="text-foreground leading-relaxed text-sm">{current.help}</p>
          <Button onClick={() => setHelpOpen(false)} className="w-full">הבנתי</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}