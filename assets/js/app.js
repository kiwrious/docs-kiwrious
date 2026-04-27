/* Kiwrious SDK Docs — single-page app router + markdown renderer */

(function () {
  'use strict';

  const DEFAULT_ROUTE = 'home';
  const CONTENT_BASE = 'content/';

  const routeFile = (route) => `${CONTENT_BASE}${route}.md`;

  const article = document.getElementById('article');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const menuToggle = document.getElementById('menu-toggle');

  // Configure marked
  marked.setOptions({
    gfm: true,
    breaks: false,
    headerIds: true,
    mangle: false,
  });

  // Custom renderer to support callouts and card-grid via fenced HTML conventions
  const renderer = new marked.Renderer();
  const baseBlockquote = renderer.blockquote.bind(renderer);
  renderer.blockquote = (quote) => {
    // {info} {warn} {bug} prefix
    const m = quote.match(/^\s*<p>\s*\{(info|warn|bug)\}\s*([\s\S]*)/i);
    if (m) {
      const kind = m[1].toLowerCase();
      const rest = '<p>' + m[2];
      return `<aside class="callout callout--${kind}"><span class="callout__label">${kind === 'warn' ? 'Warning' : kind === 'bug' ? 'Discrepancy' : 'Note'}</span>${rest}</aside>`;
    }
    return baseBlockquote(quote);
  };
  marked.use({ renderer });

  // ----- Routing -------------------------------------------------------------
  function getRouteFromHash() {
    const hash = location.hash.replace(/^#\/?/, '').trim();
    return hash || DEFAULT_ROUTE;
  }

  async function loadRoute(route) {
    article.innerHTML = '<p class="loading">Loading…</p>';
    try {
      const res = await fetch(routeFile(route));
      if (!res.ok) {
        throw new Error(`Page not found (${res.status})`);
      }
      const md = await res.text();
      const html = marked.parse(md);
      article.innerHTML = html;
      enhanceCodeBlocks();
      enhanceInternalLinks();
      enhanceCardGrids();
      Prism.highlightAllUnder(article);
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      setActiveNav(route);
      document.title = deriveTitle(article) + ' — Kiwrious SDK Docs';
    } catch (err) {
      article.innerHTML = `
        <h1>Page not found</h1>
        <p>The page <code>${route}</code> could not be loaded.</p>
        <p><a href="#/${DEFAULT_ROUTE}">Return to overview</a></p>
        <pre><code>${(err && err.message) || err}</code></pre>
      `;
    }
  }

  function deriveTitle(root) {
    const h = root.querySelector('h1');
    return h ? h.textContent : 'Documentation';
  }

  function setActiveNav(route) {
    document.querySelectorAll('.nav__link').forEach((el) => {
      const isActive = el.dataset.route === route;
      el.classList.toggle('is-active', isActive);
      el.setAttribute('href', '#/' + el.dataset.route);
    });
  }

  // ----- Code block enhancements --------------------------------------------
  function enhanceCodeBlocks() {
    article.querySelectorAll('pre > code').forEach((codeEl) => {
      const pre = codeEl.parentElement;

      // Skip if already enhanced
      if (pre.querySelector('.copy-btn')) return;

      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.type = 'button';
      btn.textContent = 'Copy';
      btn.addEventListener('click', () => {
        const text = codeEl.innerText;
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = 'Copied';
          btn.classList.add('is-copied');
          setTimeout(() => {
            btn.textContent = 'Copy';
            btn.classList.remove('is-copied');
          }, 1400);
        });
      });
      pre.appendChild(btn);
    });
  }

  // Make markdown links like (sensors/uv.md) or (#/anchor) work as routes
  function enhanceInternalLinks() {
    article.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href) return;
      // Treat *.md links as in-app navigation
      const mdMatch = href.match(/^([\w\-/]+)\.md$/);
      if (mdMatch) {
        a.setAttribute('href', '#/' + mdMatch[1]);
      }
    });
  }

  // Convert fenced "::: cards" blocks (already rendered) into proper grid layout
  function enhanceCardGrids() {
    article.querySelectorAll('.card-grid-marker').forEach((marker) => {
      const ul = marker.nextElementSibling;
      if (!ul || ul.tagName !== 'UL') return;
      const grid = document.createElement('div');
      grid.className = 'card-grid';
      ul.querySelectorAll('li').forEach((li) => {
        const a = li.querySelector('a');
        if (!a) return;
        const card = document.createElement('a');
        card.className = 'card';
        card.href = a.getAttribute('href');
        const title = document.createElement('div');
        title.className = 'card__title';
        title.textContent = a.textContent;
        const desc = document.createElement('p');
        desc.className = 'card__desc';
        // remove the link node, the rest of the LI is description
        a.remove();
        desc.textContent = li.textContent.trim().replace(/^[—–-]\s*/, '');
        card.appendChild(title);
        if (desc.textContent) card.appendChild(desc);
        grid.appendChild(card);
      });
      ul.replaceWith(grid);
      marker.remove();
    });
  }

  // ----- Wire up -------------------------------------------------------------
  document.querySelectorAll('.nav__link').forEach((el) => {
    el.setAttribute('href', '#/' + el.dataset.route);
    el.addEventListener('click', () => {
      // close mobile sidebar after click
      sidebar.classList.remove('is-open');
      sidebarBackdrop.classList.remove('is-open');
    });
  });

  window.addEventListener('hashchange', () => loadRoute(getRouteFromHash()));

  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('is-open');
      sidebarBackdrop.classList.toggle('is-open');
    });
  }
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', () => {
      sidebar.classList.remove('is-open');
      sidebarBackdrop.classList.remove('is-open');
    });
  }

  // Initial load
  if (!location.hash) {
    location.hash = '#/' + DEFAULT_ROUTE;
  } else {
    loadRoute(getRouteFromHash());
  }
})();
