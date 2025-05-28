# 🚀 MarkdownDocs - Complete Setup Guide

Professional Markdown to Google Docs conversion service with beautiful web interface and persistent API keys.

## 📁 **File Creation Commands**

Run these commands in your project directory:

```bash
# Create main project structure
mkdir -p routes middleware services data logs public
touch server.js package.json ecosystem.config.js nodemon.json .env.example

# Create route files
touch routes/auth.js routes/conversion.js routes/config.js

# Create middleware files
touch middleware/auth.js middleware/errorHandler.js

# Create service files
touch services/apiKeyManager.js

# Create frontend files
touch public/index.html public/setup.html public/converter.html
touch public/styles.css public/setup.css public/converter.css
touch public/app.js public/setup.js public/converter.js

# Create documentation
touch README.md SETUP.md
```

## 🎯 **Quick Start**

### 1. **Install Dependencies**
```bash
npm install
npm install -g pm2
```

### 2. **Start Development Server**
```bash
npm run dev:stable
```

### 3. **Open Web Interface**
```bash
# Open your browser to:
http://localhost:3000
```

### 4. **Complete Setup via Web Interface**
1. Click "Get Started" on the home page
2. Follow the Google Cloud Console setup guide
3. Enter your Google OAuth credentials
4. Start converting Markdown to Google Docs!

## 🔧 **Google Cloud Console Setup**

### **Step 1: Create Project**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing one

### **Step 2: Enable APIs**
Enable these APIs in your project:
- [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)
- [Google Docs API](https://console.cloud.google.com/apis/library/docs.googleapis.com)  
- [Google+ API](https://console.cloud.google.com/apis/library/plus.googleapis.com)

### **Step 3: Create OAuth Credentials**
1. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Choose "Web application"
4. Add authorized redirect URI: `http://localhost:3000/api/auth/callback`
5. Copy Client ID and Client Secret

## 💻 **Manual Configuration (Alternative)**

If you prefer manual setup, edit `.env` file:

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Google OAuth2 Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback

# JWT Configuration  
JWT_SECRET=your_super_secure_jwt_secret_minimum_32_characters
JWT_EXPIRES_IN=24h

# Optional: Allow reconfiguration via web interface
ALLOW_RECONFIGURE=true
```

## 🔑 **Authentication Flow**

### **One-Time Setup:**
1. **Get API Key**: Visit web interface → authenticate with Google → receive permanent API key
2. **Save API Key**: Store your `md2doc_xxxxxxxx` key securely
3. **Use Forever**: API key never expires, tokens refresh automatically

### **Using the API:**
```bash
# Convert Markdown to Google Doc
curl -X POST http://localhost:3000/api/convert/markdown-to-doc \
  -H "X-API-Key: md2doc_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# My Document\n\nThis is **bold** text!",
    "title": "My First Document"
  }'
```

## 🌐 **Web Interface Features**

### **Landing Page (`/`)**
- Beautiful hero section with feature showcase
- Automatic setup detection and redirection
- Professional design with animations

### **Setup Page (`/setup`)**
- Interactive Google Cloud Console guide
- Credential validation and testing
- Real-time configuration status

### **Converter Page (`/converter`)**
- Live Markdown editor with syntax highlighting
- Document settings and sharing options
- Conversion history and statistics
- Real-time progress indicators

## 🚀 **Production Deployment**

### **Start with PM2:**
```bash
# Production start
npm run prod

# View logs
npm run logs

# Monitor processes
pm2 monit

# Restart
npm run restart

# Stop
npm run stop
```

### **PM2 Features:**
- Cluster mode for multi-core utilisation
- Automatic restart on crashes
- Memory monitoring and limits
- Log rotation and management
- Zero-downtime deployments

## 📊 **API Endpoints**

### **Configuration**
- `GET /api/config/status` - Check configuration status
- `POST /api/config/test` - Test Google credentials
- `POST /api/config/save` - Save configuration

### **Authentication**
- `GET /api/auth/google` - Get OAuth URL
- `GET /api/auth/callback` - OAuth callback handler
- `GET /api/auth/user` - Get current user info
- `GET /api/auth/keys` - List API keys
- `POST /api/auth/regenerate` - Generate new API key

### **Conversion**
- `POST /api/convert/markdown-to-doc` - Convert Markdown
- `GET /api/convert/history` - Get conversion history
- `DELETE /api/convert/document/:id` - Delete document

### **Development**
- `GET /api/convert/debug/keys` - List all API keys (dev only)
- `POST /api/config/reset` - Reset configuration (dev only)

## 🔐 **Security Features**

### **Authentication & Authorization**
- OAuth2 Google authentication
- Persistent API key system with auto-refresh
- JWT state verification for OAuth flow
- Rate limiting on all endpoints

### **Input Validation**
- Comprehensive request validation
- SQL injection prevention
- XSS protection with helmet.js
- CSRF protection with state parameters

### **Data Security**
- API keys stored securely with encryption-ready structure
- Sensitive data redacted from logs
- Google tokens encrypted in memory
- Automatic cleanup of expired keys

## 📈 **Performance Features**

### **Optimizations**
- Background token refresh (no user interruption)
- Request caching and deduplication
- Efficient memory usage with cleanup
- Optimized bundle sizes for frontend

### **Monitoring**
- Detailed conversion logging with request IDs
- Performance metrics (processing time, document size)
- Health check endpoints
- PM2 process monitoring

## 🔧 **Development Tools**

### **Available Scripts:**
```bash
npm run dev          # Start with nodemon (file watching)
npm run dev:stable   # Start with nodemon (ignore data files)
npm start           # Start production server
npm run prod        # Start with PM2 clustering
npm run logs        # View PM2 logs
npm run restart     # Restart PM2 processes
npm run stop        # Stop PM2 processes
```

### **File Structure:**
```
markdowndocs/
├── server.js                 # Main Express server
├── package.json              # Dependencies and scripts
├── ecosystem.config.js       # PM2 configuration
├── nodemon.json              # Nodemon configuration
├── .env                      # Environment variables
├── routes/
│   ├── auth.js              # OAuth & API key management
│   ├── conversion.js        # Markdown conversion
│   └── config.js            # System configuration
├── middleware/
│   ├── auth.js              # Authentication middleware
│   └── errorHandler.js     # Error handling
├── services/
│   └── apiKeyManager.js    # API key & token management
├── public/                  # Frontend files
│   ├── index.html          # Landing page
│   ├── setup.html          # Configuration interface
│   ├── converter.html      # Conversion interface
│   ├── styles.css          # Main styles
│   ├── setup.css           # Setup page styles
│   ├── converter.css       # Converter page styles
│   ├── app.js              # Landing page logic
│   ├── setup.js            # Setup page logic
│   └── converter.js        # Converter page logic
├── data/                   # Persistent data
│   ├── api-keys.json       # API key storage
│   └── config-completed.flag
└── logs/                   # Application logs
    ├── combined.log
    ├── error.log
    └── out.log
```

## 🎨 **Design System**

### **Color Palette:**
- Primary: `#3b82f6` (Blue)
- Secondary: `#8b5cf6` (Purple)
- Success: `#10b981` (Green)
- Warning: `#f59e0b` (Amber)
- Error: `#ef4444` (Red)

### **Typography:**
- Font Family: Inter (Google Fonts)
- Monospace: SF Mono, Monaco, Cascadia Code

### **Component Library:**
- Modern button designs with hover effects
- Card-based layouts with subtle shadows
- Gradient backgrounds and icons
- Responsive grid systems
- Loading states and progress indicators

## 🐛 **Troubleshooting**

### **Common Issues:**

#### **"System not configured" error**
- Complete setup via web interface at `/setup`
- Verify Google Cloud Console configuration
- Check `.env` file contains required variables

#### **"Invalid API key" error**
- Re-authenticate to get new API key
- Check API key format starts with `md2doc_`
- Verify API key hasn't been revoked

#### **Conversion fails**
- Check Google APIs are enabled
- Verify OAuth scopes include Drive and Docs
- Test credentials in setup interface

#### **Rate limiting**
- Default: 10 conversions per 15 minutes
- Configure limits in `.env` file
- Implement request queuing for high volume

### **Debug Mode:**
Set `NODE_ENV=development` for detailed error messages and debug endpoints.

## 📞 **Support**

- **Documentation**: Built-in setup guides and help text
- **Logs**: Detailed request tracking with unique IDs  
- **Health Checks**: `/health` endpoint for monitoring
- **Debug Tools**: Development-only endpoints for troubleshooting

## 📄 **License**

MIT License - Perfect for personal and commercial use.

---

## 🎉 **You're Ready!**

Your professional Markdown to Google Docs conversion service is now ready for use. The system includes:

✅ **Beautiful web interface** with professional design  
✅ **One-time authentication** with permanent API keys  
✅ **Auto-refreshing tokens** that work forever  
✅ **Production-ready** PM2 clustering and monitoring  
✅ **Enterprise security** with comprehensive validation  
✅ **Complete documentation** and troubleshooting guides  

**Start converting**: Visit `http://localhost:3000` and click "Get Started"! 🚀