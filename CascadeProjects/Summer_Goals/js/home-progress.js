import { state } from './state.js';
import {
    escapeHtml,
    getHabitCategory,
    getHabitItemType,
} from './utils.js';
import { fetchAllMemberships } from './leaderboard.js';
import {
    countScheduledInRange,
    countEffectiveCompletions,
    filterDatesByRange,
    getHomeTimeRange,
    syncTrackingStart,
} from './home-range.js';

const CATEGORIES = ['wellness', 'social', 'learning'];

let progressUsers = [];

function computeUserProgress(memberships, range = getHomeTimeRange()) {
    const byUser = {};

    memberships.forEach((membership) => {
        if (!byUser[membership.username]) {
            byUser[membership.username] = {
                username: membership.username,
                wellness: 0,
                social: 0,
                learning: 0,
                done: 0,
                planned: 0,
                percent: 0,
                contributions: [],
            };
        }

        const habit = state.habits.find((h) => h.id === membership.habit_id);
        if (!habit) return;

        const itemType = getHabitItemType(habit);
        const planned = countScheduledInRange(membership, habit, range);
        const rawDone = filterDatesByRange(membership.completed_dates, range).length;
        const done = countEffectiveCompletions(membership, habit, range);

        if (planned <= 0 && rawDone <= 0) return;

        byUser[membership.username].planned += planned;
        byUser[membership.username].done += done;

        if (itemType !== 'goal') {
            const category = getHabitCategory(habit);
            byUser[membership.username][category] += done;
        }

        byUser[membership.username].contributions.push({
            title: habit.title,
            type: itemType,
            category: getHabitCategory(habit),
            completed: rawDone,
            counted: done,
            planned,
        });
    });

    return Object.values(byUser)
        .map((user) => {
            const percent = user.planned > 0
                ? Math.min(100, Math.round((user.done / user.planned) * 100))
                : 0;
            return { ...user, percent };
        })
        .sort((a, b) => b.percent - a.percent || b.done - a.done || a.username.localeCompare(b.username));
}

function renderBarSegments(user) {
    if (user.planned <= 0 || user.done <= 0) {
        return '<span class="home-progress-bar-segment home-progress-bar-segment--empty" style="width:100%"></span>';
    }

    const segments = CATEGORIES.map((cat) => {
        if (!user[cat]) return '';
        const widthPct = (user[cat] / user.planned) * 100;
        return `<span class="home-progress-bar-segment home-progress-bar-segment--${cat}" style="width:${widthPct}%"></span>`;
    }).join('');

    const habitDone = CATEGORIES.reduce((sum, cat) => sum + user[cat], 0);
    const goalDone = user.done - habitDone;
    const goalSegment = goalDone > 0
        ? `<span class="home-progress-bar-segment home-progress-bar-segment--goal" style="width:${(goalDone / user.planned) * 100}%"></span>`
        : '';

    const filledPct = (user.done / user.planned) * 100;
    const emptyPct = Math.max(0, 100 - filledPct);

    return `${segments}${goalSegment}${emptyPct > 0
        ? `<span class="home-progress-bar-segment home-progress-bar-segment--empty" style="width:${emptyPct}%"></span>`
        : ''}`;
}

function formatTooltip(user) {
    if (!user.contributions.length) {
        return `<p class="home-progress-tooltip__empty">No tasks in this range.</p>`;
    }

    const rows = user.contributions
        .filter((item) => item.planned > 0 || item.completed > 0)
        .sort((a, b) => b.counted - a.counted || a.title.localeCompare(b.title))
        .map((item) => {
            const label = item.type === 'goal' ? 'Goal' : 'Habit';
            const detail = item.planned > 0
                ? `${item.counted}/${item.planned} counted`
                : `${item.completed} completed`;
            return `
                <li class="home-progress-tooltip__item">
                    <span class="home-progress-tooltip__name">${escapeHtml(item.title)}</span>
                    <span class="home-progress-tooltip__meta">${label} · ${detail}${item.completed !== item.counted ? ` (${item.completed} total)` : ''}</span>
                </li>
            `;
        }).join('');

    return `
        <p class="home-progress-tooltip__heading">${escapeHtml(user.username)} · ${user.percent}%</p>
        <ul class="home-progress-tooltip__list">${rows}</ul>
    `;
}

function renderProgressChart(users) {
    const container = document.getElementById('home-progress-chart');
    if (!container) return;

    progressUsers = users;

    if (!users.length) {
        container.innerHTML = '<p class="home-progress-empty">No group members yet.</p>';
        return;
    }

    container.innerHTML = `
        <div class="home-progress-chart-rows">
            ${users.map((user, index) => `
                <div class="home-progress-row">
                    <span class="home-progress-label">${escapeHtml(user.username)}</span>
                    <div
                        class="home-progress-bar-track"
                        data-progress-index="${index}"
                        tabindex="0"
                        aria-label="${escapeHtml(user.username)} progress ${user.percent} percent"
                    >
                        ${renderBarSegments(user)}
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="home-progress-axis" aria-hidden="true">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
        </div>
        <div id="home-progress-tooltip" class="home-progress-tooltip hidden" role="tooltip"></div>
    `;
}

function hideTooltip() {
    const tooltip = document.getElementById('home-progress-tooltip');
    if (tooltip) tooltip.classList.add('hidden');
}

function showTooltip(track, clientX, clientY) {
    const tooltip = document.getElementById('home-progress-tooltip');
    const chart = document.getElementById('home-progress-chart');
    if (!tooltip || !chart) return;

    const index = Number(track.dataset.progressIndex);
    const user = progressUsers[index];
    if (!user) return;

    tooltip.innerHTML = formatTooltip(user);
    tooltip.classList.remove('hidden');

    const chartRect = chart.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    let left = clientX - chartRect.left + 12;
    let top = clientY - chartRect.top - tooltipRect.height - 12;

    if (left + tooltipRect.width > chartRect.width - 8) {
        left = chartRect.width - tooltipRect.width - 8;
    }
    if (left < 8) left = 8;
    if (top < 8) {
        top = clientY - chartRect.top + 16;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

export async function loadHomeProgress() {
    const memberships = await fetchAllMemberships();
    syncTrackingStart(memberships);
    renderProgressChart(computeUserProgress(memberships, getHomeTimeRange()));
    bindHomeProgressEvents();
}

export function bindHomeProgressEvents() {
    const chart = document.getElementById('home-progress-chart');
    if (!chart || chart.dataset.tooltipBound) return;

    chart.dataset.tooltipBound = 'true';

    chart.addEventListener('mousemove', (e) => {
        const track = e.target.closest('.home-progress-bar-track');
        if (!track) {
            hideTooltip();
            return;
        }
        showTooltip(track, e.clientX, e.clientY);
    });

    chart.addEventListener('mouseleave', hideTooltip);

    chart.addEventListener('focusin', (e) => {
        const track = e.target.closest('.home-progress-bar-track');
        if (!track) return;
        const rect = track.getBoundingClientRect();
        showTooltip(track, rect.left + rect.width / 2, rect.top);
    });

    chart.addEventListener('focusout', hideTooltip);
}
