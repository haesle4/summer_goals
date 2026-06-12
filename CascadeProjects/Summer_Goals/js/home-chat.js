import { supabaseClient } from './supabase.js';
import { state } from './state.js';
import { escapeHtml } from './utils.js';

let homeMessages = [];

function renderHomeChat() {
    const container = document.getElementById('home-chat-messages');
    if (!container) return;

    if (homeMessages.length === 0) {
        container.innerHTML = '<p class="chat-empty">No messages yet. Say hi!</p>';
        return;
    }

    container.innerHTML = homeMessages.map((msg) => {
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

export async function loadHomeChat() {
    try {
        const { data, error } = await supabaseClient
            .from('messages')
            .select('*')
            .is('habit_id', null)
            .order('created_at', { ascending: true })
            .limit(200);

        if (error) throw error;

        homeMessages = data || [];
        renderHomeChat();
    } catch (error) {
        try {
            const { data, error: fallbackError } = await supabaseClient
                .from('messages')
                .select('*')
                .order('created_at', { ascending: true })
                .limit(200);

            if (fallbackError) throw fallbackError;
            homeMessages = data || [];
            renderHomeChat();
        } catch (fallbackError) {
            console.error('Error loading general chat:', fallbackError);
        }
    }
}

async function sendHomeMessage() {
    const input = document.getElementById('home-chat-input');
    const text = input.value.trim();
    if (!text) return;

    try {
        const { error } = await supabaseClient
            .from('messages')
            .insert([{
                username: state.currentUser,
                message_text: text,
                habit_id: null,
            }]);

        if (error) throw error;

        input.value = '';
        await loadHomeChat();
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message.');
    }
}

export function bindHomeChatEvents() {
    document.getElementById('home-chat-input').addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') await sendHomeMessage();
    });
}
