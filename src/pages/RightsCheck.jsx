import React, { useState } from "react";
import Layout from "@/components/Layout";
import { base44 } from "@/api/base44Client";
import ProgressHeader from "@/components/intake/ProgressHeader";
import StoryStep from "@/components/intake/StoryStep";
import QuestionStep from "@/components/intake/QuestionStep";
import TransitionStep from "@/components/intake/TransitionStep";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function RightsCheck() {
  const { toast } = useToast();
  const [phase, setPhase] = useState("story"); // story | questions | transition
  const [story, setStory] = useState("");
  const [answers, setAnswers] = useState([]);
  const [question, setQuestion] = useState(null);
  const [progressLabel, setProgressLabel] = useState("");
  const [timeline, setTimeline] = useState([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  const fillPercent = phase === "transition" ? 100 : Math.min(85, 12 + answers.length * 16);

  const fetchNext = async (currentStory, currentAnswers) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("guideIntake", {
        story: currentStory,
        answers: currentAnswers
      });
      const data = res.data || res;

      if (data.error) {
        toast({ title: "שגיאה", description: data.error, variant: "destructive" });
        return;
      }

      setProgressLabel(data.progress_label || progressLabel);
      if (data.timeline) setTimeline(data.timeline);

      if (data.done) {
        setSummary(data.summary || "");
        setPhase("transition");
        // Persist the health event so eligibility exploration can match it against policies.
        try {
          await base44.entities.HealthEvent.create({
            story: currentStory,
            answers: currentAnswers,
            summary: data.summary || "",
            timeline: data.timeline || []
          });
        } catch {}
      } else if (data.question) {
        setQuestion(data.question);
        setPhase("questions");
      }
    } catch (e) {
      toast({ title: "שגיאה", description: e.message || "משהו השתבש", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleStorySubmit = (text) => {
    setStory(text);
    fetchNext(text, []);
  };

  const handleAnswer = (answer) => {
    const entry = { question: question?.prompt || "", answer };
    const nextAnswers = [...answers, entry];
    setAnswers(nextAnswers);
    fetchNext(story, nextAnswers);
  };

  return (
    <Layout>
      <div className={cn("min-h-[calc(100vh-60px)]", phase === "transition" ? "bg-tint-mint" : "bg-tint-blue")}>
        <div className="max-w-3xl mx-auto px-5 py-8 lg:py-12">
        {phase !== "story" && (
          <ProgressHeader label={progressLabel} fillPercent={fillPercent} />
        )}

        {phase === "story" && <StoryStep onSubmit={handleStorySubmit} loading={loading} />}

        {phase === "questions" && (
          <QuestionStep question={question} onAnswer={handleAnswer} loading={loading} />
        )}

        {phase === "transition" && (
          <TransitionStep summary={summary} timeline={timeline} />
        )}
        </div>
      </div>
    </Layout>
  );
}