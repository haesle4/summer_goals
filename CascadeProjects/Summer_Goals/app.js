const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

let currentUser = null;
let habits = [];
let currentHabitId = null;
let comments = [];
let commentCounts = {};
let messages = [];
let wheelOffset = 0;
let visibleWindow = [];

const WHEEL_SLOTS = 25;
const WHEEL_CHAR_LIMIT = 25;

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
        await loadCommentCounts();
        renderHabits();
    } catch (error) {
        console.error('Error loading habits:', error);
        alert('Failed to load habits. Please refresh the page.');
    }
}

async function loadCommentCounts() {
    try {
        const { data, error } = await supabaseClient
            .from('comments')
            .select('habit_id');
        
        if (error) throw error;
        
        commentCounts = {};
        (data || []).forEach(comment => {
            commentCounts[comment.habit_id] = (commentCounts[comment.habit_id] || 0) + 1;
        });
    } catch (error) {
        console.error('Error loading comment counts:', error);
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
    
    supabaseClient
        .channel('comments-channel')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'comments' },
            (payload) => {
                if (currentHabitId) {
                    loadComments(currentHabitId);
                }
            }
        )
        .subscribe();
    
    supabaseClient
        .channel('messages-channel')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'messages' },
            (payload) => {
                loadMessages();
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
    showHabitsPage();
    await loadHabits();
}

function showHabitsPage() {
    document.getElementById('habits-page').classList.remove('hidden');
    document.getElementById('chat-page').classList.add('hidden');
    document.getElementById('nav-habits-btn').classList.add('nav-active');
    document.getElementById('nav-chat-btn').classList.remove('nav-active');
}

async function showChatPage() {
    document.getElementById('habits-page').classList.add('hidden');
    document.getElementById('chat-page').classList.remove('hidden');
    document.getElementById('nav-chat-btn').classList.add('nav-active');
    document.getElementById('nav-habits-btn').classList.remove('nav-active');
    wheelOffset = 0;
    await loadMessages();
}

async function loadMessages() {
    try {
        const { data, error } = await supabaseClient
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1000);
        
        if (error) throw error;
        
        messages = data || [];
        clampWheelOffset();
        renderWheel();
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function clampWheelOffset() {
    const maxOffset = Math.max(0, messages.length - 1);
    if (wheelOffset > maxOffset) wheelOffset = maxOffset;
    if (wheelOffset < 0) wheelOffset = 0;
}

async function sendMessage() {
    const input = document.getElementById('chat-message-input');
    const text = input.value.trim();
    
    if (!text) return;
    
    try {
        const { error } = await supabaseClient
            .from('messages')
            .insert([{
                username: currentUser,
                message_text: text
            }]);
        
        if (error) throw error;
        
        input.value = '';
        wheelOffset = 0;
        await loadMessages();
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

function renderWheel() {
    const wheel = document.getElementById('chat-wheel');
    if (!wheel) return;
    
    if (messages.length === 0) {
        wheel.innerHTML = '<div class="wheel-empty">No messages yet. Be the first to say something!</div>';
        return;
    }
    
    const radiusPct = 28;
    const angleStep = 360 / WHEEL_SLOTS;
    
    visibleWindow = messages.slice(wheelOffset, wheelOffset + WHEEL_SLOTS);
    
    const messagesHtml = visibleWindow.map((msg, i) => {
        const angle = 180 + i * angleStep;
        const rad = (angle * Math.PI) / 180;
        const left = 50 + radiusPct * Math.cos(rad);
        const top = 50 + radiusPct * Math.sin(rad);
        const rotation = i * angleStep;
        
        const fullText = msg.message_text || '';
        const text = fullText.length > WHEEL_CHAR_LIMIT
            ? fullText.substring(0, WHEEL_CHAR_LIMIT)
            : fullText;
        
        const opacity = 1 - (i / (WHEEL_SLOTS - 1)) * 0.95;
        
        return `
            <div class="wheel-message"
                 onmouseenter="focusMessage(${i})"
                 onmouseleave="resetCenter()"
                 style="left: ${left}%; top: ${top}%; opacity: ${opacity}; transform: translate(-50%, -50%) rotate(${rotation}deg);">
                <span class="wheel-author">${escapeHtml(msg.username)}</span>
                <span class="wheel-text">${escapeHtml(text)}</span>
            </div>
        `;
    }).join('');
    
    const dividerHtml = `<div class="wheel-divider" style="left: 0; top: 54%;"></div>`;
    
    wheel.innerHTML = messagesHtml + dividerHtml + '<div class="wheel-center" id="wheel-center"></div>';
    
    resetCenter();
}

function setCenter(msg) {
    const center = document.getElementById('wheel-center');
    if (!center || !msg) return;
    center.innerHTML = `
        <span class="wheel-center-author">${escapeHtml(msg.username)}</span>
        <span class="wheel-center-text">${escapeHtml(msg.message_text || '')}</span>
    `;
}

function focusMessage(i) {
    setCenter(visibleWindow[i]);
}

function resetCenter() {
    setCenter(visibleWindow[0]);
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
        const commentCount = commentCounts[habit.id] || 0;
        
        return `
            <div class="habit-card" onclick="showHabitDetail('${habit.id}')">
                <div class="habit-header">
                    <div style="flex: 1;">
                        <div class="habit-creator">Created by ${habit.creator}</div>
                        <h3 class="habit-title">${escapeHtml(habit.title)}</h3>
                    </div>
                    ${commentCount > 0 ? `
                    <div class="comment-counter">
                        <svg class="comment-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <span class="comment-count">${commentCount}</span>
                    </div>
                    ` : ''}
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

async function showHabitDetail(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    
    currentHabitId = habitId;
    
    document.getElementById('detail-title').textContent = habit.title;
    document.getElementById('detail-creator').textContent = habit.creator;
    document.getElementById('detail-description').textContent = habit.description;
    document.getElementById('detail-goal').textContent = habit.goal;
    
    const participantsList = document.getElementById('detail-participants');
    participantsList.innerHTML = habit.participants.map(participant => 
        `<span class="participant-badge">${escapeHtml(participant)}</span>`
    ).join('');
    
    document.getElementById('comment-input').value = '';
    await loadComments(habitId);
    
    const deleteBtn = document.getElementById('delete-habit-btn');
    if (habit.creator === currentUser) {
        deleteBtn.style.display = 'block';
    } else {
        deleteBtn.style.display = 'none';
    }
    
    document.getElementById('habit-detail-modal').classList.remove('hidden');
}

function closeHabitDetail() {
    document.getElementById('habit-detail-modal').classList.add('hidden');
    currentHabitId = null;
    comments = [];
}

async function deleteHabit() {
    if (!currentHabitId) return;
    
    const habit = habits.find(h => h.id === currentHabitId);
    if (!habit) return;
    
    if (habit.creator !== currentUser) {
        alert('You can only delete habits you created');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete "${habit.title}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('habits')
            .delete()
            .eq('id', currentHabitId);
        
        if (error) throw error;
        
        closeHabitDetail();
        await loadHabits();
    } catch (error) {
        console.error('Error deleting habit:', error);
        alert('Failed to delete habit. Please try again.');
    }
}

async function loadComments(habitId) {
    try {
        const { data, error } = await supabaseClient
            .from('comments')
            .select('*')
            .eq('habit_id', habitId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        comments = data || [];
        renderComments();
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

function renderComments() {
    const commentsList = document.getElementById('comments-list');
    
    if (comments.length === 0) {
        commentsList.innerHTML = '<p style="color: var(--text-light); font-style: italic;">No comments yet. Be the first to comment!</p>';
        return;
    }
    
    commentsList.innerHTML = comments.map(comment => {
        const date = new Date(comment.created_at);
        const timeAgo = getTimeAgo(date);
        
        return `
            <div class="comment-item">
                <div class="comment-header">
                    <span class="comment-author">${escapeHtml(comment.username)}</span>
                    <span class="comment-time">${timeAgo}</span>
                </div>
                <div class="comment-text">${escapeHtml(comment.comment_text)}</div>
            </div>
        `;
    }).join('');
}

async function postComment() {
    const commentText = document.getElementById('comment-input').value.trim();
    
    if (!commentText) {
        alert('Please enter a comment');
        return;
    }
    
    if (!currentHabitId) {
        alert('No habit selected');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('comments')
            .insert([{
                habit_id: currentHabitId,
                username: currentUser,
                comment_text: commentText
            }]);
        
        if (error) throw error;
        
        document.getElementById('comment-input').value = '';
        await loadComments(currentHabitId);
    } catch (error) {
        console.error('Error posting comment:', error);
        alert('Failed to post comment. Please try again.');
    }
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    return date.toLocaleDateString();
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

document.getElementById('chat-message-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') sendMessage();
});

let scrollAccumulator = 0;
const SCROLL_THRESHOLD = 10;

document.getElementById('chat-wheel').addEventListener('wheel', function(e) {
    e.preventDefault();
    
    scrollAccumulator += e.deltaY;
    
    if (Math.abs(scrollAccumulator) < SCROLL_THRESHOLD) return;
    
    const maxOffset = Math.max(0, messages.length - 1);
    if (scrollAccumulator > 0) {
        wheelOffset = Math.max(wheelOffset - 1, 0);
    } else {
        wheelOffset = Math.min(wheelOffset + 1, maxOffset);
    }
    
    scrollAccumulator = 0;
    renderWheel();
}, { passive: false });

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

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const detailModal = document.getElementById('habit-detail-modal');
        const createModal = document.getElementById('create-habit-modal');
        
        if (!detailModal.classList.contains('hidden')) {
            closeHabitDetail();
        } else if (!createModal.classList.contains('hidden')) {
            closeCreateHabit();
        }
    }
});
