import { state } from './state.js';
import { escapeHtml, getHabitItemType, getHabitCategory } from './utils.js';
import { fetchAllMemberships } from './leaderboard.js';

const CATEGORIES = [
    { id: 'overall', label: 'Overall' },
    { id: 'habits', label: 'Habits' },
    { id: 'goals', label: 'Goals' },
    { id: 'wellness', label: 'Wellness habits' },
    { id: 'social', label: 'Social habits' },
    { id: 'learning', label: 'Learning habits' },
];

const ROTATE_MS = 6000;

let categoryIndex = 0;
let cachedMemberships = [];
let rotateTimer = null;

function membershipValue(membership, habit, categoryId) {
    const isGoal = getHabitItemType(habit) === 'goal';
    const completions = (membership.completed_dates || []).length;
    if (!completions) return 0;

    if (categoryId === 'overall') return completions;
    if (categoryId === 'goals') return isGoal ? 1 : 0;
    if (categoryId === 'habits') return isGoal ? 0 : completions;
    return !isGoal && getHabitCategory(habit) === categoryId ? completions : 0;
}

function rankingsFor(categoryId) {
    const byUser = {};

    cachedMemberships.forEach((membership) => {
        const habit = state.habits.find((h) => h.id === membership.habit_id);
        if (!habit) return;
        const value = membershipValue(membership, habit, categoryId);
        if (!value) return;
        byUser[membership.username] = (byUser[membership.username] || 0) + value;
    });

    return Object.entries(byUser)
        .map(([username, count]) => ({ username, count }))
        .sort((a, b) => b.count - a.count || a.username.localeCompare(b.username))
        .slice(0, 8);
}

function renderHomeLeaderboard() {
    const list = document.getElementById('home-lb-list');
    const categoryEl = document.getElementById('home-lb-category');
    if (!list || !categoryEl) return;

    const category = CATEGORIES[categoryIndex];
    categoryEl.textContent = category.label;

    const rows = rankingsFor(category.id);

    if (!rows.length) {
        list.innerHTML = '<li class="home-lb-empty">No completions in this category yet.</li>';
        return;
    }

    const unit = category.id === 'goals' ? 'goals' : 'done';
    list.innerHTML = rows.map((row, index) => `
        <li class="home-lb-row ${row.username === state.currentUser ? 'home-lb-row--you' : ''}">
            <span class="home-lb-rank">${index + 1}</span>
            <span class="home-lb-name">${escapeHtml(row.username)}${row.username === state.currentUser ? ' (you)' : ''}</span>
            <span class="home-lb-count">${row.count} ${unit}</span>
        </li>
    `).join('');
}

function stepCategory(delta) {
    categoryIndex = (categoryIndex + delta + CATEGORIES.length) % CATEGORIES.length;
    renderHomeLeaderboard();
}

function startRotation() {
    if (rotateTimer) clearInterval(rotateTimer);
    rotateTimer = setInterval(() => stepCategory(1), ROTATE_MS);
}

export async function loadHomeLeaderboard() {
    cachedMemberships = await fetchAllMemberships();
    renderHomeLeaderboard();
}

export function bindHomeLeaderboardEvents() {
    document.getElementById('home-lb-prev').addEventListener('click', () => {
        stepCategory(-1);
        startRotation();
    });
    document.getElementById('home-lb-next').addEventListener('click', () => {
        stepCategory(1);
        startRotation();
    });
    startRotation();
}
