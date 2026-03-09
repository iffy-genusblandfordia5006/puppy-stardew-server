/**
 * Authentication module
 * Handles login, JWT tokens, password management
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── State ───────────────────────────────────────────────────────
let panelConfig = null;
let configPath = '';

// Login rate limiting
const loginAttempts = new Map(); // ip -> { count, lastAttempt }
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// ─── Initialize ──────────────────────────────────────────────────
async function initialize(dataDir, defaultPassword) {
  configPath = path.join(dataDir, 'panel.json');

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Load or create config
  if (fs.existsSync(configPath)) {
    try {
      panelConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      console.log('[Auth] Loaded existing panel configuration');
    } catch (e) {
      console.error('[Auth] Failed to parse panel.json, recreating...');
      panelConfig = null;
    }
  }

  if (!panelConfig) {
    // First run - create config with hashed default password
    const hash = await bcrypt.hash(defaultPassword, 12);
    panelConfig = {
      passwordHash: hash,
      jwtSecret: crypto.randomBytes(32).toString('hex'),
      createdAt: new Date().toISOString(),
    };
    saveConfig();
    console.log('[Auth] Created new panel configuration');
  }
}

function saveConfig() {
  fs.writeFileSync(configPath, JSON.stringify(panelConfig, null, 2), 'utf-8');
}

// ─── Rate Limiting ───────────────────────────────────────────────
function checkRateLimit(ip) {
  const attempt = loginAttempts.get(ip);
  if (!attempt) return true;

  if (attempt.count >= MAX_ATTEMPTS) {
    const elapsed = Date.now() - attempt.lastAttempt;
    if (elapsed < LOCKOUT_MINUTES * 60 * 1000) {
      return false; // Still locked out
    }
    // Lockout expired, reset
    loginAttempts.delete(ip);
    return true;
  }
  return true;
}

function recordFailedLogin(ip) {
  const attempt = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  attempt.count += 1;
  attempt.lastAttempt = Date.now();
  loginAttempts.set(ip, attempt);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

// ─── JWT ─────────────────────────────────────────────────────────
function signToken() {
  return jwt.sign(
    { role: 'admin', iat: Math.floor(Date.now() / 1000) },
    panelConfig.jwtSecret,
    { expiresIn: '24h' }
  );
}

function verifyToken(token) {
  try {
    jwt.verify(token, panelConfig.jwtSecret);
    return true;
  } catch (e) {
    return false;
  }
}

// ─── Route Handlers ──────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Body: { password }
 */
async function login(req, res) {
  const ip = req.ip || req.connection.remoteAddress;

  // Check rate limit
  if (!checkRateLimit(ip)) {
    const attempt = loginAttempts.get(ip);
    const remainingMs = LOCKOUT_MINUTES * 60 * 1000 - (Date.now() - attempt.lastAttempt);
    const remainingMin = Math.ceil(remainingMs / 60000);
    return res.status(429).json({
      error: `Too many login attempts. Try again in ${remainingMin} minutes.`,
      locked: true,
      retryAfter: remainingMin,
    });
  }

  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const valid = await bcrypt.compare(password, panelConfig.passwordHash);
  if (!valid) {
    recordFailedLogin(ip);
    const attempt = loginAttempts.get(ip);
    const remaining = MAX_ATTEMPTS - attempt.count;
    return res.status(401).json({
      error: 'Invalid password',
      attemptsRemaining: remaining > 0 ? remaining : 0,
    });
  }

  // Success
  clearLoginAttempts(ip);
  const token = signToken();

  res.json({
    token,
    expiresIn: '24h',
  });
}

/**
 * GET /api/auth/verify
 * Verify if current token is valid
 */
function verify(req, res) {
  res.json({ valid: true });
}

/**
 * POST /api/auth/password
 * Body: { oldPassword, newPassword }
 */
async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old and new passwords are required' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters' });
  }

  const valid = await bcrypt.compare(oldPassword, panelConfig.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // Update password
  panelConfig.passwordHash = await bcrypt.hash(newPassword, 12);
  panelConfig.passwordChangedAt = new Date().toISOString();
  saveConfig();

  // Sign new token (invalidate old ones by changing secret would be too aggressive)
  const token = signToken();

  res.json({
    success: true,
    message: 'Password changed successfully',
    token,
  });
}

/**
 * Express middleware to verify JWT
 */
function verifyMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.slice(7);
  try {
    jwt.verify(token, panelConfig.jwtSecret);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = {
  initialize,
  login,
  verify,
  changePassword,
  verifyMiddleware,
  verifyToken,
};
