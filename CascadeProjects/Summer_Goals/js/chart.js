import { state } from './state.js';
import {
    getHabitCategory,
    normalizeDateKey,
    getWeekStart,
    getWeekDates,
    dateToKey,
    getItemLabels,
} from './utils.js';
import { getJoinedHabits } from './memberships.js';
import { renderGoalCalendar } from './goal-calendar.js';

const CATEGORIES = ['wellness', 'social', 'learning'];

const CATEGORY_COLORS = {
    wellness: { solid: 'var(--chart-wellness)', soft: 'var(--chart-wellness-soft)' },
    social: { solid: 'var(--chart-social)', soft: 'var(--chart-social-soft)' },
    learning: { solid: 'var(--chart-learning)', soft: 'var(--chart-learning-soft)' },
};

function emptyDayBucket() {
    return {
        wellness: { scheduled: 0, completed: 0 },
        social: { scheduled: 0, completed: 0 },
        learning: { scheduled: 0, completed: 0 },
    };
}

function computeWeekChartData() {
    const weekStart = getWeekStart(new Date());
    const weekDates = getWeekDates(weekStart);
    const itemType = state.dashboardTab === 'goals' ? 'goal' : 'habit';
    const joined = getJoinedHabits(itemType);
    const dayData = Array.from({ length: 7 }, () => emptyDayBucket());

    joined.forEach((habit) => {
        const membership = state.membershipsByHabit[habit.id];
        if (!membership) return;

        const category = getHabitCategory(habit);
        const days = (membership.days || []).map(Number);
        const completed = new Set((membership.completed_dates || []).map(normalizeDateKey));

        weekDates.forEach((date, dayIndex) => {
            if (!days.includes(dayIndex)) return;

            const dateStr = dateToKey(date);
            dayData[dayIndex][category].scheduled += 1;
            if (completed.has(dateStr)) {
                dayData[dayIndex][category].completed += 1;
            }
        });
    });

    let maxScheduled = 0;
    dayData.forEach((day) => {
        const total = CATEGORIES.reduce((sum, cat) => sum + day[cat].scheduled, 0);
        if (total > maxScheduled) maxScheduled = total;
    });

    const yMax = Math.max(3, Math.ceil(maxScheduled / 3) * 3);

    return { dayData, yMax };
}

function updateYLabels(yMax) {
    const el = document.getElementById('chart-y-labels');
    if (!el) return;

    el.innerHTML = `
        <span>${yMax}</span>
        <span>${Math.round((yMax * 2) / 3)}</span>
        <span>${Math.round(yMax / 3)}</span>
    `;
}

function renderDayBar(day, yMax) {
    const segments = [];

    CATEGORIES.forEach((cat) => {
        const { scheduled, completed } = day[cat];
        const missed = scheduled - completed;
        const colors = CATEGORY_COLORS[cat];

        if (missed > 0) {
            segments.push({ value: missed, color: colors.soft });
        }
        if (completed > 0) {
            segments.push({ value: completed, color: colors.solid });
        }
    });

    const total = segments.reduce((sum, s) => sum + s.value, 0);

    if (total === 0) {
        return `
            <div class="chart-bar-group">
                <div class="chart-bar-stack chart-bar-stack--empty">
                    <div class="chart-bar-segment chart-bar-segment--empty"></div>
                </div>
            </div>
        `;
    }

    const barHtml = segments.map((seg) => {
        const heightPct = (seg.value / yMax) * 100;
        return `<div class="chart-bar-segment" style="flex:0 0 ${heightPct}%;background:${seg.color}"></div>`;
    }).join('');

    return `
        <div class="chart-bar-group">
            <div class="chart-bar-stack">${barHtml}</div>
        </div>
    `;
}

function updateChartView() {
    const isGoals = state.dashboardTab === 'goals';
    const habitView = document.getElementById('habit-chart-view');
    const goalView = document.getElementById('goal-calendar-view');
    const subtitle = document.getElementById('chart-subtitle-text');
    const labels = getItemLabels(isGoals ? 'goal' : 'habit');

    habitView?.classList.toggle('hidden', isGoals);
    goalView?.classList.toggle('hidden', !isGoals);
    if (subtitle) subtitle.textContent = labels.chartSubtitle;
}

export function renderChart() {
    updateChartView();

    if (state.dashboardTab === 'goals') {
        renderGoalCalendar();
        return;
    }

    const container = document.getElementById('chart-bars');
    if (!container) return;

    const { dayData, yMax } = computeWeekChartData();

    updateYLabels(yMax);
    container.innerHTML = dayData.map((day) => renderDayBar(day, yMax)).join('');
}
