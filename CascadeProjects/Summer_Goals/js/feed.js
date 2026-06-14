import { supabaseClient } from './supabase.js';
import { state, SUMMER_YEAR } from './state.js';
import { escapeHtml, todayDateString, getHabitCategory } from './utils.js';
import {
    enableLocalCompletions,
    isLocalCompletions,
    loadLocalCompletions,
    appendLocalCompletion,
    removeLocalCompletion,
    showLocalDevBanner,
} from './local-dev.js';
import { loadHomeProgress } from './home-progress.js';
import {
    countStatsCompletions,
    dateInHomeRange,
    getHomeTimeRange,
    setHomeTimeRange,
    syncTrackingStart,
} from './home-range.js';
import { fetchAllMemberships } from './leaderboard.js';

import { navigateToHome, navigateToMySummer } from './page.js';

function summerDaysElapsed() {
    const start = new Date(SUMMER_YEAR, 5, 15);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.floor((today - start) / 86400000);
}

function countCompletions(memberships, range = getHomeTimeRange()) {
    return countStatsCompletions(memberships, range);
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
    const memberships = await fetchAllMemberships();
    syncTrackingStart(memberships);
    renderHomeStats(countCompletions(memberships, getHomeTimeRange()));
}

export async function loadFeed() {
    await loadHomeStats();

    if (isLocalCompletions()) {
        state.feed = loadLocalCompletions();
        renderFeed();
        await loadHomeProgress();
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

    await loadHomeProgress();
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

function formatFeedTimestamp(event) {
    const raw = event.created_at || event.completed_date;
    if (!raw) return '';

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
        const dateKey = String(event.completed_date || '').slice(0, 10);
        return dateKey || '';
    }

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}, ${hh}:${min}`;
}

export function renderFeed() {
    const list = document.getElementById('feed-list');
    if (!list) return;

    const range = getHomeTimeRange();
    const filtered = state.feed.filter((event) =>
        dateInHomeRange(event.completed_date, range));

    if (filtered.length === 0) {
        list.innerHTML = '<p class="feed-empty">No activity in this time range yet.</p>';
        return;
    }

    list.innerHTML = filtered.map((event) => {
        const habit = state.habits.find((h) => h.id === event.habit_id);
        const title = habit ? habit.title : 'Unknown habit';
        const category = habit ? getHabitCategory(habit) : 'wellness';

        return `
            <article class="feed-card feed-card--${category}">
                <div class="feed-card-top">
                    <h3 class="feed-card-title">${escapeHtml(title)}</h3>
                    <time class="feed-card-date">${formatFeedTimestamp(event)}</time>
                </div>
                <div class="feed-card-body">
                    <div class="feed-card-meta">
                        <span class="feed-card-completed-label">Completed by:</span>
                        <span class="feed-card-user">${escapeHtml(event.username)}</span>
                    </div>
                    ${event.comment ? `<div class="feed-card-quote">&ldquo;${escapeHtml(event.comment)}&rdquo;</div>` : '<div class="feed-card-quote feed-card-quote--empty"></div>'}
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
    const progressBtn = document.getElementById('my-progress-btn');
    if (progressBtn) {
        progressBtn.addEventListener('click', navigateToMySummer);
    }

    const rangeSelect = document.getElementById('home-time-range');
    if (rangeSelect) {
        rangeSelect.value = getHomeTimeRange();
        rangeSelect.addEventListener('change', async (e) => {
            setHomeTimeRange(e.target.value);
            await loadHomeStats();
            renderFeed();
            await loadHomeProgress();
        });
    }

    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', navigateToHome);
    }

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
