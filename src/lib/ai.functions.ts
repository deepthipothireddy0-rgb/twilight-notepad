import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SummarizeInput = z.object({
  text: z.string().min(1).max(20000),
});

export type NoteSummary = {
  title: string;
  summary: string;
  bullets: string[];
  tags: string[];
};

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    bullets: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
  },
  required: ["title", "summary", "bullets", "tags"],
};

export const summarizeNote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SummarizeInput.parse(input))
  .handler(async ({ data }): Promise<NoteSummary> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured yet.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        instructions:
          "You organize personal notes. Produce a short title (max 8 words), a one-paragraph summary, 3-6 concise action/idea bullets, and 2-5 lowercase single-word topic tags.",
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: data.text }],
          },
        ],
        reasoning: { effort: "low", summary: "auto" },
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: "note_summary",
            strict: true,
            schema,
          },
        },
      }),
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("AI is busy right now. Please try again shortly.");
      if (res.status === 402) throw new Error("AI credits are used up for this workspace.");
      throw new Error(`AI request failed (${res.status}). ${detail.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload);
          if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
            text += event.delta;
          } else if (event.type === "response.completed" && !text) {
            text = event.response?.output_text ?? "";
          }
        } catch {
          /* ignore partial events */
        }
      }
    }

    try {
      const parsed = JSON.parse(text) as NoteSummary;
      return {
        title: parsed.title ?? "",
        summary: parsed.summary ?? "",
        bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags.map((t) => t.toLowerCase()) : [],
      };
    } catch {
      throw new Error("AI returned an unexpected result. Please try again.");
    }
  });
