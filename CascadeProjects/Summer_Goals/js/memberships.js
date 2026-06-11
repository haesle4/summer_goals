import { supabaseClient } from './supabase.js';
import { state } from './state.js';
import { normalizeDays, normalizeDateKey, todayDateString, getHabitItemType } from './utils.js';
import {
    enableLocalMemberships,
    isLocalMemberships,
    loadLocalMemberships,
    saveLocalMembership,
    removeLocalMembership,
    showLocalDevBanner,
} from './local-dev.js';

function normalizeMembership(row) {
    return {
        ...row,
        days: normalizeDays(row.days),
        completed_dates: (row.completed_dates || []).map(normalizeDateKey).filter(Boolean),
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

export async function joinHabit(habitId, days) {
    const habit = state.habits.find((h) => h.id === habitId);
    if (!habit) return false;

    const isGoal = getHabitItemType(habit) === 'goal';
    const normalized = isGoal ? [] : normalizeDays(days);
    if (!isGoal && normalized.length === 0) {
        alert('Pick at least one day for this habit');
        return false;
    }

    const participants = habit.participants.includes(state.currentUser)
        ? habit.participants
        : [...habit.participants, state.currentUser];

    if (isLocalMemberships()) {
        try {
            await updateParticipants(habitId, participants);
            saveLocalMembership(state.currentUser, habitId, { days: normalized, completed_dates: [] });
            return true;
        } catch (error) {
            console.error('Error joining habit:', error);
            alert('Failed to join habit.');
            return false;
        }
    }

    try {
        const { error: membershipError } = await supabaseClient
            .from('habit_memberships')
            .upsert([{
                habit_id: habitId,
                username: state.currentUser,
                days: normalized,
                completed_dates: [],
            }], { onConflict: 'habit_id,username' });

        if (membershipError) throw membershipError;
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

export async function updateMembershipDays(habitId, days) {
    const membership = getMembership(habitId);
    if (!membership) return false;

    const normalized = normalizeDays(days);
    if (normalized.length === 0) {
        alert('Pick at least one day');
        return false;
    }

    if (isLocalMemberships()) {
        saveLocalMembership(state.currentUser, habitId, {
            days: normalized,
            completed_dates: membership.completed_dates || [],
        });
        membership.days = normalized;
        state.membershipsByHabit[habitId] = membership;
        return true;
    }

    try {
        const { error } = await supabaseClient
            .from('habit_memberships')
            .update({ days: normalized })
            .eq('id', membership.id);

        if (error) throw error;

        membership.days = normalized;
        state.membershipsByHabit[habitId] = membership;
        return true;
    } catch (error) {
        console.error('Error updating days:', error);
        enableLocalMemberships();
        saveLocalMembership(state.currentUser, habitId, {
            days: normalized,
            completed_dates: membership.completed_dates || [],
        });
        membership.days = normalized;
        state.membershipsByHabit[habitId] = membership;
        showLocalDevBanner();
        return true;
    }
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
