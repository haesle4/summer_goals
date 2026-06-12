import { supabaseClient } from './supabase.js';
import { state, SUMMER_YEAR } from './state.js';
import { escapeHtml, todayDateString, getHabitItemType, MONTH_NAMES } from './utils.js';
import {
    enableLocalCompletions,
    isLocalCompletions,
    loadLocalCompletions,
    appendLocalCompletion,
    removeLocalCompletion,
    showLocalDevBanner,
} from './local-dev.js';

export function showHomeView() {
    document.getElementById('home-root').classList.remove('hidden');
    document.getElementById('app-root').classList.add('hidden');
}

export function showProgressView() {
    document.getElementById('home-root').classList.add('hidden');
    document.getElementById('app-root').classList.remove('hidden');
}

function summerDaysElapsed() {
    const start = new Date(SUMMER_YEAR, 5, 15);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.floor((today - start) / 86400000);
}

function countCompletions(memberships) {
    let habits = 0;
    let goals = 0;

    memberships.forEach((m) => {
        const done = (m.completed_dates || []).length;
        if (!done) return;
        const habit = state.habits.find((h) => h.id === m.habit_id);
        if (habit && getHabitItemType(habit) === 'goal') {
            goals += done;
        } else {
            habits += done;
        }
    });

    return { habits, goals };
}

function renderHomeStats({ habits, goals }) {
    const habitsEl = document.getElementById('stat-habits-completed');
    const goalsEl = document.getElementById('stat-goals-completed');
    const daysEl = document.getElementById('stat-summer-days');

    if (habitsEl) habitsEl.textContent = habits;
    if (goalsEl) goalsEl.textContent = goals;
    if (daysEl) daysEl.textContent = summerDaysElapsed();
}

export async function loadHomeStats() {
    try {
        const { data, error } = await supabaseClient
            .from('habit_memberships')
            .select('habit_id, completed_dates');

        if (error) throw error;

        renderHomeStats(countCompletions(data || []));
    } catch (error) {
        console.warn('group stats unavailable — using local data', error);
        renderHomeStats(countCompletions(state.memberships));
    }
}

export async function loadFeed() {
    await loadHomeStats();

    if (isLocalCompletions()) {
        state.feed = loadLocalCompletions();
        renderFeed();
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('completions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        state.feed = data || [];
        renderFeed();
    } catch (error) {
        console.warn('completions unavailable — using local dev storage', error);
        enableLocalCompletions();
        showLocalDevBanner();
        state.feed = loadLocalCompletions();
        renderFeed();
    }
}

export async function logCompletion(habitId, comment) {
    const row = {
        habit_id: habitId,
        username: state.currentUser,
        completed_date: todayDateString(),
        comment: comment || null,
    };

    if (isLocalCompletions()) {
        appendLocalCompletion(row);
        await loadFeed();
        return;
    }

    try {
        const { error } = await supabaseClient.from('completions').insert([row]);
        if (error) throw error;
    } catch (error) {
        console.warn('completions insert failed — using local dev storage', error);
        enableLocalCompletions();
        showLocalDevBanner();
        appendLocalCompletion(row);
    }
    await loadFeed();
}

export async function removeCompletion(habitId) {
    const today = todayDateString();

    if (isLocalCompletions()) {
        removeLocalCompletion(habitId, state.currentUser, today);
        await loadFeed();
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('completions')
            .delete()
            .eq('habit_id', habitId)
            .eq('username', state.currentUser)
            .eq('completed_date', today);

        if (error) throw error;
    } catch (error) {
        console.warn('completions delete failed — using local dev storage', error);
        enableLocalCompletions();
        showLocalDevBanner();
        removeLocalCompletion(habitId, state.currentUser, today);
    }
    await loadFeed();
}

function formatFeedDate(dateKey) {
    if (!dateKey) return '';
    const [, m, d] = String(dateKey).slice(0, 10).split('-').map(Number);
    const month = MONTH_NAMES[m - 1]?.slice(0, 3) || '';
    return `${month} ${d}`;
}

function completedUsersFor(habitId, dateKey) {
    const users = state.feed
        .filter((c) => c.habit_id === habitId && String(c.completed_date || '').slice(0, 10) === dateKey)
        .map((c) => c.username);
    return [...new Set(users)];
}

export function renderFeed() {
    const list = document.getElementById('feed-list');
    if (!list) return;

    if (state.feed.length === 0) {
        list.innerHTML = '<p class="feed-empty">No activity yet. Check off a habit to get things going!</p>';
        return;
    }

    list.innerHTML = state.feed.map((event) => {
        const habit = state.habits.find((h) => h.id === event.habit_id);
        const title = habit ? habit.title : 'Unknown habit';
        const dateKey = String(event.completed_date || '').slice(0, 10);
        const completed = completedUsersFor(event.habit_id, dateKey);
        const participants = habit?.participants || [];
        const pending = participants.filter((p) => !completed.includes(p));

        return `
            <article class="feed-card">
                <div class="feed-card-header">
                    <h3 class="feed-card-title">${escapeHtml(title)}</h3>
                    <span class="feed-card-date">${formatFeedDate(dateKey)}</span>
                </div>
                <p class="feed-card-user">${escapeHtml(event.username)} checked this off</p>
                ${event.comment ? `<p class="feed-card-comment">&ldquo;${escapeHtml(event.comment)}&rdquo;</p>` : ''}
                <div class="feed-card-footer">
                    <div class="feed-card-group feed-card-group--done">
                        <span class="feed-card-group-label">Completed</span>
                        <span class="feed-card-group-names">${completed.length ? completed.map(escapeHtml).join(', ') : '—'}</span>
                    </div>
                    <div class="feed-card-group feed-card-group--pending">
                        <span class="feed-card-group-label">Still to go</span>
                        <span class="feed-card-group-names">${pending.length ? pending.map(escapeHtml).join(', ') : 'Everyone is done!'}</span>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

let pendingCompletionHabitId = null;

export function openCompletionCommentModal(habitId) {
    pendingCompletionHabitId = habitId;
    const habit = state.habits.find((h) => h.id === habitId);
    const titleEl = document.getElementById('completion-comment-title');
    if (titleEl) {
        titleEl.textContent = habit ? `Nice work on \u201c${habit.title}\u201d!` : 'Nice work!';
    }
    const input = document.getElementById('completion-comment-input');
    input.value = '';
    document.getElementById('completion-comment-modal').classList.remove('hidden');
    input.focus();
}

async function finishCompletionComment(comment) {
    if (!pendingCompletionHabitId) return;
    const habitId = pendingCompletionHabitId;
    pendingCompletionHabitId = null;
    document.getElementById('completion-comment-modal').classList.add('hidden');
    await logCompletion(habitId, comment);
}

export function bindFeedEvents() {
    document.getElementById('my-progress-btn').addEventListener('click', showProgressView);

    document.getElementById('home-btn').addEventListener('click', async () => {
        showHomeView();
        await loadFeed();
    });

    document.getElementById('completion-comment-post').addEventListener('click', async () => {
        const comment = document.getElementById('completion-comment-input').value.trim();
        await finishCompletionComment(comment || null);
    });

    document.getElementById('completion-comment-skip').addEventListener('click', async () => {
        await finishCompletionComment(null);
    });

    document.getElementById('completion-comment-input').addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const comment = e.target.value.trim();
            await finishCompletionComment(comment || null);
        }
    });

    const modal = document.getElementById('completion-comment-modal');
    modal.addEventListener('click', async (e) => {
        if (e.target === modal) await finishCompletionComment(null);
    });

    document.addEventListener('keydown', async (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            await finishCompletionComment(null);
        }
    });
}
