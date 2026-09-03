import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import HebrewMarkdown from "@/components/HebrewMarkdown";
import {
  Loader2,
  CheckCircle2,
  Circle,
  FileText,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  BookOpen,
  ShieldCheck,
  Download
} from "lucide-react";
import { cn } from "@/lib/utils";

const PROCESSING_STEPS = [
  "הקובץ התקבל",
  "קוראים את המסמך",
  "מזהים את מבנה הפוליסה",
  "מוצאים את הכיסויים"
];

export default function PolicyAnalysis({ policy, analyzing, onRun }) {
  const status = policy?.extraction_status;
  const hasFile = !!policy?.file_url;
  const coverages = policy?.coverages || [];
  const sections = policy?.document_sections || [];
  const metadata = policy?.policy_metadata;

  // No file attached
  if (!hasFile) {
    return (
      <Panel>
        <div className="flex flex-col items-center text-center py-6">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
            <FileText className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="font-medium mb-1">אין קובץ פוליסה מצורף</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            כדי ש-MyRight תוכל לקרוא ולנתח את הפוליסה, יש לצרף קובץ PDF של המסמך.
          </p>
        </div>
      </Panel>
    );
  }

  // Processing
  if (analyzing || status === "processing") {
    return (
      <Panel>
        <h2 className="font-heading text-lg font-semibold mb-1">אנחנו קוראים את הפוליסה שלך</h2>
        <p className="text-sm text-muted-foreground mb-6">זה עשוי לקחת כמה רגעים. אנחנו קוראים את המסמך עצמו — לא מנחשים.</p>
        <div className="space-y-3">
          {PROCESSING_STEPS.map((label, i) => {
            // Only "received" is certainly done while waiting; the rest are in progress or pending.
            const done = analyzing ? i === 0 : true;
            const inProgress = analyzing && i === 1;
            return (
              <div key={label} className="flex items-center gap-3">
                {done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : inProgress ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/30 shrink-0" />
                )}
                <span className={cn("text-[15px]", done ? "text-foreground" : inProgress ? "text-foreground" : "text-muted-foreground")}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>
    );
  }

  // Unreadable
  if (status === "unreadable") {
    return (
      <Panel>
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <p className="font-medium mb-1">לא הצלחנו לקרוא את הפוליסה בצורה אמינה</p>
          <p className="text-sm text-muted-foreground max-w-md mb-5">
            ייתכן שמדובר בקובץ סרוך ללא שכבת טקסט. כדי ש-MyRight תוכל לנתח את הפוליסה, מומלץ להעלות גרסה חיפושית (PDF עם שכבת טקסט) של המסמך. אנחנו לא רוצים לנחש עבורך.
          </p>
          <Button variant="outline" onClick={onRun}>
            <RefreshCw className="w-4 h-4 ml-2" /> ניסיון נוסף
          </Button>
        </div>
      </Panel>
    );
  }

  // Success or pending with no analysis yet
  const hasResults = status === "success" || coverages.length > 0 || !!policy?.analysis;

  if (!hasResults) {
    return (
      <Panel>
        <div className="flex flex-col items-center text-center py-4">
          <p className="text-sm text-muted-foreground mb-4">עדיין לא קראנו את הפוליסה הזו.</p>
          <Button onClick={onRun}>
            <BookOpen className="w-4 h-4 ml-2" /> לקרוא ולנתח את הפוליסה
          </Button>
        </div>
      </Panel>
    );
  }

  // Results
  return (
    <div className="space-y-4">
      {/* Header */}
      <Panel>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="font-heading text-lg font-semibold">קראנו את הפוליסה</h2>
          </div>
          <Button variant="outline" size="sm" onClick={onRun}>
            <RefreshCw className="w-4 h-4 ml-2" /> קריאה מחדש
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">המידע חולץ ישירות מהמסמך שהעלית. כל כיסוי מקושר לעמוד ולסעיף בפוליסה המקורית.</p>
      </Panel>

      {/* Detected metadata */}
      {metadata && (metadata.insurerName || metadata.policyName || metadata.policyNumber || metadata.insurancePeriod) && (
        <Panel>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">פרטים שזיהינו במסמך</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <MetaRow label="חברת ביטוח" value={metadata.insurerName} />
            <MetaRow label="שם הפוליסה" value={metadata.policyName} />
            <MetaRow label="מספר פוליסה" value={metadata.policyNumber} />
            <MetaRow label="תקופת הביטוח" value={metadata.insurancePeriod} />
          </div>
        </Panel>
      )}

      {/* Coverages */}
      {coverages.length > 0 ? (
        <div className="space-y-3">
          {coverages.map((c, i) => (
            <CoverageCard key={i} coverage={c} />
          ))}
        </div>
      ) : (
        <Panel>
          <p className="text-sm text-muted-foreground">קראנו את הפוליסה, אך לא זיהינו כיסויים מפורטים במסמך. הסיכום הכללי מופיע למטה.</p>
        </Panel>
      )}

      {/* Overall summary */}
      {policy?.analysis && (
        <Panel>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">סיכום הפוליסה במילים פשוטות</h3>
          <HebrewMarkdown content={policy.analysis} />
        </Panel>
      )}

      {/* Sections / source chunks */}
      {sections.length > 0 && (
        <SectionsList sections={sections} />
      )}

      {/* Original file */}
      <div className="flex justify-center pt-2">
        <a
          href={policy.file_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <Download className="w-4 h-4" /> צפייה בקובץ הפוליסה המקורי
        </a>
      </div>
    </div>
  );
}

function Panel({ children }) {
  return <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">{children}</div>;
}

function MetaRow({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-[15px] font-medium">{value}</p>
    </div>
  );
}

function CoverageCard({ coverage }) {
  const [showSource, setShowSource] = useState(false);
  const source = coverage.sourceText || coverage.sourceClause || coverage.sourcePage != null;
  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-heading font-semibold text-lg leading-snug">{coverage.name || "כיסוי"}</h3>
        {coverage.benefit && (
          <span className="shrink-0 text-sm font-semibold bg-tint-green/60 text-foreground px-3 py-1 rounded-full whitespace-nowrap">
            {coverage.benefit}
          </span>
        )}
      </div>

      {coverage.plainExplanation && (
        <p className="text-[15px] leading-relaxed text-foreground mb-3">{coverage.plainExplanation}</p>
      )}

      {(coverage.conditions || coverage.waitingPeriod || coverage.exclusions) && (
        <div className="space-y-1.5 mb-3">
          {coverage.waitingPeriod && <DetailLine label="תקופת המתנה/אכשרה" value={coverage.waitingPeriod} />}
          {coverage.conditions && <DetailLine label="תנאי זכאות" value={coverage.conditions} />}
          {coverage.exclusions && <DetailLine label="חריגים" value={coverage.exclusions} />}
        </div>
      )}

      {source && (
        <div className="border-t border-border pt-3">
          <button
            onClick={() => setShowSource((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <BookOpen className="w-4 h-4" />
            מה כתוב בפוליסה?
            <ChevronDown className={cn("w-4 h-4 transition-transform", showSource && "rotate-180")} />
          </button>
          {showSource && (
            <div className="mt-3 bg-muted/60 rounded-xl p-4 animate-fade-up">
              {(coverage.sourcePage != null || coverage.sourceClause) && (
                <p className="text-xs text-muted-foreground mb-2">
                  {coverage.sourcePage != null && <>עמוד {coverage.sourcePage}</>}
                  {coverage.sourcePage != null && coverage.sourceClause && " · "}
                  {coverage.sourceClause && <>סעיף {coverage.sourceClause}</>}
                </p>
              )}
              {coverage.sourceText ? (
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-foreground/90">{coverage.sourceText}</p>
              ) : (
                <p className="text-sm text-muted-foreground">לא זוהה נוסח מקור מדויק לכיסוי זה.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailLine({ label, value }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="text-foreground/90">{value}</span>
    </div>
  );
}

function SectionsList({ sections }) {
  const [open, setOpen] = useState(false);
  return (
    <Panel>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full"
      >
        <span className="text-sm font-medium text-muted-foreground">הסעיפים שזיהינו בפוליסה ({sections.length})</span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-4 space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
          {sections.map((s, i) => (
            <div key={i} className="border-t border-border pt-3 first:border-0 first:pt-0">
              <p className="text-sm font-medium mb-1">
                {s.sectionTitle || "סעיף"}
                {s.clauseNumber && <span className="text-muted-foreground"> · סעיף {s.clauseNumber}</span>}
                {(s.pageStart != null || s.pageEnd != null) && (
                  <span className="text-muted-foreground"> · עמוד {s.pageStart != null ? s.pageStart : ""}{s.pageEnd != null && s.pageEnd !== s.pageStart ? `–${s.pageEnd}` : ""}</span>
                )}
              </p>
              {s.text && <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-4">{s.text}</p>}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}