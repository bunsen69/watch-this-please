const minimizeBtn = document.getElementById('tb-minimize');
const maximizeBtn = document.getElementById('tb-maximize');
const closeBtn = document.getElementById('tb-close');

minimizeBtn.addEventListener('click', () => window.api.minimizeWindow());
maximizeBtn.addEventListener('click', () => window.api.toggleMaximizeWindow());
closeBtn.addEventListener('click', () => window.api.closeWindow());

function applyMaximizedState(isMaximized) {
  maximizeBtn.innerHTML = isMaximized ? '&#10064;' : '&#9633;';
  maximizeBtn.title = isMaximized ? 'Restore' : 'Maximize';
  maximizeBtn.setAttribute('aria-label', isMaximized ? 'Restore' : 'Maximize');
}

window.api.isWindowMaximized().then(applyMaximizedState);
window.api.onWindowMaximizedChanged(applyMaximizedState);
