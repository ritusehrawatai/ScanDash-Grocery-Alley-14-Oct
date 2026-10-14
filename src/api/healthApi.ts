import { ApiResponse, HealthStatus } from '../types/health';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface HealthCheckResult {
  data: HealthStatus | null;
  latencyMs: number;
  rawJson: string;
  error?: string;
  statusText?: string;
}

export async function fetchHealthStatus(): Promise<HealthCheckResult> {
  const start = performance.now();
  try {
    const response = await fetch(`${BASE_URL}/api/v1/health`, {
      headers: {
        Accept: 'application/json',
      },
    });

    const latencyMs = Math.round(performance.now() - start);

    if (!response.ok) {
      const errText = await response.text();
      return {
        data: null,
        latencyMs,
        rawJson: errText,
        error: `HTTP ${response.status}: ${response.statusText}`,
        statusText: 'Service Unavailable',
      };
    }

    const json: ApiResponse<HealthStatus> = await response.json();
    return {
      data: json.data,
      latencyMs,
      rawJson: JSON.stringify(json, null, 2),
      statusText: json.message || 'OK',
    };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - start);
    const errorMessage = err instanceof Error ? err.message : 'Network error';
    return {
      data: null,
      latencyMs,
      rawJson: JSON.stringify({ error: errorMessage }, null, 2),
      error: errorMessage,
      statusText: 'Connection Failed',
    };
  }
}

export async function pingBackend(): Promise<{ success: boolean; latencyMs: number; response: string }> {
  const start = performance.now();
  try {
    const response = await fetch(`${BASE_URL}/api/v1/health/ping`);
    const latencyMs = Math.round(performance.now() - start);
    if (!response.ok) {
      return { success: false, latencyMs, response: `HTTP ${response.status}` };
    }
    const json = await response.json();
    return { success: true, latencyMs, response: json.data || 'pong' };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      success: false,
      latencyMs,
      response: err instanceof Error ? err.message : 'Network error',
    };
  }
}
