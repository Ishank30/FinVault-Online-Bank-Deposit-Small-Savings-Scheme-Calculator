/**
 * FinVault Centralized API Configuration
 * Dynamically resolves backend API base URL from Vite environment variables.
 * Normalizes trailing slashes and naked hostnames.
 */

const envUrl = import.meta.env.VITE_API_URL;

// Normalize trailing slashes to prevent malformed routes
let resolvedUrl = envUrl && envUrl.trim() !== ""
  ? envUrl.trim().replace(/\/+$/, "")
  : "http://localhost:8000";

// Ensure protocol is present if a naked domain was supplied (e.g., in cloud dashboard settings)
if (resolvedUrl && !resolvedUrl.startsWith("http://") && !resolvedUrl.startsWith("https://")) {
  resolvedUrl = `https://${resolvedUrl}`;
}

export const API_BASE_URL = resolvedUrl;

// Log active target endpoint in non-production, dev, or debug mode
if (import.meta.env.DEV || import.meta.env.MODE !== "production" || (typeof window !== "undefined" && window.__FINVAULT_DEBUG__)) {
  console.info(`[FinVault] Connecting to backend at: ${API_BASE_URL}`);
}
