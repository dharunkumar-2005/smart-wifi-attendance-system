/**
 * Device Fingerprinting Utility
 * Creates a unique identifier for the device based on browser and hardware characteristics
 */

/**
 * Generate a unique device fingerprint
 * Uses: userAgent, screen resolution, color depth, timezone, language, and hardware concurrency
 */
export const generateDeviceFingerprint = async (): Promise<string> => {
  try {
    const fingerprint = {
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      maxTouchPoints: navigator.maxTouchPoints || 0,
    };

    // Create a hash from the fingerprint object
    const fingerprintString = JSON.stringify(fingerprint);
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprintString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  } catch (error) {
    console.error('Error generating device fingerprint:', error);
    // fallback: use a simple hash of userAgent if crypto fails
    const fallback = `device_${btoa(navigator.userAgent).slice(0, 32)}`;
    return fallback;
  }
};

/**
 * Get stored device fingerprint from localStorage
 * This ensures consistent fingerprint across browser sessions
 */
export const getStoredDeviceFingerprint = async (): Promise<string> => {
  const key = 'kncet_device_fingerprint';
  let stored = localStorage.getItem(key);

  if (!stored) {
    // Generate new fingerprint if not stored
    stored = await generateDeviceFingerprint();
    localStorage.setItem(key, stored);
  }

  return stored;
};

/**
 * Clear the stored device fingerprint
 * Used when user wants to reset device association
 */
export const clearStoredDeviceFingerprint = (): void => {
  const key = 'kncet_device_fingerprint';
  localStorage.removeItem(key);
};

/**
 * Check if a device fingerprint matches the current device
 */
export const verifyDeviceFingerprint = async (storedFingerprint: string): Promise<boolean> => {
  const currentFingerprint = await getStoredDeviceFingerprint();
  return currentFingerprint === storedFingerprint;
};
