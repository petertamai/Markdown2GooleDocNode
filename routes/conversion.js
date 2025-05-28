// Complete enhanced version of routes/conversion.js with all features

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
 * Update/Replace entire Google Doc content with new markdown
 * @route PUT /api/convert/document/:documentId
 */
router.put('/document/:documentId', conversionLimiter, [
  param('documentId')
    .notEmpty()
    .isString()
    .isLength({ min: 10, max: 100 })
    .withMessage('Valid document ID is required'),
  body('content')
    .isLength({ min: 1, max: 1000000 })
    .withMessage('Content must be between 1 character and 1MB'),
  body('title')
    .optional()
    .isLength({ max: 200 })
    .trim()
    .withMessage('Title cannot exceed 200 characters'),
  body('updateTitle')
    .optional()
    .isBoolean()
    .withMessage('updateTitle must be true or false'),
  body('sharing')
    .optional()
    .isObject()
    .withMessage('Sharing settings must be an object')
], async (req, res) => {
  const startTime = Date.now();
  const requestId = `updt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const { documentId } = req.params;
  
  console.log(`\n🔄 [${requestId}] DOCUMENT UPDATE STARTED`);
  console.log(`📄 [${requestId}] Document ID: ${documentId}`);
  console.log(`📝 [${requestId}] New content length: ${req.body?.content?.length || 0} characters`);
  console.log(`📋 [${requestId}] New title: "${req.body?.title || 'No title change'}"`);
  console.log(`🔄 [${requestId}] Update title: ${req.body?.updateTitle || false}`);
  console.log(`🔑 [${requestId}] API Key: ${req.headers['x-api-key'] || 'MISSING'}`);
  console.log(`🌐 [${requestId}] IP: ${req.ip}`);

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

    const { content, title, updateTitle = false, sharing } = req.body;
    const userAuth = req.userAuth;

    console.log(`✅ [${requestId}] Authentication successful for user: ${userAuth.email}`);
    console.log(`👤 [${requestId}] User: ${userAuth.name} (${userAuth.userId})`);

    // Initialize Google APIs
    const drive = google.drive({ version: 'v3', auth: userAuth.authClient });
    const docs = google.docs({ version: 'v1', auth: userAuth.authClient });

    // Step 1: Verify document exists and user has access
    console.log(`🔍 [${requestId}] Verifying document access...`);
    const documentInfo = await verifyDocumentAccess(drive, documentId, requestId);

    // Step 2: Get current document structure
    console.log(`📖 [${requestId}] Getting current document structure...`);
    const docResponse = await docs.documents.get({
      documentId: documentId
    });

    const document = docResponse.data;
    const currentTitle = document.title;
    
    console.log(`📋 [${requestId}] Current document title: "${currentTitle}"`);
    console.log(`📄 [${requestId}] Current content length: ${document.body.content?.length || 0} elements`);

    // Step 3: Create temporary document with new markdown content
    console.log(`🔄 [${requestId}] Converting markdown to Google Docs format...`);
    const tempDocResponse = await drive.files.create({
      resource: {
        name: `temp_${Date.now()}`,
        mimeType: 'application/vnd.google-apps.document'
      },
      media: {
        mimeType: 'text/markdown',
        body: content
      },
      fields: 'id'
    });

    const tempDocId = tempDocResponse.data.id;
    console.log(`📄 [${requestId}] Created temporary document: ${tempDocId}`);

    try {
      // Step 4: Get converted content from temporary document
      const tempDocContent = await docs.documents.get({
        documentId: tempDocId
      });

      // Step 5: Clear existing content from target document
      console.log(`🧹 [${requestId}] Clearing existing document content...`);
      await clearDocumentContent(docs, documentId, requestId);

      // Step 6: Insert new content
      console.log(`📝 [${requestId}] Inserting new content...`);
      await insertNewContent(docs, documentId, tempDocContent.data, requestId);

      // Step 7: Update title if requested
      if (updateTitle && title) {
        console.log(`📋 [${requestId}] Updating document title to: "${title}"`);
        await updateDocumentTitle(drive, documentId, title, requestId);
      }

      // Step 8: Apply sharing settings if provided
      if (sharing) {
        console.log(`🔐 [${requestId}] Applying sharing settings...`);
        await applySharing(drive, documentId, sharing, requestId);
      }

    } finally {
      // Always clean up temporary document
      try {
        await drive.files.delete({ fileId: tempDocId });
        console.log(`🗑️ [${requestId}] Cleaned up temporary document: ${tempDocId}`);
      } catch (cleanupError) {
        console.log(`⚠️  [${requestId}] Failed to cleanup temporary document: ${cleanupError.message}`);
      }
    }

    // Step 9: Get updated document info
    console.log(`📊 [${requestId}] Getting updated document information...`);
    const updatedDocInfo = await drive.files.get({
      fileId: documentId,
      fields: 'id,name,webViewLink,webContentLink,modifiedTime,size,parents'
    });

    const updatedDocument = updatedDocInfo.data;
    const processingTime = Date.now() - startTime;

    // Log successful update
    console.log(`🎉 [${requestId}] DOCUMENT UPDATE COMPLETED SUCCESSFULLY!`);
    console.log(`⏱️  [${requestId}] Processing time: ${processingTime}ms`);
    console.log(`📊 [${requestId}] Updated document size: ${updatedDocument.size || 'unknown'} bytes`);
    console.log(`🔗 [${requestId}] View document: ${updatedDocument.webViewLink}`);
    console.log(`👤 [${requestId}] Updated by: ${userAuth.email} using API key: ${userAuth.apiKey}`);

    res.json({
      success: true,
      requestId,
      document: {
        id: updatedDocument.id,
        name: updatedDocument.name,
        webViewLink: updatedDocument.webViewLink,
        webContentLink: updatedDocument.webContentLink,
        modifiedTime: updatedDocument.modifiedTime,
        size: updatedDocument.size,
        folderId: updatedDocument.parents?.[0] || null
      },
      processing: {
        timeMs: processingTime,
        contentLength: content.length,
        titleUpdated: updateTitle && title ? true : false,
        originalTitle: currentTitle
      },
      message: 'Document content successfully updated'
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.log(`❌ [${requestId}] DOCUMENT UPDATE FAILED after ${processingTime}ms`);
    console.log(`💥 [${requestId}] Error type: ${error.constructor.name}`);
    console.log(`📝 [${requestId}] Error message: ${error.message}`);
    console.log(`🔢 [${requestId}] Error code: ${error.code}`);
    console.log(`📊 [${requestId}] Error status: ${error.status}`);

    logError('Document update failed', {
      requestId,
      documentId,
      error: error.message,
      userId: req.userAuth?.userId,
      contentLength: req.body?.content?.length,
      processingTime
    });

    // Handle specific errors
    if (error.code === 401) {
      console.log(`🔒 [${requestId}] Authentication expired`);
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
        message: 'You do not have permission to edit this document',
        requestId
      });
    }

    if (error.code === 404) {
      console.log(`📄 [${requestId}] Document not found`);
      return res.status(404).json({
        error: 'Document not found',
        message: 'The specified document does not exist or you do not have access to it',
        requestId
      });
    }

    if (error.code === 400) {
      console.log(`📝 [${requestId}] Invalid request or content`);
      return res.status(400).json({
        error: 'Invalid request',
        message: 'The markdown content could not be processed or document format is invalid',
        requestId
      });
    }

    console.log(`🔥 [${requestId}] Returning 500 error to client`);
    res.status(500).json({
      error: 'Document update failed',
      requestId,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get document information and preview content
 * @route GET /api/convert/document/:documentId
 */
router.get('/document/:documentId', [
  param('documentId')
    .notEmpty()
    .isString()
    .isLength({ min: 10, max: 100 })
    .withMessage('Valid document ID is required')
], async (req, res) => {
  try {
    const { documentId } = req.params;
    const userAuth = req.userAuth;
    const { includeContent = false } = req.query;

    const drive = google.drive({ version: 'v3', auth: userAuth.authClient });
    const docs = google.docs({ version: 'v1', auth: userAuth.authClient });

    // Get document metadata
    const fileResponse = await drive.files.get({
      fileId: documentId,
      fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,capabilities,owners,shared'
    });

    const file = fileResponse.data;

    // Verify it's a Google Doc
    if (file.mimeType !== 'application/vnd.google-apps.document') {
      return res.status(400).json({
        error: 'Invalid file type',
        message: `File is not a Google Doc (type: ${file.mimeType})`
      });
    }

    const documentInfo = {
      id: file.id,
      name: file.name,
      size: file.size,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink,
      webContentLink: file.webContentLink,
      folderId: file.parents?.[0] || null,
      capabilities: {
        canEdit: file.capabilities?.canEdit || false,
        canComment: file.capabilities?.canComment || false,
        canShare: file.capabilities?.canShare || false
      },
      shared: file.shared || false
    };

    // Optionally include document content preview
    if (includeContent === 'true' && file.capabilities?.canEdit) {
      try {
        const docResponse = await docs.documents.get({
          documentId: documentId
        });

        // Extract text content for preview (first 500 characters)
        const textContent = extractTextContent(docResponse.data);
        documentInfo.content = {
          preview: textContent.substring(0, 500),
          wordCount: textContent.split(/\s+/).filter(word => word.length > 0).length,
          characterCount: textContent.length
        };
      } catch (contentError) {
        console.log(`⚠️ Failed to get document content: ${contentError.message}`);
        // Don't fail the request if content can't be retrieved
      }
    }

    res.json({
      success: true,
      document: documentInfo
    });

  } catch (error) {
    logError('Get document info failed', {
      error: error.message,
      userId: req.userAuth?.userId,
      documentId: req.params.documentId
    });

    if (error.code === 404) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'The specified document does not exist or you do not have access to it'
      });
    }

    if (error.code === 403) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to access this document'
      });
    }

    res.status(500).json({
      error: 'Failed to retrieve document information',
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

// ========== HELPER FUNCTIONS ==========

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
 * Verify user has access to the document
 */
async function verifyDocumentAccess(drive, documentId, requestId) {
  try {
    console.log(`🔍 [${requestId}] Checking document access: ${documentId}`);
    
    const response = await drive.files.get({
      fileId: documentId,
      fields: 'id,name,mimeType,capabilities,owners,permissions'
    });

    const file = response.data;

    // Verify it's a Google Doc
    if (file.mimeType !== 'application/vnd.google-apps.document') {
      throw new Error(`File is not a Google Doc (type: ${file.mimeType})`);
    }

    // Check if user can edit
    if (file.capabilities && file.capabilities.canEdit === false) {
      throw new Error('You do not have permission to edit this document');
    }

    console.log(`✅ [${requestId}] Document access verified: "${file.name}" (${documentId})`);
    
    return file;

  } catch (error) {
    console.log(`❌ [${requestId}] Document access verification failed: ${error.message}`);
    
    if (error.code === 404) {
      const docError = new Error('Document not found or you do not have access to it');
      docError.code = 404;
      throw docError;
    }
    
    if (error.code === 403) {
      const accessError = new Error('You do not have permission to access this document');
      accessError.code = 403;
      throw accessError;
    }
    
    throw error;
  }
}

/**
 * Clear all content from a Google Doc
 */
async function clearDocumentContent(docs, documentId, requestId) {
  try {
    console.log(`🧹 [${requestId}] Clearing document content...`);
    
    // Get current document to find content range
    const doc = await docs.documents.get({ documentId });
    const content = doc.data.body.content;
    
    if (!content || content.length <= 1) {
      console.log(`📄 [${requestId}] Document is already empty`);
      return;
    }

    // Find the range of content to delete (excluding the first element which is usually structural)
    let startIndex = 1;
    let endIndex = content[content.length - 1].endIndex - 1;

    if (endIndex <= startIndex) {
      console.log(`📄 [${requestId}] No content to clear`);
      return;
    }

    console.log(`🔄 [${requestId}] Deleting content from index ${startIndex} to ${endIndex}`);

    await docs.documents.batchUpdate({
      documentId,
      resource: {
        requests: [{
          deleteContentRange: {
            range: {
              startIndex: startIndex,
              endIndex: endIndex
            }
          }
        }]
      }
    });

    console.log(`✅ [${requestId}] Document content cleared successfully`);

  } catch (error) {
    console.log(`❌ [${requestId}] Failed to clear document content: ${error.message}`);
    throw error;
  }
}

/**
 * Insert new content into the document
 */
async function insertNewContent(docs, documentId, sourceDoc, requestId) {
  try {
    console.log(`📝 [${requestId}] Inserting new content...`);
    
    const sourceContent = sourceDoc.body.content;
    
    if (!sourceContent || sourceContent.length <= 1) {
      console.log(`📄 [${requestId}] No content to insert`);
      return;
    }

    // Extract meaningful content (skip the first structural element)
    const requests = [];
    let insertIndex = 1; // Start inserting at index 1

    // Process each content element from the source document
    for (let i = 1; i < sourceContent.length; i++) {
      const element = sourceContent[i];
      
      if (element.paragraph) {
        const paragraph = element.paragraph;
        
        // Handle paragraph content
        if (paragraph.elements) {
          for (const textElement of paragraph.elements) {
            if (textElement.textRun && textElement.textRun.content) {
              requests.push({
                insertText: {
                  location: { index: insertIndex },
                  text: textElement.textRun.content
                }
              });
              insertIndex += textElement.textRun.content.length;
            }
          }
        }
        
        // Apply paragraph style if it exists
        if (paragraph.paragraphStyle && paragraph.paragraphStyle.namedStyleType) {
          requests.push({
            updateParagraphStyle: {
              range: {
                startIndex: insertIndex - (paragraph.elements?.[0]?.textRun?.content?.length || 0),
                endIndex: insertIndex
              },
              paragraphStyle: {
                namedStyleType: paragraph.paragraphStyle.namedStyleType
              },
              fields: 'namedStyleType'
            }
          });
        }
      }
    }

    if (requests.length === 0) {
      console.log(`📄 [${requestId}] No valid content found to insert`);
      return;
    }

    console.log(`🔄 [${requestId}] Applying ${requests.length} content updates...`);

    // Apply all updates in batches to avoid API limits
    const batchSize = 50;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      await docs.documents.batchUpdate({
        documentId,
        resource: { requests: batch }
      });
      
      console.log(`✅ [${requestId}] Applied batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(requests.length/batchSize)}`);
    }

    console.log(`✅ [${requestId}] New content inserted successfully`);

  } catch (error) {
    console.log(`❌ [${requestId}] Failed to insert new content: ${error.message}`);
    throw error;
  }
}

/**
 * Update document title
 */
async function updateDocumentTitle(drive, documentId, newTitle, requestId) {
  try {
    console.log(`📋 [${requestId}] Updating document title to: "${newTitle}"`);
    
    await drive.files.update({
      fileId: documentId,
      resource: {
        name: newTitle
      }
    });
    
    console.log(`✅ [${requestId}] Document title updated successfully`);
    
  } catch (error) {
    console.log(`❌ [${requestId}] Failed to update document title: ${error.message}`);
    throw error;
  }
}

/**
 * Extract plain text content from Google Docs structure
 */
function extractTextContent(doc) {
  let textContent = '';
  
  if (doc.body && doc.body.content) {
    for (const element of doc.body.content) {
      if (element.paragraph && element.paragraph.elements) {
        for (const textElement of element.paragraph.elements) {
          if (textElement.textRun && textElement.textRun.content) {
            textContent += textElement.textRun.content;
          }
        }
      } else if (element.table) {
        // Handle table content
        for (const row of element.table.tableRows || []) {
          for (const cell of row.tableCells || []) {
            for (const cellElement of cell.content || []) {
              if (cellElement.paragraph && cellElement.paragraph.elements) {
                for (const textElement of cellElement.paragraph.elements) {
                  if (textElement.textRun && textElement.textRun.content) {
                    textContent += textElement.textRun.content;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  
  return textContent;
}

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