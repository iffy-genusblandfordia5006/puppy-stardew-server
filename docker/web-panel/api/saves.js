/**
 * Saves API - Save file and backup management
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('../server');

function getSaves(req, res) {
  try {
    if (!fs.existsSync(config.SAVES_DIR)) {
      return res.json({ saves: [] });
    }

    const entries = fs.readdirSync(config.SAVES_DIR, { withFileTypes: true });
    const saves = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const saveDir = path.join(config.SAVES_DIR, entry.name);
      const saveFile = path.join(saveDir, entry.name);

      const info = {
        name: entry.name,
        farm: entry.name.split('_')[0] || entry.name,
        size: 0,
        lastModified: null,
        files: 0,
      };

      try {
        if (fs.existsSync(saveFile)) {
          const stat = fs.statSync(saveFile);
          info.size = stat.size;
          info.lastModified = stat.mtime.toISOString();
        }
        info.files = fs.readdirSync(saveDir).length;
      } catch (e) {}

      saves.push(info);
    }

    // Sort by last modified
    saves.sort((a, b) => {
      if (!a.lastModified) return 1;
      if (!b.lastModified) return -1;
      return new Date(b.lastModified) - new Date(a.lastModified);
    });

    res.json({ saves });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list saves', details: e.message });
  }
}

function getBackups(req, res) {
  try {
    if (!fs.existsSync(config.BACKUPS_DIR)) {
      return res.json({ backups: [] });
    }

    const files = fs.readdirSync(config.BACKUPS_DIR);
    const backups = files
      .filter(f => f.endsWith('.tar.gz') || f.endsWith('.zip'))
      .map(f => {
        const stat = fs.statSync(path.join(config.BACKUPS_DIR, f));
        return {
          filename: f,
          size: stat.size,
          date: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ backups });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list backups', details: e.message });
  }
}

function createBackup(req, res) {
  try {
    // Run the backup script
    const result = execSync('bash /home/steam/scripts/auto-backup.sh manual 2>&1', {
      encoding: 'utf-8',
      timeout: 30000,
    });
    res.json({ success: true, message: 'Backup created', output: result });
  } catch (e) {
    // Fallback: manual tar backup
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupName = `manual-backup-${timestamp}.tar.gz`;
      const backupPath = path.join(config.BACKUPS_DIR, backupName);

      execSync(`tar -czf "${backupPath}" -C "${config.SAVES_DIR}" .`, {
        encoding: 'utf-8',
        timeout: 30000,
      });

      res.json({ success: true, message: `Backup created: ${backupName}` });
    } catch (e2) {
      res.status(500).json({ error: 'Failed to create backup', details: e2.message });
    }
  }
}

function downloadBackup(req, res) {
  const filename = req.params.filename;

  // Security: prevent path traversal
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(config.BACKUPS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Backup not found' });
  }

  res.download(filePath, filename);
}

module.exports = { getSaves, getBackups, createBackup, downloadBackup };
