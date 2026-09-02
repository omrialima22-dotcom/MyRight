import React from "react";
import { FileSearch } from "lucide-react";

export default function AnalysisHero() {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-tint-blue mb-4">
        <FileSearch className="w-8 h-8 text-accent" />
      </div>
      <h1 className="font-heading text-2xl sm:text-3xl font-bold mb-2">
        אנחנו עוברים על הביטוחים שלך
      </h1>
      <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
        כל פרט שמופיע כאן נמצא מתוך המסמכים שהעלית. אנחנו קוראים את הפוליסות בפועל — לא מנחשים.
      </p>
    </div>
  );
}