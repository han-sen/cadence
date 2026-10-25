import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { EFFORT, MODEL, SYSTEM, userMessage } from "../../src/lib/lineage/prompt";
import { LineageChart } from "../../src/lib/lineage/schema";

export { EFFORT, MODEL };

export type GenerateResult = {
  chart: LineageChart;
  usage: { inputTokens: number; outputTokens: number };
  servedBy: string;
};

const client = new Anthropic();

export async function generateChart(artist: string, title: string): Promise<GenerateResult> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: EFFORT, format: zodOutputFormat(LineageChart) },
    system: SYSTEM,
    messages: [{ role: "user", content: userMessage(artist, title) }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`Refused (${response.stop_details?.category ?? "no category"})`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Hit max_tokens before the chart was complete");
  }
  if (!response.parsed_output) {
    throw new Error("Response didn't match the schema");
  }

  return {
    chart: response.parsed_output,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    servedBy: response.model,
  };
}
