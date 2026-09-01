import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import WizardShell from "@/components/find-insurance/WizardShell";
import StepHarBituach from "@/components/find-insurance/StepHarBituach";
import StepLogin from "@/components/find-insurance/StepLogin";
import StepFind from "@/components/find-insurance/StepFind";
import StepDownload from "@/components/find-insurance/StepDownload";
import StepUpload from "@/components/find-insurance/StepUpload";
import StepReview from "@/components/find-insurance/StepReview";
import { Loader2 } from "lucide-react";

const STEPS = [
  {
    label: "הר הביטוח",
    help: "הר הביטוח הוא שירות ממשלתי שמרכז את כל מוצרי הביטוח הרשומים על שמך. בשלב הזה אנחנו רק פותחים את האתר. MyRight לעולם לא מבקשת את הסיסמה שלך."
  },
  {
    label: "כניסה",
    help: "ההזדהות נעשית מול האתר הרשמי של הר הביטוח בלבד. אל תזין פרטי התחברות בתוך MyRight."
  },
  {
    label: "מציאת הביטוחים",
    help: "אנחנו מחפשים ביטוחים פרטיים (בריאות, חיים, אובדן כושר עבודה וכו׳). לא צריך להחליט מה רלוונטי — MyRight תנתח את זה בהמשך."
  },
  {
    label: "הורדת פוליסות",
    help: "הפוליסה היא המסמך שמפרט מה הביטוח מכסה. אם הר הביטוח מפנה אותך לחברת הביטוח, היכנס לאזור האישי שם והורד את מסמכי הפוליסה."
  },
  {
    label: "העלאה ל-MyRight",
    help: "כאן אתה מעלה את קבצי הפוליסה שהורדת. אפשר להעלות כמה קבצים, למחוק קובץ שגוי ולהוסיף נוספים. רק אחרי שמאשרים שסיימת, נתחיל לבדוק."
  },
  {
    label: "לפני הניתוח",
    help: "לפני שמתחיל הניתוח אנחנו מוודאים שהעלית את כל הפוליסות. אם לא בטוח, אפשר לחזור להדרכה ולהוסיף עוד קבצים."
  }
];

const UPLOAD_INDEX = 4;
const DOWNLOAD_INDEX = 3;

export default function FindInsurance() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [stepIndex, setStepIndex] = useState(0);
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (searchParams.get("skip") === "1") setStepIndex(UPLOAD_INDEX);
  }, [searchParams]);

  const next = () => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  const back = () => setStepIndex((i) => Math.max(0, i - 1));

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      for (const f of files) {
        const created = await base44.entities.Policy.create({
          insurance_company: "ביטוח פרטי (טרם זוהה)",
          policy_type: "other",
          file_url: f.file_url,
          notes: "הועלה דרך הליך מציאת הביטוחים. יש להשלים את פרטי החברה וסוג הביטוח לאחר זיהוי."
        });
        try {
          const res = await base44.functions.invoke("analyzePolicy", {
            insurance_company: created.insurance_company,
            policy_type: created.policy_type,
            file_url: created.file_url,
            notes: created.notes
          });
          if (res.data?.analysis) {
            await base44.entities.Policy.update(created.id, { analysis: res.data.analysis });
          }
        } catch {
          // analysis failure shouldn't block the flow
        }
      }
      toast({ title: "המסמכים הועלו והניתוח התחיל" });
      navigate("/policies");
    } catch (e) {
      toast({ title: "משהו השתבש", description: e.message, variant: "destructive" });
    }
    setProcessing(false);
  };

  const renderStep = () => {
    switch (stepIndex) {
      case 0:
        return <StepHarBituach onNext={next} />;
      case 1:
        return <StepLogin onNext={next} />;
      case 2:
        return <StepFind onNext={next} />;
      case 3:
        return <StepDownload onNext={next} />;
      case 4:
        return <StepUpload files={files} setFiles={setFiles} onNext={next} />;
      case 5:
        return (
          <StepReview
            files={files}
            processing={processing}
            onConfirm={handleConfirm}
            onBackToUpload={() => setStepIndex(UPLOAD_INDEX)}
            onBackToDownload={() => setStepIndex(DOWNLOAD_INDEX)}
          />
        );
      default:
        return null;
    }
  };

  if (processing) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-5 py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground">מעלה את המסמכים ומתחיל לנתח…</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <WizardShell stepIndex={stepIndex} steps={STEPS} onBack={back}>
        {renderStep()}
      </WizardShell>
    </Layout>
  );
}