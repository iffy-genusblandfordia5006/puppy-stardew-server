/**
 * Logs API - Log reading and WebSocket streaming
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const config = require('../server');

// Log file mapping
const LOG_FILES = {
  all: 'smapi-latest.log',
  error: 'errors.log',
  mod: 'mods.log',
  server: 'server.log',
  game: 'game.log',
};

function getLogPath(filter) {
  if (filter === 'all' || filter === 'smapi') {
    // SMAPI log is in the game directory
    return path.join(config.GAME_DIR, 'ErrorLogs', 'SMAPI-latest.txt');
  }
  const filename = LOG_FILES[filter] || LOG_FILES.all;
  return path.join(config.LOG_DIR, filename);
}

function parseLogLevel(line) {
  if (/\bERROR\b/i.test(line)) return 'error';
  if (/\bWARN\b/i.test(line)) return 'warn';
  if (/\bDEBUG\b/i.test(line)) return 'debug';
  return 'info';
}

// ─── HTTP Handler ────────────────────────────────────────────────

function getLogs(req, res) {
  const filter = req.query.type || 'all';
  const lines = parseInt(req.query.lines || '200', 10);
  const search = req.query.search || '';

  const logPath = getLogPath(filter);

  if (!fs.existsSync(logPath)) {
    return res.json({ lines: [], total: 0, file: logPath, exists: false });
  }

  try {
    const content = fs.readFileSync(logPath, 'utf-8');
    let allLines = content.split('\n').filter(l => l.trim());

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      allLines = allLines.filter(l => l.toLowerCase().includes(searchLower));
    }

    // Get last N lines
    const result = allLines.slice(-lines).map(line => ({
      text: line,
      level: parseLogLevel(line),
    }));

    res.json({
      lines: result,
      total: allLines.length,
      file: path.basename(logPath),
      exists: true,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read log file', details: e.message });
  }
}

// ─── WebSocket Log Streaming ─────────────────────────────────────

function subscribeLogs(ws, filter) {
  const logPath = getLogPath(filter);

  // Close existing watcher
  if (ws._logWatcher) {
    ws._logWatcher.close();
    ws._logWatcher = null;
  }

  if (!fs.existsSync(logPath)) {
    ws.send(JSON.stringify({
      type: 'log',
      line: { text: `Log file not found: ${path.basename(logPath)}`, level: 'warn' },
    }));
    return;
  }

  // Get current file size to only send new lines
  let fileSize = 0;
  try {
    fileSize = fs.statSync(logPath).size;
  } catch (e) {}

  // Watch for changes
  const watcher = fs.watch(logPath, (eventType) => {
    if (eventType !== 'change') return;

    try {
      const stat = fs.statSync(logPath);
      if (stat.size <= fileSize) {
        // File was truncated, reset
        fileSize = 0;
      }

      // Read new content
      const stream = fs.createReadStream(logPath, {
        start: fileSize,
        encoding: 'utf-8',
      });

      let newData = '';
      stream.on('data', (chunk) => { newData += chunk; });
      stream.on('end', () => {
        fileSize = stat.size;
        const lines = newData.split('\n').filter(l => l.trim());
        for (const line of lines) {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: 'log',
              line: { text: line, level: parseLogLevel(line) },
            }));
          }
        }
      });
    } catch (e) {
      // File may have been deleted/rotated
    }
  });

  ws._logWatcher = watcher;

  ws.send(JSON.stringify({
    type: 'log:subscribed',
    filter,
    file: path.basename(logPath),
  }));
}

module.exports = { getLogs, subscribeLogs };
