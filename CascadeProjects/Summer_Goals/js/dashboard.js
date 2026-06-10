import { state, SUMMER_MONTHS } from './state.js';
import { getItemLabels } from './utils.js';
import { renderHabits } from './habits.js';
import { renderChart } from './chart.js';
import { renderLeaderboard } from './leaderboard.js';

function getActiveItemType() {
    return state.dashboardTab === 'goals' ? 'goal' : 'habit';
}

function updateToolbarLabels() {
    const labels = getItemLabels(getActiveItemType());
    const joinBtn = document.getElementById('join-habit-btn');
    const createBtn = document.getElementById('create-habit-btn');
    const chartTitle = document.getElementById('chart-title-text');
    const chartSubtitle = document.getElementById('chart-subtitle-text');

    if (joinBtn) {
        joinBtn.innerHTML = `<span class="toolbar-btn__icon" aria-hidden="true">☼</span> ${labels.join}`;
    }
    if (createBtn) {
        createBtn.innerHTML = `<span class="toolbar-btn__icon" aria-hidden="true">☼</span> ${labels.create}`;
    }
    if (chartTitle) {
        chartTitle.textContent = labels.chartTitle;
    }
    if (chartSubtitle) {
        chartSubtitle.textContent = labels.chartSubtitle;
    }
}

function resetCalendarMonth() {
    const now = new Date();
    const idx = SUMMER_MONTHS.indexOf(now.getMonth());
    state.calendarMonthIndex = idx >= 0 ? idx : 0;
}

function updateTabUi() {
    document.querySelectorAll('.segment[data-tab]').forEach((btn) => {
        const active = btn.dataset.tab === state.dashboardTab;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    const isStandings = state.dashboardTab === 'standings';
    const habitsList = document.getElementById('habits-list');
    const standingsList = document.getElementById('standings-list');
    const toolbarActions = document.getElementById('toolbar-actions');
    const statsPanel = document.querySelector('.stats-panel');
    const dashboardGrid = document.querySelector('.dashboard-grid');

    habitsList?.classList.toggle('hidden', isStandings);
    standingsList?.classList.toggle('hidden', !isStandings);
    toolbarActions?.classList.toggle('hidden', isStandings);
    statsPanel?.classList.toggle('hidden', isStandings);
    dashboardGrid?.classList.toggle('dashboard-grid--standings', isStandings);
}

export async function switchDashboardTab(tab) {
    state.dashboardTab = tab;
    if (tab === 'goals') resetCalendarMonth();
    updateTabUi();
    updateToolbarLabels();

    if (tab === 'standings') {
        await renderLeaderboard();
        return;
    }

    renderHabits();
    renderChart();
}

export function bindDashboardTabs() {
    document.querySelectorAll('.segment[data-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            switchDashboardTab(btn.dataset.tab);
        });
    });

    updateTabUi();
    updateToolbarLabels();
}
