const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

/**
 * Where a prediction was produced. The HTTP backend is used only when
 * VITE_API_BASE_URL is configured; otherwise the browser path keeps
 * static deployments interactive.
 */
export type PredictionSource = 'server' | 'browser-wasm' | 'browser-js-demo';

export interface PredictionResponse {
  prediction: number;
  confidence: number[];
  baseline_time_ms: number;
  optimized_time_ms: number;
  /**
   * Hidden-layer post-activation values (usually length 100, values in
   * [0, 1] after sigmoid). Present when the C++ server exposes
   * activation telemetry; omitted by older builds.
   */
  hidden_activations?: number[];
  /**
   * Per-input-pixel gradient of the argmax logit wrt the 784-dim input.
   * Used for saliency overlays. Optional for older servers.
   */
  input_grad?: number[];
  /**
   * Where this prediction ran. Populated by predict(); the raw server
   * response does not carry this field, it is stamped client-side.
   */
  source?: PredictionSource;
  /**
   * Compile-time vector ISA of the module that produced this result
   * (e.g. "simd128" for the browser WASM build). Optional; only the
   * WASM path reports it today.
   */
  build?: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  ready?: boolean;
  model_loaded?: boolean;
  model_path?: string;
  topology?: number[];
}

export function hasConfiguredBackend(): boolean {
  return API_BASE.length > 0;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function timeoutSignal(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  const abortFromParent = () => controller.abort(parent?.reason);
  if (parent) {
    if (parent.aborted) {
      abortFromParent();
    } else {
      parent.addEventListener('abort', abortFromParent, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timeoutId);
      parent?.removeEventListener('abort', abortFromParent);
    },
  };
}

async function fetchJson<T>(
  path: string,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  if (!hasConfiguredBackend()) {
    throw new Error('Backend API is not configured.');
  }

  const requestSignal = timeoutSignal(signal, timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: requestSignal.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Backend request failed with ${response.status}.`);
    }

    return (await response.json()) as T;
  } finally {
    requestSignal.cleanup();
  }
}

/**
 * Attempt the HTTP backend only when configured. If the request fails
 * for any reason (network error, non-2xx, timeout; abort from a stale
 * in-flight request is re-raised), fall back to browser inference so
 * the demo keeps working when the server is offline.
 *
 * The TS wrapper is imported dynamically so the wasm glue chunk does
 * not land in the initial bundle -- it only downloads if/when the
 * fallback path triggers and VITE_ENABLE_WASM is explicitly true.
 */
export async function predict(pixels: number[], signal?: AbortSignal): Promise<PredictionResponse> {
  if (!hasConfiguredBackend()) {
    const { classifyInBrowser } = await import('../lib/wasmClassifier');
    return classifyInBrowser(pixels);
  }

  try {
    const response = await fetchJson<PredictionResponse>(
      '/predict',
      {
        method: 'POST',
        body: JSON.stringify({ pixels }),
      },
      2000,
      signal,
    );
    return { ...response, source: 'server' };
  } catch (serverErr) {
    // A user-initiated abort should not spill over into the browser
    // path -- let the caller see the AbortError like before.
    if (signal?.aborted || isAbortError(serverErr)) {
      throw serverErr;
    }

    const { classifyInBrowser } = await import('../lib/wasmClassifier');
    const result = await classifyInBrowser(pixels);
    return { ...result, source: result.source ?? 'browser-wasm' };
  }
}

export async function healthCheck(): Promise<HealthResponse> {
  return fetchJson<HealthResponse>('/health', { method: 'GET' }, 1000);
}
