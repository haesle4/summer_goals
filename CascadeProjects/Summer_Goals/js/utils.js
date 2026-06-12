import { getLocalHabitMeta } from './local-dev.js';

export const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function getTimeAgo(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

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

export function todayWeekday() {
    return new Date().getDay();
}

export function todayDateString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function normalizeDateKey(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
}

export function getHabitCategory(habit) {
    const localCat = habit?.id ? getLocalHabitMeta(habit.id)?.category : null;
    const cat = localCat || habit?.category;
    if (cat === 'social' || cat === 'learning' || cat === 'wellness') return cat;
    return 'wellness';
}

export function getHabitItemType(habit) {
    const localType = habit?.id ? getLocalHabitMeta(habit.id)?.item_type : null;
    const type = localType || habit?.item_type;
    return type === 'goal' ? 'goal' : 'habit';
}

export function getItemLabels(itemType) {
    const isGoal = itemType === 'goal';
    return {
        singular: isGoal ? 'goal' : 'habit',
        singularCap: isGoal ? 'Goal' : 'Habit',
        plural: isGoal ? 'goals' : 'habits',
        pluralCap: isGoal ? 'Goals' : 'Habits',
        join: isGoal ? 'Join Goal' : 'Join Habit',
        create: isGoal ? 'Create Goal' : 'Create Habit',
        createModal: isGoal ? 'Create New Goal' : 'Create New Habit',
        joinModal: isGoal ? 'Join a goal' : 'Join a habit',
        joinSubmit: isGoal ? 'Join goal' : 'Join habit',
        chartTitle: isGoal ? 'Goal Calendar' : 'Habits Completed',
        chartSubtitle: isGoal
            ? 'Pink = overdue · green = done · blue = upcoming'
            : 'Bright = done · faded = still to do',
        deadlineLabel: isGoal ? 'Finish by' : 'Which days will you do this?',
        emptyJoinHint: isGoal
            ? 'to browse and set your deadline'
            : 'to browse and pick your schedule days',
    };
}

export function getWeekStart(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function dateToKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function getWeekDates(weekStart = getWeekStart()) {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
    });
}

export const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

export function getGoalDeadline(habit, membership = null) {
    if (membership?.goal_deadline) return normalizeDateKey(membership.goal_deadline);
    const local = habit?.id ? getLocalHabitMeta(habit.id)?.deadline : null;
    return normalizeDateKey(local || habit?.deadline || '');
}

export function formatDeadlineShort(dateKey) {
    if (!dateKey) return 'No deadline';
    const [y, m, d] = dateKey.split('-').map(Number);
    const month = MONTH_NAMES[m - 1]?.slice(0, 3) || '';
    return `Due ${month} ${d}`;
}

export function isGoalCompleted(membership) {
    return (membership?.completed_dates || []).length > 0;
}

/** Card/list grouping for goals. */
export function getGoalStatus(habit, membership) {
    if (!membership) return 'not-relevant';
    const deadline = getGoalDeadline(habit, membership);
    if (!deadline) return 'not-relevant';
    if (isGoalCompleted(membership)) return 'done';
    if (deadline > todayDateString()) return 'not-relevant';
    return 'todo';
}

/** Card color for goals (blue = upcoming, pink = overdue). */
export function getGoalCardStatus(habit, membership) {
    return getGoalStatus(habit, membership);
}

export function getItemStatus(habit, membership) {
    if (getHabitItemType(habit) === 'goal') {
        return getGoalStatus(habit, membership);
    }
    return getHabitStatus(membership);
}

/** @returns {'future' | 'overdue' | 'done' | 'empty'} */
export function getGoalDayStatus(deadlineKey, membership) {
    if (!deadlineKey) return 'empty';
    const today = todayDateString();
    if (isGoalCompleted(membership)) return 'done';
    if (deadlineKey > today) return 'future';
    return 'overdue';
}

/** @returns {'todo' | 'done' | 'not-relevant'} */
export function getHabitStatus(membership) {
    if (!membership) return 'not-relevant';
    const completed = membership.completed_dates || [];
    const frequency = membership.frequency || 'days';

    if (frequency === 'weekly') {
        const weekStartKey = dateToKey(getWeekStart());
        return completed.some((d) => d >= weekStartKey) ? 'done' : 'todo';
    }

    if (frequency === 'monthly') {
        const monthKey = todayDateString().slice(0, 7);
        return completed.some((d) => d.startsWith(monthKey)) ? 'done' : 'todo';
    }

    const days = membership.days || [];
    const scheduledToday = days.includes(todayWeekday());
    const completedToday = completed.includes(todayDateString());

    if (!scheduledToday) return 'not-relevant';
    if (completedToday) return 'done';
    return 'todo';
}

export function statusToVariant(status) {
    if (status === 'done') return 'completed';
    if (status === 'todo') return 'active';
    return 'skipped';
}

export function normalizeDays(days) {
    if (!Array.isArray(days)) return [];
    return [...new Set(days.map(Number).filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b);
}
