/**
 * Status API - Server status and metrics
 */

const fs = require('fs');
const { execSync } = require('child_process');
const config = require('../server');

// Status history (in-memory, last 1 hour, every 15s = 240 entries)
const statusHistory = [];
const MAX_HISTORY = 240;

// WebSocket subscribers
const statusSubscribers = new Set();

// Cache
let cachedStatus = null;
let cacheTime = 0;
const CACHE_TTL = 3000; // 3 seconds

function collectStatus() {
  const now = Date.now();
  if (cachedStatus && now - cacheTime < CACHE_TTL) {
    return cachedStatus;
  }

  const status = {
    timestamp: new Date().toISOString(),
    gameRunning: false,
    uptime: 0,
    players: { online: 0, max: 4 },
    cpu: 0,
    memory: { used: 0, limit: 2048 },
    day: 'Unknown',
    season: 'Unknown',
    backupCount: 0,
    modCount: 0,
    version: 'v1.0.66',
  };

  // Read status.json from status-reporter.sh
  try {
    if (fs.existsSync(config.STATUS_FILE)) {
      const data = JSON.parse(fs.readFileSync(config.STATUS_FILE, 'utf-8'));
      status.gameRunning = data.server_status === 'running' || data.game_running === 1;
      status.uptime = data.uptime_seconds || 0;
      status.players.online = data.players_online || 0;
      status.cpu = data.cpu_usage_percent || 0;
      status.memory.used = data.memory_usage_mb || 0;
      if (data.game_day) status.day = data.game_day;
      if (data.season) status.season = data.season;
    }
  } catch (e) {
    // status.json may not exist yet
  }

  // Check if game process is running
  try {
    execSync('pgrep -f StardewModdingAPI', { stdio: 'ignore' });
    status.gameRunning = true;
  } catch (e) {
    // Process not found
  }

  // Count backups
  try {
    if (fs.existsSync(config.BACKUPS_DIR)) {
      status.backupCount = fs.readdirSync(config.BACKUPS_DIR)
        .filter(f => f.endsWith('.tar.gz') || f.endsWith('.zip')).length;
    }
  } catch (e) {}

  // Count mods
  try {
    const modsDir = `${config.GAME_DIR}/Mods`;
    if (fs.existsSync(modsDir)) {
      status.modCount = fs.readdirSync(modsDir)
        .filter(f => {
          const manifestPath = `${modsDir}/${f}/manifest.json`;
          return fs.existsSync(manifestPath);
        }).length;
    }
  } catch (e) {}

  // Get system uptime
  try {
    const uptimeStr = execSync('cat /proc/uptime', { encoding: 'utf-8' });
    status.systemUptime = Math.floor(parseFloat(uptimeStr.split(' ')[0]));
  } catch (e) {}

  cachedStatus = status;
  cacheTime = now;

  // Push to history
  statusHistory.push({
    timestamp: status.timestamp,
    cpu: status.cpu,
    memory: status.memory.used,
    players: status.players.online,
  });
  if (statusHistory.length > MAX_HISTORY) {
    statusHistory.shift();
  }

  return status;
}

// Periodically broadcast status to WebSocket subscribers
setInterval(() => {
  if (statusSubscribers.size === 0) return;
  const status = collectStatus();
  const msg = JSON.stringify({ type: 'status', data: status });
  for (const ws of statusSubscribers) {
    if (ws.readyState === 1) {
      ws.send(msg);
    } else {
      statusSubscribers.delete(ws);
    }
  }
}, 5000);

// ─── Route Handlers ──────────────────────────────────────────────

function getStatus(req, res) {
  const status = collectStatus();
  res.json(status);
}

function subscribeStatus(ws) {
  statusSubscribers.add(ws);
  // Send current status immediately
  const status = collectStatus();
  ws.send(JSON.stringify({ type: 'status', data: status }));

  ws.on('close', () => statusSubscribers.delete(ws));
}

function restartServer(req, res) {
  try {
    // Kill the game process, crash-monitor or entrypoint will restart it
    execSync('pkill -f StardewModdingAPI || true', { encoding: 'utf-8' });
    res.json({ success: true, message: 'Server restart initiated' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to restart server', details: e.message });
  }
}

module.exports = { getStatus, subscribeStatus, restartServer };
