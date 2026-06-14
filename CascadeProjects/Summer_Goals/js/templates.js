import { isHomePage, isMySummerPage } from './page.js';

export async function loadPartial(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to load ${path}`);
    }
    return response.text();
}

export async function mountPartials() {
    const loads = [
        loadPartial('partials/auth.html').then((html) => {
            document.getElementById('auth-root').innerHTML = html;
        }),
        loadPartial('partials/modals.html').then((html) => {
            document.getElementById('modals-root').innerHTML = html;
        }),
    ];

    if (isHomePage()) {
        loads.push(
            loadPartial('partials/home.html').then((html) => {
                document.getElementById('home-root').innerHTML = html;
            }),
        );
    }

    if (isMySummerPage()) {
        loads.push(
            loadPartial('partials/dashboard.html').then((html) => {
                document.getElementById('app-root').innerHTML = html;
            }),
        );
    }

    await Promise.all(loads);
}
