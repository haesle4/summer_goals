import { mountPartials } from './templates.js';
import {
    checkAuth,
    showAuth,
    showHomePage,
    showMySummerPage,
    bindAuthEvents,
    bindProfileEvents,
} from './auth.js';
import { loadHabits, bindHabitEvents } from './habits.js';
import { bindDashboardTabs } from './dashboard.js';
import { loadMessages, bindChatEvents, updateChatHeader } from './chat.js';
import { bindCommentEvents } from './comments.js';
import { bindModalEvents } from './modals.js';
import { loadFeed, bindFeedEvents } from './feed.js';
import { loadHomeChat, bindHomeChatEvents } from './home-chat.js';
import { bindHomeProgressEvents } from './home-progress.js';
import { setupRealtimeSubscription } from './realtime.js';
import { isHomePage, isMySummerPage, navigateAfterLogin } from './page.js';

async function loadSharedData() {
    await loadHabits();
}

async function loadHomeData() {
    await loadSharedData();
    await loadFeed();
    await loadHomeChat();
}

async function loadMySummerData() {
    await loadSharedData();
    updateChatHeader();
    await loadMessages();
}

async function onAuthenticated() {
    if (isHomePage()) {
        await showHomePage(loadHomeData);
        return;
    }

    if (isMySummerPage()) {
        await showMySummerPage(loadMySummerData);
        return;
    }

    navigateAfterLogin();
}

async function initApp() {
    await mountPartials();

    bindAuthEvents({ onAuthenticated });
    bindProfileEvents();
    bindModalEvents();

    if (isHomePage()) {
        bindFeedEvents();
        bindHomeChatEvents();
        bindHomeProgressEvents();
    }

    if (isMySummerPage()) {
        bindHabitEvents();
        bindDashboardTabs();
        bindChatEvents();
        bindCommentEvents();
        bindFeedEvents();
    }

    setupRealtimeSubscription();

    if (checkAuth()) {
        await onAuthenticated();
    } else {
        showAuth();
    }
}

document.addEventListener('DOMContentLoaded', initApp);
