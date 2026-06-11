import { mountPartials } from './templates.js';
import {
    checkAuth,
    showAuth,
    showApp,
    bindAuthEvents,
    bindProfileEvents,
} from './auth.js';
import { loadHabits, bindHabitEvents } from './habits.js';
import { bindDashboardTabs } from './dashboard.js';
import { loadMessages, bindChatEvents, updateChatHeader } from './chat.js';
import { bindCommentEvents } from './comments.js';
import { bindModalEvents } from './modals.js';
import { setupRealtimeSubscription } from './realtime.js';

async function onAuthenticated() {
    await showApp(async () => {
        await loadHabits();
        updateChatHeader();
        await loadMessages();
    });
}

async function initApp() {
    await mountPartials();

    bindAuthEvents({ onAuthenticated });
    bindProfileEvents();
    bindHabitEvents();
    bindDashboardTabs();
    bindChatEvents();
    bindCommentEvents();
    bindModalEvents();
    setupRealtimeSubscription();

    if (checkAuth()) {
        await onAuthenticated();
    } else {
        showAuth();
    }
}

document.addEventListener('DOMContentLoaded', initApp);
