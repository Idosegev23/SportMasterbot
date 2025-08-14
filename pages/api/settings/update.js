// Settings Update API Endpoint
// Allows updating system settings with validation and persistence

const fs = require('fs');
const path = require('path');

// Use memory cache for settings in serverless
let settingsCache = null;

// Default settings structure
const DEFAULT_SETTINGS = {
  autoPosting: {
    enabled: true,
    hoursBeforeMatch: 2,
    enablePredictions: true,
    enableResults: true,
    enablePromos: true,
    maxMatchesPerPost: 5
  },
  
  timing: {
    timezone: 'Africa/Addis_Ababa',
    predictionHours: [8, 10, 12, 14, 16, 18, 20], // 8 AM to 8 PM
    resultsHour: 23, // 11 PM
    promoHours: [10, 14, 18], // 10 AM, 2 PM, 6 PM
    analyticsHour: 0 // Midnight
  },
  
  content: {
    language: 'en', // English
    includeStatistics: true,
    includeH2H: true,
    generateImages: true,
    imageStyle: 'vivid',
    maxPredictionLength: 500,
    maxResultLength: 300
  },
  
  notifications: {
    notifyAdmins: true,
    notifyOnErrors: true,
    notifyOnSuccess: false,
    systemStatusUpdates: true
  },
  
  api: {
    retryAttempts: 3,
    retryDelay: 2000,
    timeout: 30000,
    fallbackOnError: true
  },
  
  limits: {
    maxDailyPosts: 50,
    maxApiCalls: 1000,
    rateLimitDelay: 100
  }
};

// Load current settings from cache
function loadSettings() {
  if (settingsCache === null) {
    // Initialize with defaults
    settingsCache = {
      ...DEFAULT_SETTINGS,
      lastUpdated: new Date().toISOString(),
      version: '1.0'
    };
  }
  return { ...settingsCache };
}

// Save settings to cache
function saveSettings(settings) {
  try {
    const dataToSave = {
      ...settings,
      lastUpdated: new Date().toISOString(),
      version: '1.0'
    };
    
    settingsCache = { ...dataToSave };
    return true;
  } catch (error) {
    console.error('Error saving settings to cache:', error);
    return false;
  }
}

// Deep merge objects
function mergeDeep(target, source) {
  const output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target))
          Object.assign(output, { [key]: source[key] });
        else
          output[key] = mergeDeep(target[key], source[key]);
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

// Validate settings
function validateSettings(settings) {
  const errors = [];

  // Validate autoPosting
  if (settings.autoPosting) {
    if (typeof settings.autoPosting.hoursBeforeMatch !== 'number' || 
        settings.autoPosting.hoursBeforeMatch < 0 || 
        settings.autoPosting.hoursBeforeMatch > 24) {
      errors.push('hoursBeforeMatch must be a number between 0 and 24');
    }
    
    if (typeof settings.autoPosting.maxMatchesPerPost !== 'number' || 
        settings.autoPosting.maxMatchesPerPost < 1 || 
        settings.autoPosting.maxMatchesPerPost > 10) {
      errors.push('maxMatchesPerPost must be a number between 1 and 10');
    }
  }

  // Validate timing
  if (settings.timing) {
    if (settings.timing.resultsHour !== undefined && 
        (typeof settings.timing.resultsHour !== 'number' || 
         settings.timing.resultsHour < 0 || 
         settings.timing.resultsHour > 23)) {
      errors.push('resultsHour must be a number between 0 and 23');
    }
    
    if (settings.timing.predictionHours && Array.isArray(settings.timing.predictionHours)) {
      if (settings.timing.predictionHours.some(h => typeof h !== 'number' || h < 0 || h > 23)) {
        errors.push('predictionHours must be an array of numbers between 0 and 23');
      }
    }
  }

  // Validate API settings
  if (settings.api) {
    if (settings.api.timeout !== undefined && 
        (typeof settings.api.timeout !== 'number' || settings.api.timeout < 1000)) {
      errors.push('API timeout must be at least 1000ms');
    }
    
    if (settings.api.retryAttempts !== undefined && 
        (typeof settings.api.retryAttempts !== 'number' || 
         settings.api.retryAttempts < 1 || 
         settings.api.retryAttempts > 10)) {
      errors.push('retryAttempts must be a number between 1 and 10');
    }
  }

  return errors;
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      message: 'Use POST to update settings'
    });
  }

  try {
    console.log('⚙️ API request to update settings...');

    const updates = req.body;
    
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No updates provided',
        message: 'Request body must contain settings to update'
      });
    }

    // Load current settings
    const currentSettings = loadSettings();
    
    // Merge updates with current settings
    const updatedSettings = mergeDeep(currentSettings, updates);
    
    // Validate the updated settings
    const validationErrors = validateSettings(updatedSettings);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Settings validation failed',
        validationErrors: validationErrors
      });
    }

    // Save updated settings
    if (saveSettings(updatedSettings)) {
      
      // Log the update
      console.log('✅ Settings updated successfully');
      console.log('Updated fields:', Object.keys(updates));

      return res.status(200).json({
        success: true,
        message: 'Settings updated successfully',
        updatedFields: Object.keys(updates),
        settings: updatedSettings,
        timestamp: new Date().toISOString()
      });
      
    } else {
      return res.status(500).json({
        success: false,
        error: 'Save failed',
        message: 'Failed to save updated settings'
      });
    }

  } catch (error) {
    console.error('❌ Error in settings update endpoint:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to update settings',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}