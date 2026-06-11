import { supabaseClient } from './supabase.js';
import { state } from './state.js';
import {
    escapeHtml,
    normalizeDateKey,
    getWeekDates,
    dateToKey,
    getHabitItemType,
} from './utils.js';
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

function weekTaskStats(membership, habit, weekDates) {
    const completed = new Set(membership.completed_dates || []);
    const isGoal = getHabitItemType(habit) === 'goal';

    if (isGoal) {
        const weekKeys = new Set(weekDates.map(dateToKey));
        const rawCompleted = (membership.completed_dates || []).some((d) =>
            weekKeys.has(normalizeDateKey(d))) ? 1 : 0;
        return { rawCompleted, scheduled: 1 };
    }

    const days = (membership.days || []).map(Number);
    let rawCompleted = 0;
    let scheduled = 0;

    weekDates.forEach((date, dayIndex) => {
        if (!days.includes(dayIndex)) return;
        scheduled += 1;
        if (completed.has(dateToKey(date))) {
            rawCompleted += 1;
        }
    });

    return { rawCompleted, scheduled };
}

function taskScore(rawCompleted, scheduled, participantCount) {
    const participants = Math.max(participantCount, 1);
    const fraction = scheduled > 0 ? rawCompleted / scheduled : 0;
    return (rawCompleted * participants) / 2 + fraction * 30;
}

export function computeLeaderboard(memberships) {
    const weekDates = getWeekDates();
    const byUser = {};

    memberships.forEach((membership) => {
        const habit = state.habits.find((h) => h.id === membership.habit_id);
        if (!habit) return;

        const { rawCompleted, scheduled } = weekTaskStats(membership, habit, weekDates);
        if (scheduled === 0) return;

        if (!byUser[membership.username]) {
            byUser[membership.username] = { score: 0, completed: 0, scheduled: 0 };
        }

        const participants = (habit.participants || []).length;
        byUser[membership.username].score += taskScore(rawCompleted, scheduled, participants);
        byUser[membership.username].completed += rawCompleted;
        byUser[membership.username].scheduled += scheduled;
    });

    return Object.entries(byUser)
        .map(([username, stats]) => ({
            username,
            score: stats.score,
            completed: stats.completed,
            scheduled: stats.scheduled,
            percent: stats.scheduled
                ? Math.round((stats.completed / stats.scheduled) * 100)
                : 0,
        }))
        .sort((a, b) => b.score - a.score || b.percent - a.percent || a.username.localeCompare(b.username));
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
            <p class="standings-subtitle">Score = completions × group size ÷ 2 + completion % × 30</p>
        </div>
        <ol class="standings-list-inner">
            ${rows.map((row, index) => `
                <li class="standings-row ${row.username === state.currentUser ? 'standings-row--you' : ''}">
                    <span class="standings-rank">${index + 1}</span>
                    <span class="standings-name">${escapeHtml(row.username)}${row.username === state.currentUser ? ' (you)' : ''}</span>
                    <span class="standings-stat standings-stat--tasks">${row.completed}/${row.scheduled} done</span>
                    <span class="standings-stat standings-stat--pct">${Math.round(row.score)} pts</span>
                </li>
            `).join('')}
        </ol>
    `;
}
