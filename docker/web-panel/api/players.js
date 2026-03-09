/**
 * Players API - Online player information
 */

const fs = require('fs');
const { execSync } = require('child_process');
const config = require('../server');

// Player history (in-memory)
const playerHistory = [];
const MAX_PLAYER_HISTORY = 288; // 24h at 5-min intervals

// Track connected players from log parsing
let connectedPlayers = [];
let lastLogParse = 0;

function parsePlayersFromLogs() {
  const now = Date.now();
  if (now - lastLogParse < 10000) return connectedPlayers; // Cache 10s

  try {
    const logPath = `${config.GAME_DIR}/ErrorLogs/SMAPI-latest.txt`;
    if (!fs.existsSync(logPath)) return connectedPlayers;

    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.split('\n');

    const players = new Map();

    for (const line of lines) {
      // Detect player connections
      const joinMatch = line.match(/(\w+) connected/i) ||
                        line.match(/peer (\w+) joined/i);
      if (joinMatch) {
        const name = joinMatch[1];
        if (name !== 'Server' && name !== 'SMAPI') {
          players.set(name, { name, joinedAt: new Date().toISOString() });
        }
      }

      // Detect player disconnections
      const leaveMatch = line.match(/(\w+) disconnected/i) ||
                         line.match(/peer (\w+) left/i);
      if (leaveMatch) {
        players.delete(leaveMatch[1]);
      }
    }

    connectedPlayers = Array.from(players.values());
    lastLogParse = now;
  } catch (e) {
    // Log parsing failed, keep last known state
  }

  return connectedPlayers;
}

function getOnlineCount() {
  try {
    if (fs.existsSync(config.STATUS_FILE)) {
      const data = JSON.parse(fs.readFileSync(config.STATUS_FILE, 'utf-8'));
      return data.players_online || 0;
    }
  } catch (e) {}
  return connectedPlayers.length;
}

// Record player count history every 5 minutes
setInterval(() => {
  const count = getOnlineCount();
  playerHistory.push({
    timestamp: new Date().toISOString(),
    count,
  });
  if (playerHistory.length > MAX_PLAYER_HISTORY) {
    playerHistory.shift();
  }
}, 5 * 60 * 1000);

// ─── Route Handler ───────────────────────────────────────────────

function getPlayers(req, res) {
  const players = parsePlayersFromLogs();
  const online = getOnlineCount();

  res.json({
    online: Math.max(online, players.length),
    max: 4,
    players,
    history: playerHistory,
  });
}

module.exports = { getPlayers };
