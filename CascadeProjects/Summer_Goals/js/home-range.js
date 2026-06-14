import { state } from './state.js';
import {
    getWeekStart,
    getWeekDates,
    dateToKey,
    todayDateString,
    todayWeekday,
    normalizeDateKey,
    getHabitItemType,
    getGoalDeadline,
} from './utils.js';

export const HOME_TIME_RANGES = {
    daily: 'Daily view',
    weekly: 'Weekly view',
    all: 'Up to now',
};

export function getHomeTimeRange() {
    return state.homeTimeRange || 'weekly';
}

export function setHomeTimeRange(range) {
    state.homeTimeRange = range;
}

export function dateInHomeRange(dateKey, range = getHomeTimeRange()) {
    const key = normalizeDateKey(dateKey);
    if (!key) return false;

    if (range === 'all') return true;

    if (range === 'daily') {
        return key === todayDateString();
    }

    if (range === 'weekly') {
        const weekStart = dateToKey(getWeekStart());
        const weekEnd = dateToKey(getWeekDates()[6]);
        return key >= weekStart && key <= weekEnd;
    }

    return true;
}

export function filterDatesByRange(dates, range = getHomeTimeRange()) {
    return (dates || [])
        .map(normalizeDateKey)
        .filter(Boolean)
        .filter((d) => dateInHomeRange(d, range));
}

export function getTrackingStartDate(memberships) {
    let earliest = null;

    (memberships || []).forEach((membership) => {
        (membership.completed_dates || []).forEach((dateKey) => {
            const key = normalizeDateKey(dateKey);
            if (!key) return;
            if (!earliest || key < earliest) earliest = key;
        });
    });

    if (earliest) {
        const start = new Date(`${earliest}T12:00:00`);
        start.setHours(0, 0, 0, 0);
        return start;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

export function syncTrackingStart(memberships) {
    state.trackingStartDate = getTrackingStartDate(memberships);
}

function upToNowStartDate() {
    if (state.trackingStartDate) {
        return new Date(state.trackingStartDate);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

function countWeeklySlots(start, end) {
    let count = 0;
    const cur = getWeekStart(start);
    const endTime = end.getTime();

    while (cur.getTime() <= endTime) {
        count += 1;
        cur.setDate(cur.getDate() + 7);
    }

    return count;
}

function countMonthlySlots(start, end) {
    let count = 0;
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = end.getFullYear() * 12 + end.getMonth();

    while (cur.getFullYear() * 12 + cur.getMonth() <= endMonth) {
        count += 1;
        cur.setMonth(cur.getMonth() + 1);
    }

    return count;
}

function countDailySlots(start, end, days) {
    let count = 0;
    const cur = new Date(start);
    const endTime = end.getTime();

    while (cur.getTime() <= endTime) {
        if (days.includes(cur.getDay())) count += 1;
        cur.setDate(cur.getDate() + 1);
    }

    return count;
}

function countGoalScheduledInRange(membership, habit, range) {
    const deadline = getGoalDeadline(habit, membership);
    if (!deadline) return 0;

    if (range === 'daily') {
        return deadline === todayDateString() ? 1 : 0;
    }

    if (range === 'weekly') {
        return dateInHomeRange(deadline, 'weekly') ? 1 : 0;
    }

    if (range === 'all') {
        const startKey = dateToKey(upToNowStartDate());
        const today = todayDateString();
        if (deadline < startKey || deadline > today) return 0;
        return 1;
    }

    return 0;
}

export function countScheduledInRange(membership, habit, range = getHomeTimeRange()) {
    if (getHabitItemType(habit) === 'goal') {
        return countGoalScheduledInRange(membership, habit, range);
    }

    const days = (membership.days || []).map(Number);
    const frequency = membership.frequency || 'days';

    if (range === 'daily') {
        if (frequency === 'days') {
            return days.includes(todayWeekday()) ? 1 : 0;
        }
        if (frequency === 'weekly' || frequency === 'monthly') return 1;
    }

    if (range === 'weekly') {
        const weekDates = getWeekDates(getWeekStart());
        if (frequency === 'days') {
            return weekDates.filter((d) => days.includes(d.getDay())).length;
        }
        if (frequency === 'weekly') return 1;
        if (frequency === 'monthly') {
            const monthKey = todayDateString().slice(0, 7);
            return weekDates.some((d) => dateToKey(d).startsWith(monthKey)) ? 1 : 0;
        }
    }

    if (range === 'all') {
        const start = upToNowStartDate();
        const end = new Date();
        end.setHours(0, 0, 0, 0);

        if (frequency === 'weekly') {
            return countWeeklySlots(start, end);
        }

        if (frequency === 'monthly') {
            return countMonthlySlots(start, end);
        }

        return countDailySlots(start, end, days);
    }

    return 0;
}

export function countEffectiveCompletions(membership, habit, range = getHomeTimeRange()) {
    const planned = countScheduledInRange(membership, habit, range);
    if (planned <= 0) return 0;

    const rawDone = filterDatesByRange(membership.completed_dates, range).length;
    return Math.min(rawDone, planned);
}

export function countStatsCompletions(memberships, range = getHomeTimeRange()) {
    let habitCount = 0;
    let goalCount = 0;

    memberships.forEach((membership) => {
        const habit = state.habits.find((h) => h.id === membership.habit_id);
        if (!habit) return;

        const count = filterDatesByRange(membership.completed_dates, range).length;
        if (!count) return;

        if (getHabitItemType(habit) === 'goal') {
            goalCount += count;
        } else {
            habitCount += count;
        }
    });

    return { habits: habitCount, goals: goalCount };
}

export function countFilteredCompletions(memberships, range = getHomeTimeRange()) {
    return countStatsCompletions(memberships, range);
}
