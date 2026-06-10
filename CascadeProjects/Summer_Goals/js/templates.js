export async function loadPartial(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to load ${path}`);
    }
    return response.text();
}

export async function mountPartials() {
    const [authHtml, dashboardHtml, modalsHtml] = await Promise.all([
        loadPartial('partials/auth.html'),
        loadPartial('partials/dashboard.html'),
        loadPartial('partials/modals.html'),
    ]);

    document.getElementById('auth-root').innerHTML = authHtml;
    document.getElementById('app-root').innerHTML = dashboardHtml;
    document.getElementById('modals-root').innerHTML = modalsHtml;
}
