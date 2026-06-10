import { state, SUMMER_YEAR, SUMMER_MONTHS } from './state.js';
import {
    escapeHtml,
    MONTH_NAMES,
    getGoalDeadline,
    getGoalDayStatus,
    dateToKey,
} from './utils.js';
import { getJoinedHabits } from './memberships.js';

function getCalendarMonth() {
    return SUMMER_MONTHS[state.calendarMonthIndex] ?? SUMMER_MONTHS[0];
}

function getMonthDays(year, month) {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startPad = first.getDay();
    const days = [];

    for (let i = 0; i < startPad; i += 1) {
        days.push(null);
    }
    for (let d = 1; d <= last.getDate(); d += 1) {
        days.push(new Date(year, month, d));
    }
    return days;
}

function goalsByDate() {
    const map = {};
    const goals = getJoinedHabits('goal');

    goals.forEach((habit) => {
        const deadline = getGoalDeadline(habit);
        if (!deadline) return;
        const membership = state.membershipsByHabit[habit.id];
        if (!membership) return;
        if (!map[deadline]) map[deadline] = [];
        map[deadline].push({ habit, membership });
    });

    return map;
}

function cellStatus(goalsOnDay) {
    if (!goalsOnDay.length) return 'empty';
    const statuses = goalsOnDay.map(({ habit, membership }) =>
        getGoalDayStatus(getGoalDeadline(habit), membership));

    if (statuses.includes('overdue')) return 'overdue';
    if (statuses.every((s) => s === 'done')) return 'done';
    if (statuses.includes('future')) return 'future';
    return 'overdue';
}

function bindMonthNav() {
    const prev = document.getElementById('calendar-prev');
    const next = document.getElementById('calendar-next');
    if (!prev || !next) return;

    prev.disabled = state.calendarMonthIndex <= 0;
    next.disabled = state.calendarMonthIndex >= SUMMER_MONTHS.length - 1;

    prev.onclick = () => {
        if (state.calendarMonthIndex > 0) {
            state.calendarMonthIndex -= 1;
            renderGoalCalendar();
        }
    };

    next.onclick = () => {
        if (state.calendarMonthIndex < SUMMER_MONTHS.length - 1) {
            state.calendarMonthIndex += 1;
            renderGoalCalendar();
        }
    };
}

export function renderGoalCalendar() {
    const container = document.getElementById('goal-calendar');
    const titleEl = document.getElementById('calendar-month-title');
    if (!container) return;

    const month = getCalendarMonth();
    const byDate = goalsByDate();
    const days = getMonthDays(SUMMER_YEAR, month);

    if (titleEl) {
        titleEl.textContent = `${MONTH_NAMES[month]} ${SUMMER_YEAR}`;
    }

    container.innerHTML = `
        <div class="goal-calendar-weekdays">
            ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<span>${d}</span>`).join('')}
        </div>
        <div class="goal-calendar-grid">
            ${days.map((date) => {
                if (!date) {
                    return '<div class="goal-calendar-cell goal-calendar-cell--pad"></div>';
                }
                const key = dateToKey(date);
                const goalsOnDay = byDate[key] || [];
                const status = cellStatus(goalsOnDay);
                const items = goalsOnDay.map(({ habit }) =>
                    `<span class="goal-calendar-item" title="${escapeHtml(habit.title)}">${escapeHtml(habit.title)}</span>`
                ).join('');

                return `
                    <div class="goal-calendar-cell goal-calendar-cell--${status}" title="${goalsOnDay.length ? `${goalsOnDay.length} goal(s)` : ''}">
                        <span class="goal-calendar-daynum">${date.getDate()}</span>
                        <div class="goal-calendar-items">${items}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    bindMonthNav();
}
