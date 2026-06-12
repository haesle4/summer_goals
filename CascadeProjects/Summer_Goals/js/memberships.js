import { supabaseClient } from './supabase.js';
import { state } from './state.js';
import { normalizeDays, normalizeDateKey, todayDateString, getHabitItemType } from './utils.js';
import {
    enableLocalMemberships,
    isLocalMemberships,
    loadLocalMemberships,
    saveLocalMembership,
    removeLocalMembership,
    getLocalMembershipMeta,
    saveLocalMembershipMeta,
    showLocalDevBanner,
} from './local-dev.js';

const FREQUENCIES = ['days', 'weekly', 'monthly'];

function normalizeFrequency(value) {
    return FREQUENCIES.includes(value) ? value : 'days';
}

function normalizeMembership(row) {
    const meta = getLocalMembershipMeta(state.currentUser, row.habit_id) || {};
    return {
        ...row,
        days: normalizeDays(row.days),
        completed_dates: (row.completed_dates || []).map(normalizeDateKey).filter(Boolean),
        frequency: normalizeFrequency(row.frequency || meta.frequency),
        goal_deadline: normalizeDateKey(row.goal_deadline || meta.goal_deadline || '') || null,
    };
}

function syncMembershipsToState(rows) {
    state.memberships = rows.map(normalizeMembership);
    state.membershipsByHabit = {};
    state.memberships.forEach((m) => {
        state.membershipsByHabit[m.habit_id] = m;
    });
}

function membershipFromParticipants() {
    return state.habits
        .filter((h) => h.participants?.includes(state.currentUser))
        .map((h) => ({
            id: `local-${h.id}`,
            habit_id: h.id,
            username: state.currentUser,
            days: [0, 1, 2, 3, 4, 5, 6],
            completed_dates: [],
        }));
}

export async function loadMemberships() {
    if (isLocalMemberships()) {
        syncMembershipsToState(loadLocalMemberships(state.currentUser));
        return false;
    }

    try {
        const { data, error } = await supabaseClient
            .from('habit_memberships')
            .select('*')
            .eq('username', state.currentUser);

        if (error) throw error;

        syncMembershipsToState(data || []);
        return true;
    } catch (error) {
        console.warn('habit_memberships unavailable — using local dev storage', error);
        enableLocalMemberships();
        const local = loadLocalMemberships(state.currentUser);
        syncMembershipsToState(local.length ? local : membershipFromParticipants());
        local.forEach((m) => saveLocalMembership(state.currentUser, m.habit_id, m));
        showLocalDevBanner();
        return false;
    }
}

export function getMembership(habitId) {
    return state.membershipsByHabit[habitId] || null;
}

function matchesItemType(habit, itemType) {
    if (!itemType) return true;
    return getHabitItemType(habit) === itemType;
}

export function getJoinedHabits(itemType = null) {
    const joinedIds = new Set(state.memberships.map((m) => m.habit_id));
    return state.habits.filter((h) => joinedIds.has(h.id) && matchesItemType(h, itemType));
}

export function getUnjoinedHabits(itemType = null) {
    const joinedIds = new Set(state.memberships.map((m) => m.habit_id));
    return state.habits.filter((h) => !joinedIds.has(h.id) && matchesItemType(h, itemType));
}

async function updateParticipants(habitId, participants) {
    const { error } = await supabaseClient
        .from('habits')
        .update({ participants })
        .eq('id', habitId);
    if (error) throw error;
}

async function upsertMembershipRow(habitId, { days, frequency, goalDeadline }) {
    const base = {
        habit_id: habitId,
        username: state.currentUser,
        days,
        completed_dates: [],
    };
    const extended = { ...base, frequency, goal_deadline: goalDeadline || null };

    const { error } = await supabaseClient
        .from('habit_memberships')
        .upsert([extended], { onConflict: 'habit_id,username' });

    if (!error) return;

    const msg = String(error.message || '').toLowerCase();
    if (!msg.includes('frequency') && !msg.includes('goal_deadline')) throw error;

    const { error: baseError } = await supabaseClient
        .from('habit_memberships')
        .upsert([base], { onConflict: 'habit_id,username' });

    if (baseError) throw baseError;
    saveLocalMembershipMeta(state.currentUser, habitId, { frequency, goal_deadline: goalDeadline || null });
}

export async function joinHabit(habitId, days, options = {}) {
    const habit = state.habits.find((h) => h.id === habitId);
    if (!habit) return false;

    const isGoal = getHabitItemType(habit) === 'goal';
    const frequency = isGoal ? 'days' : normalizeFrequency(options.frequency);
    const goalDeadline = isGoal ? (options.goalDeadline || null) : null;
    const normalized = isGoal || frequency !== 'days' ? [] : normalizeDays(days);

    if (!isGoal && frequency === 'days' && normalized.length === 0) {
        alert('Pick at least one day for this habit');
        return false;
    }

    if (isGoal && !goalDeadline) {
        alert('Pick the date you want to finish this goal by');
        return false;
    }

    const participants = habit.participants.includes(state.currentUser)
        ? habit.participants
        : [...habit.participants, state.currentUser];

    if (isLocalMemberships()) {
        try {
            await updateParticipants(habitId, participants);
            saveLocalMembership(state.currentUser, habitId, {
                days: normalized,
                completed_dates: [],
                frequency,
                goal_deadline: goalDeadline,
            });
            return true;
        } catch (error) {
            console.error('Error joining habit:', error);
            alert('Failed to join habit.');
            return false;
        }
    }

    try {
        await upsertMembershipRow(habitId, { days: normalized, frequency, goalDeadline });
        await updateParticipants(habitId, participants);
        return true;
    } catch (error) {
        console.error('Error joining habit:', error);
        alert('Failed to join habit. Ask the project owner to run supabase/migration.sql.');
        return false;
    }
}

export async function leaveHabit(habitId) {
    const habit = state.habits.find((h) => h.id === habitId);
    if (!habit) return;

    const newParticipants = habit.participants.filter((p) => p !== state.currentUser);

    try {
        if (isLocalMemberships()) {
            removeLocalMembership(state.currentUser, habitId);
        } else {
            await supabaseClient
                .from('habit_memberships')
                .delete()
                .eq('habit_id', habitId)
                .eq('username', state.currentUser);
        }

        await updateParticipants(habitId, newParticipants);
    } catch (error) {
        console.error('Error leaving habit:', error);
        throw error;
    }
}

export async function toggleCompletion(habitId) {
    const membership = getMembership(habitId);
    if (!membership) return;

    const habit = state.habits.find((h) => h.id === habitId);
    const isGoal = habit && getHabitItemType(habit) === 'goal';
    const today = todayDateString();
    let completed;

    if (isGoal) {
        const wasDone = (membership.completed_dates || []).length > 0;
        completed = wasDone ? [] : [today];
    } else {
        completed = [...(membership.completed_dates || [])];
        const idx = completed.indexOf(today);
        if (idx > -1) {
            completed.splice(idx, 1);
        } else {
            completed.push(today);
        }
    }

    if (isLocalMemberships()) {
        saveLocalMembership(state.currentUser, habitId, {
            days: membership.days,
            completed_dates: completed,
        });
        membership.completed_dates = completed;
        state.membershipsByHabit[habitId] = membership;
        return true;
    }

    try {
        const { error } = await supabaseClient
            .from('habit_memberships')
            .update({ completed_dates: completed })
            .eq('id', membership.id);

        if (error) throw error;

        membership.completed_dates = completed;
        state.membershipsByHabit[habitId] = membership;
        return true;
    } catch (error) {
        console.error('Error toggling completion:', error);
        enableLocalMemberships();
        saveLocalMembership(state.currentUser, habitId, {
            days: membership.days,
            completed_dates: completed,
        });
        membership.completed_dates = completed;
        state.membershipsByHabit[habitId] = membership;
        showLocalDevBanner();
        return true;
    }
}

export async function updateMembershipSchedule(habitId, { days, frequency, goalDeadline } = {}) {
    const membership = getMembership(habitId);
    if (!membership) return false;

    const nextFrequency = normalizeFrequency(frequency ?? membership.frequency);
    const nextDeadline = goalDeadline !== undefined ? (goalDeadline || null) : (membership.goal_deadline || null);
    const nextDays = nextFrequency === 'days'
        ? normalizeDays(days ?? membership.days)
        : [];

    function applyToState() {
        membership.days = nextDays;
        membership.frequency = nextFrequency;
        membership.goal_deadline = nextDeadline;
        state.membershipsByHabit[habitId] = membership;
    }

    function persistLocal() {
        saveLocalMembership(state.currentUser, habitId, {
            days: nextDays,
            completed_dates: membership.completed_dates || [],
            frequency: nextFrequency,
            goal_deadline: nextDeadline,
        });
    }

    if (isLocalMemberships()) {
        persistLocal();
        applyToState();
        return true;
    }

    try {
        const extended = { days: nextDays, frequency: nextFrequency, goal_deadline: nextDeadline };
        const { error } = await supabaseClient
            .from('habit_memberships')
            .update(extended)
            .eq('id', membership.id);

        if (error) {
            const msg = String(error.message || '').toLowerCase();
            if (!msg.includes('frequency') && !msg.includes('goal_deadline')) throw error;

            const { error: baseError } = await supabaseClient
                .from('habit_memberships')
                .update({ days: nextDays })
                .eq('id', membership.id);

            if (baseError) throw baseError;
            saveLocalMembershipMeta(state.currentUser, habitId, {
                frequency: nextFrequency,
                goal_deadline: nextDeadline,
            });
        }

        applyToState();
        return true;
    } catch (error) {
        console.error('Error updating schedule:', error);
        enableLocalMemberships();
        persistLocal();
        applyToState();
        showLocalDevBanner();
        return true;
    }
}

export async function updateMembershipDays(habitId, days) {
    const normalized = normalizeDays(days);
    if (normalized.length === 0) {
        alert('Pick at least one day');
        return false;
    }
    return updateMembershipSchedule(habitId, { days: normalized, frequency: 'days' });
}

export async function createMembershipForCreator(habitId, days = [0, 1, 2, 3, 4, 5, 6]) {
    const normalized = normalizeDays(days);

    if (isLocalMemberships()) {
        saveLocalMembership(state.currentUser, habitId, { days: normalized, completed_dates: [] });
        return;
    }

    try {
        await supabaseClient
            .from('habit_memberships')
            .upsert([{
                habit_id: habitId,
                username: state.currentUser,
                days: normalized,
                completed_dates: [],
            }], { onConflict: 'habit_id,username' });
    } catch (error) {
        console.warn('Could not create membership row', error);
        enableLocalMemberships();
        saveLocalMembership(state.currentUser, habitId, { days: normalized, completed_dates: [] });
        showLocalDevBanner();
    }
}
