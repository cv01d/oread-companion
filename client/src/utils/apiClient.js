/**
 * Central API client.
 *
 * Usage: import { apiFetch } from './apiClient';
 *   apiFetch('/api/templates/active', { method: 'PUT', body: JSON.stringify(data) })
 *
 * The backend (oread-cli) does not use CSRF tokens, so this is a thin fetch wrapper
 * that just sets the JSON content type. `clearCsrfToken` is kept as a no-op so existing
 * callers don't break.
 */

export async function apiFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  return fetch(url, { ...options, headers });
}

// Retained as a no-op for backwards compatibility with existing callers.
export function clearCsrfToken() {}
