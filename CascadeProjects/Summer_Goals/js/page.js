export function getPageId() {
    return document.body.dataset.page || 'home';
}

export function isHomePage() {
    return getPageId() === 'home';
}

export function isMySummerPage() {
    return getPageId() === 'my-summer';
}

export function navigateToHome() {
    window.location.href = 'index.html';
}

export function navigateToMySummer() {
    window.location.href = 'my-summer.html';
}

export function navigateAfterLogin() {
    window.location.href = 'index.html';
}
