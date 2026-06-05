const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

let currentUser = null;
let habits = [];

function initApp() {
    checkAuth();
    setupRealtimeSubscription();
}

async function loadHabits() {
    try {
        const { data, error } = await supabaseClient
            .from('habits')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        habits = data || [];
        renderHabits();
    } catch (error) {
        console.error('Error loading habits:', error);
        alert('Failed to load habits. Please refresh the page.');
    }
}

function setupRealtimeSubscription() {
    supabaseClient
        .channel('habits-channel')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'habits' },
            (payload) => {
                loadHabits();
            }
        )
        .subscribe();
}

function checkAuth() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = savedUser;
        showApp();
    } else {
        showAuth();
    }
}

function showAuth() {
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
}

async function showApp() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    document.getElementById('current-user').textContent = currentUser;
    await loadHabits();
}

function showLogin() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('signup-form').classList.add('hidden');
}

function showSignup() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.remove('hidden');
}

async function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        alert('Please enter both username and password');
        return;
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
            return;
        }
        
        currentUser = username;
        localStorage.setItem('currentUser', currentUser);
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        await showApp();
    } catch (error) {
        console.error('Login error:', error);
        alert('Invalid username or password');
    }
}

async function signup() {
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    
    if (!username || !password || !confirm) {
        alert('Please fill in all fields');
        return;
    }
    
    if (password !== confirm) {
        alert('Passwords do not match');
        return;
    }
    
    try {
        const { data: existingUser } = await supabaseClient
            .from('users')
            .select('username')
            .eq('username', username)
            .single();
        
        if (existingUser) {
            alert('Username already exists');
            return;
        }
        
        const { error } = await supabaseClient
            .from('users')
            .insert([{ username, password }]);
        
        if (error) throw error;
        
        currentUser = username;
        localStorage.setItem('currentUser', currentUser);
        
        document.getElementById('signup-username').value = '';
        document.getElementById('signup-password').value = '';
        document.getElementById('signup-confirm').value = '';
        
        await showApp();
    } catch (error) {
        console.error('Signup error:', error);
        alert('Failed to create account. Please try again.');
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    showAuth();
    showLogin();
}

function showCreateHabit() {
    document.getElementById('create-habit-modal').classList.remove('hidden');
}

function closeCreateHabit() {
    document.getElementById('create-habit-modal').classList.add('hidden');
    document.getElementById('habit-title').value = '';
    document.getElementById('habit-description').value = '';
    document.getElementById('habit-goal').value = '';
}

async function createHabit() {
    const title = document.getElementById('habit-title').value.trim();
    const description = document.getElementById('habit-description').value.trim();
    const goal = document.getElementById('habit-goal').value.trim();
    
    if (!title) {
        alert('Please enter a habit title');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('habits')
            .insert([{
                title,
                description: description || 'No description provided',
                goal: goal || 'No specific goal',
                creator: currentUser,
                participants: [currentUser]
            }]);
        
        if (error) throw error;
        
        closeCreateHabit();
        await loadHabits();
    } catch (error) {
        console.error('Error creating habit:', error);
        alert('Failed to create habit. Please try again.');
    }
}

function renderHabits() {
    const habitsList = document.getElementById('habits-list');
    
    if (habits.length === 0) {
        habitsList.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--text-light);">
                <h2 style="color: var(--orange); margin-bottom: 16px;">No habits yet</h2>
                <p>Create your first habit to get started!</p>
            </div>
        `;
        return;
    }
    
    habitsList.innerHTML = habits.map(habit => {
        const isParticipant = habit.participants.includes(currentUser);
        const participantNames = habit.participants.join(', ');
        
        return `
            <div class="habit-card" onclick="showHabitDetail('${habit.id}')">
                <div class="habit-header">
                    <div style="flex: 1;">
                        <div class="habit-creator">Created by ${habit.creator}</div>
                        <h3 class="habit-title">${escapeHtml(habit.title)}</h3>
                    </div>
                </div>
                <p class="habit-description">${escapeHtml(habit.description)}</p>
                <div class="habit-footer">
                    <div class="participants">
                        Being pursued by <span class="participants-names">${escapeHtml(participantNames)}</span>
                    </div>
                    <div class="join-checkbox-container" onclick="event.stopPropagation(); toggleParticipation('${habit.id}')">
                        <input type="checkbox" 
                               class="join-checkbox" 
                               ${isParticipant ? 'checked' : ''} 
                               onclick="event.stopPropagation(); toggleParticipation('${habit.id}')">
                        <label class="join-label">${isParticipant ? 'Joined' : 'Join'}</label>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function toggleParticipation(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    
    const index = habit.participants.indexOf(currentUser);
    let newParticipants;
    
    if (index > -1) {
        if (habit.creator === currentUser) {
            alert('You cannot leave a habit you created');
            return;
        }
        newParticipants = habit.participants.filter(p => p !== currentUser);
    } else {
        newParticipants = [...habit.participants, currentUser];
    }
    
    try {
        const { error } = await supabaseClient
            .from('habits')
            .update({ participants: newParticipants })
            .eq('id', habitId);
        
        if (error) throw error;
        
        await loadHabits();
    } catch (error) {
        console.error('Error updating participation:', error);
        alert('Failed to update participation. Please try again.');
    }
}

function showHabitDetail(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    
    document.getElementById('detail-title').textContent = habit.title;
    document.getElementById('detail-creator').textContent = habit.creator;
    document.getElementById('detail-description').textContent = habit.description;
    document.getElementById('detail-goal').textContent = habit.goal;
    
    const participantsList = document.getElementById('detail-participants');
    participantsList.innerHTML = habit.participants.map(participant => 
        `<span class="participant-badge">${escapeHtml(participant)}</span>`
    ).join('');
    
    document.getElementById('habit-detail-modal').classList.remove('hidden');
}

function closeHabitDetail() {
    document.getElementById('habit-detail-modal').classList.add('hidden');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', initApp);

document.getElementById('login-username').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') login();
});

document.getElementById('login-password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') login();
});

document.getElementById('signup-username').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') document.getElementById('signup-password').focus();
});

document.getElementById('signup-password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') document.getElementById('signup-confirm').focus();
});

document.getElementById('signup-confirm').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') signup();
});

window.onclick = function(event) {
    const createModal = document.getElementById('create-habit-modal');
    const detailModal = document.getElementById('habit-detail-modal');
    
    if (event.target === createModal) {
        closeCreateHabit();
    }
    if (event.target === detailModal) {
        closeHabitDetail();
    }
}
