const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { google } = require('googleapis');
const { logError } = require('../middleware/errorHandler');

const API_KEYS_FILE = path.join(__dirname, '../data/api-keys.json');
const DATA_DIR = path.join(__dirname, '../data');

/**
 * API Key Manager - handles persistent storage and auto-refresh of Google tokens
 */
class ApiKeyManager {
  constructor() {
    this.apiKeys = new Map();
    this.refreshTimers = new Map();
    this.init();
  }

  async init() {
    try {
      // Ensure data directory exists
      await fs.mkdir(DATA_DIR, { recursive: true });
      
      // Load existing API keys
      await this.loadApiKeys();
      
      // Set up auto-refresh for all stored tokens
      this.setupAutoRefresh();
      
      console.log('✅ API Key Manager initialised successfully');
    } catch (error) {
      logError('Failed to initialise API Key Manager', error);
    }
  }

  /**
   * Load API keys from storage
   */
  async loadApiKeys() {
    try {
      const data = await fs.readFile(API_KEYS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      
      for (const [key, value] of Object.entries(parsed)) {
        this.apiKeys.set(key, {
          ...value,
          createdAt: new Date(value.createdAt),
          lastUsed: new Date(value.lastUsed),
          tokenExpiry: value.tokenExpiry ? new Date(value.tokenExpiry) : null
        });
      }
      
      console.log(`📂 Loaded ${this.apiKeys.size} API keys from storage`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logError('Failed to load API keys', error);
      }
      // File doesn't exist yet, start with empty map
    }
  }

  /**
   * Save API keys to storage
   */
  async saveApiKeys() {
    try {
      const data = Object.fromEntries(this.apiKeys);
      await fs.writeFile(API_KEYS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      logError('Failed to save API keys', error);
    }
  }

  /**
   * Generate a new API key for a user after OAuth
   */
  async createApiKey(userInfo, tokens) {
    try {
      // Generate short, readable API key
      const keyId = crypto.randomBytes(4).toString('hex');
      const apiKey = `md2doc_${keyId}`;
      
      const keyData = {
        userId: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: tokens.scope,
        createdAt: new Date(),
        lastUsed: new Date(),
        active: true
      };

      this.apiKeys.set(apiKey, keyData);
      await this.saveApiKeys();
      
      // Set up auto-refresh for this key
      this.scheduleTokenRefresh(apiKey);
      
      console.log(`🔑 Created API key: ${apiKey} for user: ${userInfo.email}`);
      
      return apiKey;
    } catch (error) {
      logError('Failed to create API key', error);
      throw error;
    }
  }

  /**
   * Get user data by API key
   */
  async getUserByApiKey(apiKey) {
    const keyData = this.apiKeys.get(apiKey);
    
    if (!keyData || !keyData.active) {
      return null;
    }

    // Update last used
    keyData.lastUsed = new Date();
    await this.saveApiKeys();

    // Check if token needs refresh
    if (this.needsTokenRefresh(keyData)) {
      await this.refreshUserTokens(apiKey);
      return this.apiKeys.get(apiKey); // Get updated data
    }

    return keyData;
  }

  /**
   * Check if token needs refresh (refresh 5 minutes before expiry)
   */
  needsTokenRefresh(keyData) {
    if (!keyData.tokenExpiry) return false;
    
    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
    return keyData.tokenExpiry.getTime() < fiveMinutesFromNow;
  }

  /**
   * Refresh Google tokens for a user
   */
  async refreshUserTokens(apiKey) {
    try {
      const keyData = this.apiKeys.get(apiKey);
      if (!keyData || !keyData.refreshToken) {
        throw new Error('No refresh token available');
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      oauth2Client.setCredentials({
        refresh_token: keyData.refreshToken
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update stored tokens
      keyData.accessToken = credentials.access_token;
      keyData.tokenExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
      
      this.apiKeys.set(apiKey, keyData);
      await this.saveApiKeys();
      
      console.log(`🔄 Refreshed tokens for API key: ${apiKey}`);
      
      // Reschedule next refresh
      this.scheduleTokenRefresh(apiKey);
      
      return keyData;
    } catch (error) {
      logError('Failed to refresh tokens', { apiKey, error });
      
      // If refresh fails, mark key as inactive
      const keyData = this.apiKeys.get(apiKey);
      if (keyData) {
        keyData.active = false;
        await this.saveApiKeys();
      }
      
      throw error;
    }
  }

  /**
   * Schedule automatic token refresh
   */
  scheduleTokenRefresh(apiKey) {
    const keyData = this.apiKeys.get(apiKey);
    if (!keyData || !keyData.tokenExpiry) return;

    // Clear existing timer
    if (this.refreshTimers.has(apiKey)) {
      clearTimeout(this.refreshTimers.get(apiKey));
    }

    // Schedule refresh 5 minutes before expiry
    const refreshTime = keyData.tokenExpiry.getTime() - Date.now() - (5 * 60 * 1000);
    
    if (refreshTime > 0) {
      const timer = setTimeout(async () => {
        try {
          await this.refreshUserTokens(apiKey);
        } catch (error) {
          logError('Scheduled token refresh failed', { apiKey, error });
        }
      }, refreshTime);
      
      this.refreshTimers.set(apiKey, timer);
      
      const refreshDate = new Date(Date.now() + refreshTime);
      console.log(`⏰ Scheduled token refresh for ${apiKey} at ${refreshDate.toISOString()}`);
    }
  }

  /**
   * Set up auto-refresh for all existing keys
   */
  setupAutoRefresh() {
    for (const [apiKey, keyData] of this.apiKeys.entries()) {
      if (keyData.active && keyData.tokenExpiry) {
        this.scheduleTokenRefresh(apiKey);
      }
    }
  }

  /**
   * List all API keys for a user
   */
  getUserApiKeys(userId) {
    const userKeys = [];
    
    for (const [apiKey, keyData] of this.apiKeys.entries()) {
      if (keyData.userId === userId) {
        userKeys.push({
          apiKey: apiKey,
          createdAt: keyData.createdAt,
          lastUsed: keyData.lastUsed,
          active: keyData.active,
          tokenExpiry: keyData.tokenExpiry
        });
      }
    }
    
    return userKeys;
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(apiKey) {
    const keyData = this.apiKeys.get(apiKey);
    if (keyData) {
      keyData.active = false;
      await this.saveApiKeys();
      
      // Clear refresh timer
      if (this.refreshTimers.has(apiKey)) {
        clearTimeout(this.refreshTimers.get(apiKey));
        this.refreshTimers.delete(apiKey);
      }
      
      console.log(`🚫 Revoked API key: ${apiKey}`);
      return true;
    }
    return false;
  }

  /**
   * Get OAuth2 client with user credentials
   */
  getAuthenticatedClient(keyData) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: keyData.accessToken,
      refresh_token: keyData.refreshToken
    });

    return oauth2Client;
  }

  /**
   * Cleanup expired and inactive keys (run periodically)
   */
  async cleanup() {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    let cleanupCount = 0;

    for (const [apiKey, keyData] of this.apiKeys.entries()) {
      // Remove inactive keys older than 30 days
      if (!keyData.active && keyData.lastUsed.getTime() < thirtyDaysAgo) {
        this.apiKeys.delete(apiKey);
        
        if (this.refreshTimers.has(apiKey)) {
          clearTimeout(this.refreshTimers.get(apiKey));
          this.refreshTimers.delete(apiKey);
        }
        
        cleanupCount++;
      }
    }

    if (cleanupCount > 0) {
      await this.saveApiKeys();
      console.log(`🧹 Cleaned up ${cleanupCount} expired API keys`);
    }
  }
}

// Create singleton instance
const apiKeyManager = new ApiKeyManager();

// Run cleanup every 24 hours
setInterval(() => {
  apiKeyManager.cleanup();
}, 24 * 60 * 60 * 1000);

module.exports = apiKeyManager;