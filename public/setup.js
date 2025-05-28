// Setup page logic
let apiUrl = window.location.origin;

// Initialize setup page
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 Setup page loaded');
    
    // Set redirect URI immediately
    setRedirectUri();
    
    // Initialize other components
    initializeSetup();
    setupFormHandlers();
    
    // Set redirect URI again after a delay to ensure it's set
    setTimeout(setRedirectUri, 1000);
    
    checkForApiKey(); // Check if we're returning from OAuth
});

// Check for API key in URL (returning from OAuth)
function checkForApiKey() {
    const urlParams = new URLSearchParams(window.location.search);
    const apiKey = urlParams.get('apiKey');
    const error = urlParams.get('error');
    
    if (error) {
        console.log('❌ OAuth error:', error);
        showNotification('Authentication failed. Please try again.', 'error');
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return false;
    }
    
    if (apiKey) {
        console.log('🔑 API key received from OAuth:', apiKey.substring(0, 15) + '...');
        
        // Save API key
        localStorage.setItem('markdowndocs_api_key', apiKey);
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Show API key received state
        showApiKeyReceivedState(apiKey);
        
        return true;
    }
    
    return false;
}

// Initialize the setup page
async function initializeSetup() {
    try {
        // If we found an API key in URL, don't check config status
        if (checkForApiKey()) {
            return;
        }
        
        // Check current configuration status
        const status = await checkConfigurationStatus();
        updateConfigStatus(status);
        
        console.log('📊 Configuration status:', status);
        
        if (status.configured) {
            // Check if user already has an API key
            const savedApiKey = localStorage.getItem('markdowndocs_api_key');
            if (savedApiKey) {
                showApiKeyReceivedState(savedApiKey);
            } else {
                showSuccessState();
            }
            
            // Hide reconfigure button if not allowed
            if (!status.allowReconfigure) {
                const reconfigureBtn = document.getElementById('reconfigureBtn');
                if (reconfigureBtn) {
                    reconfigureBtn.style.display = 'none';
                    console.log('🔒 Reconfigure button hidden - not allowed');
                }
            }
        }
    } catch (error) {
        console.error('Failed to check configuration:', error);
        updateConfigStatus({ configured: false, error: error.message });
    }
}

// Authenticate with Google
async function authenticateWithGoogle() {
    try {
        showLoadingModal('Redirecting to Google', 'You will be redirected to Google for authentication...');
        
        console.log('🔄 Getting Google OAuth URL...');
        
        const response = await fetch(`${apiUrl}/api/auth/google`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to get authentication URL');
        }
        
        if (data.authUrl) {
            console.log('🌐 Redirecting to Google OAuth...');
            
            // Store current page for return (setup page)
            localStorage.setItem('markdowndocs_return_url', window.location.href);
            
            // Redirect to Google OAuth
            window.location.href = data.authUrl;
        } else {
            throw new Error('No authentication URL received');
        }
        
    } catch (error) {
        hideLoadingModal();
        console.error('OAuth redirect failed:', error);
        showNotification('Authentication failed: ' + error.message, 'error');
    }
}

// Show API key received state
function showApiKeyReceivedState(apiKey) {
    // Hide other states
    const configForm = document.querySelector('.config-form-container');
    const successState = document.getElementById('successState');
    const apiKeyState = document.getElementById('apiKeyReceivedState');
    
    if (configForm) configForm.style.display = 'none';
    if (successState) successState.style.display = 'none';
    
    // Show API key state
    apiKeyState.style.display = 'block';
    
    // Display the API key
    const displayedApiKey = document.getElementById('displayedApiKey');
    if (displayedApiKey) {
        displayedApiKey.textContent = apiKey;
    }
    
    // Update status
    updateConfigStatus({ configured: true });
    
    // Animate in
    setTimeout(() => {
        apiKeyState.style.opacity = '1';
        apiKeyState.style.transform = 'translateY(0)';
    }, 100);
    
    console.log('✅ API key saved and displayed');
}

// Copy API key to clipboard
function copyApiKey() {
    const apiKeyElement = document.getElementById('displayedApiKey');
    const apiKey = apiKeyElement.textContent;
    
    navigator.clipboard.writeText(apiKey).then(() => {
        showNotification('API key copied to clipboard!', 'success');
        
        // Visual feedback
        const copyBtn = document.querySelector('.copy-btn');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✅';
        copyBtn.style.background = 'var(--success-500)';
        copyBtn.style.color = 'white';
        
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = '';
            copyBtn.style.color = '';
        }, 2000);
        
    }).catch(err => {
        console.error('Copy failed:', err);
        showNotification('Failed to copy API key', 'error');
    });
}

// Go to converter (updated to include API key)
function goToConverter() {
    const apiKey = localStorage.getItem('markdowndocs_api_key');
    if (apiKey) {
        // Include API key in URL for immediate access
        window.location.href = `/converter?apiKey=${apiKey}`;
    } else {
        window.location.href = '/converter';
    }
}

// Check configuration status
async function checkConfigurationStatus() {
    try {
        const response = await fetch(`${apiUrl}/api/config/status`);
        if (!response.ok) {
            throw new Error('Failed to check configuration status');
        }
        return await response.json();
    } catch (error) {
        return { configured: false, error: error.message };
    }
}

// Update configuration status display
function updateConfigStatus(status) {
    const statusContainer = document.getElementById('configStatus');
    
    if (status.configured) {
        statusContainer.innerHTML = `
            <div class="status-configured">
                <span class="status-icon">✅</span>
                <span>System is configured and ready</span>
            </div>
        `;
    } else {
        statusContainer.innerHTML = `
            <div class="status-not-configured">
                <span class="status-icon">⚠️</span>
                <span>Configuration required</span>
            </div>
        `;
    }
}

// Setup event listeners
function setupFormHandlers() {
    const form = document.getElementById('configForm');
    form.addEventListener('submit', handleFormSubmit);
    
    // Auto-resize textareas and validate on input
    const inputs = form.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', handleInputChange);
        input.addEventListener('blur', handleInputBlur);
    });
    
    // Test credentials button
    const testBtn = document.getElementById('testCredentialsBtn');
    if (testBtn) {
        testBtn.addEventListener('click', testCredentials);
    }
    
    // Password toggle buttons
    const passwordToggles = document.querySelectorAll('.password-toggle');
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            togglePassword(target);
        });
    });
    
    // Authenticate button
    const authenticateBtn = document.getElementById('authenticateBtn');
    if (authenticateBtn) {
        authenticateBtn.addEventListener('click', authenticateWithGoogle);
    }
    
    // Reconfigure button
    const reconfigureBtn = document.getElementById('reconfigureBtn');
    if (reconfigureBtn) {
        reconfigureBtn.addEventListener('click', reconfigure);
    }
    
    // Go to converter button
    const goToConverterBtn = document.getElementById('goToConverterBtn');
    if (goToConverterBtn) {
        goToConverterBtn.addEventListener('click', goToConverter);
    }
    
    // Copy API key button
    const copyApiKeyBtn = document.getElementById('copyApiKeyBtn');
    if (copyApiKeyBtn) {
        copyApiKeyBtn.addEventListener('click', copyApiKey);
    }
    
    // Modal close button
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
    }
    
    // Modal overlay click
    const modalOverlay = document.querySelector('.modal-overlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeModal);
    }
    
    // Set redirect URI button
    const setRedirectUriBtn = document.getElementById('setRedirectUriBtn');
    if (setRedirectUriBtn) {
        setRedirectUriBtn.addEventListener('click', setRedirectUri);
    }
}

// Handle input changes
function handleInputChange(event) {
    const input = event.target;
    const group = input.closest('.form-group');
    
    // Remove error state on input
    group.classList.remove('error');
    
    // Remove any existing error message
    const existingError = group.querySelector('.form-error');
    if (existingError) {
        existingError.remove();
    }
    
    // Basic validation
    if (input.required && input.value.trim() === '') {
        return; // Don't show error while typing
    }
    
    // Format validation
    if (input.name === 'clientId' && input.value) {
        if (!input.value.includes('.apps.googleusercontent.com')) {
            showFieldError(group, 'Client ID should end with .apps.googleusercontent.com');
            return;
        }
    }
    
    if (input.name === 'clientSecret' && input.value) {
        if (!input.value.startsWith('GOCSPX-')) {
            showFieldError(group, 'Client Secret should start with GOCSPX-');
            return;
        }
    }
    
    // Show success state if valid
    if (input.value.trim() !== '') {
        group.classList.add('success');
    }
}

// Handle input blur (when user leaves field)
function handleInputBlur(event) {
    const input = event.target;
    const group = input.closest('.form-group');
    
    if (input.required && input.value.trim() === '') {
        showFieldError(group, 'This field is required');
    }
}

// Show field error
function showFieldError(group, message) {
    group.classList.add('error');
    group.classList.remove('success');
    
    // Remove existing error
    const existingError = group.querySelector('.form-error');
    if (existingError) {
        existingError.remove();
    }
    
    // Add error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-error';
    errorDiv.innerHTML = `
        <span>⚠️</span>
        <span>${message}</span>
    `;
    
    const input = group.querySelector('.form-input');
    input.insertAdjacentElement('afterend', errorDiv);
}

// Show field success
function showFieldSuccess(group, message) {
    group.classList.add('success');
    group.classList.remove('error');
    
    // Remove existing messages
    const existingError = group.querySelector('.form-error');
    const existingSuccess = group.querySelector('.form-success');
    if (existingError) existingError.remove();
    if (existingSuccess) existingSuccess.remove();
    
    // Add success message
    const successDiv = document.createElement('div');
    successDiv.className = 'form-success';
    successDiv.innerHTML = `
        <span>✅</span>
        <span>${message}</span>
    `;
    
    const input = group.querySelector('.form-input');
    input.insertAdjacentElement('afterend', successDiv);
}

// Set redirect URI automatically
function setRedirectUri() {
    const redirectUri = `${window.location.origin}/api/auth/callback`;
    
    console.log('🔗 Setting redirect URI:', redirectUri);
    
    // Update the display in the guide
    const redirectUriElement = document.getElementById('redirectUri');
    if (redirectUriElement) {
        redirectUriElement.textContent = redirectUri;
        redirectUriElement.onclick = () => copyToClipboard(redirectUri);
        console.log('✅ Updated redirect URI in guide');
    } else {
        console.log('⚠️ Redirect URI guide element not found');
    }
    
    // Set in the form input - try multiple approaches
    const redirectUriInput = document.getElementById('redirectUriInput');
    if (redirectUriInput) {
        redirectUriInput.value = redirectUri;
        // Also set as default value
        redirectUriInput.defaultValue = redirectUri;
        // Trigger input event to ensure validation
        redirectUriInput.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('✅ Redirect URI set in form input:', redirectUriInput.value);
    } else {
        console.log('❌ Redirect URI input field not found');
        
        // Try alternative selector
        const altInput = document.querySelector('input[name="redirectUri"]');
        if (altInput) {
            altInput.value = redirectUri;
            altInput.defaultValue = redirectUri;
            console.log('✅ Redirect URI set via alternative selector');
        }
    }
    
    // Also try to set it via form name
    const form = document.getElementById('configForm');
    if (form && form.redirectUri) {
        form.redirectUri.value = redirectUri;
        console.log('✅ Redirect URI set via form element');
    }
    
    // Ensure it's set after a short delay as well
    setTimeout(() => {
        const input = document.getElementById('redirectUriInput') || document.querySelector('input[name="redirectUri"]');
        if (input && !input.value) {
            input.value = redirectUri;
            input.defaultValue = redirectUri;
            console.log('✅ Redirect URI set via timeout fallback');
        }
    }, 500);
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const config = {
        clientId: formData.get('clientId')?.trim(),
        clientSecret: formData.get('clientSecret')?.trim(),
        redirectUri: formData.get('redirectUri')?.trim()
    };
    
    console.log('📤 Form submission data:', {
        clientId: config.clientId ? config.clientId.substring(0, 20) + '...' : 'MISSING',
        clientSecret: config.clientSecret ? 'PROVIDED' : 'MISSING',
        redirectUri: config.redirectUri || 'MISSING',
        formDataEntries: Array.from(formData.entries()).map(([key, value]) => 
            [key, key === 'clientSecret' ? 'PROVIDED' : (value ? value.substring(0, 20) + '...' : 'MISSING')]
        )
    });
    
    // Validate required fields
    if (!config.clientId || !config.clientSecret || !config.redirectUri) {
        console.log('❌ Missing required fields:', {
            clientId: !config.clientId,
            clientSecret: !config.clientSecret,
            redirectUri: !config.redirectUri
        });
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    // Validate format
    if (!config.clientId.includes('.apps.googleusercontent.com')) {
        showNotification('Invalid Client ID format', 'error');
        return;
    }
    
    if (!config.clientSecret.startsWith('GOCSPX-')) {
        showNotification('Invalid Client Secret format', 'error');
        return;
    }
    
    try {
        showLoadingModal('Saving Configuration', 'Validating credentials and saving configuration...');
        
        console.log('🚀 Sending configuration to server...');
        
        const response = await fetch(`${apiUrl}/api/config/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        console.log('📥 Server response status:', response.status);
        
        const result = await response.json();
        console.log('📋 Server response:', result);
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to save configuration');
        }
        
        hideLoadingModal();
        showNotification('Configuration saved successfully!', 'success');
        
        // Show success state
        setTimeout(() => {
            showSuccessState();
        }, 1000);
        
    } catch (error) {
        hideLoadingModal();
        console.error('💥 Configuration save failed:', error);
        
        let errorMessage = error.message;
        
        // Try to parse error response if it's a fetch error
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = 'Network error - please check your connection';
        }
        
        showNotification(errorMessage, 'error');
        
        // If it's a validation error, highlight the problematic fields
        if (errorMessage.includes('Validation failed')) {
            // Re-run client-side validation to highlight issues
            const clientId = document.getElementById('clientId').value.trim();
            const clientSecret = document.getElementById('clientSecret').value.trim();
            const redirectUri = document.getElementById('redirectUriInput').value.trim();
            
            if (!clientId) {
                showFieldError(document.getElementById('clientId').closest('.form-group'), 'Client ID is required');
            }
            if (!clientSecret) {
                showFieldError(document.getElementById('clientSecret').closest('.form-group'), 'Client Secret is required');
            }
            if (!redirectUri) {
                showFieldError(document.getElementById('redirectUriInput').closest('.form-group'), 'Redirect URI is required');
            }
        }
    }
}

// Test credentials
async function testCredentials() {
    const clientId = document.getElementById('clientId').value.trim();
    const clientSecret = document.getElementById('clientSecret').value.trim();
    const redirectUri = document.getElementById('redirectUriInput').value.trim();
    
    if (!clientId || !clientSecret) {
        showNotification('Please enter Client ID and Client Secret first', 'warning');
        return;
    }
    
    const testBtn = document.querySelector('button[onclick="testCredentials()"]');
    const originalText = testBtn.innerHTML;
    
    try {
        // Update button state
        testBtn.innerHTML = `
            <div class="loading-spinner"></div>
            <span>Testing...</span>
        `;
        testBtn.disabled = true;
        
        const response = await fetch(`${apiUrl}/api/config/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                clientId,
                clientSecret,
                redirectUri
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('✅ Credentials are valid!', 'success');
        } else {
            throw new Error(result.error || 'Credential test failed');
        }
        
    } catch (error) {
        console.error('Credential test failed:', error);
        showNotification(`❌ ${error.message}`, 'error');
    } finally {
        // Restore button
        testBtn.innerHTML = originalText;
        testBtn.disabled = false;
    }
}

// Toggle password visibility
function togglePassword(fieldId) {
    const field = document.getElementById(fieldId);
    const toggle = field.nextElementSibling;
    const icon = toggle.querySelector('.toggle-icon');
    
    if (field.type === 'password') {
        field.type = 'text';
        icon.textContent = '🙈';
    } else {
        field.type = 'password';
        icon.textContent = '👁️';
    }
}

// Show success state
function showSuccessState() {
    const configForm = document.querySelector('.config-form-container');
    const successState = document.getElementById('successState');
    const configStatus = document.getElementById('configStatus');
    
    // Hide form and show success
    configForm.style.display = 'none';
    successState.style.display = 'block';
    
    // Update status
    updateConfigStatus({ configured: true });
    
    // Animate success state
    setTimeout(() => {
        successState.style.opacity = '1';
        successState.style.transform = 'translateY(0)';
    }, 100);
}

// Go to converter
function goToConverter() {
    window.location.href = '/converter.html';
}

// Reconfigure (show form again)
function reconfigure() {
    const configForm = document.querySelector('.config-form-container');
    const successState = document.getElementById('successState');
    
    configForm.style.display = 'block';
    successState.style.display = 'none';
    
    // Clear form
    document.getElementById('configForm').reset();
    
    // Clear validation states
    document.querySelectorAll('.form-group').forEach(group => {
        group.classList.remove('error', 'success');
        const messages = group.querySelectorAll('.form-error, .form-success');
        messages.forEach(msg => msg.remove());
    });
}

// Loading modal functions
function showLoadingModal(title, message) {
    const modal = document.getElementById('loadingModal');
    const titleElement = document.getElementById('loadingTitle');
    const messageElement = document.getElementById('loadingMessage');
    
    titleElement.textContent = title;
    messageElement.textContent = message;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function hideLoadingModal() {
    const modal = document.getElementById('loadingModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        
        // Visual feedback
        const element = document.getElementById('redirectUri');
        element.classList.add('copy-success');
        
        setTimeout(() => {
            element.classList.remove('copy-success');
        }, 300);
        
        showNotification('Copied to clipboard!', 'success');
    } catch (error) {
        console.error('Failed to copy:', error);
        
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        showNotification('Copied to clipboard!', 'success');
    }
}

// Notification system
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
            <button class="notification-close">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Add click handler for close button
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => notification.remove());
    
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

// Add notification styles
const notificationStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 3000;
        background: white;
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-xl);
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s ease;
        max-width: 400px;
        border: 1px solid var(--gray-200);
    }
    
    .notification-info { border-left: 4px solid var(--primary-500); }
    .notification-success { border-left: 4px solid var(--success-500); }
    .notification-warning { border-left: 4px solid var(--warning-500); }
    .notification-error { border-left: 4px solid var(--error-500); }
    
    .notification-content {
        padding: var(--space-4) var(--space-5);
        display: flex;
        align-items: center;
        gap: var(--space-3);
    }
    
    .notification-icon {
        font-size: 1.25rem;
        flex-shrink: 0;
    }
    
    .notification-message {
        color: var(--gray-700);
        font-weight: 500;
        flex: 1;
        line-height: 1.4;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: var(--gray-400);
        cursor: pointer;
        font-size: 1.25rem;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.2s ease;
        flex-shrink: 0;
    }
    
    .notification-close:hover {
        background: var(--gray-100);
        color: var(--gray-600);
    }
`;

// Inject notification styles
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Debug function to check form state
function debugFormState() {
    console.log('🐛 Form debug info:');
    console.log('- Redirect URI input exists:', !!document.getElementById('redirectUriInput'));
    console.log('- Redirect URI input value:', document.getElementById('redirectUriInput')?.value);
    console.log('- Form exists:', !!document.getElementById('configForm'));
    console.log('- All form inputs:', Array.from(document.querySelectorAll('#configForm input')).map(input => ({
        name: input.name,
        id: input.id,
        value: input.value,
        type: input.type
    })));
}

// Call debug function after setup
setTimeout(() => {
    debugFormState();
}, 2000);

// Export functions for global use
window.SetupApp = {
    testCredentials,
    togglePassword,
    goToConverter,
    reconfigure,
    copyToClipboard,
    authenticateWithGoogle,
    copyApiKey,
    setRedirectUri,
    debugFormState
};