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
import { loadFeed, bindFeedEvents, showHomeView } from './feed.js';
import { bindCollectiveEvents } from './collective.js';
import { loadHomeChat, bindHomeChatEvents } from './home-chat.js';
import { loadHomeLeaderboard, bindHomeLeaderboardEvents } from './home-leaderboard.js';
import { setupRealtimeSubscription } from './realtime.js';

async function onAuthenticated() {
    await showApp(async () => {
        await loadHabits();
        updateChatHeader();
        await loadMessages();
        await loadFeed();
        await loadHomeChat();
        await loadHomeLeaderboard();
    });
    showHomeView();
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
    bindFeedEvents();
    bindCollectiveEvents();
    bindHomeChatEvents();
    bindHomeLeaderboardEvents();
    setupRealtimeSubscription();

    if (checkAuth()) {
        await onAuthenticated();
    } else {
        showAuth();
    }
}

document.addEventListener('DOMContentLoaded', initApp);
