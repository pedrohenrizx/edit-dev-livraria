// Authentication functionality for Edit.Dev Livraria

// Login functionality
async function handleLogin(event) {
    event.preventDefault();
    
    const form = event.target;
    const email = form.email.value;
    const password = form.password.value;
    const submitButton = form.querySelector('button[type="submit"]');
    
    if (!email || !password) {
        showAlert('Preencha todos os campos.', 'error');
        return;
    }
    
    const hideLoading = showLoading(submitButton);
    
    try {
        const data = await apiRequest('/api/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        // Store authentication data
        localStorage.setItem('token', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        
        showAlert('Login realizado com sucesso!', 'success');
        
        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 1000);
        
    } catch (error) {
        showAlert(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Register functionality
async function handleRegister(event) {
    event.preventDefault();
    
    const form = event.target;
    const name = form.name.value;
    const email = form.email.value;
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;
    const submitButton = form.querySelector('button[type="submit"]');
    
    // Validation
    if (!name || !email || !password || !confirmPassword) {
        showAlert('Preencha todos os campos.', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showAlert('As senhas não coincidem.', 'error');
        return;
    }
    
    if (password.length < 6) {
        showAlert('A senha deve ter pelo menos 6 caracteres.', 'error');
        return;
    }
    
    if (!isValidEmail(email)) {
        showAlert('Digite um email válido.', 'error');
        return;
    }
    
    const hideLoading = showLoading(submitButton);
    
    try {
        const data = await apiRequest('/api/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });
        
        // Store authentication data
        localStorage.setItem('token', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        
        showAlert('Conta criada com sucesso! Bem-vindo!', 'success');
        
        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 1000);
        
    } catch (error) {
        showAlert(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Email validation
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Password strength checker
function checkPasswordStrength(password) {
    const strength = {
        score: 0,
        feedback: []
    };
    
    if (password.length >= 8) {
        strength.score += 1;
    } else {
        strength.feedback.push('Use pelo menos 8 caracteres');
    }
    
    if (/[a-z]/.test(password)) {
        strength.score += 1;
    } else {
        strength.feedback.push('Inclua letras minúsculas');
    }
    
    if (/[A-Z]/.test(password)) {
        strength.score += 1;
    } else {
        strength.feedback.push('Inclua letras maiúsculas');
    }
    
    if (/[0-9]/.test(password)) {
        strength.score += 1;
    } else {
        strength.feedback.push('Inclua números');
    }
    
    if (/[^a-zA-Z0-9]/.test(password)) {
        strength.score += 1;
    } else {
        strength.feedback.push('Inclua símbolos especiais');
    }
    
    return strength;
}

// Show password strength indicator
function showPasswordStrength(password, indicatorElement) {
    if (!indicatorElement) return;
    
    const strength = checkPasswordStrength(password);
    const strengthLevels = ['Muito fraca', 'Fraca', 'Regular', 'Boa', 'Forte'];
    const strengthColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];
    
    const level = Math.min(strength.score, 4);
    const color = strengthColors[level];
    const text = strengthLevels[level];
    
    indicatorElement.innerHTML = `
        <div class="flex items-center space-x-2 mt-2">
            <div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div class="h-full transition-all duration-300" 
                     style="width: ${(level + 1) * 20}%; background-color: ${color}"></div>
            </div>
            <span class="text-sm font-medium" style="color: ${color}">${text}</span>
        </div>
        ${strength.feedback.length > 0 ? `
            <ul class="text-xs text-gray-600 mt-1 space-y-1">
                ${strength.feedback.map(fb => `<li>• ${fb}</li>`).join('')}
            </ul>
        ` : ''}
    `;
}

// Toggle password visibility
function togglePasswordVisibility(inputId, buttonElement) {
    const input = document.getElementById(inputId);
    const icon = buttonElement.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// Check authentication status and redirect if needed
function checkAuthRedirect() {
    const currentPage = window.location.pathname;
    const isAuth = isAuthenticated();
    
    // If user is logged in and trying to access login/register pages
    if (isAuth && (currentPage === '/login' || currentPage === '/register')) {
        window.location.href = '/dashboard';
        return;
    }
    
    // If user is not logged in and trying to access protected pages
    const protectedPages = ['/dashboard', '/library', '/contact'];
    if (!isAuth && protectedPages.some(page => currentPage.startsWith(page))) {
        showAlert('Você precisa fazer login para acessar esta página.', 'warning');
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
        return;
    }
}

// Initialize authentication features
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication and redirect if needed
    checkAuthRedirect();
    
    // Setup login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Setup register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
        
        // Password strength indicator
        const passwordInput = registerForm.password;
        const strengthIndicator = document.getElementById('passwordStrength');
        
        if (passwordInput && strengthIndicator) {
            passwordInput.addEventListener('input', function() {
                showPasswordStrength(this.value, strengthIndicator);
            });
        }
    }
    
    // Setup password visibility toggles
    const passwordToggles = document.querySelectorAll('[data-password-toggle]');
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const targetId = this.getAttribute('data-password-toggle');
            togglePasswordVisibility(targetId, this);
        });
    });
    
    // Auto-fill demo credentials if in development
    if (window.location.hostname === 'localhost' && window.location.pathname === '/login') {
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        
        if (emailInput && passwordInput) {
            // Add demo credentials button
            const demoButton = document.createElement('button');
            demoButton.type = 'button';
            demoButton.className = 'btn-secondary w-full mt-4';
            demoButton.innerHTML = '<i class="fas fa-user-circle mr-2"></i>Usar Dados Demo';
            demoButton.onclick = function() {
                emailInput.value = 'demo@editdev.com';
                passwordInput.value = 'demo123';
            };
            
            const form = document.getElementById('loginForm');
            if (form) {
                form.appendChild(demoButton);
            }
        }
    }
});

// Export functions for global use
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.checkPasswordStrength = checkPasswordStrength;
window.togglePasswordVisibility = togglePasswordVisibility;