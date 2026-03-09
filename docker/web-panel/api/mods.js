/**
 * Mods API - List installed mods
 */

const fs = require('fs');
const path = require('path');
const config = require('../server');

function getMods(req, res) {
  const mods = [];

  // Scan built-in mods
  try {
    const modsDir = path.join(config.GAME_DIR, 'Mods');
    if (fs.existsSync(modsDir)) {
      const entries = fs.readdirSync(modsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const manifestPath = path.join(modsDir, entry.name, 'manifest.json');
        if (!fs.existsSync(manifestPath)) continue;

        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          mods.push({
            id: manifest.UniqueID || entry.name,
            name: manifest.Name || entry.name,
            version: manifest.Version || 'unknown',
            author: manifest.Author || 'unknown',
            description: manifest.Description || '',
            enabled: true,
            isCustom: false,
            folder: entry.name,
          });
        } catch (e) {
          mods.push({
            id: entry.name,
            name: entry.name,
            version: 'unknown',
            enabled: true,
            isCustom: false,
            folder: entry.name,
          });
        }
      }
    }
  } catch (e) {}

  // Scan custom mods
  try {
    const customModsDir = '/home/steam/custom-mods';
    if (fs.existsSync(customModsDir)) {
      const entries = fs.readdirSync(customModsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const manifestPath = path.join(customModsDir, entry.name, 'manifest.json');
        if (!fs.existsSync(manifestPath)) continue;

        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          mods.push({
            id: manifest.UniqueID || entry.name,
            name: manifest.Name || entry.name,
            version: manifest.Version || 'unknown',
            author: manifest.Author || 'unknown',
            description: manifest.Description || '',
            enabled: true,
            isCustom: true,
            folder: entry.name,
          });
        } catch (e) {}
      }
    }
  } catch (e) {}

  res.json({ mods, total: mods.length });
}

module.exports = { getMods };
