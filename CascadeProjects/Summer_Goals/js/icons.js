export function sunIcon(size = 16, className = '') {
    return `<span class="icon-sun-char ${className}" style="font-size:${size}px" aria-hidden="true">☼</span>`;
}

export function sunDivider(count = 7) {
    return `<div class="sun-divider" aria-hidden="true">
        ${Array.from({ length: count }, () => sunIcon(16, 'sun-divider__icon')).join('')}
    </div>`;
}

export function personIcon() {
    return `<svg class="icon-person" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4" fill="currentColor"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="currentColor"/>
    </svg>`;
}

export function editIcon() {
    return `<svg class="icon-edit" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h4l10-10-4-4L4 16v4z" fill="currentColor"/>
        <path d="M14 6l4 4" stroke="currentColor" stroke-width="2"/>
    </svg>`;
}
