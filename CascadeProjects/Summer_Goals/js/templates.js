export async function loadPartial(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to load ${path}`);
    }
    return response.text();
}

export async function mountPartials() {
    const [authHtml, homeHtml, dashboardHtml, modalsHtml] = await Promise.all([
        loadPartial('partials/auth.html'),
        loadPartial('partials/home.html'),
        loadPartial('partials/dashboard.html'),
        loadPartial('partials/modals.html'),
    ]);

    document.getElementById('auth-root').innerHTML = authHtml;
    document.getElementById('home-root').innerHTML = homeHtml;
    document.getElementById('app-root').innerHTML = dashboardHtml;
    document.getElementById('modals-root').innerHTML = modalsHtml;
}
