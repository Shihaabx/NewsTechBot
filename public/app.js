const state = {
  token: sessionStorage.getItem('newstech-token') || '',
  bootstrap: null,
  sources: [],
  rules: null,
  settings: null,
  discord: null,
};

const categories = [
  ['ai','AI'],
  ['pc-hardware','PC & Hardware'],
  ['windows-software','Windows & Software'],
  ['gaming-tech','Gaming Tech'],
  ['cybersecurity','Cybersecurity'],
  ['general-tech','General Tech'],
];

const channelMeta = [
  ['incoming','Incoming / fallback','Used when no category channel is configured'],
  ['breaking','Breaking news','Urgent, high-value stories'],
  ['ai','AI','OpenAI, models, inference, AI tooling'],
  ['pcHardware','PC & Hardware','NVIDIA, AMD, Intel, GPUs, CPUs'],
  ['windowsSoftware','Windows & Software','Windows, apps, drivers, Microsoft'],
  ['gamingTech','Gaming Tech','PC gaming technology and engines'],
  ['cybersecurity','Cybersecurity','Vulnerabilities, breaches, patches'],
  ['generalTech','General Tech','Fallback technology category'],
  ['videoIdeas','Video Ideas','Stories saved from Discord'],
  ['usedNews','Used News','Stories already used for content'],
];

const $ = (id) => document.getElementById(id);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  })[char]);
}

function toast(message, type='success') {
  const el = $('toast');
  el.textContent = message;
  el.className = 'toast show ' + type;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.className = 'toast', 3200);
}

async function api(path, options={}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type','application/json');
  if (state.token) headers.set('Authorization', 'Bearer ' + state.token);

  const response = await fetch('/api' + path, { ...options, headers, cache:'no-store' });
  if (response.status === 401) {
    $('loginOverlay').classList.remove('hidden');
    throw new Error('Dashboard authentication required.');
  }

  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(payload?.error || payload || 'Request failed');
  return payload;
}

function setView(name) {
  $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
  $$('.view').forEach((view) => view.classList.toggle('active', view.id === 'view-' + name));
  const label = {
    overview:'Overview', sources:'Sources', filters:'Filters',
    discord:'Discord', system:'System', brand:'Brand'
  }[name];
  $('pageTitle').textContent = label || 'NewsTech';
}

function lines(value) {
  return [...new Set(String(value).split(/\n|,/).map((item) => item.trim()).filter(Boolean))];
}

function formatRelative(iso) {
  if (!iso) return 'No poll yet';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return seconds + 's ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  return Math.floor(hours / 24) + 'd ago';
}

function renderStatus(payload) {
  const status = payload.status || payload;
  const settings = payload.settings || state.settings;
  if (payload.settings) state.settings = payload.settings;

  const paused = Boolean(settings?.paused);
  $('sidebarDot').className = 'status-dot ' + (paused ? 'paused' : 'live');
  $('sidebarStatus').textContent = paused ? 'Paused' : status.running ? 'Polling' : 'Online';
  $('sidebarMeta').textContent = status.running ? 'Collecting news now' : 'News intelligence';
  $('heroState').textContent = paused ? 'PAUSED' : status.running ? 'POLLING' : 'LIVE';
  $('heroState').style.color = paused ? '#f7d97f' : '';
  $('pauseTop').textContent = paused ? 'Resume' : 'Pause';
  $('overviewPause').querySelector('strong').textContent = paused ? 'Resume collector' : 'Pause collector';

  $('metricSources').textContent = status.enabledSources ?? 0;
  $('metricPublished').textContent = status.published ?? 0;
  $('metricFiltered').textContent = status.filtered ?? 0;
  $('metricDuplicates').textContent = status.duplicates ?? 0;
  $('metricSeen').textContent = payload.seenCount ?? state.bootstrap?.seenCount ?? 0;
  $('metricFailures').textContent = status.failedSources ?? 0;
  $('lastPollBadge').textContent = formatRelative(status.lastPollAt);

  if (payload.events) renderEvents(payload.events);
}

function renderEvents(events=[]) {
  $('eventList').innerHTML = events.length
    ? events.map((event) => `
      <div class="event-item ${escapeHtml(event.level)}">
        <i class="event-bullet"></i>
        <div><strong>${escapeHtml(event.message)}</strong>${event.detail ? `<small>${escapeHtml(event.detail)}</small>` : ''}</div>
        <time>${escapeHtml(formatRelative(event.at))}</time>
      </div>`).join('')
    : '<div class="event-item"><i class="event-bullet"></i><div><strong>No activity yet</strong><small>NewsTech events will appear here.</small></div></div>';
}

function renderSources() {
  const query = $('sourceSearch').value.trim().toLowerCase();
  const rows = state.sources.filter((source) =>
    !query || [source.name,source.url,source.category].some((v) => String(v).toLowerCase().includes(query))
  );

  $('sourceCount').textContent = state.sources.length + (state.sources.length === 1 ? ' source' : ' sources');
  $('sourcesBody').innerHTML = rows.length ? rows.map((source) => `
    <tr>
      <td><strong>${escapeHtml(source.name)}</strong><small>${escapeHtml(source.url)}</small></td>
      <td>${escapeHtml(categories.find(([id]) => id === source.category)?.[1] || source.category)}</td>
      <td><strong>${source.trust}</strong><small>/100</small></td>
      <td>${source.official ? '<span class="tone orange">OFFICIAL</span>' : '<span class="tone muted">SELECTED</span>'}</td>
      <td><label class="toggle"><input data-source-toggle="${escapeHtml(source.id)}" type="checkbox" ${source.enabled ? 'checked' : ''}><i></i></label></td>
      <td><div class="row-actions">
        <button class="icon-btn" data-source-edit="${escapeHtml(source.id)}" title="Edit">✎</button>
        <button class="icon-btn" data-source-delete="${escapeHtml(source.id)}" title="Delete">×</button>
      </div></td>
    </tr>`).join('') : '<tr><td colspan="6"><div style="padding:30px;color:#7f878d;text-align:center">No sources match this view.</div></td></tr>';

  $$('[data-source-toggle]').forEach((input) => input.addEventListener('change', () => toggleSource(input.dataset.sourceToggle, input.checked)));
  $$('[data-source-edit]').forEach((button) => button.addEventListener('click', () => openSourceModal(button.dataset.sourceEdit)));
  $$('[data-source-delete]').forEach((button) => button.addEventListener('click', () => deleteSource(button.dataset.sourceDelete)));
}

function renderRules() {
  const rules = state.rules;
  if (!rules) return;

  $('blockedTopics').value = (rules.blocked_topics || []).join('\n');
  $('highValueTerms').value = (rules.high_value_terms || []).join('\n');
  $('breakingTerms').value = (rules.breaking_terms || []).join('\n');
  $('lowValueTerms').value = (rules.low_value_terms || []).join('\n');

  $('categoryRules').innerHTML = categories.map(([id,label]) => `
    <div class="category-card">
      <label>${escapeHtml(label)}</label>
      <textarea class="textarea" data-category-rules="${id}" placeholder="one keyword per line">${escapeHtml((rules.categories?.[id]?.terms || []).join('\n'))}</textarea>
    </div>`).join('');
}

function renderSettings() {
  const s = state.settings;
  if (!s) return;

  $('pollInterval').value = s.pollIntervalMinutes;
  $('maxItems').value = s.maxItemsPerSource;
  $('maxAge').value = s.maxArticleAgeHours;
  $('newsMinScore').value = s.newsMinScore;
  $('breakingMinScore').value = s.breakingMinScore;
  $('allowedUsers').value = (s.allowedUserIds || []).join('\n');
  $('dryRun').checked = Boolean(s.dryRun);
  renderScoreNeedle();

  $('channelGrid').innerHTML = channelMeta.map(([key,title,desc]) => `
    <article class="channel-card">
      <div class="channel-card-head">
        <div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(desc)}</p></div>
        <span class="channel-state empty" data-channel-state="${key}">NOT SET</span>
      </div>
      <input class="input" data-channel-input="${key}" value="${escapeHtml(s.channels?.[key] || '')}" placeholder="Discord channel ID">
    </article>`).join('');

  renderDiscordChecks();
}

function renderDiscord(discord=state.discord) {
  if (!discord) return;
  state.discord = discord;
  $('discordBotName').textContent = discord.bot?.username || 'NewsTech';
  $('discordGuildName').textContent = discord.guild?.name || 'Discord server';
  if (discord.bot?.avatarUrl) $('discordAvatar').src = discord.bot.avatarUrl;
  renderDiscordChecks();
}

function renderDiscordChecks() {
  const checks = state.discord?.channels || [];
  checks.forEach((check) => {
    const el = document.querySelector('[data-channel-state="' + check.key + '"]');
    if (!el) return;
    el.className = 'channel-state ' + (!check.configured ? 'empty' : check.valid ? 'good' : 'bad');
    el.textContent = !check.configured ? 'NOT SET' : check.valid ? (check.name ? '#' + check.name : 'READY') : 'CHECK';
    el.title = check.error || '';
  });
}

function collectSettings() {
  const channels = {};
  $$('[data-channel-input]').forEach((input) => {
    const value = input.value.trim();
    channels[input.dataset.channelInput] = value || undefined;
  });

  return {
    paused: Boolean(state.settings?.paused),
    dryRun: $('dryRun').checked,
    allowedUserIds: lines($('allowedUsers').value),
    pollIntervalMinutes: Number($('pollInterval').value),
    maxItemsPerSource: Number($('maxItems').value),
    maxArticleAgeHours: Number($('maxAge').value),
    newsMinScore: Number($('newsMinScore').value),
    breakingMinScore: Number($('breakingMinScore').value),
    channels,
  };
}

function renderScoreNeedle() {
  const value = Math.max(0,Math.min(100,Number($('newsMinScore').value || 0)));
  $('scoreNeedle').style.left = 'calc(' + value + '% - 1px)';
}

async function saveSettings(message='Settings saved') {
  const saved = await api('/settings', { method:'PUT', body:JSON.stringify(collectSettings()) });
  state.settings = saved;
  renderSettings();
  renderStatus({ status: state.bootstrap.status, settings: saved, seenCount: state.bootstrap.seenCount });
  toast(message);
  await refreshDiscord();
}

async function refreshStatus() {
  try {
    const payload = await api('/status');
    if (state.bootstrap) state.bootstrap.status = payload.status;
    renderStatus(payload);
  } catch (error) {
    if (!String(error.message).includes('authentication')) toast(error.message,'error');
  }
}

async function refreshDiscord() {
  try {
    const discord = await api('/discord');
    renderDiscord(discord);
    toast('Discord connection refreshed');
  } catch (error) {
    toast(error.message,'error');
  }
}

async function doPoll() {
  try {
    setBusyPoll(true);
    const result = await api('/actions/poll',{method:'POST'});
    if (result.skipped === 'already-running') toast('A poll is already running','error');
    else toast('Poll completed: ' + result.published + ' published');
    await refreshStatus();
  } catch (error) {
    toast(error.message,'error');
  } finally {
    setBusyPoll(false);
  }
}

function setBusyPoll(value) {
  ['pollNowTop','overviewPoll'].forEach((id) => {
    $(id).disabled = value;
  });
}

async function togglePause() {
  try {
    const paused = Boolean(state.settings?.paused);
    const saved = await api('/actions/' + (paused ? 'resume' : 'pause'), {method:'POST'});
    state.settings = saved;
    renderStatus({status:state.bootstrap.status,settings:saved,seenCount:state.bootstrap.seenCount});
    toast(paused ? 'Collector resumed' : 'Collector paused');
  } catch (error) {
    toast(error.message,'error');
  }
}

function openSourceModal(id='') {
  const source = state.sources.find((item) => item.id === id);
  $('sourceModalTitle').textContent = source ? 'Edit source' : 'Add source';
  $('sourceId').value = source?.id || '';
  $('sourceName').value = source?.name || '';
  $('sourceUrl').value = source?.url || '';
  $('sourceCategory').value = source?.category || 'general-tech';
  $('sourceTrust').value = source?.trust ?? 70;
  $('sourceOfficial').checked = Boolean(source?.official);
  $('sourceEnabled').checked = source ? Boolean(source.enabled) : true;
  $('sourceTestResult').classList.add('hidden');
  $('sourceModal').classList.remove('hidden');
}

async function reloadSources() {
  state.sources = await api('/sources');
  renderSources();
}

async function toggleSource(id, enabled) {
  const source = state.sources.find((item) => item.id === id);
  if (!source) return;
  try {
    state.sources = await api('/sources/' + encodeURIComponent(id), {
      method:'PUT',
      body:JSON.stringify({...source, enabled})
    });
    renderSources();
    await refreshStatus();
    toast((enabled ? 'Enabled ' : 'Disabled ') + source.name);
  } catch (error) {
    toast(error.message,'error');
    renderSources();
  }
}

function confirmAction(title,text) {
  return new Promise((resolve) => {
    $('confirmTitle').textContent = title;
    $('confirmText').textContent = text;
    $('confirmOverlay').classList.remove('hidden');

    const finish = (value) => {
      $('confirmOverlay').classList.add('hidden');
      $('confirmOk').onclick = null;
      $('confirmCancel').onclick = null;
      resolve(value);
    };
    $('confirmOk').onclick = () => finish(true);
    $('confirmCancel').onclick = () => finish(false);
  });
}

async function deleteSource(id) {
  const source = state.sources.find((item) => item.id === id);
  if (!source) return;
  if (!await confirmAction('Delete source?', source.name + ' will stop being monitored.')) return;

  try {
    state.sources = await api('/sources/' + encodeURIComponent(id),{method:'DELETE'});
    renderSources();
    await refreshStatus();
    toast('Source deleted');
  } catch (error) {
    toast(error.message,'error');
  }
}

async function saveFilters() {
  const categoryRules = {};
  $$('[data-category-rules]').forEach((area) => {
    categoryRules[area.dataset.categoryRules] = {terms:lines(area.value)};
  });

  const next = {
    blocked_topics:lines($('blockedTopics').value),
    high_value_terms:lines($('highValueTerms').value),
    breaking_terms:lines($('breakingTerms').value),
    low_value_terms:lines($('lowValueTerms').value),
    categories:categoryRules,
  };

  try {
    state.rules = await api('/rules',{method:'PUT',body:JSON.stringify(next)});
    renderRules();
    toast('News filters saved');
  } catch (error) {
    toast(error.message,'error');
  }
}

async function sendTest() {
  try {
    await api('/discord/test',{method:'POST',body:JSON.stringify({})});
    toast('Test card sent to Discord');
  } catch (error) {
    toast(error.message,'error');
  }
}

async function clearHistory() {
  if (!await confirmAction('Clear duplicate history?','Old feed items can be evaluated and posted again after this.')) return;
  try {
    const result = await api('/actions/clear-history',{method:'POST'});
    if (state.bootstrap) state.bootstrap.seenCount = result.seenCount;
    $('metricSeen').textContent = result.seenCount;
    toast('Duplicate history cleared');
  } catch (error) {
    toast(error.message,'error');
  }
}

async function uploadLogo() {
  const file = $('logoFile').files?.[0];
  if (!file) return toast('Choose a logo file first','error');
  if (file.size > 2 * 1024 * 1024) return toast('Logo must be 2 MB or smaller','error');

  const allowed = ['image/png','image/jpeg','image/webp'];
  if (!allowed.includes(file.type)) return toast('Use PNG, JPEG, or WebP','error');

  const base64 = await new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  try {
    await api('/brand/logo',{method:'POST',body:JSON.stringify({mime:file.type,base64})});
    refreshLogoImages();
    $('logoFile').value = '';
    toast('Logo uploaded');
  } catch (error) {
    toast(error.message,'error');
  }
}

function refreshLogoImages() {
  const src = '/api/brand/logo?v=' + Date.now();
  $$('.brand-logo,#brandPreview,.hero-mark img').forEach((img) => img.src = src);
}

async function resetLogo() {
  if (!await confirmAction('Reset logo?','The dashboard will return to the default NewsTech mark.')) return;
  try {
    await api('/brand/logo',{method:'DELETE'});
    refreshLogoImages();
    toast('Default NewsTech logo restored');
  } catch (error) {
    toast(error.message,'error');
  }
}

async function applyIdentity() {
  try {
    const result = await api('/brand/apply',{method:'POST'});
    toast('Discord bot identity updated');
    await refreshDiscord();
    if (result.avatarUrl) $('discordAvatar').src = result.avatarUrl;
  } catch (error) {
    toast(error.message,'error');
  }
}

async function bootstrap() {
  try {
    const data = await api('/bootstrap');
    state.bootstrap = data;
    state.sources = data.sources || [];
    state.rules = data.rules;
    state.settings = data.settings;
    state.discord = data.discord;

    $('loginOverlay').classList.add('hidden');
    $('logoutBtn').classList.toggle('hidden', !data.authRequired);

    renderStatus({status:data.status,settings:data.settings,seenCount:data.seenCount,events:data.events});
    renderSources();
    renderRules();
    renderSettings();
    renderDiscord(data.discord);
  } catch (error) {
    if (!String(error.message).includes('authentication')) toast(error.message,'error');
  }
}

function bindEvents() {
  $$('.nav-item').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
  $$('[data-go]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.go)));

  $('pollNowTop').addEventListener('click', doPoll);
  $('overviewPoll').addEventListener('click', doPoll);
  $('pauseTop').addEventListener('click', togglePause);
  $('overviewPause').addEventListener('click', togglePause);
  $('overviewTest').addEventListener('click', sendTest);
  $('refreshStatus').addEventListener('click', refreshStatus);

  $('addSourceBtn').addEventListener('click', () => openSourceModal());
  $('closeSourceModal').addEventListener('click', () => $('sourceModal').classList.add('hidden'));
  $('sourceSearch').addEventListener('input', renderSources);

  $('sourceCategory').innerHTML = categories.map(([id,label]) => `<option value="${id}">${escapeHtml(label)}</option>`).join('');

  $('sourceForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = $('sourceId').value;
    const payload = {
      name:$('sourceName').value.trim(),
      url:$('sourceUrl').value.trim(),
      category:$('sourceCategory').value,
      trust:Number($('sourceTrust').value),
      official:$('sourceOfficial').checked,
      enabled:$('sourceEnabled').checked,
    };

    try {
      state.sources = await api(id ? '/sources/' + encodeURIComponent(id) : '/sources', {
        method:id ? 'PUT' : 'POST',
        body:JSON.stringify(payload),
      });
      $('sourceModal').classList.add('hidden');
      renderSources();
      await refreshStatus();
      toast(id ? 'Source updated' : 'Source added');
    } catch (error) {
      toast(error.message,'error');
    }
  });

  $('testSourceBtn').addEventListener('click', async () => {
    const url = $('sourceUrl').value.trim();
    if (!url) return toast('Enter a feed URL first','error');
    const resultEl = $('sourceTestResult');
    resultEl.classList.remove('hidden');
    resultEl.textContent = 'Testing feed…';
    try {
      const result = await api('/sources/test',{
        method:'POST',
        body:JSON.stringify({url,category:$('sourceCategory').value}),
      });
      resultEl.textContent = result.count
        ? `✓ Feed works • ${result.count} items • Latest: ${result.latest?.title || 'Untitled'}`
        : 'Feed loaded but returned no articles.';
    } catch (error) {
      resultEl.textContent = '✕ ' + error.message;
    }
  });

  $('saveFiltersBtn').addEventListener('click', saveFilters);
  $('saveDiscordBtn').addEventListener('click', () => saveSettings('Discord channels saved'));
  $('refreshDiscordBtn').addEventListener('click', refreshDiscord);
  $('sendTestBtn').addEventListener('click', sendTest);
  $('saveSystemBtn').addEventListener('click', () => saveSettings('System settings saved'));
  $('newsMinScore').addEventListener('input', renderScoreNeedle);
  $('clearHistoryBtn').addEventListener('click', clearHistory);

  $('uploadLogoBtn').addEventListener('click', uploadLogo);
  $('resetLogoBtn').addEventListener('click', resetLogo);
  $('applyIdentityBtn').addEventListener('click', applyIdentity);

  $('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    state.token = $('tokenInput').value;
    sessionStorage.setItem('newstech-token', state.token);
    await bootstrap();
  });

  $('logoutBtn').addEventListener('click', () => {
    state.token = '';
    sessionStorage.removeItem('newstech-token');
    $('tokenInput').value = '';
    $('loginOverlay').classList.remove('hidden');
  });

  $('sourceModal').addEventListener('click', (event) => {
    if (event.target === $('sourceModal')) $('sourceModal').classList.add('hidden');
  });
}

bindEvents();
bootstrap();
setInterval(() => {
  if (!$('loginOverlay').classList.contains('hidden')) return;
  refreshStatus();
}, 10000);
