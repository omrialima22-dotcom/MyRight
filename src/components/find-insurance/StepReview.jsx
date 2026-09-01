import React from "react";
import { Button } from "@/components/ui/button";
import { FileCheck2, ArrowLeft } from "lucide-react";

export default function StepReview({ files, onConfirm, onBackToUpload, onBackToDownload, processing }) {
  return (
    <div>
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <FileCheck2 className="w-6 h-6 text-primary" />
      </div>

      <h1 className="text-2xl lg:text-3xl font-heading font-bold mb-3 leading-tight">
        לפני שנבדוק
      </h1>
      <p className="text-muted-foreground text-base lg:text-lg leading-relaxed mb-2">
        קיבלנו <span className="font-semibold text-foreground">{files.length}</span> מסמכים.
      </p>
      <p className="text-foreground text-lg font-medium mb-6">אלה כל הפוליסות שמצאת?</p>

      <div className="space-y-3">
        <Button
          onClick={onConfirm}
          disabled={processing}
          size="lg"
          className="w-full h-12 text-base font-medium"
        >
          כן, אפשר להמשיך
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Button
          onClick={onBackToUpload}
          variant="outline"
          size="lg"
          disabled={processing}
          className="w-full h-12 text-base font-medium"
        >
          מצאתי עוד פוליסה
        </Button>
        <Button
          onClick={onBackToDownload}
          variant="ghost"
          size="lg"
          disabled={processing}
          className="w-full h-12 text-base font-medium"
        >
          אני לא בטוח שהעליתי הכול
        </Button>
      </div>
    </div>
  );
}