# Markdown to Google Docs API

A production-ready REST API for converting Markdown content to Google Docs using Google's native Markdown import capability. Features **persistent API key authentication** with automatic token refresh - authenticate once and use forever!

## 🚀 Features

- **🔑 Persistent API Keys**: Authenticate once, get a short API key, use forever
- **🔄 Auto Token Refresh**: Google tokens automatically refreshed in background
- **📝 Native Google Conversion**: Leverages Google Drive API's built-in Markdown support
- **🔒 OAuth2 Authentication**: Secure Google account integration
- **⚡ Production Ready**: Comprehensive error handling, logging, and security
- **🛡️ Rate Limiting**: Prevents abuse with configurable limits
- **🔧 PM2 Support**: Cluster mode and process management
- **📊 API Management**: Create, list, and revoke API keys

## 📋 Prerequisites

- Node.js 18+ and npm 8+
- Google Cloud Console project with Drive and Docs APIs enabled
- PM2 installed globally for production deployment

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd markdown-to-google-docs-api
npm install
```

### 2. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable these APIs:
   - Google Drive API
   - Google Docs API
   - Google+ API (or People API)
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set application type to "Web application"
6. Add authorised redirect URIs:
   - `http://localhost:3000/api/auth/callback` (development)
   - `https://yourdomain.com/api/auth/callback` (production)
7. Copy the Client ID and Client Secret

### 3. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your Google credentials:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
JWT_SECRET=your_super_secure_jwt_secret_minimum_32_characters
```

### 4. Development Setup

```bash
# Install PM2 globally (if not already installed)
npm install -g pm2

# Create data directory for API keys
mkdir data

# Start in development mode
npm run dev
```

## 🔑 Authentication Flow (One-Time Setup)

### Step 1: Get Your API Key

```bash
# 1. Get Google OAuth URL
curl http://localhost:3000/api/auth/google

# 2. Visit the returned authUrl and approve permissions
# 3. You'll get a response with your permanent API key
```

**Response:**
```json
{
  "success": true,
  "apiKey": "md2doc_a1b2c3d4",
  "user": {
    "id": "123456789",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "message": "Authentication successful - save this API key for future requests",
  "usage": {
    "header": "X-API-Key",
    "example": "X-API-Key: md2doc_a1b2c3d4"
  }
}
```

### Step 2: Save Your API Key

**Save the API key** (`md2doc_a1b2c3d4`) - this is your permanent authentication token!

## 📚 API Usage

### Convert Markdown to Google Doc

```bash
curl -X POST http://localhost:3000/api/convert/markdown-to-doc \
  -H "X-API-Key: md2doc_a1b2c3d4" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# My Document\n\nThis is **bold** text and *italic*.\n\n## Features\n- Auto-refresh tokens\n- Persistent API keys\n\n```javascript\nconsole.log(\"Hello World\");\n```",
    "title": "My Converted Document",
    "sharing": {
      "visibility": "private",
      "emails": ["colleague@example.com"]
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "name": "My Converted Document",
    "webViewLink": "https://docs.google.com/document/d/1BxiMVs0.../edit",
    "createdTime": "2025-05-28T04:05:34.000Z"
  }
}
```

## 🔧 API Key Management

### Get Current User Info
```bash
curl -H "X-API-Key: md2doc_a1b2c3d4" \
  http://localhost:3000/api/auth/user
```

### List All Your API Keys
```bash
curl -H "X-API-Key: md2doc_a1b2c3d4" \
  http://localhost:3000/api/auth/keys
```

### Generate New API Key
```bash
curl -X POST -H "X-API-Key: md2doc_a1b2c3d4" \
  http://localhost:3000/api/auth/regenerate
```

### Revoke an API Key
```bash
curl -X DELETE -H "X-API-Key: md2doc_a1b2c3d4" \
  http://localhost:3000/api/auth/keys/md2doc_old_key
```

### Get Conversion History
```bash
curl -H "X-API-Key: md2doc_a1b2c3d4" \
  "http://localhost:3000/api/convert/history?limit=20"
```

### Delete Document
```bash
curl -X DELETE -H "X-API-Key: md2doc_a1b2c3d4" \
  http://localhost:3000/api/convert/document/DOCUMENT_ID
```

## 🤖 Automatic Token Management

✅ **Google tokens automatically refresh** - no manual intervention needed!

✅ **API keys never expire** - authenticate once, use forever

✅ **Background refresh** - tokens refresh 5 minutes before expiry

✅ **Failure handling** - if refresh fails, API key is marked inactive

## 🚀 Production Deployment

### Start with PM2

```bash
# Production start
npm run prod

# View logs
npm run logs

# Restart
npm run restart

# Stop
npm run stop
```

## 🧪 Simple Test Page

Create `test.html` for easy testing:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Markdown to Docs Converter</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .container { margin: 20px 0; }
        textarea { width: 100%; }
        button { background: #4285f4; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #3367d6; }
        .result { margin: 20px 0; padding: 10px; border-radius: 4px; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <h1>🔄 Markdown to Google Docs Converter</h1>
    
    <div class="container">
        <h3>1. API Key</h3>
        <input type="text" id="apiKey" placeholder="Enter your API key (md2doc_...)" style="width: 300px;">
        <button onclick="testAuth()">Test API Key</button>
        <p><small>Don't have one? <a href="http://localhost:3000/api/auth/google" target="_blank">Authenticate with Google</a></small></p>
    </div>
    
    <div class="container">
        <h3>2. Markdown Content</h3>
        <textarea id="markdown" rows="10" placeholder="Enter your markdown here...">
# My Test Document

This is **bold** text and *italic* text.

## Features
- Auto-refresh tokens ✅
- Persistent API keys 🔑
- Native Google conversion 📝

```javascript
console.log("Hello from converted document!");
```

> This quote will be preserved in Google Docs

| Feature | Status |
|---------|--------|
| Tables | ✅ Supported |
| Code | ✅ Supported |
| Lists | ✅ Supported |
        </textarea>
    </div>
    
    <div class="container">
        <h3>3. Document Settings</h3>
        <input type="text" id="title" placeholder="Document title" value="My Converted Document" style="width: 300px;"><br><br>
        <button onclick="convert()">🚀 Convert to Google Doc</button>
    </div>
    
    <div id="result"></div>

    <script>
        // Load saved API key
        const savedKey = localStorage.getItem('apiKey');
        if (savedKey) {
            document.getElementById('apiKey').value = savedKey;
        }

        async function testAuth() {
            const apiKey = document.getElementById('apiKey').value;
            if (!apiKey) {
                showResult('Please enter an API key', 'error');
                return;
            }
            
            try {
                const response = await fetch('http://localhost:3000/api/auth/user', {
                    headers: { 'X-API-Key': apiKey }
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    localStorage.setItem('apiKey', apiKey);
                    showResult(`✅ API key valid! Authenticated as: ${data.user.name} (${data.user.email})`, 'success');
                } else {
                    showResult(`❌ ${data.error}`, 'error');
                }
            } catch (error) {
                showResult(`❌ Error: ${error.message}`, 'error');
            }
        }

        async function convert() {
            const apiKey = document.getElementById('apiKey').value;
            const content = document.getElementById('markdown').value;
            const title = document.getElementById('title').value;
            
            if (!apiKey) {
                showResult('Please enter an API key first', 'error');
                return;
            }
            
            if (!content.trim()) {
                showResult('Please enter some markdown content', 'error');
                return;
            }
            
            try {
                showResult('🔄 Converting markdown to Google Doc...', 'info');
                
                const response = await fetch('http://localhost:3000/api/convert/markdown-to-doc', {
                    method: 'POST',
                    headers: {
                        'X-API-Key': apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ content, title })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showResult(`
                        <h3>✅ Conversion Successful!</h3>
                        <p><strong>Document:</strong> ${result.document.name}</p>
                        <p><strong>Created:</strong> ${new Date(result.document.createdTime).toLocaleString()}</p>
                        <p><a href="${result.document.webViewLink}" target="_blank" style="background: #4285f4; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">📄 Open in Google Docs</a></p>
                    `, 'success');
                } else {
                    showResult(`❌ Conversion failed: ${result.error}`, 'error');
                }
            } catch (error) {
                showResult(`❌ Error: ${error.message}`, 'error');
            }
        }
        
        function showResult(message, type) {
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = `<div class="result ${type}">${message}</div>`;
        }
    </script>
</body>
</html>
```

## 🔒 Security Features

- **API Key Format**: `md2doc_` prefix for easy identification
- **Auto Token Refresh**: Google credentials refreshed automatically
- **Rate Limiting**: 10 conversions per 15 minutes per IP
- **Input Validation**: All inputs validated and sanitised
- **Secure Storage**: API keys stored securely with encryption-ready structure
- **Access Control**: Users can only manage their own API keys

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### Logs
- Application logs: `./logs/combined.log`
- PM2 logs: `pm2 logs markdown-docs-api`

## 🧹 Automatic Cleanup

- **Inactive API keys** older than 30 days are automatically cleaned up
- **Failed token refreshes** mark API keys as inactive
- **Background maintenance** runs every 24 hours

## 🔧 Configuration

### Environment Variables
- `JWT_SECRET`: Used for state verification during OAuth
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: OAuth credentials
- `GOOGLE_REDIRECT_URI`: OAuth callback URL

### File Structure
```
data/
└── api-keys.json    # Persistent API key storage
```

**Your API key grants permanent access** - treat it like a password! 🔐