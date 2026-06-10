import { supabaseClient } from './supabase.js';
import { state } from './state.js';
import { escapeHtml, normalizeDateKey, getWeekDates, dateToKey } from './utils.js';
import { isLocalMemberships, loadLocalMemberships } from './local-dev.js';

function normalizeMembership(row) {
    return {
        ...row,
        days: (row.days || []).map(Number),
        completed_dates: (row.completed_dates || []).map(normalizeDateKey).filter(Boolean),
    };
}

async function fetchAllMemberships() {
    try {
        const { data, error } = await supabaseClient
            .from('habit_memberships')
            .select('*');

        if (!error && data?.length) {
            return data.map(normalizeMembership);
        }
    } catch (error) {
        console.warn('Leaderboard: could not load all memberships', error);
    }

    if (isLocalMemberships()) {
        const local = loadLocalMemberships(state.currentUser);
        return local.map(normalizeMembership);
    }

    return (state.memberships || []).map(normalizeMembership);
}

export function computeLeaderboard(memberships) {
    const weekDates = getWeekDates();
    const byUser = {};

    memberships.forEach((membership) => {
        const habit = state.habits.find((h) => h.id === membership.habit_id);
        if (!habit) return;

        if (!byUser[membership.username]) {
            byUser[membership.username] = { scheduled: 0, completed: 0 };
        }

        const completed = new Set(membership.completed_dates || []);
        const days = (membership.days || []).map(Number);

        weekDates.forEach((date, dayIndex) => {
            if (!days.includes(dayIndex)) return;
            byUser[membership.username].scheduled += 1;
            if (completed.has(dateToKey(date))) {
                byUser[membership.username].completed += 1;
            }
        });
    });

    return Object.entries(byUser)
        .map(([username, stats]) => ({
            username,
            tasks: stats.scheduled,
            completed: stats.completed,
            percent: stats.scheduled
                ? Math.round((stats.completed / stats.scheduled) * 100)
                : 0,
        }))
        .sort((a, b) => b.tasks - a.tasks || b.percent - a.percent || a.username.localeCompare(b.username));
}

export async function renderLeaderboard() {
    const container = document.getElementById('standings-list');
    if (!container) return;

    const memberships = await fetchAllMemberships();
    const rows = computeLeaderboard(memberships);

    if (!rows.length) {
        container.innerHTML = `
            <div class="habits-empty">
                <h3>No standings yet</h3>
                <p>Join habits or goals to show up on the leaderboard this week.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="standings-header">
            <h2 class="standings-title">This week</h2>
            <p class="standings-subtitle">Ranked by tasks scheduled · % completed</p>
        </div>
        <ol class="standings-list-inner">
            ${rows.map((row, index) => `
                <li class="standings-row ${row.username === state.currentUser ? 'standings-row--you' : ''}">
                    <span class="standings-rank">${index + 1}</span>
                    <span class="standings-name">${escapeHtml(row.username)}${row.username === state.currentUser ? ' (you)' : ''}</span>
                    <span class="standings-stat standings-stat--tasks">${row.tasks} tasks</span>
                    <span class="standings-stat standings-stat--pct">${row.percent}%</span>
                </li>
            `).join('')}
        </ol>
    `;
}
