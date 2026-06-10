import { closeCreateHabit, closeJoinHabit, closeEditHabit } from './habits.js';
import { closeHabitDetail } from './comments.js';

export function bindModalEvents() {
    document.querySelectorAll('[data-close]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.close;
            document.getElementById(id).classList.add('hidden');

            if (id === 'create-habit-modal') closeCreateHabit();
            if (id === 'habit-detail-modal') closeHabitDetail();
            if (id === 'join-habit-modal') closeJoinHabit();
            if (id === 'edit-habit-modal') closeEditHabit();
        });
    });

    window.addEventListener('click', (event) => {
        const createModal = document.getElementById('create-habit-modal');
        const detailModal = document.getElementById('habit-detail-modal');
        const joinModal = document.getElementById('join-habit-modal');
        const editModal = document.getElementById('edit-habit-modal');

        if (event.target === createModal) closeCreateHabit();
        if (event.target === detailModal) closeHabitDetail();
        if (event.target === joinModal) closeJoinHabit();
        if (event.target === editModal) closeEditHabit();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;

        const detailModal = document.getElementById('habit-detail-modal');
        const createModal = document.getElementById('create-habit-modal');
        const joinModal = document.getElementById('join-habit-modal');
        const editModal = document.getElementById('edit-habit-modal');

        if (!detailModal.classList.contains('hidden')) {
            closeHabitDetail();
        } else if (!editModal.classList.contains('hidden')) {
            closeEditHabit();
        } else if (!joinModal.classList.contains('hidden')) {
            closeJoinHabit();
        } else if (!createModal.classList.contains('hidden')) {
            closeCreateHabit();
        }
    });
}
