import { supabaseClient } from './supabase.js';
import { state } from './state.js';
import { escapeHtml, getTimeAgo } from './utils.js';

export async function loadComments(habitId) {
    try {
        const { data, error } = await supabaseClient
            .from('comments')
            .select('*')
            .eq('habit_id', habitId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        state.comments = data || [];
        renderComments();
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

export function renderComments() {
    const commentsList = document.getElementById('comments-list');
    if (!commentsList) return;

    if (state.comments.length === 0) {
        commentsList.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">No comments yet. Be the first to comment!</p>';
        return;
    }

    commentsList.innerHTML = state.comments.map((comment) => {
        const date = new Date(comment.created_at);
        const timeAgo = getTimeAgo(date);

        return `
            <div class="comment-item">
                <div class="comment-header">
                    <span class="comment-author">${escapeHtml(comment.username)}</span>
                    <span class="comment-time">${timeAgo}</span>
                </div>
                <div class="comment-text">${escapeHtml(comment.comment_text)}</div>
            </div>
        `;
    }).join('');
}

export async function postComment() {
    const commentText = document.getElementById('comment-input').value.trim();

    if (!commentText) {
        alert('Please enter a comment');
        return;
    }

    if (!state.currentHabitId) {
        alert('No habit selected');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('comments')
            .insert([{
                habit_id: state.currentHabitId,
                username: state.currentUser,
                comment_text: commentText,
            }]);

        if (error) throw error;

        document.getElementById('comment-input').value = '';
        await loadComments(state.currentHabitId);
    } catch (error) {
        console.error('Error posting comment:', error);
        alert('Failed to post comment. Please try again.');
    }
}

export function closeHabitDetail() {
    document.getElementById('habit-detail-modal').classList.add('hidden');
    state.currentHabitId = null;
    state.comments = [];
}

export function bindCommentEvents() {
    document.getElementById('post-comment-btn').addEventListener('click', postComment);
}
