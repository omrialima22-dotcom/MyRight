import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildSystemPrompt } from "../../shared/hebrewContext.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { message, history = [] } = body;
    if (!message || typeof message !== 'string') {
      return Response.json({ error: 'חובה לשלוח הודעה' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt("אתה עונה כעת בצ׳אט עם המשתמש. תשובותיך קצרות, ברורות ומועילות. כתוב בעברית בלבד.");

    const historyBlock = (history || [])
      .map((m) => `${m.role === 'assistant' ? "עוזר" : "משתמש"}: ${m.content}`)
      .join("\n");

    const prompt = [
      systemPrompt,
      "",
      "--- היסטוריית שיחה ---",
      historyBlock || "(תחילת שיחה)",
      "",
      "--- הודעה חדשה מהמשתמש ---",
      message,
      "",
      "ענה כעת בעברית בלבד, בקצרה ובבהירות:"
    ].join("\n");

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude-sonnet-5'
    });

    const reply = typeof result === 'string' ? result : (result?.reply || String(result));
    return Response.json({ reply });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}