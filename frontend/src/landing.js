if (document.documentElement.dataset.view === 'landing') {
  const menuButton = document.querySelector('.lp-menu-toggle');
  const menu = document.querySelector('.lp-nav');
  const closeMenu = () => {
    menu?.classList.remove('lp-open');
    menuButton?.setAttribute('aria-expanded', 'false');
    menuButton?.setAttribute('aria-label', 'Open menu');
  };

  menuButton?.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('lp-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
  });
  menu?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

  const year = document.querySelector('#lp-year');
  if (year) year.textContent = String(new Date().getFullYear());

  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('lp-js');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('lp-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px 40px 0px' });
    document.querySelectorAll('.lp-reveal').forEach(element => observer.observe(element));
  }
}
