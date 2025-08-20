// Main JavaScript functionality for Edit.Dev Livraria

// API Base URL
const API_BASE = '';

// Utility functions
function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert-${type}`;
    alertDiv.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'exclamation-triangle'} mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Insert at the top of the body or a specific container
    const container = document.querySelector('.alert-container') || document.body;
    container.insertBefore(alertDiv, container.firstChild);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);
}

function showLoading(element) {
    const originalContent = element.innerHTML;
    element.innerHTML = '<span class="loading"></span> Carregando...';
    element.disabled = true;
    
    return function hideLoading() {
        element.innerHTML = originalContent;
        element.disabled = false;
    };
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(amount);
}

// API helper functions
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        }
    };
    
    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, finalOptions);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Request failed:', error);
        throw error;
    }
}

// Authentication helpers
function isAuthenticated() {
    return !!localStorage.getItem('token');
}

function getUserData() {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    window.location.href = '/';
}

// Navigation updates based on authentication
function updateNavigation() {
    const navAuth = document.getElementById('nav-auth');
    if (!navAuth) return;
    
    if (isAuthenticated()) {
        const userData = getUserData();
        navAuth.innerHTML = `
            <div class="flex items-center space-x-4">
                <span class="text-sm">Olá, ${userData?.name || 'Usuário'}</span>
                <div class="flex space-x-2">
                    <a href="/dashboard" class="btn-secondary text-sm">Dashboard</a>
                    <button onclick="logout()" class="btn-accent text-sm">Sair</button>
                </div>
            </div>
        `;
    } else {
        navAuth.innerHTML = `
            <div class="flex space-x-4">
                <a href="/login" class="btn-secondary">Entrar</a>
                <a href="/register" class="btn-accent">Cadastrar</a>
            </div>
        `;
    }
}

// Protected routes
function requireAuth() {
    if (!isAuthenticated()) {
        showAlert('Você precisa estar logado para acessar esta página.', 'warning');
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
        return false;
    }
    return true;
}

// Book helpers
function createBookCard(book, showFullAccess = false) {
    const userData = getUserData();
    const userPlan = userData?.plan || 'basic';
    
    return `
        <div class="book-card p-6 rounded-lg">
            <div class="text-center mb-4">
                <div class="text-5xl text-blue-600 mb-4">
                    <i class="fas fa-book"></i>
                </div>
                <h4 class="font-bold text-lg mb-2">${book.title}</h4>
                <p class="text-gray-600 mb-2">por ${book.author}</p>
                <span class="badge badge-${book.category?.toLowerCase()}">${book.category}</span>
            </div>
            
            <p class="text-gray-700 text-sm mb-4 h-20 overflow-hidden">${book.description}</p>
            
            <div class="space-y-2">
                <div class="flex justify-between text-sm">
                    <span>Capítulos:</span>
                    <span>${book.total_chapters}</span>
                </div>
                ${userPlan === 'basic' ? `
                    <div class="text-xs text-orange-600">
                        <i class="fas fa-lock mr-1"></i>
                        Plano Básico: Primeiros 3 capítulos
                    </div>
                ` : ''}
            </div>
            
            <div class="mt-6 space-y-2">
                <a href="/book-reader/${book.id}" class="btn-primary w-full text-center block text-sm">
                    <i class="fas fa-book-reader mr-2"></i>
                    Ler Online
                </a>
                <button onclick="downloadBook(${book.id})" class="btn-secondary w-full text-sm">
                    <i class="fas fa-download mr-2"></i>
                    Download
                </button>
            </div>
        </div>
    `;
}

// Download functionality
async function downloadBook(bookId) {
    if (!requireAuth()) return;
    
    try {
        const data = await apiRequest(`/api/books/${bookId}/download`, {
            method: 'POST'
        });
        
        showAlert(`Download iniciado: ${data.book.title}`, 'success');
        
        // Update download count if on dashboard
        if (window.updateDashboard) {
            window.updateDashboard();
        }
        
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Plan helpers
function getPlanBadge(plan, isValid = true) {
    if (!isValid) {
        return '<span class="badge" style="background-color: #ef4444; color: white;">Expirado</span>';
    }
    
    switch (plan) {
        case 'pro':
            return '<span class="badge badge-pro"><i class="fas fa-crown mr-1"></i>Pro</span>';
        case 'basic':
        default:
            return '<span class="badge badge-basic">Básico</span>';
    }
}

function getDownloadLimitText(plan, current, isValid = true) {
    if (!isValid || plan === 'basic') {
        return `${current}/2 downloads este mês`;
    }
    return 'Downloads ilimitados';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    updateNavigation();
    
    // Add mobile menu toggle if needed
    const mobileMenuButton = document.querySelector('[data-mobile-menu]');
    const mobileMenu = document.querySelector('[data-mobile-menu-items]');
    
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
        });
    }
    
    // Add smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});

// Global error handler
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showAlert('Ocorreu um erro inesperado. Tente novamente.', 'error');
});

// Export functions for global use
window.showAlert = showAlert;
window.showLoading = showLoading;
window.apiRequest = apiRequest;
window.isAuthenticated = isAuthenticated;
window.getUserData = getUserData;
window.logout = logout;
window.requireAuth = requireAuth;
window.createBookCard = createBookCard;
window.downloadBook = downloadBook;
window.getPlanBadge = getPlanBadge;
window.getDownloadLimitText = getDownloadLimitText;
window.formatDate = formatDate;
window.formatCurrency = formatCurrency;