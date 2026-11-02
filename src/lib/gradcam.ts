type GradcamSource = Record<string, unknown>;

const imageKeys = ['gradcam_image', 'gradcam_heatmap', 'heatmap', 'heatmap_url', 'gradcam_url', 'gradcam'];
const errorKeys = ['gradcam_error', 'heatmap_error', 'explainability_error'];

function getSources(rawOutput: Record<string, unknown> | null): GradcamSource[] {
  if (!rawOutput) return [];

  return [
    rawOutput,
    asRecord(rawOutput.model),
    asRecord(rawOutput.raw_model_response),
  ].filter((source): source is GradcamSource => source !== null);
}

function asRecord(value: unknown): GradcamSource | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as GradcamSource
    : null;
}

function getStringValue(sources: GradcamSource[], keys: string[]): string | null {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }

  return null;
}

export function getGradcamImage(rawOutput: Record<string, unknown> | null): string | null {
  return getStringValue(getSources(rawOutput), imageKeys);
}

export function getGradcamError(rawOutput: Record<string, unknown> | null): string | null {
  return getStringValue(getSources(rawOutput), errorKeys);
}
