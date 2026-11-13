const updatesList = document.getElementById('updates-list');

const PLAYER_CHANGE = /\b(rank|training|train|aim|market|missions?|ticker|chart|trade|trading|portfolio|holding|farm|weapon|loadout|crosshair|session|reward|target|buy menu|stats|mode|visuals?)\b/i;
const INTERNAL_CHANGE = /\b(stage|smoke|screenshot|cache|stylesheet|api|server|backend|test|coverage|documentation|readme|vercel|supabase|importmap|refactor|helper|script|ci|bootstrap)\b/i;

function isPlayerVisible(commit) {
  return ['feature', 'fix', 'design'].includes(commit.category)
    && PLAYER_CHANGE.test(commit.subject)
    && !INTERNAL_CHANGE.test(commit.subject);
}

function formatDate(date) {
  const value = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(value.getTime())) return date;
  return new Intl.DateTimeFormat('en', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(value);
}

function makeEntry(commit) {
  const article = document.createElement('article');
  article.className = 'update-entry';

  const title = document.createElement('h3');
  title.textContent = commit.subject.replace(/^(feat|fix|feature|design):\s*/i, '');
  article.append(title);
  return article;
}

function render(commits) {
  const visible = commits.filter(isPlayerVisible).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const grouped = new Map();
  for (const commit of visible) {
    const date = commit.timestamp.slice(0, 10);
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date).push(commit);
  }

  updatesList.replaceChildren();
  if (!grouped.size) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No player-facing updates are listed yet.';
    updatesList.append(empty);
    return;
  }

  const latestDate = grouped.keys().next().value;
  for (const [date, entries] of grouped) {
    const day = document.createElement('details');
    day.className = 'update-day';
    if (date === latestDate) day.open = true;

    const summary = document.createElement('summary');
    const dateLabel = document.createElement('span');
    dateLabel.className = 'day-date';
    dateLabel.textContent = formatDate(date);

    const actions = document.createElement('span');
    actions.className = 'day-actions';
    const count = document.createElement('span');
    count.className = 'day-count';
    count.textContent = `${entries.length} ${entries.length === 1 ? 'update' : 'updates'}`;
    const toggle = document.createElement('span');
    toggle.className = 'day-toggle';
    toggle.setAttribute('aria-hidden', 'true');
    toggle.textContent = '+';
    actions.append(count, toggle);
    summary.append(dateLabel, actions);

    const list = document.createElement('div');
    list.className = 'day-entries';
    for (const commit of entries) list.append(makeEntry(commit));
    day.append(summary, list);
    updatesList.append(day);
  }
}

async function loadUpdates() {
  try {
    const response = await fetch('data/update-history.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`History request returned ${response.status}`);
    const archive = await response.json();
    if (!Array.isArray(archive.commits)) throw new Error('Update history is unavailable.');
    render(archive.commits);
  } catch (error) {
    updatesList.replaceChildren();
    const message = document.createElement('p');
    message.className = 'error-state';
    message.textContent = `Could not load updates. ${error instanceof Error ? error.message : ''}`;
    updatesList.append(message);
  }
}

loadUpdates();
