// App-grade dropdown: search field, icon rows, animated panel.
// Progressive enhancement over native <select>: the native element stays in
// the DOM (hidden), value stays the single source of truth, and every pick
// dispatches input+change so existing listeners keep working untouched.
// Option panel is rebuilt from live <option>s on every open (safe for
// dynamically rebuilt selects). Icons via data-ic (svg use href) or
// data-swatch (color dot). Search via data-search attribute.

const registry = [];

function closeAll(except) {
  for (const c of registry) if (c !== except && c.open) setOpen(c, false);
}

function setOpen(c, on) {
  c.open = on;
  c.wrap.classList.toggle('open', on);
  c.btn.setAttribute('aria-expanded', on ? 'true' : 'false');
  const tile = c.wrap.closest('.tile'); // lift above neighboring tiles while open
  if (tile) tile.classList.toggle('raised', on);
  if (on) {
    buildRows(c);
    const s = c.search;
    if (s) { s.value = ''; s.placeholder = 'Search…'; setTimeout(() => s.focus(), 30); }
    requestAnimationFrame(() => {
      const r = c.panel.getBoundingClientRect();
      c.wrap.classList.toggle('drop-up', r.bottom > innerHeight - 8);
    });
  } else {
    c.wrap.classList.remove('drop-up');
  }
}

function buildRows(c) {
  const list = c.list; list.innerHTML = '';
  const q = (c.search ? c.search.value : '').trim().toLowerCase();
  let first = null;
  for (const o of c.sel.options) {
    if (q && !(o.text.toLowerCase().includes(q))) continue;
    const r = document.createElement('div');
    r.className = 'combo-opt' + (o.value === c.sel.value ? ' on' : '');
    r.dataset.value = o.value;
    let icon = '';
    if (o.dataset.ic) icon = `<svg class="combo-ic" viewBox="0 0 120 40"><use href="${o.dataset.ic}"/></svg>`;
    else if (o.dataset.swatch) icon = `<span class="combo-dot" style="background:${o.dataset.swatch}"></span>`;
    r.innerHTML = `${icon}<span class="combo-txt">${o.text}</span><span class="combo-check">✓</span>`;
    r.addEventListener('click', () => pick(c, o.value));
    list.appendChild(r);
    if (!first) first = r;
  }
  if (!list.children.length) {
    const d = document.createElement('div');
    d.className = 'combo-empty'; d.textContent = 'No matches';
    list.appendChild(d);
  }
  void first;
}

function pick(c, value) {
  if (c.sel.value !== value) {
    c.sel.value = value;
    c.sel.dispatchEvent(new Event('input', { bubbles: true }));
    c.sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
  syncOne(c);
  setOpen(c, false);
  c.btn.focus({ preventScroll: true });
}

function syncOne(c) {
  const o = c.sel.selectedOptions[0];
  let icon = '';
  if (o) {
    if (o.dataset.ic) icon = `<svg class="combo-ic" viewBox="0 0 120 40"><use href="${o.dataset.ic}"/></svg>`;
    else if (o.dataset.swatch) icon = `<span class="combo-dot" style="background:${o.dataset.swatch}"></span>`;
  }
  c.label.innerHTML = `${icon}<span class="combo-txt">${o ? o.text : ''}</span>`;
}

function enhance(sel) {
  if (sel.dataset.enhanced) return;
  sel.dataset.enhanced = '1';
  const wrap = document.createElement('div');
  wrap.className = 'combo';
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'combo-btn'; btn.setAttribute('aria-haspopup', 'listbox');
  btn.innerHTML = '<span class="combo-label"></span><svg class="combo-chev" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const panel = document.createElement('div');
  panel.className = 'combo-panel'; panel.setAttribute('role', 'listbox');
  let search = null, list;
  if (sel.hasAttribute('data-search')) {
    search = document.createElement('input');
    search.className = 'combo-search'; search.type = 'text'; search.placeholder = 'Search…';
    search.addEventListener('input', () => buildRows(c));
    search.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(c, false); e.stopPropagation(); });
    panel.appendChild(search);
  }
  list = document.createElement('div'); list.className = 'combo-list';
  panel.appendChild(list);
  sel.style.display = 'none';
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(btn); wrap.appendChild(panel); wrap.appendChild(sel);
  const c = { sel, wrap, btn, panel, search, list, label: btn.firstChild, open: false };
  btn.addEventListener('click', e => { e.stopPropagation(); const was = c.open; closeAll(); setOpen(c, !was); });
  btn.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(c, false); });
  registry.push(c);
  syncOne(c);
}

export function enhanceCombos(root) {
  (root || document).querySelectorAll('select').forEach(enhance);
  document.addEventListener('click', e => {
    if (!e.target.closest || !e.target.closest('.combo')) closeAll();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
}

export function syncCombos() {
  for (const c of registry) syncOne(c);
}
