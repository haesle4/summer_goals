import { supabaseClient } from './supabase.js';
import { state } from './state.js';
import { loadHabits } from './habits.js';
import { loadComments } from './comments.js';
import { loadMessages } from './chat.js';

export function setupRealtimeSubscription() {
    supabaseClient
        .channel('habits-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'habits' }, () => {
            loadHabits();
        })
        .subscribe();

    supabaseClient
        .channel('memberships-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_memberships' }, () => {
            loadHabits();
        })
        .subscribe();

    supabaseClient
        .channel('comments-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
            if (state.currentHabitId) {
                loadComments(state.currentHabitId);
            }
            loadHabits();
        })
        .subscribe();

    supabaseClient
        .channel('messages-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
            loadMessages();
        })
        .subscribe();
}
