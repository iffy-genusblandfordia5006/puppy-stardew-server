/**
 * Main Application - Navigation, WebSocket, Dashboard, all page logic
 */

// ─── Auth Check ──────────────────────────────────────────────────
(function authCheck() {
  if (!API.token) {
    window.location.href = '/login.html';
    return;
  }
  // Verify token
  API.get('/api/auth/verify').then(data => {
    if (!data || !data.valid) {
      window.location.href = '/login.html';
      return;
    }
    document.getElementById('app').style.display = 'flex';
    init();
  }).catch(() => {
    window.location.href = '/login.html';
  });
})();

// ─── Global State ────────────────────────────────────────────────
let ws = null;
let currentPage = 'dashboard';
let logAutoScroll = true;
let statusInterval = null;

// ─── i18n ────────────────────────────────────────────────────────
let currentLang = localStorage.getItem('panel_lang') || 'en';
const translations = {
  zh: {
    'nav.dashboard': '仪表盘', 'nav.logs': '日志', 'nav.terminal': '终端',
    'nav.players': '玩家', 'nav.saves': '存档', 'nav.config': '配置', 'nav.mods': 'Mods',
    'dash.status': '服务器状态', 'dash.players': '在线玩家', 'dash.uptime': '运行时间',
    'dash.gameDay': '游戏日期', 'dash.backups': '备份数量', 'dash.mods': '已加载Mod',
    'dash.resources': '系统资源', 'dash.quickActions': '快捷操作',
    'dash.viewLogs': '📋 查看日志', 'dash.restart': '🔄 重启服务器', 'dash.backup': '💾 立即备份',
    'term.title': 'SMAPI 控制台', 'term.hint': '点击"连接"打开 SMAPI 控制台。可在此输入 Steam Guard 验证码或 SMAPI 命令。',
    'players.title': '在线玩家', 'players.loading': '加载中...',
    'saves.title': '存档文件', 'saves.backups': '备份列表',
    'config.password': '修改面板密码', 'mods.title': '已安装 Mods',
    'login.subtitle': '服务器管理面板', 'login.password': '密码', 'login.button': '登录',
    'status.running': '运行中', 'status.stopped': '已停止', 'status.checking': '检查中...',
    'toast.backupOk': '备份创建成功！', 'toast.backupFail': '备份失败',
    'toast.restartOk': '重启指令已发送', 'toast.restartFail': '重启失败',
    'toast.pwdOk': '密码修改成功', 'toast.pwdFail': '密码修改失败',
    'toast.configOk': '配置已保存，重启后生效', 'players.none': '当前没有在线玩家',
  },
  en: {
    'nav.dashboard': 'Dashboard', 'nav.logs': 'Logs', 'nav.terminal': 'Terminal',
    'nav.players': 'Players', 'nav.saves': 'Saves', 'nav.config': 'Config', 'nav.mods': 'Mods',
    'dash.status': 'Server Status', 'dash.players': 'Online Players', 'dash.uptime': 'Uptime',
    'dash.gameDay': 'Game Day', 'dash.backups': 'Backups', 'dash.mods': 'Loaded Mods',
    'dash.resources': 'System Resources', 'dash.quickActions': 'Quick Actions',
    'dash.viewLogs': '📋 View Logs', 'dash.restart': '🔄 Restart', 'dash.backup': '💾 Backup Now',
    'term.title': 'SMAPI Console', 'term.hint': 'Click "Connect" to open SMAPI console. You can enter Steam Guard codes or SMAPI commands here.',
    'players.title': 'Online Players', 'players.loading': 'Loading...',
    'saves.title': 'Save Files', 'saves.backups': 'Backups',
    'config.password': 'Change Panel Password', 'mods.title': 'Installed Mods',
    'login.subtitle': 'Server Management Panel', 'login.password': 'Password', 'login.button': 'Login',
    'status.running': 'Running', 'status.stopped': 'Stopped', 'status.checking': 'Checking...',
    'toast.backupOk': 'Backup created!', 'toast.backupFail': 'Backup failed',
    'toast.restartOk': 'Restart initiated', 'toast.restartFail': 'Restart failed',
    'toast.pwdOk': 'Password changed', 'toast.pwdFail': 'Password change failed',
    'toast.configOk': 'Config saved. Restart to apply.', 'players.none': 'No players online',
  },
};

function t(key) {
  return (translations[currentLang] && translations[currentLang][key]) || key;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
}

// ─── Init ────────────────────────────────────────────────────────
function init() {
  applyTranslations();
  setupNavigation();
  setupWebSocket();
  loadDashboard();

  // Logout
  document.getElementById('logoutBtn').onclick = () => {
    localStorage.removeItem('panel_token');
    window.location.href = '/login.html';
  };

  // Language toggle
  document.getElementById('langToggle').onclick = () => {
    currentLang = currentLang === 'en' ? 'zh' : 'en';
    localStorage.setItem('panel_lang', currentLang);
    applyTranslations();
  };

  // Mobile menu toggle
  document.getElementById('menuToggle').onclick = () => {
    document.getElementById('sidebar').classList.toggle('open');
  };

  // Log controls
  document.getElementById('logAutoScroll').onclick = () => {
    logAutoScroll = !logAutoScroll;
    document.getElementById('logAutoScroll').style.opacity = logAutoScroll ? '1' : '0.5';
  };

  document.getElementById('logClear').onclick = () => {
    document.getElementById('logOutput').innerHTML = '';
  };

  // Log filters
  document.querySelectorAll('.log-filter').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.log-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadLogs(btn.dataset.filter);
      subscribeToLogs(btn.dataset.filter);
    };
  });

  // Log search
  let searchTimeout;
  document.getElementById('logSearch').oninput = (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const activeFilter = document.querySelector('.log-filter.active')?.dataset.filter || 'all';
      loadLogs(activeFilter, e.target.value);
    }, 300);
  };

  // Auto-refresh dashboard
  statusInterval = setInterval(loadDashboard, 10000);
}

// ─── Navigation ──────────────────────────────────────────────────
function setupNavigation() {
  // Sidebar nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.onclick = () => navigateTo(item.dataset.page);
  });
  // Mobile nav
  document.querySelectorAll('.mob-nav-item').forEach(item => {
    item.onclick = () => navigateTo(item.dataset.page);
  });
}

function navigateTo(page) {
  currentPage = page;

  // Update sidebar active
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll('.mob-nav-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  document.querySelector(`.mob-nav-item[data-page="${page}"]`)?.classList.add('active');

  // Show page
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');

  // Update title
  const titleMap = {
    dashboard: t('nav.dashboard'), logs: t('nav.logs'), terminal: t('nav.terminal'),
    players: t('nav.players'), saves: t('nav.saves'), config: t('nav.config'), mods: t('nav.mods'),
  };
  document.getElementById('pageTitle').textContent = titleMap[page] || page;

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');

  // Load page data
  switch (page) {
    case 'dashboard': loadDashboard(); break;
    case 'logs': loadLogs('all'); subscribeToLogs('all'); break;
    case 'players': loadPlayers(); break;
    case 'saves': loadSaves(); break;
    case 'config': loadConfig(); break;
    case 'mods': loadMods(); break;
  }
}

// ─── WebSocket ───────────────────────────────────────────────────
function setupWebSocket() {
  if (ws) {
    ws.close();
  }

  ws = new WebSocket(API.getWsUrl());

  ws.onopen = () => {
    console.log('[WS] Connected');
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      handleWsMessage(msg);
    } catch (err) {
      console.error('[WS] Parse error:', err);
    }
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected, reconnecting in 5s...');
    setTimeout(setupWebSocket, 5000);
  };

  ws.onerror = () => {
    // Will trigger onclose
  };
}

function wsSend(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function handleWsMessage(msg) {
  switch (msg.type) {
    case 'status':
      updateDashboardUI(msg.data);
      break;
    case 'log':
      appendLogLine(msg.line);
      break;
    case 'log:subscribed':
      // Already subscribed
      break;
    case 'terminal:output':
      appendTerminalOutput(msg.data);
      break;
    case 'terminal:opened':
      appendTerminalOutput(msg.data);
      document.getElementById('termInput').disabled = false;
      document.getElementById('termSendBtn').disabled = false;
      document.getElementById('termConnect').style.display = 'none';
      document.getElementById('termDisconnect').style.display = '';
      break;
    case 'terminal:closed':
      appendTerminalOutput(msg.data);
      document.getElementById('termInput').disabled = true;
      document.getElementById('termSendBtn').disabled = true;
      document.getElementById('termConnect').style.display = '';
      document.getElementById('termDisconnect').style.display = 'none';
      break;
    case 'terminal:error':
      appendTerminalOutput(`[Error] ${msg.data}\r\n`);
      break;
  }
}

// ─── Dashboard ───────────────────────────────────────────────────
async function loadDashboard() {
  const data = await API.get('/api/status');
  if (data) updateDashboardUI(data);
}

function updateDashboardUI(data) {
  // Status
  const statusEl = document.getElementById('stat-status');
  const statusIcon = document.getElementById('stat-status-icon');
  const statusBadge = document.getElementById('serverStatus');

  if (data.gameRunning) {
    statusEl.textContent = t('status.running');
    statusIcon.textContent = '🟢';
    statusBadge.textContent = '● ' + t('status.running');
    statusBadge.className = 'status-badge online';
  } else {
    statusEl.textContent = t('status.stopped');
    statusIcon.textContent = '🔴';
    statusBadge.textContent = '● ' + t('status.stopped');
    statusBadge.className = 'status-badge offline';
  }

  // Players
  document.getElementById('stat-players').textContent =
    `${data.players?.online || 0}/${data.players?.max || 4}`;

  // Uptime
  document.getElementById('stat-uptime').textContent = formatUptime(data.uptime || 0);

  // Game day
  document.getElementById('stat-day').textContent = data.day || '--';

  // Backups & Mods
  document.getElementById('stat-backups').textContent = data.backupCount || 0;
  document.getElementById('stat-mods').textContent = data.modCount || 0;

  // CPU
  const cpu = Math.round(data.cpu || 0);
  document.getElementById('cpu-value').textContent = cpu + '%';
  const cpuBar = document.getElementById('cpu-bar');
  cpuBar.style.width = Math.min(cpu, 100) + '%';
  cpuBar.className = 'progress-fill' + (cpu > 80 ? ' danger' : cpu > 60 ? ' warn' : '');

  // RAM
  const memUsed = Math.round(data.memory?.used || 0);
  const memLimit = data.memory?.limit || 2048;
  const memPct = Math.round((memUsed / memLimit) * 100);
  document.getElementById('ram-value').textContent = `${memUsed} / ${memLimit} MB`;
  const ramBar = document.getElementById('ram-bar');
  ramBar.style.width = Math.min(memPct, 100) + '%';
  ramBar.className = 'progress-fill' + (memPct > 80 ? ' danger' : memPct > 60 ? ' warn' : '');
}

function formatUptime(seconds) {
  if (!seconds || seconds <= 0) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Logs ────────────────────────────────────────────────────────
async function loadLogs(filter, search) {
  const params = new URLSearchParams({ type: filter || 'all', lines: 300 });
  if (search) params.set('search', search);

  const data = await API.get(`/api/logs?${params}`);
  if (!data) return;

  const output = document.getElementById('logOutput');
  output.innerHTML = '';

  if (!data.exists) {
    output.innerHTML = '<div class="log-line info">Log file not found yet. Server may still be starting...</div>';
    return;
  }

  for (const line of data.lines) {
    appendLogLine(line);
  }
}

function appendLogLine(line) {
  const output = document.getElementById('logOutput');
  const div = document.createElement('div');
  div.className = `log-line ${line.level || 'info'}`;
  div.textContent = line.text || line;
  output.appendChild(div);

  // Keep max 2000 lines
  while (output.children.length > 2000) {
    output.removeChild(output.firstChild);
  }

  if (logAutoScroll) {
    output.scrollTop = output.scrollHeight;
  }
}

function subscribeToLogs(filter) {
  wsSend({ type: 'subscribe', channel: 'logs', filter });
}

// ─── Terminal ────────────────────────────────────────────────────
function terminalConnect() {
  wsSend({ type: 'terminal:open' });
}

function terminalDisconnect() {
  wsSend({ type: 'terminal:close' });
  document.getElementById('termInput').disabled = true;
  document.getElementById('termSendBtn').disabled = true;
  document.getElementById('termConnect').style.display = '';
  document.getElementById('termDisconnect').style.display = 'none';
}

function terminalSend() {
  const input = document.getElementById('termInput');
  const text = input.value.trim();
  if (!text) return;

  wsSend({ type: 'terminal:input', data: text });
  input.value = '';
}

function appendTerminalOutput(text) {
  const output = document.getElementById('termOutput');
  // Remove hint on first output
  const hint = output.querySelector('.terminal-hint');
  if (hint) hint.remove();

  output.textContent += text;
  output.scrollTop = output.scrollHeight;
}

// ─── Players ─────────────────────────────────────────────────────
async function loadPlayers() {
  const data = await API.get('/api/players');
  if (!data) return;

  const list = document.getElementById('playersList');

  if (!data.players || data.players.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div style="font-size:48px;margin-bottom:12px;">👥</div>
      <div>${t('players.none')}</div>
      <div style="margin-top:8px;color:var(--text-muted)">Online: ${data.online}/${data.max}</div>
    </div>`;
    return;
  }

  list.innerHTML = data.players.map(p => `
    <div class="player-card">
      <div class="player-avatar">🧑‍🌾</div>
      <div>
        <div class="player-name">${escapeHtml(p.name)}</div>
        <div class="player-info">${p.farm ? 'Farm: ' + escapeHtml(p.farm) : ''}</div>
      </div>
    </div>
  `).join('');
}

// ─── Saves ───────────────────────────────────────────────────────
async function loadSaves() {
  const [savesData, backupsData] = await Promise.all([
    API.get('/api/saves'),
    API.get('/api/saves/backups'),
  ]);

  if (savesData) {
    const list = document.getElementById('savesList');
    if (!savesData.saves || savesData.saves.length === 0) {
      list.innerHTML = '<div class="empty-state">No save files found</div>';
    } else {
      list.innerHTML = savesData.saves.map(s => `
        <div class="save-item">
          <div class="save-info">
            <div class="save-name">🌾 ${escapeHtml(s.farm || s.name)}</div>
            <div class="save-meta">${formatSize(s.size)} · ${s.lastModified ? new Date(s.lastModified).toLocaleString() : 'unknown'}</div>
          </div>
        </div>
      `).join('');
    }
  }

  if (backupsData) {
    const list = document.getElementById('backupsList');
    if (!backupsData.backups || backupsData.backups.length === 0) {
      list.innerHTML = '<div class="empty-state">No backups found</div>';
    } else {
      list.innerHTML = backupsData.backups.map(b => `
        <div class="backup-item">
          <div class="save-info">
            <div class="save-name">📦 ${escapeHtml(b.filename)}</div>
            <div class="save-meta">${formatSize(b.size)} · ${new Date(b.date).toLocaleString()}</div>
          </div>
          <a href="/api/saves/download/${encodeURIComponent(b.filename)}" class="btn btn-sm btn-primary"
             onclick="this.href += '?token=' + API.token; return true;">⬇️</a>
        </div>
      `).join('');
    }
  }
}

// ─── Config ──────────────────────────────────────────────────────
async function loadConfig() {
  const data = await API.get('/api/config');
  if (!data) return;

  const container = document.getElementById('configContainer');
  container.innerHTML = '';

  for (const group of data.groups) {
    const card = document.createElement('div');
    card.className = 'card config-group';
    card.innerHTML = `<div class="config-group-title">${escapeHtml(group.name)}</div>`;

    for (const item of group.items) {
      const row = document.createElement('div');
      row.className = 'config-item';

      let valueHtml;
      if (item.readonly) {
        valueHtml = `<span style="color:var(--text-muted)">${item.sensitive ? '••••••••' : escapeHtml(item.value || '--')}</span>`;
      } else if (item.type === 'boolean') {
        const checked = item.value === 'true' || item.hasValue && item.value !== 'false' ? 'checked' : '';
        valueHtml = `<label class="toggle">
          <input type="checkbox" data-key="${item.key}" ${checked} onchange="configChanged()">
          <span class="toggle-slider"></span>
        </label>`;
      } else if (item.sensitive) {
        valueHtml = `<input type="password" class="input" data-key="${item.key}" placeholder="••••••••" style="width:150px" onchange="configChanged()">`;
      } else {
        valueHtml = `<input type="${item.type === 'number' ? 'number' : 'text'}" class="input" data-key="${item.key}"
          value="${escapeHtml(item.value || '')}" placeholder="${escapeHtml(item.default || '')}"
          style="width:150px" onchange="configChanged()">`;
      }

      row.innerHTML = `
        <div>
          <div class="config-label">${escapeHtml(item.label)}</div>
          <div class="config-key">${item.key}</div>
        </div>
        <div class="config-value">${valueHtml}</div>
      `;
      card.appendChild(row);
    }

    container.appendChild(card);
  }

  // Add save button
  const saveBtn = document.createElement('div');
  saveBtn.style.textAlign = 'right';
  saveBtn.innerHTML = `<button class="btn btn-success" id="saveConfigBtn" onclick="saveConfig()" style="display:none">Save Changes</button>`;
  container.appendChild(saveBtn);
}

function configChanged() {
  document.getElementById('saveConfigBtn').style.display = '';
}

async function saveConfig() {
  const updates = {};
  document.querySelectorAll('[data-key]').forEach(el => {
    const key = el.dataset.key;
    if (el.type === 'checkbox') {
      updates[key] = el.checked ? 'true' : 'false';
    } else if (el.value) {
      updates[key] = el.value;
    }
  });

  if (Object.keys(updates).length === 0) return;

  const data = await API.put('/api/config', updates);
  if (data && data.success) {
    showToast(t('toast.configOk'), 'success');
    document.getElementById('saveConfigBtn').style.display = 'none';
  } else {
    showToast(data?.error || t('toast.configFail'), 'error');
  }
}

// ─── Mods ────────────────────────────────────────────────────────
async function loadMods() {
  const data = await API.get('/api/mods');
  if (!data) return;

  const list = document.getElementById('modsList');
  if (!data.mods || data.mods.length === 0) {
    list.innerHTML = '<div class="empty-state">No mods found</div>';
    return;
  }

  list.innerHTML = data.mods.map(m => `
    <div class="mod-item">
      <div class="mod-info">
        <div class="mod-name">${escapeHtml(m.name)}</div>
        <div class="mod-meta">v${escapeHtml(m.version)} · ${escapeHtml(m.author || '')} · ${escapeHtml(m.id)}</div>
        ${m.description ? `<div class="mod-meta">${escapeHtml(m.description)}</div>` : ''}
      </div>
      <span class="mod-badge ${m.isCustom ? 'custom' : ''}">${m.isCustom ? 'Custom' : 'Built-in'}</span>
    </div>
  `).join('');
}

// ─── Actions ─────────────────────────────────────────────────────
async function restartServer() {
  if (!confirm('Are you sure you want to restart the server?')) return;
  const data = await API.post('/api/server/restart');
  if (data && data.success) {
    showToast(t('toast.restartOk'), 'success');
  } else {
    showToast(data?.error || t('toast.restartFail'), 'error');
  }
}

async function createBackup() {
  showToast('Creating backup...', 'warn');
  const data = await API.post('/api/saves/backup');
  if (data && data.success) {
    showToast(t('toast.backupOk'), 'success');
    if (currentPage === 'saves') loadSaves();
  } else {
    showToast(data?.error || t('toast.backupFail'), 'error');
  }
}

async function changePassword() {
  const oldPwd = document.getElementById('oldPassword').value;
  const newPwd = document.getElementById('newPassword').value;

  if (!oldPwd || !newPwd) {
    showToast('Please fill in both password fields', 'error');
    return;
  }

  const data = await API.post('/api/auth/password', { oldPassword: oldPwd, newPassword: newPwd });
  if (data && data.success) {
    showToast(t('toast.pwdOk'), 'success');
    // Update token
    if (data.token) {
      API.token = data.token;
      localStorage.setItem('panel_token', data.token);
    }
    document.getElementById('oldPassword').value = '';
    document.getElementById('newPassword').value = '';
  } else {
    showToast(data?.error || t('toast.pwdFail'), 'error');
  }
}

// ─── Utilities ───────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}
