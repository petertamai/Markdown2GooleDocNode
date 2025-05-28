// Setup page logic
let apiUrl = window.location.origin;

// Initialize setup page
document.addEventListener('DOMContentLoaded', function() {
    initializeSetup();
    setupFormHandlers();
    setRedirectUri();
});

// Initialize the setup page
async function initializeSetup() {
    try {
        // Check current configuration status
        const status = await checkConfigurationStatus();
        updateConfigStatus(status);
        
        if (status.configured) {
            showSuccessState();
        }
    } catch (error) {
        console.error('Failed to check configuration:', error);
        updateConfigStatus({ configured: false, error: error.message });
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

// Set up form handlers
function setupFormHandlers() {
    const form = document.getElementById('configForm');
    form.addEventListener('submit', handleFormSubmit);
    
    // Auto-resize textareas and validate on input
    const inputs = form.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', handleInputChange);
        input.addEventListener('blur', handleInputBlur);
    });
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
    
    // Update the display in the guide
    const redirectUriElement = document.getElementById('redirectUri');
    if (redirectUriElement) {
        redirectUriElement.textContent = redirectUri;
        redirectUriElement.onclick = () => copyToClipboard(redirectUri);
    }
    
    // Set in the form input
    const redirectUriInput = document.getElementById('redirectUriInput');
    if (redirectUriInput) {
        redirectUriInput.value = redirectUri;
    }
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const config = {
        clientId: formData.get('clientId').trim(),
        clientSecret: formData.get('clientSecret').trim(),
        redirectUri: formData.get('redirectUri').trim()
    };
    
    // Validate required fields
    if (!config.clientId || !config.clientSecret || !config.redirectUri) {
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
        
        const response = await fetch(`${apiUrl}/api/config/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        const result = await response.json();
        
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
        console.error('Configuration save failed:', error);
        showNotification(error.message, 'error');
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

// Export functions for global use
window.SetupApp = {
    testCredentials,
    togglePassword,
    goToConverter,
    reconfigure,
    copyToClipboard
};