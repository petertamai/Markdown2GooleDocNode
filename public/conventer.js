// Converter page logic
let apiUrl = window.location.origin;
let currentApiKey = null;
let currentUser = null;
let lastConversionResult = null;

// Initialize converter page
document.addEventListener('DOMContentLoaded', function() {
    initializeConverter();
    setupEventListeners();
    setupTextareaStats();
});

// Initialize the converter
async function initializeConverter() {
    try {
        // Check if system is configured
        const configStatus = await checkSystemConfiguration();
        if (!configStatus.configured) {
            window.location.href = '/setup.html';
            return;
        }

        // Try to get API key from URL, localStorage, or check existing auth
        const urlParams = new URLSearchParams(window.location.search);
        const apiKeyFromUrl = urlParams.get('apiKey');
        const storedApiKey = localStorage.getItem('markdowndocs_api_key');

        console.log('🔍 Checking authentication:', {
            apiKeyFromUrl: apiKeyFromUrl ? apiKeyFromUrl.substring(0, 15) + '...' : 'none',
            storedApiKey: storedApiKey ? storedApiKey.substring(0, 15) + '...' : 'none'
        });

        if (apiKeyFromUrl) {
            console.log('💾 Saving API key from URL');
            localStorage.setItem('markdowndocs_api_key', apiKeyFromUrl);
            currentApiKey = apiKeyFromUrl;
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (storedApiKey) {
            console.log('🔑 Using stored API key');
            currentApiKey = storedApiKey;
        }

        if (currentApiKey) {
            console.log('✅ API key found, validating...');
            await validateStoredApiKey();
        } else {
            console.log('❌ No API key found, showing auth section');
            showAuthSection();
        }

    } catch (error) {
        console.error('💥 Initialization failed:', error);
        showAuthSection();
    }
}

// Check system configuration
async function checkSystemConfiguration() {
    try {
        const response = await fetch(`${apiUrl}/api/config/status`);
        if (response.ok) {
            return await response.json();
        }
        return { configured: false };
    } catch (error) {
        return { configured: false };
    }
}

// Validate stored API key
async function validateStoredApiKey() {
    try {
        console.log('🔐 Validating stored API key...');
        updateAuthStatus('loading', 'Validating API key...');

        const response = await fetch(`${apiUrl}/api/auth/user`, {
            headers: {
                'X-API-Key': currentApiKey
            }
        });

        console.log('📡 API key validation response:', response.status);

        if (response.ok) {
            const userData = await response.json();
            currentUser = userData.user;
            
            console.log('✅ API key validation successful for:', currentUser.name);
            updateAuthStatus('authenticated', `Welcome back, ${currentUser.name}`);
            showConverterSection();
            loadConversionHistory();
        } else {
            const errorData = await response.json();
            console.log('❌ API key validation failed:', errorData);
            throw new Error(errorData.error || 'Invalid API key');
        }

    } catch (error) {
        console.error('💥 API key validation failed:', error);
        localStorage.removeItem('markdowndocs_api_key');
        currentApiKey = null;
        currentUser = null;
        updateAuthStatus('error', 'Invalid API key - please authenticate again');
        showApiKeySection();
    }
}

// Update authentication status
function updateAuthStatus(status, message) {
    const statusContainer = document.getElementById('authStatus');
    
    const statusClasses = {
        loading: 'status-loading',
        authenticated: 'status-authenticated', 
        error: 'status-error'
    };

    const statusIcons = {
        loading: '<div class="loading-spinner"></div>',
        authenticated: '✅',
        error: '❌'
    };

    statusContainer.innerHTML = `
        <div class="${statusClasses[status]}">
            ${statusIcons[status]}
            <span>${message}</span>
        </div>
    `;
}

// Show authentication section
function showAuthSection() {
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('apiKeySection').style.display = 'none';
    document.getElementById('converterSection').style.display = 'none';
    updateAuthStatus('error', 'Authentication required');
}

// Show API key section
function showApiKeySection() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('apiKeySection').style.display = 'flex';
    document.getElementById('converterSection').style.display = 'none';
    updateAuthStatus('error', 'API key required');
}

// Show converter section
function showConverterSection() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('apiKeySection').style.display = 'none';
    document.getElementById('converterSection').style.display = 'block';
}

// Authenticate with Google
async function authenticate() {
    try {
        const response = await fetch(`${apiUrl}/api/auth/google`);
        const data = await response.json();
        
        if (data.authUrl) {
            // Store current page for return
            localStorage.setItem('markdowndocs_return_url', window.location.href);
            window.location.href = data.authUrl;
        } else {
            throw new Error('Failed to get authentication URL');
        }
    } catch (error) {
        console.error('Authentication failed:', error);
        showNotification('Authentication failed: ' + error.message, 'error');
    }
}

// Validate API key from input
async function validateApiKey() {
    const apiKeyInput = document.getElementById('apiKeyInput');
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        showNotification('Please enter an API key', 'warning');
        return;
    }

    if (!apiKey.startsWith('md2doc_')) {
        showNotification('Invalid API key format', 'error');
        return;
    }

    try {
        updateAuthStatus('loading', 'Validating API key...');

        const response = await fetch(`${apiUrl}/api/auth/user`, {
            headers: {
                'X-API-Key': apiKey
            }
        });

        if (response.ok) {
            const userData = await response.json();
            currentUser = userData.user;
            currentApiKey = apiKey;
            
            // Store API key
            localStorage.setItem('markdowndocs_api_key', apiKey);
            
            updateAuthStatus('authenticated', `Welcome, ${currentUser.name}`);
            showConverterSection();
            loadConversionHistory();
            showNotification('API key validated successfully!', 'success');
            
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Invalid API key');
        }

    } catch (error) {
        console.error('API key validation failed:', error);
        updateAuthStatus('error', 'Invalid API key');
        showNotification(error.message, 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    // API key input - enter key
    const apiKeyInput = document.getElementById('apiKeyInput');
    if (apiKeyInput) {
        apiKeyInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                validateApiKey();
            }
        });
    }

    // Document title auto-generation
    const markdownInput = document.getElementById('markdownInput');
    const titleInput = document.getElementById('documentTitle');
    
    if (markdownInput && titleInput) {
        markdownInput.addEventListener('input', function() {
            // Auto-generate title from first heading if title is empty
            if (!titleInput.value.trim()) {
                const content = markdownInput.value;
                const firstHeading = content.match(/^#\s+(.+)$/m);
                if (firstHeading) {
                    titleInput.value = firstHeading[1].trim();
                }
            }
        });
    }
}

// Setup textarea statistics
function setupTextareaStats() {
    const textarea = document.getElementById('markdownInput');
    const charCount = document.getElementById('charCount');
    const wordCount = document.getElementById('wordCount');
    const lineCount = document.getElementById('lineCount');

    if (!textarea) return;

    function updateStats() {
        const content = textarea.value;
        const chars = content.length;
        const words = content.trim() ? content.trim().split(/\s+/).length : 0;
        const lines = content.split('\n').length;

        charCount.textContent = `${chars.toLocaleString()} characters`;
        wordCount.textContent = `${words.toLocaleString()} words`;
        lineCount.textContent = `${lines.toLocaleString()} lines`;
    }

    textarea.addEventListener('input', updateStats);
    updateStats(); // Initial update
}

// Load sample content
function loadSample() {
    const textarea = document.getElementById('markdownInput');
    const titleInput = document.getElementById('documentTitle');
    
    const sampleContent = `# MarkdownDocs Sample Document

Welcome to **MarkdownDocs**! This sample demonstrates the powerful conversion capabilities from Markdown to Google Docs.

## Features Showcase

### Text Formatting
- **Bold text** for emphasis
- *Italic text* for subtle emphasis
- \`Inline code\` for technical terms
- ~~Strikethrough~~ for corrections

### Lists and Organization

#### Unordered Lists
- Auto-refresh tokens ✅
- Persistent API keys 🔑
- Native Google conversion 📝
- Enterprise security 🛡️

#### Ordered Lists
1. Authenticate with Google
2. Get your permanent API key
3. Convert Markdown to Google Docs
4. Share and collaborate

### Code Blocks

\`\`\`javascript
// Example: Converting markdown programmatically
const response = await fetch('/api/convert/markdown-to-doc', {
  method: 'POST',
  headers: {
    'X-API-Key': 'md2doc_your_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    content: markdownContent,
    title: 'My Document'
  })
});

const result = await response.json();
console.log('Document created:', result.document.webViewLink);
\`\`\`

### Tables

| Feature | Status | Description |
|---------|--------|-------------|
| Markdown Parsing | ✅ Complete | Full GitHub Flavored Markdown support |
| Google Integration | ✅ Complete | Native Google Drive API integration |
| Auto Token Refresh | ✅ Complete | Background token management |
| Team Collaboration | ✅ Complete | Share documents with teammates |

### Blockquotes

> "MarkdownDocs has revolutionized our documentation workflow. The seamless conversion from Markdown to Google Docs means our team can write in their preferred format while maintaining professional presentation."
> 
> — Development Team Lead

### Links and References

- [Google Docs](https://docs.google.com) - The destination format
- [Markdown Guide](https://www.markdownguide.org) - Learn Markdown syntax
- [GitHub Flavored Markdown](https://github.github.com/gfm/) - Extended syntax support

---

## Advanced Features

### Mathematical Expressions
For complex documentation, you can include mathematical expressions that will be preserved in the conversion process.

### Custom Styling
The conversion process maintains the hierarchical structure of your document, ensuring that headings, subheadings, and content organization are preserved in the final Google Doc.

## Getting Started

1. **Setup**: Configure your Google Cloud credentials
2. **Authenticate**: Get your permanent API key
3. **Convert**: Transform your Markdown into professional Google Docs
4. **Collaborate**: Share with your team and stakeholders

**Ready to get started?** Click the convert button below to see this sample in action!`;

    textarea.value = sampleContent;
    titleInput.value = 'MarkdownDocs Sample Document';
    
    // Trigger stats update
    textarea.dispatchEvent(new Event('input'));
    
    showNotification('Sample content loaded!', 'success');
}

// Clear input
function clearInput() {
    const textarea = document.getElementById('markdownInput');
    const titleInput = document.getElementById('documentTitle');
    
    textarea.value = '';
    titleInput.value = '';
    
    // Trigger stats update
    textarea.dispatchEvent(new Event('input'));
    
    showNotification('Content cleared', 'info');
}

// Convert markdown to Google Doc
async function convertMarkdown() {
    const content = document.getElementById('markdownInput').value.trim();
    const title = document.getElementById('documentTitle').value.trim() || 'Untitled Document';
    const folderId = document.getElementById('folderId').value.trim();
    const visibility = document.getElementById('visibility').value;
    const shareEmails = document.getElementById('shareEmails').value.trim();

    // Validation
    if (!content) {
        showNotification('Please enter some Markdown content', 'warning');
        return;
    }

    if (!currentApiKey) {
        showNotification('API key required', 'error');
        showApiKeySection();
        return;
    }

    const convertBtn = document.getElementById('convertBtn');
    const originalContent = convertBtn.innerHTML;

    try {
        // Show loading state
        convertBtn.innerHTML = `
            <div class="loading-spinner"></div>
            <span>Converting...</span>
        `;
        convertBtn.disabled = true;
        convertBtn.classList.add('converting');

        // Show conversion modal
        showConversionModal();

        // Prepare request data
        const requestData = {
            content: content,
            title: title
        };

        if (folderId) {
            requestData.folderId = folderId;
        }

        // Add sharing settings
        if (visibility === 'public' || shareEmails) {
            requestData.sharing = {
                visibility: visibility,
                role: 'reader'
            };

            if (shareEmails) {
                requestData.sharing.emails = shareEmails.split(',').map(email => email.trim()).filter(email => email);
            }
        }

        updateConversionProgress(2); // Step 2: Converting

        const response = await fetch(`${apiUrl}/api/convert/markdown-to-doc`, {
            method: 'POST',
            headers: {
                'X-API-Key': currentApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Conversion failed');
        }

        updateConversionProgress(3); // Step 3: Finalizing

        // Store result
        lastConversionResult = result;

        // Wait a bit for the final step animation
        await new Promise(resolve => setTimeout(resolve, 1000));

        hideConversionModal();
        showConversionResult(result);
        loadConversionHistory(); // Refresh history

        showNotification('Document created successfully!', 'success');

    } catch (error) {
        console.error('Conversion failed:', error);
        hideConversionModal();
        showNotification('Conversion failed: ' + error.message, 'error');

        // Handle specific errors
        if (error.message.includes('Authentication')) {
            localStorage.removeItem('markdowndocs_api_key');
            currentApiKey = null;
            currentUser = null;
            showApiKeySection();
        }

    } finally {
        // Restore button
        convertBtn.innerHTML = originalContent;
        convertBtn.disabled = false;
        convertBtn.classList.remove('converting');
    }
}

// Show conversion modal
function showConversionModal() {
    const modal = document.getElementById('conversionModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Reset progress steps
    updateConversionProgress(1);
}

// Hide conversion modal
function hideConversionModal() {
    const modal = document.getElementById('conversionModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Update conversion progress
function updateConversionProgress(step) {
    // Remove all active/completed states
    document.querySelectorAll('.progress-step').forEach(s => {
        s.classList.remove('active', 'completed');
    });

    // Set completed steps
    for (let i = 1; i < step; i++) {
        const stepElement = document.getElementById(`step${i}`);
        if (stepElement) {
            stepElement.classList.add('completed');
        }
    }

    // Set active step
    const activeStep = document.getElementById(`step${step}`);
    if (activeStep) {
        activeStep.classList.add('active');
    }

    // Update messages
    const messages = {
        1: 'Processing your Markdown content...',
        2: 'Converting to Google Docs format...',
        3: 'Finalizing document and applying settings...'
    };

    const progressMessage = document.getElementById('progressMessage');
    if (progressMessage && messages[step]) {
        progressMessage.textContent = messages[step];
    }
}

// Show conversion result
function showConversionResult(result) {
    const resultsSection = document.getElementById('resultsSection');
    const resultTitle = document.getElementById('resultTitle');
    const resultDetails = document.getElementById('resultDetails');
    const viewDocLink = document.getElementById('viewDocLink');
    const processingTime = document.getElementById('processingTime');
    const documentSize = document.getElementById('documentSize');
    const contentLength = document.getElementById('contentLength');

    // Update result details
    resultTitle.textContent = result.document.name;
    resultDetails.textContent = `Created ${new Date(result.document.createdTime).toLocaleString()}`;
    viewDocLink.href = result.document.webViewLink;

    // Update stats
    if (result.processing) {
        processingTime.textContent = `${result.processing.timeMs}ms`;
        contentLength.textContent = `${result.processing.contentLength} chars`;
    }
    
    if (result.document.size) {
        const sizeKB = Math.round(parseInt(result.document.size) / 1024);
        documentSize.textContent = `${sizeKB} KB`;
    }

    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Hide results
function hideResults() {
    document.getElementById('resultsSection').style.display = 'none';
}

// Copy document link
function copyDocumentLink() {
    if (!lastConversionResult) return;

    const link = lastConversionResult.document.webViewLink;
    
    navigator.clipboard.writeText(link).then(() => {
        showNotification('Document link copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Copy failed:', err);
        showNotification('Failed to copy link', 'error');
    });
}

// Load conversion history
async function loadConversionHistory() {
    const historyList = document.getElementById('historyList');
    
    if (!currentApiKey) {
        historyList.innerHTML = `
            <div class="history-empty">
                <div class="history-empty-icon">🔑</div>
                <p>Please authenticate to view conversion history</p>
            </div>
        `;
        return;
    }

    try {
        historyList.innerHTML = `
            <div class="history-loading">
                <div class="loading-spinner"></div>
                <span>Loading history...</span>
            </div>
        `;

        const response = await fetch(`${apiUrl}/api/convert/history?limit=10`, {
            headers: {
                'X-API-Key': currentApiKey
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load history');
        }

        const data = await response.json();
        
        if (data.documents && data.documents.length > 0) {
            historyList.innerHTML = data.documents.map(doc => `
                <div class="history-item">
                    <div class="history-doc">
                        <div class="history-icon">📄</div>
                        <div class="history-details">
                            <h5>${escapeHtml(doc.name)}</h5>
                            <p>Created ${new Date(doc.createdTime).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div class="history-actions">
                        <button class="btn-icon-small" onclick="openDocument('${doc.webViewLink}')" title="Open document">
                            👁️
                        </button>
                        <button class="btn-icon-small" onclick="copyDocumentUrl('${doc.webViewLink}')" title="Copy link">
                            📋
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            historyList.innerHTML = `
                <div class="history-empty">
                    <div class="history-empty-icon">📚</div>
                    <p>No conversions yet. Create your first document above!</p>
                </div>
            `;
        }

    } catch (error) {
        console.error('Failed to load history:', error);
        historyList.innerHTML = `
            <div class="history-empty">
                <div class="history-empty-icon">❌</div>
                <p>Failed to load conversion history</p>
            </div>
        `;
    }
}

// Refresh history
function refreshHistory() {
    loadConversionHistory();
    showNotification('History refreshed', 'info');
}

// Open document
function openDocument(url) {
    window.open(url, '_blank');
}

// Copy document URL
function copyDocumentUrl(url) {
    navigator.clipboard.writeText(url).then(() => {
        showNotification('Document link copied!', 'success');
    }).catch(err => {
        console.error('Copy failed:', err);
        showNotification('Failed to copy link', 'error');
    });
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Notification system (reuse from other files)
function showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌'
    };
    
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${icons[type] || icons.info}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
    }, 100);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.transform = 'translateX(100%)';
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Export functions for global use
window.ConverterApp = {
    authenticate,
    validateApiKey,
    convertMarkdown,
    loadSample,
    clearInput,
    hideResults,
    copyDocumentLink,
    refreshHistory,
    openDocument,
    copyDocumentUrl
};