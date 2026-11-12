import { z } from "zod";
import { executeExternal } from "../external/execute.js";

const responseSchema = z.object({
  model: z.string().min(1).max(80),
  status: z.literal("completed"),
  output: z.array(
    z.object({
      type: z.string(),
      content: z
        .array(z.object({ type: z.string(), text: z.string().optional() }))
        .optional(),
    }),
  ),
});

export function openAiFoodSuggestions<T>(
  resultSchema: z.ZodType<T>,
  body: Record<string, unknown>,
  options: {
    key: string;
    timeoutMs: number;
    request: typeof fetch;
    operation: string;
  },
) {
  return executeExternal(
    async (signal) => {
      const response = await options.request(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          signal,
          headers: {
            Authorization: `Bearer ${options.key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...body,
            store: false,
            max_output_tokens: 2000,
          }),
        },
      );
      if (!response.ok) throw new Error("Food suggestion request failed");
      const result = responseSchema.parse(await response.json());
      const output = result.output
        .filter((entry) => entry.type === "message")
        .flatMap((entry) => entry.content ?? []);
      const [message] = output;
      if (
        output.length !== 1 ||
        message?.type !== "output_text" ||
        !message.text
      )
        throw new Error("Response did not contain food suggestions");
      const payload: unknown = JSON.parse(message.text);
      return resultSchema.parse({
        ...z.object({ items: z.unknown() }).parse(payload),
        modelVersion: result.model,
      });
    },
    {
      provider: "openai",
      operation: options.operation,
      timeoutMs: options.timeoutMs,
      retries: 0,
      retryable: false,
    },
  );
}
