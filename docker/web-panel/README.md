# Puppy Stardew Web Panel

Lightweight web management panel for Puppy Stardew Server.

## Features

- 🔐 JWT authentication with password management
- 📊 Real-time server status dashboard
- 📝 Live log streaming with filters
- 💻 Interactive terminal for SMAPI console
- 👥 Player management
- 💾 Save file management (backup/download)
- ⚙️ Configuration editor (.env)
- 🎮 Mod management
- 🌐 Chinese/English i18n support

## Access

Default URL: `http://localhost:18642`

Default credentials:
- Username: `admin`
- Password: `admin123`

**⚠️ Change the default password immediately after first login!**

## Environment Variables

Set in `.env` file or docker-compose:

```bash
# Web panel admin password (default: admin123)
WEB_PANEL_PASSWORD=your_secure_password

# JWT secret (auto-generated if not set)
WEB_PANEL_JWT_SECRET=your_jwt_secret
```

## API Endpoints

- `POST /api/auth/login` - Login
- `POST /api/auth/change-password` - Change password
- `GET /api/status` - Server status
- `GET /api/logs` - Get logs
- `GET /api/players` - List players
- `GET /api/saves` - List saves
- `POST /api/saves/backup` - Create backup
- `GET /api/config` - Get config
- `PUT /api/config` - Update config
- `GET /api/mods` - List mods

## WebSocket

- `/ws` - Real-time log streaming

## Security

- Rate limiting on login (5 attempts per 15 minutes)
- JWT token authentication
- Password hashing with bcrypt
- Session timeout after 1 hour idle
