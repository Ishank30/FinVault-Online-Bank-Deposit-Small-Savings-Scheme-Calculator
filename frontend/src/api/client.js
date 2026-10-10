/**
 * FinVault India - Production Cloud API Client
 * Centralizes base URL configuration, cold-start telemetry, and network dispatch.
 */

// Read dynamically from Vite environment variables with fallback to local development server
const rawBaseUrl = (import.meta.env.VITE_API_URL || "http://localhost:8000").trim();
const normalizedUrl = (rawBaseUrl && !rawBaseUrl.startsWith("http://") && !rawBaseUrl.startsWith("https://"))
  ? `https://${rawBaseUrl}`
  : rawBaseUrl;
export const API_BASE_URL = normalizedUrl.replace(/\/+$/, '');

/**
 * Builds an absolute endpoint URL using the configured API_BASE_URL.
 * @param {string} endpoint - Path relative to base URL (e.g., '/api/calculate' or '/health')
 * @returns {string}
 */
export function getApiEndpoint(endpoint) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
}

/**
 * Lightweight probe to test backend connectivity and wake up free-tier cold instances.
 * @param {number} timeoutMs - Timeout limit in milliseconds
 * @returns {Promise<{ healthy: boolean, latencyMs: number, data?: any, error?: string }>}
 */
export async function checkBackendHealth(timeoutMs = 60000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();

  try {
    const response = await fetch(getApiEndpoint('/health'), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - start);

    if (response.ok) {
      const data = await response.json();
      return { healthy: true, latencyMs, data };
    }
    return {
      healthy: false,
      latencyMs,
      error: `Health check responded with status ${response.status}`
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - start);
    return {
      healthy: false,
      latencyMs,
      error: err.name === 'AbortError' ? 'Health check timed out' : (err.message || 'Connection failed')
    };
  }
}

/**
 * Dispatches an investment calculation request to FastAPI backend.
 * Parses text response first to avoid "Unexpected end of JSON input" on empty bodies or HTML errors.
 */
export async function calculateInvestmentApi(payload) {
  const cleanBaseUrl = API_BASE_URL;
  let res;

  try {
    res = await fetch(`${cleanBaseUrl}/api/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (fetchErr) {
    // Only attempt local IP fallback in local development mode
    if (cleanBaseUrl.includes('localhost')) {
      const fallbackUrl = 'http://127.0.0.1:8000/api/calculate';
      try {
        res = await fetch(fallbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        throw fetchErr;
      }
    } else {
      throw fetchErr;
    }
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Server returned non-JSON response (Status: ${res.status}): ${text || 'Empty response'}`);
  }

  if (!res.ok) {
    let errorDetail = data.detail || data.message || `Calculation failed with status ${res.status}`;
    if (Array.isArray(data.detail)) {
      errorDetail = data.detail.map(d => {
        const field = d.loc ? d.loc.filter(x => x !== 'body').join('.') : '';
        return field ? `${field}: ${d.msg}` : d.msg;
      }).join('; ');
    }
    const err = new Error(typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail));
    err.status = res.status;
    err.statusCode = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
