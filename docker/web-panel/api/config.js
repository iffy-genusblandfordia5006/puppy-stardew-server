/**
 * Config API - Environment configuration management
 */

const fs = require('fs');
const path = require('path');
const config = require('../server');

// Config field definitions with metadata
const CONFIG_SCHEMA = {
  'Steam 设置': [
    { key: 'STEAM_USERNAME', label: 'Steam Username', type: 'text', sensitive: false, readonly: true },
    { key: 'STEAM_PASSWORD', label: 'Steam Password', type: 'password', sensitive: true, readonly: true },
  ],
  'VNC 设置': [
    { key: 'ENABLE_VNC', label: 'Enable VNC', type: 'boolean', default: 'true' },
    { key: 'VNC_PASSWORD', label: 'VNC Password', type: 'password', sensitive: true, default: 'stardew1', maxLength: 8 },
  ],
  '显示设置': [
    { key: 'RESOLUTION_WIDTH', label: 'Resolution Width', type: 'number', default: '1280' },
    { key: 'RESOLUTION_HEIGHT', label: 'Resolution Height', type: 'number', default: '720' },
    { key: 'REFRESH_RATE', label: 'Refresh Rate', type: 'number', default: '60' },
    { key: 'USE_GPU', label: 'Use GPU', type: 'boolean', default: 'false' },
  ],
  '备份设置': [
    { key: 'ENABLE_AUTO_BACKUP', label: 'Auto Backup', type: 'boolean', default: 'false' },
    { key: 'MAX_BACKUPS', label: 'Max Backups', type: 'number', default: '7' },
    { key: 'BACKUP_HOUR', label: 'Backup Hour (0-23)', type: 'number', default: '4', min: 0, max: 23 },
  ],
  '稳定性': [
    { key: 'ENABLE_CRASH_RESTART', label: 'Auto Crash Restart', type: 'boolean', default: 'false' },
    { key: 'MAX_CRASH_RESTARTS', label: 'Max Restarts', type: 'number', default: '5' },
  ],
  '监控': [
    { key: 'ENABLE_LOG_MONITOR', label: 'Log Monitor', type: 'boolean', default: 'true' },
    { key: 'METRICS_PORT', label: 'Metrics Port', type: 'number', default: '9090' },
  ],
  '其他': [
    { key: 'TZ', label: 'Timezone', type: 'text', default: 'UTC' },
  ],
};

function parseEnvFile() {
  const envPath = findEnvFile();
  if (!envPath || !fs.existsSync(envPath)) return {};

  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

function findEnvFile() {
  // Try multiple locations
  const candidates = [
    config.ENV_FILE,
    '/home/steam/.env',
    path.join(process.cwd(), '.env'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function writeEnvFile(envData) {
  const envPath = findEnvFile();
  if (!envPath) throw new Error('.env file not found');

  // Read original file to preserve comments and order
  const original = fs.readFileSync(envPath, 'utf-8');
  const lines = original.split('\n');
  const updatedKeys = new Set();

  const newLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return line;

    const key = trimmed.slice(0, eqIndex).trim();
    if (key in envData) {
      updatedKeys.add(key);
      return `${key}=${envData[key]}`;
    }
    return line;
  });

  // Append any new keys not in original file
  for (const [key, value] of Object.entries(envData)) {
    if (!updatedKeys.has(key)) {
      newLines.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(envPath, newLines.join('\n'), 'utf-8');
}

// ─── Route Handlers ──────────────────────────────────────────────

function getConfig(req, res) {
  const env = parseEnvFile();
  const groups = [];

  for (const [groupName, fields] of Object.entries(CONFIG_SCHEMA)) {
    const items = fields.map(field => {
      let value = env[field.key] || field.default || '';

      // Mask sensitive fields
      if (field.sensitive && value) {
        value = '••••••••';
      }

      return {
        ...field,
        value: field.sensitive ? undefined : value,
        hasValue: !!env[field.key],
      };
    });

    groups.push({ name: groupName, items });
  }

  res.json({ groups });
}

function updateConfig(req, res) {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    // Validate: don't allow updating readonly fields
    const readonlyKeys = new Set();
    for (const fields of Object.values(CONFIG_SCHEMA)) {
      for (const field of fields) {
        if (field.readonly) readonlyKeys.add(field.key);
      }
    }

    for (const key of Object.keys(updates)) {
      if (readonlyKeys.has(key)) {
        return res.status(400).json({ error: `Field '${key}' is read-only` });
      }
    }

    writeEnvFile(updates);
    res.json({
      success: true,
      message: 'Configuration updated. Restart server for changes to take effect.',
      needsRestart: true,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update config', details: e.message });
  }
}

module.exports = { getConfig, updateConfig };
