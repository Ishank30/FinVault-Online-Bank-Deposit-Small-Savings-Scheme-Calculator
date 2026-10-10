/**
 * FinVault India - Production Cloud API Client
 * Centralizes base URL configuration, cold-start telemetry, and network dispatch.
 */

// Read dynamically from Vite environment variables with fallback to local development server
export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/+$/, '');

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
 * Handles local fallback if in development mode.
 */
export async function calculateInvestmentApi(payload) {
  const primaryUrl = getApiEndpoint('/api/calculate');
  let response;

  try {
    response = await fetch(primaryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (fetchErr) {
    // Only attempt local IP fallback in local development mode
    if (API_BASE_URL.includes('localhost')) {
      const fallbackUrl = 'http://127.0.0.1:8000/api/calculate';
      try {
        response = await fetch(fallbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } catch {
        throw fetchErr;
      }
    } else {
      throw fetchErr;
    }
  }

  return response;
}
