if (document.documentElement.dataset.view === 'app') {
  import('./app-entry.jsx');
  window.addEventListener('popstate', () => {
    if (window.location.pathname === '/') window.location.reload();
  });
}
