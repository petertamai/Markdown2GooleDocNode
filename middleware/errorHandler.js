/**
 * Enhanced error logging function
 */
const logError = (message, error = {}) => {
    const timestamp = new Date().toISOString();
    const errorInfo = {
      timestamp,
      message,
      error: error.message || error,
      stack: error.stack,
      code: error.code,
      ...error
    };
  
    // Log to console (in production, you'd typically use a proper logging service)
    console.error(`❌ [${timestamp}] ${message}:`, errorInfo);
  
    // In production, you might want to send to external logging services
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to logging service
      // await sendToLoggingService(errorInfo);
    }
  };
  
  /**
   * Global error handler middleware
   */
  const errorHandler = (error, req, res, next) => {
    const timestamp = new Date().toISOString();
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
  
    // Log the complete error details
    logError('Unhandled error in request', {
      requestId,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      body: req.method === 'POST' ? sanitiseRequestBody(req.body) : undefined,
      error
    });
  
    // Determine appropriate status code
    let statusCode = 500;
    let errorMessage = 'Internal server error';
  
    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = 'Validation failed';
    } else if (error.name === 'UnauthorizedError' || error.status === 401) {
      statusCode = 401;
      errorMessage = 'Unauthorised access';
    } else if (error.status === 403) {
      statusCode = 403;
      errorMessage = 'Forbidden';
    } else if (error.status === 404) {
      statusCode = 404;
      errorMessage = 'Resource not found';
    } else if (error.status === 429) {
      statusCode = 429;
      errorMessage = 'Too many requests';
    }
  
    // Send error response
    res.status(statusCode).json({
      error: errorMessage,
      requestId,
      timestamp,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  };
  
  /**
   * Async error wrapper for route handlers
   */
  const asyncHandler = (fn) => {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };
  
  /**
   * Sanitise request body for logging (remove sensitive data)
   */
  const sanitiseRequestBody = (body) => {
    if (!body || typeof body !== 'object') {
      return body;
    }
  
    const sanitised = { ...body };
    const sensitiveFields = [
      'password',
      'token',
      'apiKey',
      'secret',
      'authorization',
      'auth',
      'key'
    ];
  
    // Remove sensitive fields
    for (const field of sensitiveFields) {
      if (sanitised[field]) {
        sanitised[field] = '[REDACTED]';
      }
    }
  
    // Truncate large content fields for logging
    if (sanitised.content && sanitised.content.length > 1000) {
      sanitised.content = sanitised.content.substring(0, 1000) + '... [TRUNCATED]';
    }
  
    return sanitised;
  };
  
  /**
   * API response success helper
   */
  const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
    res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  };
  
  /**
   * API response error helper
   */
  const sendError = (res, message, statusCode = 500, details = null) => {
    res.status(statusCode).json({
      success: false,
      error: message,
      details: process.env.NODE_ENV === 'development' ? details : undefined,
      timestamp: new Date().toISOString()
    });
  };
  
  /**
   * Health check middleware
   */
  const healthCheck = (req, res) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    res.json({
      status: 'healthy',
      uptime: `${Math.floor(uptime / 60)} minutes`,
      memory: {
        used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
      },
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  };
  
  module.exports = {
    logError,
    errorHandler,
    asyncHandler,
    sendSuccess,
    sendError,
    healthCheck,
    sanitiseRequestBody
  };