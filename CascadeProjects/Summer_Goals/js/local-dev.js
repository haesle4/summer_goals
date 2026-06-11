const STORAGE_KEY = 'summer_goals_dev_v1';

function readStore() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
        return {};
    }
}

function writeStore(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export const localDev = {
  memberships: false,
  habitChat: false,
};

export function enableLocalMemberships() {
    localDev.memberships = true;
}

export function enableLocalHabitChat() {
    localDev.habitChat = true;
}

export function isLocalMemberships() {
    return localDev.memberships;
}

export function isLocalHabitChat() {
    return localDev.habitChat;
}

function userKey(username) {
    return username || '_guest';
}

export function loadLocalMemberships(username) {
    const store = readStore();
    const byUser = store.memberships?.[userKey(username)] || {};
    return Object.entries(byUser).map(([habitId, data]) => ({
        id: `local-${habitId}`,
        habit_id: habitId,
        username,
        days: data.days || [],
        completed_dates: data.completed_dates || [],
    }));
}

export function getLocalHabitMeta(habitId) {
    const store = readStore();
    return store.habitMeta?.[habitId] || null;
}

export function saveLocalHabitMeta(habitId, data) {
    const store = readStore();
    if (!store.habitMeta) store.habitMeta = {};
    store.habitMeta[habitId] = { ...store.habitMeta[habitId], ...data };
    writeStore(store);
}

export function saveLocalMembership(username, habitId, data) {
    const store = readStore();
    if (!store.memberships) store.memberships = {};
    if (!store.memberships[userKey(username)]) store.memberships[userKey(username)] = {};
    store.memberships[userKey(username)][habitId] = {
        days: data.days,
        completed_dates: data.completed_dates || [],
    };
    writeStore(store);
}

export function removeLocalMembership(username, habitId) {
    const store = readStore();
    if (store.memberships?.[userKey(username)]?.[habitId]) {
        delete store.memberships[userKey(username)][habitId];
        writeStore(store);
    }
}

export function loadLocalHabitMessages(habitId) {
    const store = readStore();
    return store.habitMessages?.[habitId] || [];
}

export function appendLocalHabitMessage(habitId, message) {
    const store = readStore();
    if (!store.habitMessages) store.habitMessages = {};
    if (!store.habitMessages[habitId]) store.habitMessages[habitId] = [];
    store.habitMessages[habitId].push({
        ...message,
        created_at: new Date().toISOString(),
        id: `local-${Date.now()}`,
    });
    writeStore(store);
}

export function showLocalDevBanner() {
    if (!localDev.memberships && !localDev.habitChat) return;

    let banner = document.getElementById('local-dev-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'local-dev-banner';
        banner.className = 'local-dev-banner';
        document.body.prepend(banner);
    }

    const parts = [];
    if (localDev.memberships) parts.push('habit days & checkoffs');
    if (localDev.habitChat) parts.push('per-habit chat');

    banner.textContent = `Dev mode: ${parts.join(' + ')} saved in this browser only. Ask the project owner to run supabase/migration.sql for real persistence.`;
}
