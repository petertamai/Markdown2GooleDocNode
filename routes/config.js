const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');
const { body, validationResult } = require('express-validator');
const { logError } = require('../middleware/errorHandler');

const router = express.Router();

// Configuration file path
const CONFIG_FILE = path.join(__dirname, '../.env');
const CONFIG_FLAG_FILE = path.join(__dirname, '../data/config-completed.flag');

/**
 * Check if system is configured
 * @route GET /api/config/status
 */
router.get('/status', async (req, res) => {
    try {
        const isConfigured = await checkConfigurationStatus();
        const allowReconfigure = process.env.ALLOW_RECONFIGURE === 'true';
        
        res.json({
            configured: isConfigured,
            allowReconfigure: allowReconfigure,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logError('Configuration status check failed', error);
        res.json({
            configured: false,
            allowReconfigure: false,
            error: error.message
        });
    }
});

/**
 * Test Google credentials
 * @route POST /api/config/test
 */
router.post('/test', [
    body('clientId').notEmpty().withMessage('Client ID is required'),
    body('clientSecret').notEmpty().withMessage('Client Secret is required'),
    body('redirectUri')
        .notEmpty().withMessage('Redirect URI is required')
        .custom((value) => {
            // Allow localhost and standard HTTP/HTTPS URLs
            const urlPattern = /^https?:\/\/(localhost|127\.0\.0\.1|[\w.-]+)(:\d+)?(\/.*)?$/;
            if (!urlPattern.test(value)) {
                throw new Error('Invalid redirect URI format');
            }
            return true;
        })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { clientId, clientSecret, redirectUri } = req.body;

        console.log('🧪 Testing Google credentials...');

        // Validate Client ID format
        if (!clientId.includes('.apps.googleusercontent.com')) {
            return res.status(400).json({
                error: 'Invalid Client ID format. Should end with .apps.googleusercontent.com'
            });
        }

        // Validate Client Secret format
        if (!clientSecret.startsWith('GOCSPX-')) {
            return res.status(400).json({
                error: 'Invalid Client Secret format. Should start with GOCSPX-'
            });
        }

        // Test OAuth2 client creation
        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );

        // Generate test auth URL to verify credentials work
        const testAuthUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/documents',
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/userinfo.email'
            ],
            state: 'test'
        });

        if (!testAuthUrl || !testAuthUrl.includes('accounts.google.com')) {
            throw new Error('Failed to generate valid authentication URL');
        }

        console.log('✅ Credentials test successful');

        res.json({
            success: true,
            message: 'Credentials are valid and can generate authentication URLs',
            testDetails: {
                clientIdValid: true,
                clientSecretValid: true,
                redirectUriValid: true,
                authUrlGenerated: true
            }
        });

    } catch (error) {
        console.log('❌ Credentials test failed:', error.message);
        
        logError('Credential test failed', {
            error: error.message,
            clientId: req.body?.clientId?.substring(0, 10) + '...',
        });

        res.status(400).json({
            error: 'Credential test failed',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * Save configuration
 * @route POST /api/config/save
 */
router.post('/save', [
    body('clientId').notEmpty().withMessage('Client ID is required'),
    body('clientSecret').notEmpty().withMessage('Client Secret is required'),
    body('redirectUri')
        .notEmpty().withMessage('Redirect URI is required')
        .custom((value) => {
            // Allow localhost and standard HTTP/HTTPS URLs
            const urlPattern = /^https?:\/\/(localhost|127\.0\.0\.1|[\w.-]+)(:\d+)?(\/.*)?$/;
            if (!urlPattern.test(value)) {
                throw new Error('Invalid redirect URI format');
            }
            return true;
        })
], async (req, res) => {
    try {
        console.log('📥 Configuration save request received');
        console.log('📋 Request body:', {
            clientId: req.body.clientId ? req.body.clientId.substring(0, 20) + '...' : 'MISSING',
            clientSecret: req.body.clientSecret ? 'PROVIDED' : 'MISSING',
            redirectUri: req.body.redirectUri || 'MISSING'
        });

        // Check if reconfiguration is allowed
        const configStatus = await checkConfigurationStatus();
        const allowReconfigure = process.env.ALLOW_RECONFIGURE === 'true';
        
        if (configStatus && !allowReconfigure) {
            console.log('⚠️ Reconfiguration blocked - system already configured');
            return res.status(403).json({
                error: 'System is already configured',
                message: 'Set ALLOW_RECONFIGURE=true in .env to allow reconfiguration'
            });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('❌ Validation errors:', errors.array());
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array(),
                receivedData: {
                    hasClientId: !!req.body.clientId,
                    hasClientSecret: !!req.body.clientSecret,
                    hasRedirectUri: !!req.body.redirectUri,
                    clientIdLength: req.body.clientId?.length || 0,
                    clientSecretLength: req.body.clientSecret?.length || 0
                }
            });
        }

        const { clientId, clientSecret, redirectUri } = req.body;

        console.log('🧪 Testing credentials before saving...');

        // Test credentials first
        await testCredentials(clientId, clientSecret, redirectUri);

        console.log('💾 Credentials valid, saving configuration...');

        // Read existing .env file
        let envContent = '';
        try {
            envContent = await fs.readFile(CONFIG_FILE, 'utf8');
        } catch (error) {
            // .env file doesn't exist, create new one
            console.log('📄 Creating new .env file');
        }

        // Parse existing environment variables
        const envVars = parseEnvFile(envContent);

        // Update configuration values
        envVars.GOOGLE_CLIENT_ID = clientId;
        envVars.GOOGLE_CLIENT_SECRET = clientSecret;
        envVars.GOOGLE_REDIRECT_URI = redirectUri;
        
        // Ensure JWT secret exists
        if (!envVars.JWT_SECRET) {
            envVars.JWT_SECRET = generateSecureSecret();
        }

        // Set default values for optional vars
        if (!envVars.NODE_ENV) {
            envVars.NODE_ENV = 'development';
        }
        if (!envVars.PORT) {
            envVars.PORT = '3000';
        }
        
        // IMPORTANT: Disable reconfiguration after first setup for security
        // To allow reconfiguration later, manually change this to 'true' in .env
        if (!envVars.ALLOW_RECONFIGURE) {
            envVars.ALLOW_RECONFIGURE = 'false';
        }

        // Generate new .env content
        const newEnvContent = generateEnvContent(envVars);

        // Write configuration
        await fs.writeFile(CONFIG_FILE, newEnvContent, 'utf8');

        // Create configuration completion flag
        await fs.mkdir(path.dirname(CONFIG_FLAG_FILE), { recursive: true });
        await fs.writeFile(CONFIG_FLAG_FILE, JSON.stringify({
            configuredAt: new Date().toISOString(),
            version: '1.0.0'
        }), 'utf8');

        console.log('✅ Configuration saved successfully');

        res.json({
            success: true,
            message: 'Configuration saved successfully',
            requiresRestart: false, // We'll update process.env directly
            nextStep: 'You can now start using the converter'
        });

        // Update process.env immediately (for current session)
        process.env.GOOGLE_CLIENT_ID = clientId;
        process.env.GOOGLE_CLIENT_SECRET = clientSecret;
        process.env.GOOGLE_REDIRECT_URI = redirectUri;
        if (!process.env.JWT_SECRET) {
            process.env.JWT_SECRET = envVars.JWT_SECRET;
        }
        
        console.log('🔄 Environment variables updated in current process');
        console.log('📊 Updated env check:', {
            hasClientId: !!process.env.GOOGLE_CLIENT_ID,
            hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
            hasRedirectUri: !!process.env.GOOGLE_REDIRECT_URI,
            clientIdPrefix: process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + '...'
        });

    } catch (error) {
        console.log('💥 Configuration save failed:', error.message);
        
        logError('Configuration save failed', {
            error: error.message,
            clientId: req.body?.clientId?.substring(0, 10) + '...'
        });

        res.status(500).json({
            error: 'Failed to save configuration',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * Reset configuration (development only)
 * @route POST /api/config/reset
 */
router.post('/reset', async (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(404).json({ error: 'Endpoint not available in production' });
    }

    try {
        // Remove configuration flag
        try {
            await fs.unlink(CONFIG_FLAG_FILE);
        } catch (error) {
            // File doesn't exist, that's fine
        }

        // Reset environment variables in .env
        let envContent = '';
        try {
            envContent = await fs.readFile(CONFIG_FILE, 'utf8');
            const envVars = parseEnvFile(envContent);
            
            // Remove Google credentials
            delete envVars.GOOGLE_CLIENT_ID;
            delete envVars.GOOGLE_CLIENT_SECRET;
            delete envVars.GOOGLE_REDIRECT_URI;
            
            const newEnvContent = generateEnvContent(envVars);
            await fs.writeFile(CONFIG_FILE, newEnvContent, 'utf8');
        } catch (error) {
            // .env file handling error is non-critical
            console.warn('Could not update .env file:', error.message);
        }

        console.log('🔄 Configuration reset completed');

        res.json({
            success: true,
            message: 'Configuration reset successfully'
        });

    } catch (error) {
        logError('Configuration reset failed', error);
        res.status(500).json({
            error: 'Failed to reset configuration',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Helper functions

/**
 * Check if system is configured
 */
async function checkConfigurationStatus() {
    try {
        // Check if configuration flag exists
        await fs.access(CONFIG_FLAG_FILE);
        
        // Check if environment variables are set
        const hasRequiredVars = process.env.GOOGLE_CLIENT_ID && 
                                process.env.GOOGLE_CLIENT_SECRET && 
                                process.env.GOOGLE_REDIRECT_URI &&
                                process.env.JWT_SECRET;

        return hasRequiredVars;
    } catch (error) {
        return false;
    }
}

/**
 * Test credentials by creating OAuth client and generating URL
 */
async function testCredentials(clientId, clientSecret, redirectUri) {
    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
    );

    // Test by generating an auth URL
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/userinfo.profile'],
        state: 'test'
    });

    if (!authUrl || !authUrl.includes('accounts.google.com')) {
        throw new Error('Failed to generate valid authentication URL with provided credentials');
    }

    return true;
}

/**
 * Parse .env file content into object
 */
function parseEnvFile(content) {
    const envVars = {};
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const equalIndex = trimmed.indexOf('=');
        if (equalIndex > 0) {
            const key = trimmed.substring(0, equalIndex).trim();
            const value = trimmed.substring(equalIndex + 1).trim();
            
            // Remove quotes if present
            const unquotedValue = value.replace(/^["']|["']$/g, '');
            envVars[key] = unquotedValue;
        }
    }

    return envVars;
}

/**
 * Generate .env file content from variables object
 */
function generateEnvContent(envVars) {
    const lines = [
        '# MarkdownDocs Configuration',
        '# Generated on ' + new Date().toISOString(),
        '',
        '# Server Configuration',
        `NODE_ENV=${envVars.NODE_ENV || 'development'}`,
        `PORT=${envVars.PORT || '3000'}`,
        '',
        '# Google OAuth2 Configuration',
        `GOOGLE_CLIENT_ID=${envVars.GOOGLE_CLIENT_ID || ''}`,
        `GOOGLE_CLIENT_SECRET=${envVars.GOOGLE_CLIENT_SECRET || ''}`,
        `GOOGLE_REDIRECT_URI=${envVars.GOOGLE_REDIRECT_URI || ''}`,
        '',
        '# JWT Configuration',
        `JWT_SECRET=${envVars.JWT_SECRET || ''}`,
        `JWT_EXPIRES_IN=${envVars.JWT_EXPIRES_IN || '24h'}`,
        '',
        '# CORS Configuration',
        `ALLOWED_ORIGINS=${envVars.ALLOWED_ORIGINS || 'http://localhost:3000'}`,
        '',
        '# PM2 Configuration',
        `PM2_INSTANCES=${envVars.PM2_INSTANCES || 'max'}`,
        '',
        '# Security Configuration',
        `ALLOW_RECONFIGURE=${envVars.ALLOW_RECONFIGURE || 'false'}`,
        '',
        '# Rate Limiting',
        `RATE_LIMIT_WINDOW_MS=${envVars.RATE_LIMIT_WINDOW_MS || '900000'}`,
        `RATE_LIMIT_MAX_REQUESTS=${envVars.RATE_LIMIT_MAX_REQUESTS || '100'}`,
        `CONVERSION_RATE_LIMIT_MAX=${envVars.CONVERSION_RATE_LIMIT_MAX || '10'}`,
        ''
    ];

    return lines.join('\n');
}

/**
 * Generate cryptographically secure secret
 */
function generateSecureSecret() {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
}

module.exports = router;