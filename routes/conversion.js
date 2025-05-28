const express = require('express');
const { google } = require('googleapis');
const { body, query, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { logError } = require('../middleware/errorHandler');
const apiKeyManager = require('../services/apiKeyManager');

const router = express.Router();

// Conversion-specific rate limiting
const conversionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 conversions per 15 minutes
  message: { error: 'Too many conversion requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Convert markdown to Google Doc
 * @route POST /api/convert/markdown-to-doc
 */
router.post('/markdown-to-doc', conversionLimiter, [
  body('content')
    .isLength({ min: 1, max: 1000000 })
    .withMessage('Content must be between 1 character and 1MB'),
  body('title')
    .optional()
    .isLength({ max: 200 })
    .trim()
    .withMessage('Title cannot exceed 200 characters'),
  body('folderId')
    .optional()
    .isString()
    .withMessage('Folder ID must be a string'),
  body('sharing')
    .optional()
    .isObject()
    .withMessage('Sharing settings must be an object')
], async (req, res) => {
  const startTime = Date.now();
  const requestId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`\n🔄 [${requestId}] CONVERSION STARTED`);
  console.log(`📝 Content length: ${req.body?.content?.length || 0} characters`);
  console.log(`📋 Title: "${req.body?.title || 'Untitled Document'}"`);
  console.log(`🔑 API Key: ${req.headers['x-api-key'] || 'MISSING'}`);
  console.log(`🌐 IP: ${req.ip}`);

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(`❌ [${requestId}] Validation failed:`, errors.array());
      return res.status(422).json({
        error: 'Validation failed',
        details: errors.array(),
        requestId
      });
    }

    const { content, title = 'Untitled Document', folderId, sharing } = req.body;
    const userAuth = req.userAuth; // Added by authentication middleware

    console.log(`✅ [${requestId}] Authentication successful for user: ${userAuth.email}`);
    console.log(`👤 [${requestId}] User: ${userAuth.name} (${userAuth.userId})`);

    // Use the authenticated Google client from the middleware
    const drive = google.drive({ version: 'v3', auth: userAuth.authClient });

    // Prepare file metadata
    const fileMetadata = {
      name: title,
      mimeType: 'application/vnd.google-apps.document'
    };

    // Add to specific folder if provided
    if (folderId) {
      fileMetadata.parents = [folderId];
      console.log(`📁 [${requestId}] Adding to folder: ${folderId}`);
    }

    // Prepare media content
    const media = {
      mimeType: 'text/markdown',
      body: content
    };

    console.log(`🚀 [${requestId}] Starting Google Drive API call...`);
    
    // Create the document using Google's native Markdown conversion
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id,name,webViewLink,webContentLink,createdTime,size'
    });

    const documentData = response.data;
    console.log(`✅ [${requestId}] Google Drive API call successful!`);
    console.log(`📄 [${requestId}] Document ID: ${documentData.id}`);
    console.log(`🔗 [${requestId}] Document URL: ${documentData.webViewLink}`);

    // Apply sharing settings if provided
    if (sharing) {
      console.log(`🔐 [${requestId}] Applying sharing settings...`);
      await applySharing(drive, documentData.id, sharing, requestId);
    }

    // Calculate processing time
    const processingTime = Date.now() - startTime;

    // Log successful conversion
    console.log(`🎉 [${requestId}] CONVERSION COMPLETED SUCCESSFULLY!`);
    console.log(`⏱️  [${requestId}] Processing time: ${processingTime}ms`);
    console.log(`📊 [${requestId}] Document size: ${documentData.size || 'unknown'} bytes`);
    console.log(`🔗 [${requestId}] View document: ${documentData.webViewLink}`);
    console.log(`👤 [${requestId}] Created by: ${userAuth.email} using API key: ${userAuth.apiKey}`);

    res.status(201).json({
      success: true,
      requestId,
      document: {
        id: documentData.id,
        name: documentData.name,
        webViewLink: documentData.webViewLink,
        webContentLink: documentData.webContentLink,
        createdTime: documentData.createdTime,
        size: documentData.size
      },
      processing: {
        timeMs: processingTime,
        contentLength: content.length
      },
      message: 'Markdown successfully converted to Google Doc'
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.log(`❌ [${requestId}] CONVERSION FAILED after ${processingTime}ms`);
    console.log(`💥 [${requestId}] Error type: ${error.constructor.name}`);
    console.log(`📝 [${requestId}] Error message: ${error.message}`);
    console.log(`🔢 [${requestId}] Error code: ${error.code}`);
    console.log(`📊 [${requestId}] Error status: ${error.status}`);
    
    if (error.response) {
      console.log(`🌐 [${requestId}] Response status: ${error.response.status}`);
      console.log(`📄 [${requestId}] Response data:`, error.response.data);
    }

    logError('Markdown conversion failed', {
      requestId,
      error: error.message,
      userId: req.userAuth?.userId,
      contentLength: req.body?.content?.length,
      processingTime
    });

    // Handle specific Google API errors
    if (error.code === 401) {
      console.log(`🔒 [${requestId}] Authentication expired - user needs to re-authenticate`);
      return res.status(401).json({
        error: 'Authentication expired',
        message: 'Please refresh your authentication token',
        requestId
      });
    }

    if (error.code === 403) {
      console.log(`⛔ [${requestId}] Insufficient permissions`);
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Unable to create document with current permissions',
        requestId
      });
    }

    if (error.code === 400) {
      console.log(`📝 [${requestId}] Invalid markdown content`);
      return res.status(400).json({
        error: 'Invalid request',
        message: 'The markdown content could not be processed',
        requestId
      });
    }

    console.log(`🔥 [${requestId}] Returning 500 error to client`);
    res.status(500).json({
      error: 'Conversion failed',
      requestId,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get conversion history for the authenticated user
 * @route GET /api/convert/history
 */
router.get('/history', async (req, res) => {
  try {
    const userAuth = req.userAuth;
    const { limit = 20, pageToken } = req.query;

    const drive = google.drive({ version: 'v3', auth: userAuth.authClient });

    // Get user's Google Docs
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.document' and trashed=false",
      orderBy: 'createdTime desc',
      pageSize: Math.min(parseInt(limit), 100),
      pageToken: pageToken,
      fields: 'nextPageToken,files(id,name,createdTime,modifiedTime,webViewLink,size)'
    });

    res.json({
      success: true,
      documents: response.data.files,
      nextPageToken: response.data.nextPageToken,
      totalResults: response.data.files.length
    });

  } catch (error) {
    logError('Get conversion history failed', {
      error: error.message,
      userId: req.userAuth?.userId
    });

    res.status(500).json({
      error: 'Failed to retrieve conversion history',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Delete a document
 * @route DELETE /api/convert/document/:documentId
 */
router.delete('/document/:documentId', [
  param('documentId').notEmpty().withMessage('Document ID is required')
], async (req, res) => {
  try {
    const { documentId } = req.params;
    const userAuth = req.userAuth;

    const drive = google.drive({ version: 'v3', auth: userAuth.authClient });

    // Delete the document
    await drive.files.delete({
      fileId: documentId
    });

    console.log(`🗑️ Document deleted: ${documentId} by user: ${userAuth.email}`);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    logError('Document deletion failed', {
      error: error.message,
      userId: req.userAuth?.userId,
      documentId: req.params.documentId
    });

    if (error.code === 404) {
      return res.status(404).json({
        error: 'Document not found'
      });
    }

    res.status(500).json({
      error: 'Failed to delete document',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Apply sharing settings to a document
 */
async function applySharing(drive, fileId, sharingSettings, requestId = 'unknown') {
  try {
    const { visibility = 'private', role = 'reader', emails = [] } = sharingSettings;

    console.log(`🔐 [${requestId}] Configuring sharing: visibility=${visibility}, role=${role}, emails=${emails.length}`);

    // Set general visibility
    if (visibility === 'public') {
      console.log(`🌍 [${requestId}] Making document public with role: ${role}`);
      await drive.permissions.create({
        fileId: fileId,
        resource: {
          role: role,
          type: 'anyone'
        }
      });
    }

    // Share with specific emails
    for (const email of emails) {
      console.log(`📧 [${requestId}] Sharing with: ${email} (role: ${role})`);
      await drive.permissions.create({
        fileId: fileId,
        resource: {
          role: role,
          type: 'user',
          emailAddress: email
        },
        sendNotificationEmail: true
      });
    }

    console.log(`✅ [${requestId}] Sharing configuration completed successfully`);

  } catch (error) {
    console.log(`⚠️  [${requestId}] Sharing configuration failed: ${error.message}`);
    logError('Sharing configuration failed', { requestId, error });
    // Don't throw - sharing failure shouldn't fail the entire conversion
  }
}

module.exports = router;