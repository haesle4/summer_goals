import { supabaseClient } from './supabase.js';
import { state } from './state.js';
import {
    escapeHtml,
    getHabitCategory,
    getHabitItemType,
    getItemStatus,
    getGoalCardStatus,
    isGoalCompleted,
    statusToVariant,
    getItemLabels,
    getGoalDeadline,
    formatDeadlineShort,
    todayDateString,
    DAY_LABELS,
} from './utils.js';
import { openCompletionCommentModal, removeCompletion } from './feed.js';
import { renderCollectiveList } from './collective.js';
import { loadComments, closeHabitDetail } from './comments.js';
import { selectChatHabit, loadMessages } from './chat.js';
import { sunDivider, sunIcon, personIcon, editIcon } from './icons.js';
import {
    loadMemberships,
    getMembership,
    getJoinedHabits,
    getUnjoinedHabits,
    joinHabit,
    leaveHabit,
    toggleCompletion,
    updateMembershipDays,
    createMembershipForCreator,
} from './memberships.js';
import { renderChart } from './chart.js';
import { renderLeaderboard } from './leaderboard.js';
import { isLocalMemberships, saveLocalHabitMeta } from './local-dev.js';

function activeItemType() {
    return state.dashboardTab === 'goals' ? 'goal' : 'habit';
}

function activeLabels() {
    return getItemLabels(activeItemType());
}

let joinSelectedHabitId = null;
let joinSelectedDays = [];
let joinItemType = null;
let createItemTypeOverride = null;
let editHabitId = null;
let editSelectedDays = [];

function createItemType() {
    return createItemTypeOverride || activeItemType();
}

async function updateHabitFields(habitId, { title, description, category, deadline }) {
    const payload = {
        title,
        description: description || 'No description provided',
    };

    const extended = { ...payload };
    if (category) extended.category = category;
    if (deadline !== undefined) extended.deadline = deadline || null;

    if (!isLocalMemberships()) {
        const { error } = await supabaseClient
            .from('habits')
            .update(extended)
            .eq('id', habitId);

        if (!error) {
            if (category) saveLocalHabitMeta(habitId, { category });
            if (deadline !== undefined) saveLocalHabitMeta(habitId, { deadline: deadline || null });
            return;
        }

        const msg = String(error.message || '').toLowerCase();
        if (!msg.includes('category') && !msg.includes('deadline') && !msg.includes('item_type')) {
            throw error;
        }
    }

    const { error } = await supabaseClient
        .from('habits')
        .update(payload)
        .eq('id', habitId);

    if (error) throw error;

    const meta = {};
    if (category) meta.category = category;
    if (deadline !== undefined) meta.deadline = deadline || null;
    if (Object.keys(meta).length) saveLocalHabitMeta(habitId, meta);
}

async function insertHabitRecord({ title, description, goal, category, itemType = 'habit', deadline }) {
    const base = {
        title,
        description: description || 'No description provided',
        goal: goal || 'No specific goal',
        creator: state.currentUser,
        participants: [state.currentUser],
    };

    const extended = { ...base, category, item_type: itemType };
    if (deadline) extended.deadline = deadline;

    if (!isLocalMemberships()) {
        const { data, error } = await supabaseClient
            .from('habits')
            .insert([extended])
            .select()
            .single();

        if (!error) return data;

        const msg = String(error.message || '').toLowerCase();
        if (!msg.includes('category') && !msg.includes('item_type') && !msg.includes('deadline')) {
            throw error;
        }
    }

    const { data, error } = await supabaseClient
        .from('habits')
        .insert([base])
        .select()
        .single();

    if (error) throw error;

    const meta = { category, item_type: itemType };
    if (deadline) meta.deadline = deadline;
    saveLocalHabitMeta(data.id, meta);
    return data;
}

export async function loadHabits() {
    try {
        const { data, error } = await supabaseClient
            .from('habits')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        state.habits = data || [];
        await loadMemberships();
        await loadCommentCounts();
        renderCollectiveList();
        if (state.dashboardTab === 'standings') {
            await renderLeaderboard();
        } else {
            renderHabits();
            renderChart();
        }
    } catch (error) {
        console.error('Error loading habits:', error);
        alert('Failed to load habits. Please refresh the page.');
    }
}

async function loadCommentCounts() {
    try {
        const { data, error } = await supabaseClient
            .from('comments')
            .select('habit_id');

        if (error) throw error;

        state.commentCounts = {};
        (data || []).forEach((comment) => {
            state.commentCounts[comment.habit_id] = (state.commentCounts[comment.habit_id] || 0) + 1;
        });
    } catch (error) {
        console.error('Error loading comment counts:', error);
    }
}

function renderDayDots(days) {
    const set = new Set(days || []);
    return DAY_LABELS.map((label, i) => {
        const on = set.has(i);
        return `<span class="habit-dot ${on ? 'filled' : ''}" title="${label}"></span>`;
    }).join('');
}

function renderHabitCard(habit, membership) {
    const isGoal = getHabitItemType(habit) === 'goal';
    const status = getItemStatus(habit, membership);
    const cardStatus = isGoal ? getGoalCardStatus(habit, membership) : status;
    const variant = statusToVariant(cardStatus);
    const category = getHabitCategory(habit);
    const participantNames = habit.participants.join(', ');
    const isSelected = state.selectedChatHabitId === habit.id;
    const checked = isGoal ? isGoalCompleted(membership) : status === 'done';
    const disabled = !isGoal && status === 'not-relevant';

    let checkboxInner = '';
    if (disabled) {
        checkboxInner = '<span class="habit-checkbox-mark"></span>';
    } else if (checked) {
        checkboxInner = '<span class="habit-checkbox-check">✓</span>';
    }

    const frequency = membership?.frequency || 'days';
    let scheduleMarkup;
    if (isGoal) {
        scheduleMarkup = `<div class="habit-deadline" aria-label="Deadline">${formatDeadlineShort(getGoalDeadline(habit, membership))}</div>`;
    } else if (frequency === 'weekly') {
        scheduleMarkup = '<div class="habit-deadline" aria-label="Schedule">Once a week</div>';
    } else if (frequency === 'monthly') {
        scheduleMarkup = '<div class="habit-deadline" aria-label="Schedule">Once a month</div>';
    } else {
        scheduleMarkup = `<div class="habit-progress" aria-label="Scheduled days">${renderDayDots(membership?.days)}</div>`;
    }

    return `
        <article
            class="habit-card habit-card--${variant} ${isSelected ? 'habit-card--selected' : ''}"
            data-habit-id="${habit.id}"
            data-status="${status}"
        >
            <div class="habit-title-row">
                <div class="habit-checkbox ${disabled ? 'habit-checkbox--disabled' : ''}" onclick="event.stopPropagation()">
                    <input
                        type="checkbox"
                        ${checked ? 'checked' : ''}
                        ${disabled ? 'disabled' : ''}
                        data-complete-habit="${habit.id}"
                        aria-label="${checked ? 'Mark incomplete' : 'Mark complete'}"
                    />
                    ${checkboxInner}
                </div>
                <h3 class="habit-title">${escapeHtml(habit.title)}</h3>
            </div>
            ${scheduleMarkup}
            <div class="habit-card-bottom">
                <p class="habit-participants">
                    ${personIcon()}
                    <span>${escapeHtml(participantNames)}</span>
                </p>
                <div class="habit-card-footer">
                    <span class="habit-tag habit-tag--${category}">${category.charAt(0).toUpperCase() + category.slice(1)}</span>
                    <button type="button" class="habit-edit-btn" data-edit-habit="${habit.id}" aria-label="Edit or delete habit" onclick="event.stopPropagation()">
                        ${editIcon()}
                    </button>
                </div>
            </div>
        </article>
    `;
}

function renderSection(cards) {
    if (!cards.length) return '';
    return cards.join('');
}

export function renderHabits() {
    const habitsList = document.getElementById('habits-list');
    if (!habitsList || state.dashboardTab === 'standings') return;

    const labels = activeLabels();
    const joined = getJoinedHabits(activeItemType());

    if (joined.length === 0) {
        habitsList.innerHTML = `
            <div class="habits-empty">
                <h3>No ${labels.plural} joined yet</h3>
                <p>Use <strong>${labels.join}</strong> ${labels.emptyJoinHint}.</p>
            </div>
        `;
        return;
    }

    const grouped = { todo: [], done: [], 'not-relevant': [] };

    joined.forEach((habit) => {
        const membership = getMembership(habit.id);
        const status = getItemStatus(habit, membership);
        grouped[status].push(renderHabitCard(habit, membership));
    });

    const parts = [];
    if (grouped.todo.length) {
        parts.push(`<div class="habits-section">${renderSection(grouped.todo)}</div>`);
    }
    if (grouped.todo.length && (grouped.done.length || grouped['not-relevant'].length)) {
        parts.push(sunDivider(7));
    }
    if (grouped.done.length) {
        parts.push(`<div class="habits-section">${renderSection(grouped.done)}</div>`);
    }
    if (grouped.done.length && grouped['not-relevant'].length) {
        parts.push(sunDivider(7));
    }
    if (grouped['not-relevant'].length) {
        parts.push(`<div class="habits-section">${renderSection(grouped['not-relevant'])}</div>`);
    }

    habitsList.innerHTML = parts.join('');

    habitsList.querySelectorAll('[data-habit-id]').forEach((card) => {
        card.addEventListener('click', () => {
            selectChatHabit(card.dataset.habitId);
            renderHabits();
        });
        card.addEventListener('dblclick', () => {
            showHabitDetail(card.dataset.habitId);
        });
    });

    habitsList.querySelectorAll('[data-complete-habit]').forEach((input) => {
        input.addEventListener('change', async (e) => {
            e.stopPropagation();
            const habitId = input.dataset.completeHabit;
            const ok = await toggleCompletion(habitId);
            renderHabits();
            renderChart();

            if (!ok) return;

            const membership = getMembership(habitId);
            const nowChecked = (membership?.completed_dates || []).includes(todayDateString());
            if (nowChecked) {
                openCompletionCommentModal(habitId);
            } else {
                await removeCompletion(habitId);
            }
        });
    });

    habitsList.querySelectorAll('[data-edit-habit]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditHabitModal(btn.dataset.editHabit);
        });
    });
}

function setScheduleModalMode(prefix, isGoal) {
    const daySection = document.getElementById(`${prefix}-day-section`);
    const deadlineSection = document.getElementById(`${prefix}-deadline-section`);
    const scheduleLabel = document.getElementById(`${prefix}-schedule-label`);

    daySection?.classList.toggle('hidden', isGoal);
    deadlineSection?.classList.toggle('hidden', !isGoal);

    if (scheduleLabel) {
        scheduleLabel.textContent = isGoal
            ? 'Your schedule days'
            : 'Which days will you do this?';
    }
}

export function openEditHabitModal(habitId) {
    const habit = state.habits.find((h) => h.id === habitId);
    const membership = getMembership(habitId);
    if (!habit || !membership) return;

    const isGoal = getHabitItemType(habit) === 'goal';
    editHabitId = habitId;
    editSelectedDays = [...(membership.days || [])];

    const isCreator = habit.creator === state.currentUser;
    const titleInput = document.getElementById('edit-habit-title');
    const descInput = document.getElementById('edit-habit-description');
    const categoryInput = document.getElementById('edit-habit-category');
    const creatorNote = document.getElementById('edit-creator-note');
    const deleteAllBtn = document.getElementById('edit-delete-all-btn');
    const deadlineInput = document.getElementById('edit-goal-deadline');

    titleInput.value = habit.title;
    descInput.value = habit.description || '';
    categoryInput.value = getHabitCategory(habit);
    titleInput.disabled = !isCreator;
    descInput.disabled = !isCreator;
    categoryInput.disabled = !isCreator;
    if (deadlineInput) {
        deadlineInput.value = getGoalDeadline(habit);
        deadlineInput.disabled = !isCreator;
    }
    creatorNote.classList.toggle('hidden', isCreator);
    deleteAllBtn.classList.toggle('hidden', !isCreator);

    setScheduleModalMode('edit', isGoal);
    if (!isGoal) renderEditDayPicker();
    document.getElementById('edit-habit-modal').classList.remove('hidden');
}

export function closeEditHabit() {
    document.getElementById('edit-habit-modal').classList.add('hidden');
    editHabitId = null;
    editSelectedDays = [];
}

function renderEditDayPicker() {
    const container = document.getElementById('edit-day-picker');
    container.innerHTML = DAY_LABELS.map((label, i) => {
        const on = editSelectedDays.includes(i);
        return `
            <button type="button" class="day-picker-btn ${on ? 'day-picker-btn--on' : ''}" data-edit-day="${i}">
                ${sunIcon(14, on ? '' : 'day-picker-btn__sun-off')}
                <span>${label}</span>
            </button>
        `;
    }).join('');

    container.querySelectorAll('[data-edit-day]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const day = Number(btn.dataset.editDay);
            if (editSelectedDays.includes(day)) {
                editSelectedDays = editSelectedDays.filter((d) => d !== day);
            } else {
                editSelectedDays.push(day);
            }
            renderEditDayPicker();
        });
    });
}

async function saveEditHabit() {
    if (!editHabitId) return;

    const habit = state.habits.find((h) => h.id === editHabitId);
    if (!habit) return;

    const isCreator = habit.creator === state.currentUser;
    const title = document.getElementById('edit-habit-title').value.trim();
    const description = document.getElementById('edit-habit-description').value.trim();
    const category = document.getElementById('edit-habit-category').value;

    if (isCreator && !title) {
        alert('Please enter a habit name');
        return;
    }

    const isGoal = getHabitItemType(habit) === 'goal';
    const deadline = document.getElementById('edit-goal-deadline')?.value || '';

    if (!isGoal && editSelectedDays.length === 0) {
        alert('Pick at least one day');
        return;
    }

    if (isGoal && isCreator && !deadline) {
        alert('Pick a finish-by date');
        return;
    }

    try {
        if (isCreator) {
            const fields = { title, description, category };
            if (isGoal) fields.deadline = deadline;
            await updateHabitFields(editHabitId, fields);
            habit.title = title;
            habit.description = description || 'No description provided';
            habit.category = category;
            if (isGoal) habit.deadline = deadline;
        }

        if (!isGoal) {
            const daysOk = await updateMembershipDays(editHabitId, editSelectedDays);
            if (!daysOk) {
                alert('Failed to save your schedule days. Please try again.');
                return;
            }
        }

        closeEditHabit();
        renderHabits();
        renderChart();
        await loadHabits();
    } catch (error) {
        console.error('Error saving habit:', error);
        alert('Failed to save changes. Please try again.');
    }
}

async function leaveHabitFromEdit() {
    if (!editHabitId) return;

    const habit = state.habits.find((h) => h.id === editHabitId);
    if (!habit) return;

    if (!confirm(`Leave "${habit.title}"? It will be removed from your habits.`)) {
        return;
    }

    try {
        await leaveHabit(editHabitId);
        closeEditHabit();
        if (state.selectedChatHabitId === editHabitId) {
            selectChatHabit(null);
        }
        await loadHabits();
    } catch (error) {
        alert('Failed to leave habit. Please try again.');
    }
}

async function deleteHabitForEveryone() {
    if (!editHabitId) return;

    const habit = state.habits.find((h) => h.id === editHabitId);
    if (!habit || habit.creator !== state.currentUser) return;

    if (!confirm(`Delete "${habit.title}" for everyone? This cannot be undone.`)) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('habits')
            .delete()
            .eq('id', editHabitId);

        if (error) throw error;

        closeEditHabit();
        if (state.selectedChatHabitId === editHabitId) {
            selectChatHabit(null);
        }
        await loadHabits();
    } catch (error) {
        console.error('Error deleting habit:', error);
        alert('Failed to delete habit. Please try again.');
    }
}

export function showJoinHabit(itemType = null) {
    joinItemType = itemType || activeItemType();
    const labels = getItemLabels(joinItemType);
    joinSelectedHabitId = null;
    joinSelectedDays = [];
    document.getElementById('join-modal-title').textContent = labels.joinModal;
    document.getElementById('join-modal-submit').textContent = labels.joinSubmit;
    const dayLabel = document.getElementById('join-schedule-label');
    if (dayLabel) {
        dayLabel.textContent = `Pick the days you'll do this ${labels.singular}`;
    }
    renderJoinHabitList();
    document.getElementById('join-frequency-section').classList.add('hidden');
    document.getElementById('join-day-section').classList.add('hidden');
    document.getElementById('join-deadline-section').classList.add('hidden');
    document.getElementById('join-habit-modal').classList.remove('hidden');
}

export function openJoinModalForHabit(habitId) {
    const habit = state.habits.find((h) => h.id === habitId);
    if (!habit) return;
    showJoinHabit(getHabitItemType(habit));
    selectJoinHabit(habitId);
}

export function closeJoinHabit() {
    document.getElementById('join-habit-modal').classList.add('hidden');
    joinSelectedHabitId = null;
    joinSelectedDays = [];
}

function renderJoinHabitList() {
    const container = document.getElementById('join-habit-list');
    const labels = getItemLabels(joinItemType || activeItemType());
    const unjoined = getUnjoinedHabits(joinItemType || activeItemType());

    if (unjoined.length === 0) {
        container.innerHTML = `<p class="join-empty">You've joined every ${labels.singular}! Create a new one to share.</p>`;
        return;
    }

    container.innerHTML = unjoined.map((habit) => `
        <button type="button" class="join-habit-item ${joinSelectedHabitId === habit.id ? 'join-habit-item--selected' : ''}" data-join-pick="${habit.id}">
            <span class="join-habit-item__title">${escapeHtml(habit.title)}</span>
            <span class="join-habit-item__meta">by ${escapeHtml(habit.creator)} · ${escapeHtml(habit.participants.length)} joined</span>
        </button>
    `).join('');

    container.querySelectorAll('[data-join-pick]').forEach((btn) => {
        btn.addEventListener('click', () => selectJoinHabit(btn.dataset.joinPick));
    });
}

function selectJoinHabit(habitId) {
    const habit = state.habits.find((h) => h.id === habitId);
    const isGoal = habit && getHabitItemType(habit) === 'goal';
    joinSelectedHabitId = habitId;
    joinSelectedDays = isGoal ? [] : [0, 1, 2, 3, 4, 5, 6];
    renderJoinHabitList();

    if (isGoal) {
        document.getElementById('join-frequency-section').classList.add('hidden');
        document.getElementById('join-day-section').classList.add('hidden');
        const deadlineSection = document.getElementById('join-deadline-section');
        const deadlineDisplay = document.getElementById('join-deadline-display');
        const deadlineInput = document.getElementById('join-goal-deadline');
        deadlineSection?.classList.remove('hidden');
        const groupDeadline = getGoalDeadline(habit);
        if (deadlineInput) deadlineInput.value = groupDeadline || '';
        if (deadlineDisplay) {
            deadlineDisplay.textContent = groupDeadline
                ? `Group deadline: ${formatDeadlineShort(groupDeadline)} — set your own if you like.`
                : 'Pick the date you want to finish by.';
        }
    } else {
        document.getElementById('join-deadline-section').classList.add('hidden');
        const freqSelect = document.getElementById('join-frequency');
        if (freqSelect) freqSelect.value = 'days';
        document.getElementById('join-frequency-section').classList.remove('hidden');
        document.getElementById('join-day-section').classList.remove('hidden');
        renderJoinDayPicker();
    }
}

function renderJoinDayPicker() {
    const container = document.getElementById('join-day-picker');
    container.innerHTML = DAY_LABELS.map((label, i) => {
        const on = joinSelectedDays.includes(i);
        return `
            <button type="button" class="day-picker-btn ${on ? 'day-picker-btn--on' : ''}" data-day="${i}">
                ${sunIcon(14, on ? '' : 'day-picker-btn__sun-off')}
                <span>${label}</span>
            </button>
        `;
    }).join('');

    container.querySelectorAll('[data-day]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const day = Number(btn.dataset.day);
            if (joinSelectedDays.includes(day)) {
                joinSelectedDays = joinSelectedDays.filter((d) => d !== day);
            } else {
                joinSelectedDays.push(day);
            }
            renderJoinDayPicker();
        });
    });
}

async function submitJoin() {
    const labels = getItemLabels(joinItemType || activeItemType());
    if (!joinSelectedHabitId) {
        alert(`Pick a ${labels.singular} first`);
        return;
    }

    const frequency = document.getElementById('join-frequency')?.value || 'days';
    const goalDeadline = document.getElementById('join-goal-deadline')?.value || null;
    const joinedHabitId = joinSelectedHabitId;

    const ok = await joinHabit(joinedHabitId, joinSelectedDays, { frequency, goalDeadline });

    if (ok) {
        closeJoinHabit();
        await loadHabits();
        selectChatHabit(joinedHabitId);
        await loadMessages();
    }
}

export function showCreateHabitOfType(itemType) {
    createItemTypeOverride = itemType;
    showCreateHabit();
}

export function showCreateHabit() {
    const labels = getItemLabels(createItemType());
    const isGoal = createItemType() === 'goal';
    const modal = document.getElementById('create-habit-modal');
    modal.querySelector('.modal-header h2').textContent = labels.createModal;
    document.getElementById('habit-title').placeholder = `${labels.singularCap} title`;
    document.getElementById('create-habit-submit').textContent = `Create ${labels.singularCap}`;
    setScheduleModalMode('create', isGoal);
    const deadlineInput = document.getElementById('create-goal-deadline');
    if (deadlineInput) deadlineInput.value = '';
    modal.classList.remove('hidden');
}

export function closeCreateHabit() {
    createItemTypeOverride = null;
    document.getElementById('create-habit-modal').classList.add('hidden');
    document.getElementById('habit-title').value = '';
    document.getElementById('habit-description').value = '';
    document.getElementById('habit-goal').value = '';
    document.getElementById('habit-category').value = 'wellness';
    document.getElementById('create-day-picker').querySelectorAll('.day-picker-btn--on').forEach((b) => {
        b.classList.remove('day-picker-btn--on');
    });
    [0, 1, 2, 3, 4, 5, 6].forEach((d) => {
        const btn = document.getElementById('create-day-picker').querySelector(`[data-day="${d}"]`);
        if (btn) btn.classList.add('day-picker-btn--on');
    });
    const deadlineInput = document.getElementById('create-goal-deadline');
    if (deadlineInput) deadlineInput.value = '';
}

export async function createHabit() {
    const itemType = createItemType();
    const labels = getItemLabels(itemType);
    const title = document.getElementById('habit-title').value.trim();
    const description = document.getElementById('habit-description').value.trim();
    const goal = document.getElementById('habit-goal').value.trim();
    const category = document.getElementById('habit-category').value;
    const isGoal = itemType === 'goal';
    const days = [...document.querySelectorAll('#create-day-picker .day-picker-btn--on')]
        .map((b) => Number(b.dataset.day));
    const deadline = document.getElementById('create-goal-deadline')?.value || '';

    if (!title) {
        alert(`Please enter a ${labels.singular} title`);
        return;
    }

    if (isGoal && !deadline) {
        alert('Pick a finish-by date for this goal');
        return;
    }

    if (!isGoal && days.length === 0) {
        alert(`Pick at least one day for this ${labels.singular}`);
        return;
    }

    try {
        const data = await insertHabitRecord({
            title, description, goal, category, itemType, deadline: isGoal ? deadline : undefined,
        });

        await createMembershipForCreator(data.id, isGoal ? [] : days);
        closeCreateHabit();
        await loadHabits();
        selectChatHabit(data.id);
    } catch (error) {
        console.error('Error creating habit:', error);
        alert(`Failed to create ${labels.singular}. Please try again.`);
    }
}

export async function showHabitDetail(habitId) {
    const habit = state.habits.find((h) => h.id === habitId);
    if (!habit) return;

    state.currentHabitId = habitId;

    document.getElementById('detail-title').textContent = habit.title;
    document.getElementById('detail-creator').textContent = habit.creator;
    document.getElementById('detail-description').textContent = habit.description;
    document.getElementById('detail-goal').textContent = habit.goal;

    const participantsList = document.getElementById('detail-participants');
    participantsList.innerHTML = habit.participants.map((participant) =>
        `<span class="participant-badge">${escapeHtml(participant)}</span>`
    ).join('');

    document.getElementById('comment-input').value = '';
    await loadComments(habitId);

    const deleteBtn = document.getElementById('delete-habit-btn');
    if (habit.creator === state.currentUser) {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }

    document.getElementById('habit-detail-modal').classList.remove('hidden');
}

export async function deleteHabit() {
    if (!state.currentHabitId) return;

    const habit = state.habits.find((h) => h.id === state.currentHabitId);
    if (!habit) return;

    if (habit.creator !== state.currentUser) {
        alert('You can only delete habits you created');
        return;
    }

    if (!confirm(`Are you sure you want to delete "${habit.title}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('habits')
            .delete()
            .eq('id', state.currentHabitId);

        if (error) throw error;

        closeHabitDetail();
        if (state.selectedChatHabitId === state.currentHabitId) {
            selectChatHabit(null);
        }
        await loadHabits();
    } catch (error) {
        console.error('Error deleting habit:', error);
        alert('Failed to delete habit. Please try again.');
    }
}

function initCreateDayPicker() {
    const container = document.getElementById('create-day-picker');
    if (!container) return;

    container.innerHTML = DAY_LABELS.map((label, i) => `
        <button type="button" class="day-picker-btn day-picker-btn--on" data-day="${i}">
            ${sunIcon(14)}
            <span>${label}</span>
        </button>
    `).join('');

    container.querySelectorAll('[data-day]').forEach((btn) => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('day-picker-btn--on');
        });
    });
}

export function bindHabitEvents() {
    document.getElementById('create-habit-btn').addEventListener('click', showCreateHabit);
    document.getElementById('join-habit-btn').addEventListener('click', () => showJoinHabit());
    document.getElementById('create-habit-submit').addEventListener('click', createHabit);
    document.getElementById('delete-habit-btn').addEventListener('click', deleteHabit);
    document.getElementById('join-modal-submit').addEventListener('click', submitJoin);
    document.getElementById('join-modal-cancel').addEventListener('click', closeJoinHabit);
    document.getElementById('edit-habit-save').addEventListener('click', saveEditHabit);
    document.getElementById('edit-leave-btn').addEventListener('click', leaveHabitFromEdit);
    document.getElementById('edit-delete-all-btn').addEventListener('click', deleteHabitForEveryone);
    document.getElementById('join-frequency').addEventListener('change', (e) => {
        const showDays = e.target.value === 'days';
        document.getElementById('join-day-section').classList.toggle('hidden', !showDays);
        if (showDays) renderJoinDayPicker();
    });
    initCreateDayPicker();
}
