import { apiFetch } from './apiClient';

export async function saveUserTemplate(name, description, settings) {
  const response = await apiFetch('/api/templates/user', {
    method: 'POST',
    body: JSON.stringify({ name, description, settings })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function deleteUserTemplate(id) {
  const response = await apiFetch(`/api/templates/user/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  return response.json();
}
