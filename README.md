# MarkdownDocs API

**Professional Markdown to Google Docs Conversion Service**

Transform your Markdown content into beautifully formatted Google Documents using Google's native conversion engine. Built for teams and individuals who demand quality, reliability, and seamless integration.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Production Ready](https://img.shields.io/badge/Production-Ready-brightgreen.svg)]()

## 🌟 Features

### Core Functionality
- **Native Google Conversion**: Uses Google's built-in Markdown parser for perfect formatting
- **One-Time Authentication**: Get a permanent API key that works forever
- **Auto Token Refresh**: Background token management with zero maintenance
- **Folder Management**: Save documents to specific Google Drive folders
- **Document Updates**: Replace entire document content while preserving metadata
- **CRUD Operations**: Complete document lifecycle management

### Enterprise Features
- **Production-Grade Security**: Rate limiting, input validation, secure credential storage
- **Comprehensive Logging**: Detailed audit trails with request tracking
- **PM2 Clustering**: High-availability deployment with process management
- **Web Interface**: Beautiful setup and conversion interface
- **API-First Design**: RESTful API for seamless integration
- **Error Handling**: Robust error recovery and meaningful error messages

### Sharing & Collaboration
- **Document Sharing**: Configure public/private sharing with specific users
- **Permission Management**: Role-based access control (reader, editor, commenter)
- **Team Integration**: Multi-user support with individual API keys
- **Conversion History**: Track all document conversions with metadata

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 8+
- Google Cloud Project with Drive and Docs APIs enabled
- Google OAuth2 credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/markdown-to-google-docs-api.git
cd markdown-to-google-docs-api

# Install dependencies
npm install

# Start development server
npm run dev
```

### Initial Setup

1. **Access the Web Interface**
   ```
   http://localhost:3000
   ```

2. **Follow the Setup Wizard**
   - Create Google Cloud Project
   - Enable required APIs
   - Configure OAuth2 credentials
   - Complete system configuration

3. **Get Your API Key**
   - Authenticate with Google
   - Receive permanent API key
   - Start converting documents

## 📋 Table of Contents

- [Installation & Setup](#-installation--setup)
- [Google Cloud Configuration](#-google-cloud-configuration)
- [API Documentation](#-api-documentation)
- [Web Interface](#-web-interface)
- [Configuration Options](#-configuration-options)
- [Deployment](#-deployment)
- [Security](#-security)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

## 🔧 Installation & Setup

### System Requirements

```json
{
  "node": ">=18.0.0",
  "npm": ">=8.0.0",
  "memory": "512MB minimum",
  "storage": "100MB for application + logs"
}
```

### Environment Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/yourusername/markdown-to-google-docs-api.git
   cd markdown-to-google-docs-api
   npm install
   ```

2. **Development Mode**
   ```bash
   npm run dev          # Start with nodemon
   npm run dev:stable   # Start with ignored data/logs
   ```

3. **Production Mode**
   ```bash
   npm run prod         # Start with PM2 clustering
   npm run stop         # Stop PM2 processes
   npm run restart      # Restart PM2 processes
   npm logs             # View PM2 logs
   ```

### Project Structure

```
markdown-to-google-docs-api/
├── data/                    # API keys and configuration storage
├── logs/                    # Application logs (PM2)
├── middleware/              # Authentication and error handling
├── public/                  # Web interface files
├── routes/                  # API route definitions
├── services/                # Core business logic
├── .env.example            # Environment variables template
├── ecosystem.config.js     # PM2 configuration
├── server.js              # Application entry point
└── package.json           # Dependencies and scripts
```

## ☁️ Google Cloud Configuration

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Note your Project ID for reference

### Step 2: Enable Required APIs

Enable these APIs in your Google Cloud Project:

| API | Purpose | Enable Link |
|-----|---------|-------------|
| Google Drive API | File creation and management | [Enable Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com) |
| Google Docs API | Document content manipulation | [Enable Docs API](https://console.cloud.google.com/apis/library/docs.googleapis.com) |
| Google+ API | User profile information | [Enable Google+ API](https://console.cloud.google.com/apis/library/plus.googleapis.com) |

### Step 3: Create OAuth2 Credentials

1. **Navigate to Credentials**
   ```
   Google Cloud Console → APIs & Services → Credentials
   ```

2. **Create OAuth 2.0 Client ID**
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Name: "MarkdownDocs API"

3. **Configure Authorized Redirect URIs**
   ```
   http://localhost:3000/api/auth/callback
   https://yourdomain.com/api/auth/callback
   ```

4. **Save Credentials**
   - Copy Client ID and Client Secret
   - Keep these secure and confidential

### Step 4: Configure Scopes

The application requests these OAuth2 scopes:

```javascript
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',      // Create and access own files
  'https://www.googleapis.com/auth/documents',       // Read and write documents
  'https://www.googleapis.com/auth/userinfo.profile', // User profile information
  'https://www.googleapis.com/auth/userinfo.email'   // User email address
];
```

## 📚 API Documentation

### Authentication

All API requests require authentication using an API key:

```http
X-API-Key: md2doc_your_api_key_here
```

### Base URL

```
Production: https://yourdomain.com/api
Development: http://localhost:3000/api
```

### Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/convert/markdown-to-doc` | Create new document |
| `PUT` | `/convert/document/:id` | Update existing document |
| `GET` | `/convert/document/:id` | Get document information |
| `DELETE` | `/convert/document/:id` | Delete document |
| `GET` | `/convert/history` | Get conversion history |
| `GET` | `/convert/folders` | List user's folders |
| `GET` | `/auth/user` | Get current user info |

---

### Create Document

Convert Markdown content to a new Google Document.

**Endpoint:** `POST /api/convert/markdown-to-doc`

**Headers:**
```http
Content-Type: application/json
X-API-Key: md2doc_your_api_key_here
```

**Request Body:**
```json
{
  "content": "# My Document\n\nThis is **bold** text.\n\n## Features\n- Auto conversion\n- Perfect formatting",
  "title": "My Document",
  "folderId": "1ABC123_optional_folder_id",
  "sharing": {
    "visibility": "private",
    "role": "reader",
    "emails": ["user@example.com"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "requestId": "conv_1234567890_abc123",
  "document": {
    "id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "name": "My Document",
    "webViewLink": "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
    "webContentLink": "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=docx",
    "createdTime": "2025-05-28T12:34:56.789Z",
    "size": "12345",
    "folderId": "1ABC123_folder_id_or_null"
  },
  "processing": {
    "timeMs": 1234,
    "contentLength": 125
  },
  "message": "Markdown successfully converted to Google Doc"
}
```

---

### Update Document

Replace the entire content of an existing Google Document.

**Endpoint:** `PUT /api/convert/document/:documentId`

**Headers:**
```http
Content-Type: application/json
X-API-Key: md2doc_your_api_key_here
```

**Request Body:**
```json
{
  "content": "# Updated Document\n\nThis replaces ALL existing content...",
  "title": "New Document Title",
  "updateTitle": true,
  "sharing": {
    "visibility": "public",
    "role": "reader"
  }
}
```

**Response:**
```json
{
  "success": true,
  "requestId": "updt_1234567890_abc123",
  "document": {
    "id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "name": "New Document Title",
    "webViewLink": "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
    "modifiedTime": "2025-05-28T12:34:56.789Z",
    "size": "15678",
    "folderId": "1ABC123_folder_id_or_null"
  },
  "processing": {
    "timeMs": 2340,
    "contentLength": 1250,
    "titleUpdated": true,
    "originalTitle": "Old Document Title"
  },
  "message": "Document content successfully updated"
}
```

---

### Get Document Information

Retrieve metadata and optionally content preview for a document.

**Endpoint:** `GET /api/convert/document/:documentId`

**Query Parameters:**
- `includeContent` (boolean): Include content preview (default: false)

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "name": "My Document",
    "size": "12345",
    "createdTime": "2025-05-28T12:34:56.789Z",
    "modifiedTime": "2025-05-28T13:45:00.123Z",
    "webViewLink": "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
    "folderId": "1ABC123_folder_id_or_null",
    "capabilities": {
      "canEdit": true,
      "canComment": true,
      "canShare": true
    },
    "shared": false,
    "content": {
      "preview": "My Document\n\nThis is bold text...",
      "wordCount": 125,
      "characterCount": 850
    }
  }
}
```

---

### List Folders

Get a list of user's Google Drive folders for folder selection.

**Endpoint:** `GET /api/convert/folders`

**Query Parameters:**
- `limit` (number): Maximum folders to return (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "folders": [
    {
      "id": "1ABC123_folder_id",
      "name": "My Documents",
      "isRoot": false,
      "parentId": "0BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      "createdTime": "2025-05-28T12:34:56.789Z",
      "modifiedTime": "2025-05-28T13:45:00.123Z"
    }
  ],
  "total": 1
}
```

---

### Get Conversion History

Retrieve user's document conversion history with optional folder filtering.

**Endpoint:** `GET /api/convert/history`

**Query Parameters:**
- `limit` (number): Documents per page (default: 20, max: 100)
- `pageToken` (string): Pagination token for next page
- `folderId` (string): Filter by specific folder

**Response:**
```json
{
  "success": true,
  "documents": [
    {
      "id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      "name": "My Document",
      "createdTime": "2025-05-28T12:34:56.789Z",
      "modifiedTime": "2025-05-28T13:45:00.123Z",
      "webViewLink": "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
      "size": "12345",
      "folderId": "1ABC123_folder_id_or_null"
    }
  ],
  "nextPageToken": "next_page_token_here",
  "totalResults": 1,
  "filteredByFolder": false
}
```

---

### Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error Type",
  "message": "Detailed error description",
  "requestId": "req_1234567890_abc123",
  "details": "Additional error information (development only)"
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (validation errors, invalid content)
- `401` - Unauthorized (missing or invalid API key)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (document or folder not found)
- `422` - Unprocessable Entity (validation failed)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error (server-side error)

---

### Rate Limiting

API requests are rate-limited to ensure fair usage:

- **General API**: 100 requests per 15 minutes per IP
- **Conversions**: 10 conversions per 15 minutes per IP

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

## 🖥️ Web Interface

### Setup Wizard

Navigate to `http://localhost:3000/setup` for the interactive setup process:

1. **Configuration Check**: Verify system status
2. **Google Cloud Guide**: Step-by-step API setup instructions
3. **Credential Input**: Secure credential configuration
4. **Authentication**: Google OAuth2 flow
5. **API Key Generation**: Receive permanent API key

### Document Converter

Access the converter at `http://localhost:3000/converter`:

**Features:**
- Live Markdown editor with syntax highlighting
- Real-time character, word, and line counts
- Folder selection dropdown
- Document sharing configuration
- Conversion history with search and filters
- Sample content loader for testing

**Workflow:**
1. Enter or paste Markdown content
2. Set document title and folder (optional)
3. Configure sharing settings (optional)
4. Click "Convert to Google Doc"
5. View results and access document

### Navigation

- **Home Page** (`/`): Project overview and getting started
- **Setup** (`/setup`): System configuration wizard
- **Converter** (`/converter`): Document conversion interface

## ⚙️ Configuration Options

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Server Configuration
NODE_ENV=production
PORT=3000

# Google OAuth2 Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/callback

# JWT Configuration
JWT_SECRET=your_super_secure_jwt_secret_minimum_32_characters
JWT_EXPIRES_IN=24h

# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Security Configuration
ALLOW_RECONFIGURE=false

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CONVERSION_RATE_LIMIT_MAX=10

# PM2 Configuration
PM2_INSTANCES=max
```

### PM2 Configuration

The `ecosystem.config.js` file controls PM2 clustering:

```javascript
module.exports = {
  apps: [{
    name: 'markdown-docs-api',
    script: 'server.js',
    instances: process.env.PM2_INSTANCES || 'max',
    exec_mode: 'cluster',
    autorestart: true,
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3000
    }
  }]
};
```

### Security Configuration

**API Key Security:**
- API keys are stored encrypted in local JSON files
- Automatic token refresh prevents expiration
- Keys can be revoked and regenerated as needed

**Environment Security:**
- Sensitive credentials in environment variables
- CORS protection with configurable origins
- Rate limiting to prevent abuse
- Input validation and sanitisation

**Google API Security:**
- OAuth2 with minimal required scopes
- Refresh tokens for long-term access
- Secure credential storage and transmission

## 🚀 Deployment

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Access application
open http://localhost:3000
```

### Production Deployment

#### Option 1: PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Configure environment
cp .env.example .env
# Edit .env with your production values

# Start with PM2
npm run prod

# Monitor application
pm2 monitor
pm2 logs markdown-docs-api
```

#### Option 2: Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t markdown-docs-api .
docker run -p 3000:3000 --env-file .env markdown-docs-api
```

#### Option 3: Cloud Platforms

**Vercel/Netlify:**
- Configure environment variables in platform dashboard
- Set build command: `npm install`
- Set start command: `npm start`

**AWS/GCP/Azure:**
- Use provided container services or virtual machines
- Configure load balancing for high availability
- Set up monitoring and logging services

### Environment-Specific Configuration

**Development:**
```bash
NODE_ENV=development
ALLOW_RECONFIGURE=true
LOG_LEVEL=debug
```

**Staging:**
```bash
NODE_ENV=staging
ALLOW_RECONFIGURE=true
LOG_LEVEL=info
```

**Production:**
```bash
NODE_ENV=production
ALLOW_RECONFIGURE=false
LOG_LEVEL=warn
```

### Health Checks

Monitor application health:

```bash
# Health check endpoint
curl http://localhost:3000/health

# Response
{
  "status": "healthy",
  "timestamp": "2025-05-28T12:34:56.789Z",
  "uptime": "5 minutes",
  "memory": {
    "used": "45 MB",
    "total": "128 MB"
  },
  "environment": "production"
}
```

## 🔒 Security

### Data Protection

**Local Storage:**
- API keys stored in encrypted local files
- No sensitive data transmitted in logs
- Automatic cleanup of expired keys

**Transmission Security:**
- HTTPS enforcement in production
- Secure OAuth2 flows
- JWT tokens for session management

**Access Control:**
- User-specific API keys
- Google Drive permissions respected
- Folder-level access validation

### Security Best Practices

1. **Keep Dependencies Updated**
   ```bash
   npm audit
   npm audit fix
   ```

2. **Environment Variable Security**
   - Never commit `.env` files
   - Use strong JWT secrets (32+ characters)
   - Rotate credentials regularly

3. **API Key Management**
   - Monitor API key usage
   - Revoke compromised keys immediately
   - Use different keys for different environments

4. **Google Cloud Security**
   - Enable 2FA on Google accounts
   - Regularly review OAuth consent screen
   - Monitor API usage in Google Cloud Console

### Rate Limiting

Protect against abuse with configurable rate limits:

```javascript
// General API rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many requests, please try again later' }
});

// Conversion-specific rate limiting
const conversionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 conversions per window
  message: { error: 'Too many conversion requests, please try again later' }
});
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. Google API Errors

**"Invalid credentials" Error:**
```
Solution:
1. Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env
2. Check redirect URI matches Google Cloud Console
3. Ensure APIs are enabled in Google Cloud Console
```

**"Insufficient permissions" Error:**
```
Solution:
1. Verify OAuth2 scopes include required permissions
2. Re-authenticate to refresh permissions
3. Check document/folder access permissions
```

#### 2. Authentication Issues

**"API key expired" Error:**
```
Solution:
1. Check token expiry in logs
2. Automatic refresh should occur - wait 5 minutes
3. If persistent, re-authenticate to get new API key
```

**"Configuration not found" Error:**
```
Solution:
1. Run setup wizard at /setup
2. Ensure .env file exists with correct values
3. Check file permissions on data/ directory
```

#### 3. Conversion Failures

**"Markdown processing failed" Error:**
```
Solution:
1. Validate Markdown syntax
2. Check content length (max 1MB)
3. Ensure special characters are properly escaped
```

**"Folder not found" Error:**
```
Solution:
1. Verify folder ID exists and is accessible
2. Check folder permissions
3. Use /api/convert/folders to list available folders
```

### Debug Mode

Enable detailed logging for troubleshooting:

```bash
# Set environment variable
NODE_ENV=development
LOG_LEVEL=debug

# Start with detailed logs
npm run dev

# Check logs
tail -f logs/combined.log
```

### Log Analysis

Key log patterns to monitor:

```bash
# Successful conversions
grep "CONVERSION COMPLETED SUCCESSFULLY" logs/combined.log

# Authentication failures
grep "Authentication failed" logs/combined.log

# Rate limit violations
grep "Too many requests" logs/combined.log

# Google API errors
grep "Google API error" logs/combined.log
```

### Performance Monitoring

Monitor application performance:

```bash
# PM2 monitoring
pm2 monit

# Memory usage
ps aux | grep node

# Check disk space
df -h

# Monitor API response times
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:3000/health"
```

### Support Channels

1. **GitHub Issues**: Report bugs and feature requests
2. **Documentation**: Check this README and inline documentation
3. **Google Cloud Support**: For Google API-related issues
4. **Community**: Stack Overflow with tag `markdowndocs-api`

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/markdown-to-google-docs-api.git
   cd markdown-to-google-docs-api
   git checkout -b feature/your-feature-name
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Setup Environment**
   ```bash
   cp .env.example .env
   # Configure your development environment
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

### Code Standards

**JavaScript Style:**
- Use modern ES6+ syntax
- Follow existing code patterns
- Include comprehensive error handling
- Add detailed logging with request IDs

**File Organisation:**
- Place routes in `/routes` directory
- Add middleware to `/middleware` directory
- Create services in `/services` directory
- Update documentation for new features

**Commit Messages:**
```
feat: add document update functionality
fix: resolve authentication token refresh issue
docs: update API documentation
style: improve code formatting
refactor: optimise folder validation logic
test: add integration tests for conversion API
```

### Pull Request Process

1. **Create Feature Branch**
2. **Implement Changes** with tests and documentation
3. **Test Thoroughly** in development environment
4. **Update Documentation** including this README
5. **Submit Pull Request** with detailed description

### Feature Requests

When requesting features, please include:
- **Use Case**: Why is this feature needed?
- **Implementation**: How should it work?
- **Compatibility**: Impact on existing functionality
- **Documentation**: Required documentation changes

### Bug Reports

Include the following information:
- **Environment**: OS, Node.js version, npm version
- **Configuration**: Relevant environment variables (sanitised)
- **Steps to Reproduce**: Detailed reproduction steps
- **Expected vs Actual**: What should happen vs what happens
- **Logs**: Relevant log entries with request IDs

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 MarkdownDocs API

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🙏 Acknowledgements

- **Google APIs**: For providing excellent Drive and Docs APIs
- **Node.js Community**: For the robust ecosystem of packages
- **Contributors**: Everyone who has contributed to this project

---

**Built with ❤️ for teams and individuals who love great documentation**

For more information, visit our [PeterTam.pro](https://petertam.pro) 