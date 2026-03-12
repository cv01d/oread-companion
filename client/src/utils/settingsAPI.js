// Backend API client for settings persistence

const API_BASE = '/api/settings';

// Load settings from backend
export async function loadSettingsFromAPI() {
  try {
    const response = await fetch(API_BASE, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.settings;
  } catch (error) {
    console.error('Error loading settings from API:', error);
    return null;
  }
}

// Save settings to backend
export async function saveSettingsToAPI(settings) {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ settings })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.settings;
  } catch (error) {
    console.error('Error saving settings to API:', error);
    throw error;
  }
}

// Delete settings from backend (reset to defaults)
export async function deleteSettingsFromAPI() {
  try {
    const response = await fetch(API_BASE, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.settings;
  } catch (error) {
    console.error('Error deleting settings from API:', error);
    throw error;
  }
}

// Convenience wrapper functions for App.jsx
export async function loadSettings() {
  try {
    const settings = await loadSettingsFromAPI();
    return { success: !!settings, settings };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function saveSettings(settings) {
  try {
    await saveSettingsToAPI(settings);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function deleteSettings() {
  try {
    const settings = await deleteSettingsFromAPI();
    return { success: true, settings };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
