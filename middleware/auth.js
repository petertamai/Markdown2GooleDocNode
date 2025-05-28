const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const { logError } = require('./errorHandler');
const apiKeyManager = require('../services/apiKeyManager');

/**
 * Middleware to authenticate users via API Key
 */
const authenticateUser = async (req, res, next) => {
  const requestId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const apiKey = req.headers['x-api-key'];
    
    console.log(`🔐 [${requestId}] Authentication attempt from IP: ${req.ip}`);
    console.log(`🔑 [${requestId}] API Key provided: ${apiKey ? apiKey.substring(0, 15) + '...' : 'NONE'}`);
    
    if (!apiKey) {
      console.log(`❌ [${requestId}] No API key provided`);
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid API key in X-API-Key header',
        requestId
      });
    }

    // Validate API key format
    if (!apiKey.startsWith('md2doc_')) {
      console.log(`❌ [${requestId}] Invalid API key format: ${apiKey}`);
      return res.status(401).json({
        error: 'Invalid API key format',
        message: 'API key must start with "md2doc_"',
        requestId
      });
    }

    console.log(`🔍 [${requestId}] Looking up API key in storage...`);

    // Get user data from API key
    const userData = await apiKeyManager.getUserByApiKey(apiKey);
    
    if (!userData) {
      console.log(`❌ [${requestId}] API key not found in storage: ${apiKey}`);
      return res.status(401).json({
        error: 'Invalid or expired API key',
        message: 'Please authenticate again to get a new API key',
        requestId
      });
    }

    console.log(`✅ [${requestId}] API key found for user: ${userData.email}`);

    // Check if API key is active
    if (!userData.active) {
      console.log(`❌ [${requestId}] API key is inactive: ${apiKey}`);
      return res.status(401).json({
        error: 'API key has been revoked',
        message: 'Please authenticate again to get a new API key',
        requestId
      });
    }

    console.log(`🔍 [${requestId}] API key is active, checking Google credentials...`);

    // Get authenticated Google client
    const authClient = apiKeyManager.getAuthenticatedClient(userData);

    // Test the Google credentials
    try {
      console.log(`🌐 [${requestId}] Testing Google API connection...`);
      const oauth2 = google.oauth2({ version: 'v2', auth: authClient });
      await oauth2.userinfo.get();
      console.log(`✅ [${requestId}] Google API test successful`);
    } catch (googleError) {
      console.log(`⚠️  [${requestId}] Google API test failed: ${googleError.message}`);
      
      if (googleError.code === 401) {
        console.log(`🔄 [${requestId}] Token expired, attempting refresh...`);
        // Token might be expired, trigger refresh
        try {
          await apiKeyManager.refreshUserTokens(apiKey);
          console.log(`✅ [${requestId}] Token refresh successful`);
          
          // Get updated data after refresh
          const refreshedData = await apiKeyManager.getUserByApiKey(apiKey);
          if (refreshedData) {
            userData.accessToken = refreshedData.accessToken;
            userData.tokenExpiry = refreshedData.tokenExpiry;
            console.log(`🔄 [${requestId}] Updated user data with new tokens`);
          }
        } catch (refreshError) {
          console.log(`❌ [${requestId}] Token refresh failed: ${refreshError.message}`);
          return res.status(401).json({
            error: 'Google authentication expired',
            message: 'Please re-authenticate with Google',
            requestId
          });
        }
      } else {
        throw googleError;
      }
    }

    console.log(`🎉 [${requestId}] Authentication successful for: ${userData.email}`);

    // Attach user authentication data to request
    req.userAuth = {
      requestId: requestId,
      apiKey: apiKey,
      userId: userData.userId,
      email: userData.email,
      name: userData.name,
      accessToken: userData.accessToken,
      refreshToken: userData.refreshToken,
      tokenExpiry: userData.tokenExpiry,
      authClient: apiKeyManager.getAuthenticatedClient(userData)
    };

    next();

  } catch (error) {
    console.log(`💥 [${requestId}] Authentication middleware error: ${error.message}`);
    
    logError('Authentication middleware failed', {
      requestId,
      error: error.message,
      hasApiKey: !!req.headers['x-api-key']
    });

    res.status(500).json({
      error: 'Authentication failed',
      requestId,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.userAuth = null;
      return next();
    }

    // Use the main authentication logic but don't fail
    await authenticateUser(req, res, next);

  } catch (error) {
    // Continue without authentication
    req.userAuth = null;
    next();
  }
};

/**
 * Middleware to check if user has specific Google scopes
 */
const requireScopes = (requiredScopes) => {
  return async (req, res, next) => {
    try {
      if (!req.userAuth) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: req.userAuth.accessToken
      });

      // Check token info to verify scopes
      const tokenInfo = await oauth2Client.getTokenInfo(req.userAuth.accessToken);
      const userScopes = tokenInfo.scopes || [];

      const hasRequiredScopes = requiredScopes.every(scope => 
        userScopes.includes(scope)
      );

      if (!hasRequiredScopes) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Additional Google permissions required',
          requiredScopes,
          userScopes
        });
      }

      next();

    } catch (error) {
      logError('Scope verification failed', error);
      res.status(500).json({
        error: 'Permission verification failed'
      });
    }
  };
};

module.exports = {
  authenticateUser,
  optionalAuth,
  requireScopes
};