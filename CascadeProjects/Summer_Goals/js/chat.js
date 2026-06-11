import { supabaseClient } from './supabase.js';
import { state } from './state.js';
import { escapeHtml } from './utils.js';
import { getJoinedHabits } from './memberships.js';
import {
    enableLocalHabitChat,
    isLocalHabitChat,
    loadLocalHabitMessages,
    appendLocalHabitMessage,
    showLocalDevBanner,
} from './local-dev.js';

export function selectChatHabit(habitId) {
    state.selectedChatHabitId = habitId;
    updateChatHeader();
    loadMessages();
}

export function updateChatHeader() {
    const select = document.getElementById('chat-habit-select');
    if (!select) return;

    const joined = getJoinedHabits();
    const options = [
        '<option value="">General</option>',
        ...joined.map((h) => {
            const selected = state.selectedChatHabitId === h.id ? 'selected' : '';
            return `<option value="${h.id}" ${selected}>${escapeHtml(h.title)}</option>`;
        }),
    ];

    select.innerHTML = options.join('');
    select.value = state.selectedChatHabitId || '';

    const title = document.getElementById('chat-title-text');
    if (title) {
        if (!state.selectedChatHabitId) {
            title.textContent = 'General chat';
        } else {
            const habit = state.habits.find((h) => h.id === state.selectedChatHabitId);
            title.textContent = habit ? `${habit.title} chat` : 'Habit chat';
        }
    }
}

export async function loadMessages() {
    if (state.selectedChatHabitId && isLocalHabitChat()) {
        state.messages = loadLocalHabitMessages(state.selectedChatHabitId);
        renderChat();
        return;
    }

    try {
        let query = supabaseClient
            .from('messages')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(200);

        if (state.selectedChatHabitId) {
            query = query.eq('habit_id', state.selectedChatHabitId);
        } else {
            query = query.is('habit_id', null);
        }

        const { data, error } = await query;

        if (error) throw error;

        state.messages = data || [];
        renderChat();
    } catch (error) {
        if (state.selectedChatHabitId) {
            console.warn('per-habit chat unavailable — using local dev storage', error);
            enableLocalHabitChat();
            showLocalDevBanner();
            state.messages = loadLocalHabitMessages(state.selectedChatHabitId);
            renderChat();
            return;
        }

        try {
            const { data, error: fallbackError } = await supabaseClient
                .from('messages')
                .select('*')
                .order('created_at', { ascending: true })
                .limit(200);

            if (fallbackError) throw fallbackError;
            state.messages = data || [];
            renderChat();
        } catch (fallbackError) {
            console.error('Error loading messages:', fallbackError);
        }
    }
}

export function renderChat() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    if (state.messages.length === 0) {
        const label = state.selectedChatHabitId ? 'this habit' : 'general';
        container.innerHTML = `<p class="chat-empty">No messages in ${label} chat yet.</p>`;
        return;
    }

    container.innerHTML = state.messages.map((msg) => {
        const isOwn = msg.username === state.currentUser;
        const bubbleClass = isOwn ? 'chat-bubble--outgoing' : 'chat-bubble--incoming';
        return `
            <div class="chat-bubble ${bubbleClass}">
                ${!isOwn ? `<span class="chat-bubble-author">${escapeHtml(msg.username)}</span>` : ''}
                ${escapeHtml(msg.message_text || '')}
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

export async function sendMessage() {
    const input = document.getElementById('chat-message-input');
    const text = input.value.trim();

    if (!text) return;

    if (state.selectedChatHabitId && isLocalHabitChat()) {
        appendLocalHabitMessage(state.selectedChatHabitId, {
            username: state.currentUser,
            message_text: text,
        });
        input.value = '';
        await loadMessages();
        return;
    }

    try {
        const payload = {
            username: state.currentUser,
            message_text: text,
            habit_id: state.selectedChatHabitId || null,
        };

        const { error } = await supabaseClient
            .from('messages')
            .insert([payload]);

        if (error) throw error;

        input.value = '';
        await loadMessages();
    } catch (error) {
        if (state.selectedChatHabitId) {
            enableLocalHabitChat();
            showLocalDevBanner();
            appendLocalHabitMessage(state.selectedChatHabitId, {
                username: state.currentUser,
                message_text: text,
            });
            input.value = '';
            await loadMessages();
            return;
        }

        console.error('Error sending message:', error);
        alert('Failed to send message.');
    }
}

export function bindChatEvents() {
    document.getElementById('chat-message-input').addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') await sendMessage();
    });

    document.getElementById('chat-habit-select').addEventListener('change', (e) => {
        const val = e.target.value;
        selectChatHabit(val || null);
    });
}
