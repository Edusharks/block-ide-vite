// src/renderer/theme-loader.js
export function applyTheme() {
    const savedTheme = localStorage.getItem('blockIdeTheme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}