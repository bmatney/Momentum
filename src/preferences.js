export const PREFERENCES_KEY = 'momentum.preferences.v1';
export const defaultPreferences = { names: ['', ''], haptics: true, timerAlerts: false, keepAwake: false };

export function loadPreferences(storage) {
  try {
    const value = JSON.parse(storage.getItem(PREFERENCES_KEY));
    return {
      names: [0, 1].map(i => typeof value?.names?.[i] === 'string' ? value.names[i].slice(0, 24) : ''),
      haptics: typeof value?.haptics === 'boolean' ? value.haptics : true,
      timerAlerts: typeof value?.timerAlerts === 'boolean' ? value.timerAlerts : false,
      keepAwake: typeof value?.keepAwake === 'boolean' ? value.keepAwake : false,
    };
  } catch { return defaultPreferences; }
}

export function savePreferences(storage, preferences) {
  try { storage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); return true; }
  catch { return false; }
}
