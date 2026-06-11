import { supabaseClient } from './supabase.js';
import { state } from './state.js';

export function showAuth() {
    document.getElementById('auth-root').classList.remove('hidden');
    document.getElementById('app-root').classList.add('hidden');
}

export async function showApp(onReady) {
    document.getElementById('auth-root').classList.add('hidden');
    document.getElementById('app-root').classList.remove('hidden');

    const initial = state.currentUser?.charAt(0).toUpperCase() || 'M';
    document.getElementById('avatar-initial').textContent = initial;

    if (onReady) await onReady();
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
    showAuth();
    showLogin();
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
        if (await login()) await onAuthenticated();
    });

    document.getElementById('signup-btn').addEventListener('click', async () => {
        if (await signup()) await onAuthenticated();
    });

    document.getElementById('login-username').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('login-password').focus();
    });

    document.getElementById('login-password').addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && (await login())) await onAuthenticated();
    });

    document.getElementById('signup-username').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('signup-password').focus();
    });

    document.getElementById('signup-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('signup-confirm').focus();
    });

    document.getElementById('signup-confirm').addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && (await signup())) await onAuthenticated();
    });
}

export function bindProfileEvents() {
    const menu = document.getElementById('profile-menu');
    const toggle = () => menu.classList.toggle('hidden');

    document.getElementById('profile-toggle').addEventListener('click', toggle);
    document.getElementById('nav-avatar').addEventListener('click', toggle);

    document.getElementById('logout-btn').addEventListener('click', () => {
        menu.classList.add('hidden');
        logout();
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-profile')) {
            menu.classList.add('hidden');
        }
    });
}
