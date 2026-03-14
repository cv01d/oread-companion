// Templates are loaded from data/templates/defaults/*.json via the backend API.
// Use loadTemplates() to fetch them, or access via the Zustand store (state.templates).

export async function loadTemplates() {
  const response = await fetch('/api/templates');
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to load templates');
  return data.templates;
}

export function getTemplateById(templates, id) {
  return templates.find(t => t.id === id) || null;
}

export function getTemplatesByCategory(templates, category) {
  return templates.filter(t => t.category === category);
}

export function getRoleplayTemplates(templates) {
  return getTemplatesByCategory(templates, 'roleplay');
}

export function getUtilityTemplates(templates) {
  return getTemplatesByCategory(templates, 'utility');
}
