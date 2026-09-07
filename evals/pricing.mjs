/**
 * Per-million-token API prices, used to report what an eval run actually cost.
 *
 * Spend was previously invisible: the proxy returned only the generated text, so
 * a run's cost could not be known until the credit balance ran out.
 */
export const PRICING = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
};

export function costOf(model, usage) {
  const rate = PRICING[model];
  if (!rate || !usage) return null;
  const input = (usage.input_tokens ?? 0) / 1e6;
  const output = (usage.output_tokens ?? 0) / 1e6;
  return input * rate.input + output * rate.output;
}

export function formatUsd(value) {
  if (value == null) return "cost unknown";
  return value < 0.01 ? `<$0.01` : `$${value.toFixed(2)}`;
}
