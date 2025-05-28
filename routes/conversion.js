// Enhanced version of routes/conversion.js with better folder validation

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
    .isLength({ min: 10, max: 100 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Folder ID must be a valid Google Drive folder ID (10-100 alphanumeric characters)'),
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
  console.log(`📁 Folder ID: ${req.body?.folderId || 'Root folder'}`);
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

    // Validate folder access if folderId is provided
    if (folderId) {
      await validateFolderAccess(drive, folderId, requestId);
    }

    // Prepare file metadata
    const fileMetadata = {
      name: title,
      mimeType: 'application/vnd.google-apps.document'
    };

    // Add to specific folder if provided
    if (folderId) {
      fileMetadata.parents = [folderId];
      console.log(`📁 [${requestId}] Adding to folder: ${folderId}`);
    } else {
      console.log(`📁 [${requestId}] Saving to root folder (My Drive)`);
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
      fields: 'id,name,webViewLink,webContentLink,createdTime,size,parents'
    });

    const documentData = response.data;
    console.log(`✅ [${requestId}] Google Drive API call successful!`);
    console.log(`📄 [${requestId}] Document ID: ${documentData.id}`);
    console.log(`📁 [${requestId}] Saved in folder: ${documentData.parents?.[0] || 'Root'}`);
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
        size: documentData.size,
        folderId: documentData.parents?.[0] || null
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
      folderId: req.body?.folderId,
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

    if (error.code === 404 && error.message.includes('folder')) {
      console.log(`📁 [${requestId}] Folder not found or no access`);
      return res.status(404).json({
        error: 'Folder not found',
        message: 'The specified folder does not exist or you do not have access to it',
        requestId
      });
    }

    if (error.code === 400) {
      console.log(`📝 [${requestId}] Invalid markdown content or request`);
      return res.status(400).json({
        error: 'Invalid request',
        message: error.message.includes('folder') ? 
          'Invalid folder ID or folder access denied' : 
          'The markdown content could not be processed',
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
 * Get list of user's folders for folder selection
 * @route GET /api/convert/folders
 */
router.get('/folders', async (req, res) => {
  try {
    const userAuth = req.userAuth;
    const { limit = 50 } = req.query;

    const drive = google.drive({ version: 'v3', auth: userAuth.authClient });

    // Get user's folders
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
      orderBy: 'name',
      pageSize: Math.min(parseInt(limit), 100),
      fields: 'files(id,name,parents,createdTime,modifiedTime)'
    });

    res.json({
      success: true,
      folders: response.data.files.map(folder => ({
        id: folder.id,
        name: folder.name,
        isRoot: !folder.parents || folder.parents.length === 0,
        parentId: folder.parents?.[0] || null,
        createdTime: folder.createdTime,
        modifiedTime: folder.modifiedTime
      })),
      total: response.data.files.length
    });

  } catch (error) {
    logError('Get folders failed', {
      error: error.message,
      userId: req.userAuth?.userId
    });

    res.status(500).json({
      error: 'Failed to retrieve folders',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Validate that user has access to the specified folder
 */
async function validateFolderAccess(drive, folderId, requestId = 'unknown') {
  try {
    console.log(`🔍 [${requestId}] Validating folder access: ${folderId}`);
    
    // Try to get folder metadata to verify access
    const folderResponse = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType,capabilities'
    });

    const folder = folderResponse.data;

    // Verify it's actually a folder
    if (folder.mimeType !== 'application/vnd.google-apps.folder') {
      throw new Error(`Specified ID is not a folder (type: ${folder.mimeType})`);
    }

    // Check if user can add files to this folder
    if (folder.capabilities && folder.capabilities.canAddChildren === false) {
      throw new Error('You do not have permission to add files to this folder');
    }

    console.log(`✅ [${requestId}] Folder validation successful: "${folder.name}" (${folderId})`);
    
    return folder;

  } catch (error) {
    console.log(`❌ [${requestId}] Folder validation failed: ${error.message}`);
    
    if (error.code === 404) {
      const folderError = new Error('Folder not found or you do not have access to it');
      folderError.code = 404;
      throw folderError;
    }
    
    if (error.code === 403) {
      const accessError = new Error('You do not have permission to access this folder');
      accessError.code = 403;
      throw accessError;
    }
    
    throw error;
  }
}

/**
 * Get conversion history for the authenticated user
 * @route GET /api/convert/history
 */
router.get('/history', async (req, res) => {
  try {
    const userAuth = req.userAuth;
    const { limit = 20, pageToken, folderId } = req.query;

    const drive = google.drive({ version: 'v3', auth: userAuth.authClient });

    // Build query
    let query = "mimeType='application/vnd.google-apps.document' and trashed=false";
    
    // Filter by folder if specified
    if (folderId) {
      query += ` and '${folderId}' in parents`;
    }

    // Get user's Google Docs
    const response = await drive.files.list({
      q: query,
      orderBy: 'createdTime desc',
      pageSize: Math.min(parseInt(limit), 100),
      pageToken: pageToken,
      fields: 'nextPageToken,files(id,name,createdTime,modifiedTime,webViewLink,size,parents)'
    });

    res.json({
      success: true,
      documents: response.data.files.map(doc => ({
        ...doc,
        folderId: doc.parents?.[0] || null
      })),
      nextPageToken: response.data.nextPageToken,
      totalResults: response.data.files.length,
      filteredByFolder: !!folderId
    });

  } catch (error) {
    logError('Get conversion history failed', {
      error: error.message,
      userId: req.userAuth?.userId,
      folderId: req.query?.folderId
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