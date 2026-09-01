import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, Trash2, Loader2, ArrowLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function StepUpload({ files, setFiles, onNext }) {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (fileList) => {
    const arr = Array.from(fileList).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (arr.length === 0) {
      toast({ title: "ניתן להעלות קבצי PDF בלבד", variant: "destructive" });
      return;
    }
    setUploading(true);
    for (const f of arr) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        setFiles((prev) => [...prev, { file_url, name: f.name }]);
      } catch (e) {
        toast({ title: "ההעלאה נכשלה", description: e.message, variant: "destructive" });
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <h1 className="text-2xl lg:text-3xl font-heading font-bold mb-3 leading-tight">
        מצוין. עכשיו אפשר להעלות את הפוליסות
      </h1>
      <p className="text-muted-foreground text-base lg:text-lg leading-relaxed mb-6">
        העלה כאן את מסמכי הפוליסה שמצאת. אפשר להעלות כמה קבצים — אנחנו נעבור עליהם ונבדוק מה עשוי להיות רלוונטי למקרה שלך.
      </p>

      {/* Dropzone / picker */}
      <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors py-10 mb-5 cursor-pointer">
        <UploadCloud className="w-8 h-8 text-primary" />
        <span className="text-sm font-medium">לחצו לבחירת קבצי PDF</span>
        <span className="text-xs text-muted-foreground">ניתן להעלות מספר קבצים</span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
        />
      </label>

      {uploading && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          מעלה קבצים…
        </div>
      )}

      {/* Uploaded list */}
      {files.length > 0 && (
        <div className="space-y-2 mb-6">
          <p className="text-sm font-medium text-muted-foreground">קבצים שהועלו ({files.length})</p>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm font-medium truncate flex-1">{f.name}</span>
              <button
                onClick={() => removeFile(i)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                aria-label="הסר קובץ"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button
        onClick={onNext}
        disabled={files.length === 0 || uploading}
        size="lg"
        className="w-full h-12 text-base font-medium"
      >
        סיימתי להעלות — אפשר לבדוק
        <ArrowLeft className="w-5 h-5" />
      </Button>
    </div>
  );
}