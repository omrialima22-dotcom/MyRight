import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import Layout from "@/components/Layout";
import HebrewMarkdown from "@/components/HebrewMarkdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Sparkles, MessageCircle } from "lucide-react";

const SUGGESTIONS = [
  "מה זה תקופת המתנה בפוליסה?",
  "מה ההבדל בין השתתפות עצמית להשתתפות מדורגת?",
  "מה כדאי לבדוק לפני שמגישים תביעת ביטוח בריאות?",
  "כמה זמן לוקח לחברת ביטוח לאשר תביעה?"
];

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  const conversationId = user ? `user_${user.id}` : "guest";

  useEffect(() => {
    (async () => {
      try {
        const history = await base44.entities.ChatMessage.filter(
          { conversation_id: conversationId },
          "created_date",
          200
        );
        if (history.length > 0) {
          setMessages(history.map((m) => ({ role: m.role, content: m.content })));
        } else {
          setMessages([
            {
              role: "assistant",
              content: `שלום${user?.full_name ? " " + user.full_name : ""}! 👋\n\nאני העוזר האישי שלך לענייני ביטוח. אפשר לשאול אותי הכול – על הפוליסה שלך, על מונחים שלא הבנת, או על איך להגיש תביעה. אענה לך בעברית פשוטה וברורה.\n\nבמה אוכל לעזור?`
            }
          ]);
        }
      } catch (e) {
        setMessages([{ role: "assistant", content: "שלום! אני העוזר האישי שלך לענייני ביטוח. במה אוכל לעזור?" }]);
      }
      setLoading(false);
    })();
  }, [conversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput("");
    const userMsg = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setSending(true);
    try {
      await base44.entities.ChatMessage.create({ role: "user", content, conversation_id: conversationId });
      const res = await base44.functions.invoke("chatWithAssistant", {
        message: content,
        history: messages.filter((m) => m.role === "assistant" || m.role === "user")
      });
      const reply = res.data?.reply || "מצטער, לא הצלחתי לענות כעת. נסה שוב.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      await base44.entities.ChatMessage.create({ role: "assistant", content: reply, conversation_id: conversationId });
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "אירעה שגיאה. אנא נסה שוב בעוד רגע." }]);
    }
    setSending(false);
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 lg:py-8 flex flex-col" style={{ height: "calc(100vh - 60px)" }}>
        <div className="lg:hidden" />
        <div className="flex items-center gap-3 mb-4 px-1">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold">העוזר האישי</h1>
            <p className="text-xs text-muted-foreground">עונה בעברית פשוטה על כל שאלה בענייני ביטוח</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin space-y-4 px-1 pb-2">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin ml-2" /> טוען את השיחה…
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      m.role === "user"
                        ? "bg-muted text-foreground rounded-tr-sm"
                        : "bg-primary text-white rounded-tl-sm"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <HebrewMarkdown content={m.content} className="text-white [&_strong]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white" />
                    ) : (
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-end">
                  <div className="bg-primary text-white rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">העוזר חושב…</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && !sending && (
          <div className="flex flex-wrap gap-2 mb-3 px-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-sm bg-card border border-border rounded-full px-3.5 py-2 hover:border-primary/40 hover:bg-primary/5 transition-colors text-right"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="bg-card border border-border rounded-2xl p-2 flex items-end gap-2 shadow-sm">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="כתוב שאלה בעברית…"
            rows={1}
            className="border-0 resize-none focus-visible:ring-0 bg-transparent min-h-[44px] max-h-32"
          />
          <Button onClick={() => send()} disabled={sending || !input.trim()} size="icon" className="rounded-xl shrink-0 h-11 w-11">
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </Layout>
  );
}