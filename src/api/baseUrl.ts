/**
 * Centralized API Base URL configuration.
 * When running in the browser, requests must route to relative paths ('')
 * so they are served by the full-stack server on the same origin.
 * Prevents 'Failed to fetch' caused by localhost:8080 being queried from the browser.
 */
export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  // If undefined, empty, or pointing to localhost in a browser context, use relative root ''
  if (!envUrl || (typeof window !== 'undefined' && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')))) {
    return '';
  }
  return envUrl;
}

export const BASE_URL = getApiBaseUrl();
