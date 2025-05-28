// Global state
let isConfigured = false;
let apiUrl = window.location.origin;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupScrollEffects();
    setupAnimations();
});

// Initialize application
async function initializeApp() {
    try {
        // Check if system is configured
        const configStatus = await checkConfiguration();
        isConfigured = configStatus.configured;
        
        console.log('Configuration status:', configStatus);
    } catch (error) {
        console.warn('Could not check configuration status:', error.message);
    }
}

// Check if system is configured
async function checkConfiguration() {
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

// Check setup and redirect accordingly
async function checkSetup() {
    showLoadingState();
    
    try {
        const status = await checkConfiguration();
        
        if (status.configured) {
            // System is configured, go to converter
            window.location.href = '/converter.html';
        } else {
            // System needs configuration
            window.location.href = '/setup.html';
        }
    } catch (error) {
        console.error('Setup check failed:', error);
        // Fallback to setup page
        window.location.href = '/setup.html';
    } finally {
        hideLoadingState();
    }
}

// Show setup modal/page
function showSetup() {
    window.location.href = '/setup.html';
}

// Show demo modal
function showDemo() {
    // Create demo modal content
    const demoContent = `
        <div class="demo-modal">
            <h3>How It Works</h3>
            <div class="demo-steps">
                <div class="demo-step">
                    <div class="demo-step-number">1</div>
                    <div class="demo-step-content">
                        <h4>Write Markdown</h4>
                        <p>Create your content using standard Markdown syntax</p>
                    </div>
                </div>
                <div class="demo-step">
                    <div class="demo-step-number">2</div>
                    <div class="demo-step-content">
                        <h4>Send API Request</h4>
                        <p>Use your API key to convert the content</p>
                    </div>
                </div>
                <div class="demo-step">
                    <div class="demo-step-number">3</div>
                    <div class="demo-step-content">
                        <h4>Get Google Doc</h4>
                        <p>Receive a perfectly formatted Google Document</p>
                    </div>
                </div>
            </div>
            <div class="demo-actions">
                <button class="btn-primary" onclick="closeModal(); checkSetup();">
                    Try It Now
                </button>
            </div>
        </div>
    `;
    
    showModal('See It In Action', demoContent);
}

// Generic modal function
function showModal(title, content) {
    const modal = document.getElementById('setupModal');
    const modalHeader = modal.querySelector('.modal-header h2');
    const modalBody = modal.querySelector('.modal-body');
    
    modalHeader.textContent = title;
    modalBody.innerHTML = content;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Add escape key listener
    document.addEventListener('keydown', handleModalEscape);
}

// Close modal
function closeModal() {
    const modal = document.getElementById('setupModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Remove escape key listener
    document.removeEventListener('keydown', handleModalEscape);
}

// Handle escape key
function handleModalEscape(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
}

// Loading state management
function showLoadingState() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
        if (btn.onclick === checkSetup) {
            btn.innerHTML = `
                <svg class="loading-spinner" width="20" height="20" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" 
                            fill="none" stroke-dasharray="50.265" stroke-dashoffset="50.265"
                            stroke-linecap="round">
                        <animateTransform attributeName="transform" type="rotate" 
                                        dur="1s" repeatCount="indefinite" values="0 10 10;360 10 10"/>
                    </circle>
                </svg>
                <span>Checking...</span>
            `;
            btn.disabled = true;
        }
    });
}

function hideLoadingState() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
        if (btn.disabled && btn.innerHTML.includes('Checking...')) {
            btn.innerHTML = `
                <span>Get Started</span>
                <svg class="btn-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4.166 10h11.668m-5.834 5.834L15.834 10 10 4.166" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            btn.disabled = false;
        }
    });
}

// Scroll effects
function setupScrollEffects() {
    const navbar = document.querySelector('.navbar');
    let lastScrollY = window.scrollY;
    
    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        
        // Navbar background opacity
        if (currentScrollY > 50) {
            navbar.style.background = 'rgba(248, 250, 252, 0.95)';
            navbar.style.borderBottom = '1px solid rgba(226, 232, 240, 0.8)';
        } else {
            navbar.style.background = 'rgba(248, 250, 252, 0.8)';
            navbar.style.borderBottom = '1px solid rgba(226, 232, 240, 0.4)';
        }
        
        lastScrollY = currentScrollY;
    });
    
    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe feature cards and step cards
    document.querySelectorAll('.feature-card, .step-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });
}

// Setup animations
function setupAnimations() {
    // Hero stats counter animation
    const stats = document.querySelectorAll('.stat-number');
    
    const animateCounter = (element, target, duration = 2000) => {
        let start = 0;
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const eased = 1 - Math.pow(1 - progress, 3);
            
            if (target.includes('%')) {
                const value = Math.floor(eased * parseFloat(target));
                element.textContent = value + '%';
            } else if (target.includes('s')) {
                const value = (eased * parseFloat(target)).toFixed(1);
                element.textContent = value + 's';
            } else if (target === 'Auto') {
                if (progress > 0.5) {
                    element.textContent = 'Auto';
                }
            } else {
                const value = Math.floor(eased * parseInt(target));
                element.textContent = value.toString();
            }
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    };
    
    // Trigger counter animation when hero is visible
    const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                stats.forEach(stat => {
                    const target = stat.textContent;
                    stat.textContent = '0';
                    setTimeout(() => animateCounter(stat, target), 500);
                });
                heroObserver.unobserve(entry.target);
            }
        });
    });
    
    const heroStats = document.querySelector('.hero-stats');
    if (heroStats) {
        heroObserver.observe(heroStats);
    }
}

// Utility functions
function formatError(error) {
    if (error.response && error.response.data) {
        return error.response.data.error || error.message;
    }
    return error.message || 'An unexpected error occurred';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
    }, 100);
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add CSS for notifications
const notificationStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 3000;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s ease;
        max-width: 400px;
        border-left: 4px solid var(--primary-500);
    }
    
    .notification-info { border-left-color: var(--primary-500); }
    .notification-success { border-left-color: var(--success-500); }
    .notification-warning { border-left-color: var(--warning-500); }
    .notification-error { border-left-color: var(--error-500); }
    
    .notification-content {
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }
    
    .notification-message {
        color: var(--gray-700);
        font-weight: 500;
        flex: 1;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: var(--gray-400);
        cursor: pointer;
        font-size: 18px;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.2s ease;
    }
    
    .notification-close:hover {
        background: var(--gray-100);
        color: var(--gray-600);
    }
    
    .loading-spinner {
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    .demo-modal {
        text-align: center;
    }
    
    .demo-modal h3 {
        margin-bottom: 24px;
        color: var(--gray-900);
        font-size: 1.5rem;
        font-weight: 700;
    }
    
    .demo-steps {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-bottom: 32px;
    }
    
    .demo-step {
        display: flex;
        align-items: center;
        gap: 16px;
        text-align: left;
        padding: 16px;
        background: var(--gray-50);
        border-radius: 12px;
    }
    
    .demo-step-number {
        width: 32px;
        height: 32px;
        background: var(--gradient-primary);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        flex-shrink: 0;
    }
    
    .demo-step-content h4 {
        color: var(--gray-900);
        font-weight: 600;
        margin-bottom: 4px;
    }
    
    .demo-step-content p {
        color: var(--gray-600);
        font-size: 0.875rem;
        margin: 0;
    }
    
    .demo-actions {
        display: flex;
        justify-content: center;
    }
`;

// Inject notification styles
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Export for use in other files
window.MarkdownDocsApp = {
    checkSetup,
    showSetup,
    showDemo,
    closeModal,
    showNotification
};