import { state } from './state.js';
import { escapeHtml, getHabitItemType, MONTH_NAMES } from './utils.js';
import { getMembership } from './memberships.js';
import { openJoinModalForHabit, showCreateHabitOfType, openEditHabitModal } from './habits.js';

function formatCreatedDate(createdAt) {
    if (!createdAt) return '';
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return '';
    return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function renderCollectiveList() {
    const container = document.getElementById('collective-list');
    if (!container) return;

    const sorted = [...state.habits].sort((a, b) =>
        String(b.created_at || '').localeCompare(String(a.created_at || '')));

    if (sorted.length === 0) {
        container.innerHTML = '<p class="collective-empty">Nothing yet — add the group\'s first habit or goal!</p>';
        return;
    }

    container.innerHTML = sorted.map((habit) => {
        const itemType = getHabitItemType(habit);
        const joined = Boolean(getMembership(habit.id));
        const created = formatCreatedDate(habit.created_at);

        return `
            <div class="collective-item collective-item--${itemType}">
                <button
                    type="button"
                    class="collective-check ${joined ? 'collective-check--joined' : ''}"
                    data-collective-check="${habit.id}"
                    aria-label="${joined ? 'Customize your schedule' : 'Join and customize'}"
                    title="${joined ? 'Customize your schedule' : 'Join and customize'}"
                >✓</button>
                <div class="collective-item-body">
                    <span class="collective-item-title">${escapeHtml(habit.title)}</span>
                    <span class="collective-item-meta">
                        ${itemType === 'goal' ? 'Goal' : 'Habit'} · by ${escapeHtml(habit.creator)}${created ? ` · ${created}` : ''}
                    </span>
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('[data-collective-check]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const habitId = btn.dataset.collectiveCheck;
            if (getMembership(habitId)) {
                openEditHabitModal(habitId);
            } else {
                openJoinModalForHabit(habitId);
            }
        });
    });
}

export function bindCollectiveEvents() {
    document.getElementById('add-habit-home-btn').addEventListener('click', () => {
        showCreateHabitOfType('habit');
    });
    document.getElementById('add-goal-home-btn').addEventListener('click', () => {
        showCreateHabitOfType('goal');
    });
}
