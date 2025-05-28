const express = require('express');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const { body, query, validationResult } = require('express-validator');
const { logError } = require('../middleware/errorHandler');
const apiKeyManager = require('../services/apiKeyManager');

const router = express.Router();

// Google OAuth2 client setup
let oauth2Client;

function initializeOAuth2Client() {
  console.log('🔧 Initializing OAuth2 client...');
  console.log('📊 Environment check:', {
    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasRedirectUri: !!process.env.GOOGLE_REDIRECT_URI,
    clientIdPrefix: process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + '...',
    redirectUri: process.env.GOOGLE_REDIRECT_URI
  });

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    console.error('❌ Missing required OAuth2 environment variables');
    return null;
  }

  oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  console.log('✅ OAuth2 client initialized successfully');
  return oauth2Client;
}

// Initialize on startup
oauth2Client = initializeOAuth2Client();

// Validate OAuth2 configuration on startup
if (!oauth2Client) {
  console.error('❌ Missing required Google OAuth2 environment variables');
  console.error('Required: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI');
} else {
  console.log('✅ Google OAuth2 client configured successfully');
}

// Required scopes for Google Drive and Docs
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
];

/**
 * Generate authentication URL for Google OAuth2
 * @route GET /api/auth/google
 */
router.get('/google', (req, res) => {
  try {
    console.log('🔐 OAuth URL request received');
    
    // Reinitialize OAuth client if needed (in case env vars were updated)
    if (!oauth2Client || !process.env.GOOGLE_CLIENT_ID) {
      console.log('🔄 Reinitializing OAuth2 client...');
      oauth2Client = initializeOAuth2Client();
    }

    if (!oauth2Client) {
      console.error('❌ OAuth2 client not available - missing configuration');
      return res.status(500).json({
        error: 'OAuth2 not configured',
        message: 'Google OAuth2 credentials are not properly configured'
      });
    }

    const returnUrl = req.query.returnUrl || req.headers.referer || '/setup';
    
    const state = jwt.sign(
      { 
        timestamp: Date.now(),
        returnUrl: returnUrl
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '10m' }
    );

    console.log('🌐 Generating OAuth URL with:', {
      scopes: SCOPES.length,
      returnUrl,
      hasState: !!state
    });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: state,
      prompt: 'consent' // Forces refresh token generation
    });

    console.log('✅ OAuth URL generated successfully');
    console.log('🔗 Auth URL preview:', authUrl.substring(0, 100) + '...');

    res.json({
      authUrl,
      message: 'Visit the provided URL to authorise the application'
    });

  } catch (error) {
    console.error('💥 OAuth URL generation failed:', error);
    logError('OAuth URL generation failed', error);
    res.status(500).json({ 
      error: 'Failed to generate authentication URL',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Handle Google OAuth2 callback
 * @route GET /api/auth/callback
 */
router.get('/callback', [
  query('code').notEmpty().withMessage('Authorization code is required'),
  query('state').notEmpty().withMessage('State parameter is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { code, state } = req.query;

    console.log('🔄 Processing OAuth callback with code:', code ? code.substring(0, 20) + '...' : 'MISSING');

    // Verify state parameter
    let stateData;
    try {
      stateData = jwt.verify(state, process.env.JWT_SECRET);
      console.log('✅ State parameter verified successfully');
    } catch (stateError) {
      console.log('❌ State verification failed:', stateError.message);
      return res.status(400).json({ 
        error: 'Invalid or expired state parameter'
      });
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // Log token info for debugging (remove in production)
    console.log('🔑 Tokens received:', {
      access_token: tokens.access_token ? '***EXISTS***' : 'MISSING',
      refresh_token: tokens.refresh_token ? '***EXISTS***' : 'MISSING',
      scope: tokens.scope,
      token_type: tokens.token_type,
      expiry_date: tokens.expiry_date
    });

    // Set credentials on the oauth2Client
    oauth2Client.setCredentials(tokens);

    // Verify we have required credentials
    if (!tokens.access_token) {
      throw new Error('No access token received from Google');
    }

    // Get user info using the authenticated client
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Generate persistent API key
    const apiKey = await apiKeyManager.createApiKey(userInfo.data, tokens);

    // Determine redirect URL from state
    const returnUrl = stateData.returnUrl || '/setup';
    const isSetupFlow = returnUrl.includes('/setup') || returnUrl.includes('setup');

    // Success response with API key
    if (isSetupFlow) {
      // Redirect back to setup page with API key
      const setupUrl = returnUrl.includes('?') 
        ? `${returnUrl}&apiKey=${apiKey}`
        : `${returnUrl}?apiKey=${apiKey}`;
      res.redirect(setupUrl);
    } else if (process.env.CLIENT_SUCCESS_REDIRECT) {
      const separator = process.env.CLIENT_SUCCESS_REDIRECT.includes('?') ? '&' : '?';
      res.redirect(`${process.env.CLIENT_SUCCESS_REDIRECT}${separator}apiKey=${apiKey}`);
    } else {
      res.json({
        success: true,
        apiKey: apiKey,
        user: {
          id: userInfo.data.id,
          email: userInfo.data.email,
          name: userInfo.data.name,
          picture: userInfo.data.picture
        },
        message: 'Authentication successful - save this API key for future requests',
        usage: {
          header: 'X-API-Key',
          example: `X-API-Key: ${apiKey}`
        }
      });
    }

  } catch (error) {
    logError('OAuth callback failed', error);
    
    console.log('❌ OAuth callback error details:', {
      message: error.message,
      code: error.code,
      status: error.status
    });
    
    // Try to get returnUrl from state for error redirect
    let returnUrl = '/setup';
    try {
      const { code, state } = req.query;
      if (state) {
        const stateData = jwt.verify(state, process.env.JWT_SECRET);
        returnUrl = stateData.returnUrl || '/setup';
      }
    } catch (stateError) {
      // Use default returnUrl
    }
    
    const isSetupFlow = returnUrl.includes('/setup') || returnUrl.includes('setup');
    
    if (isSetupFlow) {
      // Redirect back to setup page with error
      const setupErrorUrl = returnUrl.includes('?') 
        ? `${returnUrl}&error=auth_failed`
        : `${returnUrl}?error=auth_failed`;
      res.redirect(setupErrorUrl);
    } else if (process.env.CLIENT_ERROR_REDIRECT) {
      const separator = process.env.CLIENT_ERROR_REDIRECT.includes('?') ? '&' : '?';
      res.redirect(`${process.env.CLIENT_ERROR_REDIRECT}${separator}error=auth_failed`);
    } else {
      // Provide more specific error information
      let errorMessage = 'Authentication failed';
      let statusCode = 500;
      
      if (error.code === 400) {
        errorMessage = 'Invalid authorization code or request';
        statusCode = 400;
      } else if (error.code === 401) {
        errorMessage = 'Google authentication failed - please check your OAuth2 configuration';
        statusCode = 401;
      }
      
      res.status(statusCode).json({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        suggestion: 'Please try the authentication process again'
      });
    }
  }
});

/**
 * Refresh access token
 * @route POST /api/auth/refresh
 */
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { refreshToken } = req.body;

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    // Refresh the access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Generate new JWT with updated tokens
    const userToken = jwt.sign({
      ...jwt.decode(req.headers.authorization?.replace('Bearer ', '')),
      accessToken: credentials.access_token,
      tokenExpiry: credentials.expiry_date
    }, process.env.JWT_SECRET, { 
      expiresIn: process.env.JWT_EXPIRES_IN || '24h' 
    });

    res.json({
      success: true,
      token: userToken,
      expiresAt: credentials.expiry_date
    });

  } catch (error) {
    logError('Token refresh failed', error);
    res.status(401).json({ 
      error: 'Failed to refresh token',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Logout user
 * @route POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  try {
    // In a production environment, you might want to:
    // 1. Revoke the Google tokens
    // 2. Add JWT to a blacklist
    // 3. Clear client-side storage
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    logError('Logout failed', error);
    res.status(500).json({ 
      error: 'Logout failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get current user info by API key
 * @route GET /api/auth/user
 */
router.get('/user', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required in X-API-Key header' });
    }

    const userData = await apiKeyManager.getUserByApiKey(apiKey);
    if (!userData) {
      return res.status(401).json({ error: 'Invalid or expired API key' });
    }
    
    res.json({
      user: {
        id: userData.userId,
        email: userData.email,
        name: userData.name,
        picture: userData.picture
      },
      apiKey: {
        createdAt: userData.createdAt,
        lastUsed: userData.lastUsed,
        tokenExpiry: userData.tokenExpiry
      }
    });

  } catch (error) {
    logError('Get user info failed', error);
    res.status(500).json({ 
      error: 'Failed to retrieve user information',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * List all API keys for current user
 * @route GET /api/auth/keys
 */
router.get('/keys', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required in X-API-Key header' });
    }

    const userData = await apiKeyManager.getUserByApiKey(apiKey);
    if (!userData) {
      return res.status(401).json({ error: 'Invalid or expired API key' });
    }

    const userKeys = apiKeyManager.getUserApiKeys(userData.userId);
    
    res.json({
      success: true,
      keys: userKeys,
      total: userKeys.length
    });

  } catch (error) {
    logError('Get API keys failed', error);
    res.status(500).json({ 
      error: 'Failed to retrieve API keys',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Revoke an API key
 * @route DELETE /api/auth/keys/:keyId
 */
router.delete('/keys/:keyId', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const keyToRevoke = req.params.keyId;
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required in X-API-Key header' });
    }

    const userData = await apiKeyManager.getUserByApiKey(apiKey);
    if (!userData) {
      return res.status(401).json({ error: 'Invalid or expired API key' });
    }

    // Check if the key to revoke belongs to this user
    const keyData = await apiKeyManager.getUserByApiKey(keyToRevoke);
    if (!keyData || keyData.userId !== userData.userId) {
      return res.status(403).json({ error: 'Cannot revoke API key that does not belong to you' });
    }

    const revoked = await apiKeyManager.revokeApiKey(keyToRevoke);
    
    if (revoked) {
      res.json({
        success: true,
        message: 'API key revoked successfully'
      });
    } else {
      res.status(404).json({ error: 'API key not found' });
    }

  } catch (error) {
    logError('Revoke API key failed', error);
    res.status(500).json({ 
      error: 'Failed to revoke API key',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Generate a new API key (re-authenticate)
 * @route POST /api/auth/regenerate
 */
router.post('/regenerate', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required in X-API-Key header' });
    }

    const userData = await apiKeyManager.getUserByApiKey(apiKey);
    if (!userData) {
      return res.status(401).json({ error: 'Invalid or expired API key' });
    }

    // Create new API key with existing tokens
    const newApiKey = await apiKeyManager.createApiKey({
      id: userData.userId,
      email: userData.email,
      name: userData.name,
      picture: userData.picture
    }, {
      access_token: userData.accessToken,
      refresh_token: userData.refreshToken,
      expiry_date: userData.tokenExpiry?.getTime(),
      scope: userData.scope
    });

    res.json({
      success: true,
      apiKey: newApiKey,
      message: 'New API key generated successfully',
      usage: {
        header: 'X-API-Key',
        example: `X-API-Key: ${newApiKey}`
      }
    });

  } catch (error) {
    logError('API key regeneration failed', error);
    res.status(500).json({ 
      error: 'Failed to regenerate API key',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
module.exports.initializeOAuth2Client = initializeOAuth2Client;