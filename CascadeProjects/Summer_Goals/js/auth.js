import { supabaseClient } from './supabase.js';
import { state } from './state.js';
import { isHomePage, isMySummerPage, navigateAfterLogin } from './page.js';

export function showAuth() {
    document.getElementById('auth-root').classList.remove('hidden');
    if (isHomePage()) {
        document.getElementById('home-root').classList.add('hidden');
    }
    if (isMySummerPage()) {
        document.getElementById('app-root').classList.add('hidden');
    }
}

function setAvatarInitials() {
    const initial = state.currentUser?.charAt(0).toUpperCase() || 'M';
    const avatarEl = document.getElementById('avatar-initial');
    const homeAvatarEl = document.getElementById('home-avatar-initial');
    if (avatarEl) avatarEl.textContent = initial;
    if (homeAvatarEl) homeAvatarEl.textContent = initial;
}

export function showHomePage(onReady) {
    document.getElementById('auth-root').classList.add('hidden');
    document.getElementById('home-root').classList.remove('hidden');
    setAvatarInitials();
    if (onReady) return onReady();
}

export function showMySummerPage(onReady) {
    document.getElementById('auth-root').classList.add('hidden');
    document.getElementById('app-root').classList.remove('hidden');
    setAvatarInitials();
    if (onReady) return onReady();
}

export function showLogin() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('signup-form').classList.add('hidden');
}

export function showSignup() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.remove('hidden');
}

export function checkAuth() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        state.currentUser = savedUser;
        return true;
    }
    return false;
}

export async function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        alert('Please enter both username and password');
        return false;
    }

    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (error || !data) {
            alert('Invalid username or password');
            return false;
        }

        state.currentUser = username;
        localStorage.setItem('currentUser', state.currentUser);
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        return true;
    } catch (error) {
        console.error('Login error:', error);
        alert('Invalid username or password');
        return false;
    }
}

export async function signup() {
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;

    if (!username || !password || !confirm) {
        alert('Please fill in all fields');
        return false;
    }

    if (password !== confirm) {
        alert('Passwords do not match');
        return false;
    }

    try {
        const { data: existingUser } = await supabaseClient
            .from('users')
            .select('username')
            .eq('username', username)
            .single();

        if (existingUser) {
            alert('Username already exists');
            return false;
        }

        const { error } = await supabaseClient
            .from('users')
            .insert([{ username, password }]);

        if (error) throw error;

        state.currentUser = username;
        localStorage.setItem('currentUser', state.currentUser);

        document.getElementById('signup-username').value = '';
        document.getElementById('signup-password').value = '';
        document.getElementById('signup-confirm').value = '';
        return true;
    } catch (error) {
        console.error('Signup error:', error);
        alert('Failed to create account. Please try again.');
        return false;
    }
}

export function logout() {
    state.currentUser = null;
    localStorage.removeItem('currentUser');
    navigateAfterLogin();
}

export function bindAuthEvents({ onAuthenticated }) {
    document.getElementById('show-signup-link').addEventListener('click', (e) => {
        e.preventDefault();
        showSignup();
    });

    document.getElementById('show-login-link').addEventListener('click', (e) => {
        e.preventDefault();
        showLogin();
    });

    document.getElementById('login-btn').addEventListener('click', async () => {
        if (await login()) {
            if (isHomePage()) {
                await onAuthenticated();
            } else {
                navigateAfterLogin();
            }
        }
    });

    document.getElementById('signup-btn').addEventListener('click', async () => {
        if (await signup()) {
            if (isHomePage()) {
                await onAuthenticated();
            } else {
                navigateAfterLogin();
            }
        }
    });

    document.getElementById('login-username').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('login-password').focus();
    });

    document.getElementById('login-password').addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && (await login())) {
            if (isHomePage()) {
                await onAuthenticated();
            } else {
                navigateAfterLogin();
            }
        }
    });

    document.getElementById('signup-username').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('signup-password').focus();
    });

    document.getElementById('signup-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('signup-confirm').focus();
    });

    document.getElementById('signup-confirm').addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && (await signup())) {
            if (isHomePage()) {
                await onAuthenticated();
            } else {
                navigateAfterLogin();
            }
        }
    });
}

export function bindProfileEvents() {
    const bindProfile = (toggleId, avatarId, menuId, logoutId) => {
        const menu = document.getElementById(menuId);
        const toggle = document.getElementById(toggleId);
        const avatar = document.getElementById(avatarId);
        const logoutBtn = document.getElementById(logoutId);
        if (!menu || !toggle || !avatar || !logoutBtn) return;

        const toggleMenu = () => menu.classList.toggle('hidden');

        toggle.addEventListener('click', toggleMenu);
        avatar.addEventListener('click', toggleMenu);
        logoutBtn.addEventListener('click', () => {
            menu.classList.add('hidden');
            logout();
        });
    };

    bindProfile('profile-toggle', 'nav-avatar', 'profile-menu', 'logout-btn');
    bindProfile('home-profile-toggle', 'home-nav-avatar', 'home-profile-menu', 'home-logout-btn');

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-profile')) {
            document.querySelectorAll('.profile-menu').forEach((menu) => {
                menu.classList.add('hidden');
            });
        }
    });
}
