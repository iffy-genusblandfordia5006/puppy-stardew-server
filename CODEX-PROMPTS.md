# Codex AI 任务提示词

> 以下是三个独立任务的提示词，分别交给 Codex 执行。

---

## 任务 1：首次访问设置密码 + 中英文国际化完善

### 背景

项目 `puppy-stardew-server` 是一个 Docker 化的星露谷物语专用服务器，在 `docker/web-panel/` 下有一个 Node.js + Express + WebSocket 的 Web 管理面板。

**当前问题**：
- 面板使用 `.env` 中的 `PANEL_PASSWORD=admin123` 作为默认密码，首次访问直接进入登录页面要求输入这个默认密码
- 没有"首次设置密码"引导流程——用户可能不知道默认密码是什么
- 希望实现：首次访问时，如果还没设置过密码，显示一个"设置密码"页面，让用户自己设置密码
- 面板已有基础的中英文 i18n 系统（`data-i18n` 属性 + `translations` 对象），但需要完善

### 你的任务

**请修改以下文件来实现"首次设置密码"功能，并完善中英文双语支持**：

#### 后端修改

**文件: `docker/web-panel/auth.js`**

1. 在 `panelConfig` 中增加 `needsSetup` 标记
2. 修改 `initialize()` 函数：
   - 首次运行（无 `panel.json`）时，设置 `needsSetup: true`，**不再**使用 `PANEL_PASSWORD` 默认密码生成 hash
   - `passwordHash` 初始设为 `null`
3. 新增 `getStatus()` 函数：返回 `{ needsSetup: boolean }` —— 这个路由**不需要**JWT验证
4. 新增 `setup(req, res)` 函数：
   - 仅当 `needsSetup === true` 时可调用
   - 接收 `{ password, confirmPassword }`
   - 验证密码长度 ≥ 6
   - 验证 password === confirmPassword
   - 用 bcrypt hash 密码，存入 `panelConfig.passwordHash`
   - 设置 `needsSetup = false`
   - 保存配置
   - 自动签发 JWT token 并返回
   - 如果 `needsSetup === false`，返回 `403 { error: 'Setup already completed' }`
5. 修改 `login()` 函数：如果 `needsSetup === true`，返回 `403 { error: 'Setup required', needsSetup: true }`
6. 导出新函数 `getStatus` 和 `setup`

**文件: `docker/web-panel/server.js`**

1. 新增路由（不需要 JWT）：
   - `GET /api/auth/status` → `auth.getStatus`
   - `POST /api/auth/setup` → `auth.setup`
2. 保留向后兼容：如果已有 `panel.json` 且密码已设置（旧用户升级），`needsSetup` 应为 `false`

#### 前端修改

**文件: `docker/web-panel/public/login.html`**

1. 页面加载时先调用 `GET /api/auth/status`
2. 如果 `needsSetup === true`，显示"设置密码"表单（两个密码输入框 + 确认按钮），隐藏登录表单
3. 如果 `needsSetup === false`，显示正常登录表单
4. 设置密码成功后，自动保存 token 并跳转到主页 `/`
5. 所有文案支持中英文（用 `data-i18n` 属性）
6. 页面语言检测：优先 localStorage `panel_lang`，其次 `navigator.language`

**文件: `docker/web-panel/public/js/app.js`**

完善 i18n translations 对象，新增以下翻译 key：

```javascript
// 中文
'setup.title': '设置管理密码',
'setup.subtitle': '首次使用，请设置您的管理密码',
'setup.password': '设置密码',
'setup.confirm': '确认密码',
'setup.button': '开始使用',
'setup.minLength': '密码至少需要6个字符',
'setup.mismatch': '两次输入的密码不一致',
'setup.success': '密码设置成功！',
'setup.failed': '设置失败',

// 英文
'setup.title': 'Set Admin Password',
'setup.subtitle': 'First time setup - please create your admin password',
'setup.password': 'Password',
'setup.confirm': 'Confirm Password',
'setup.button': 'Get Started',
'setup.minLength': 'Password must be at least 6 characters',
'setup.mismatch': 'Passwords do not match',
'setup.success': 'Password set successfully!',
'setup.failed': 'Setup failed',
```

#### 设计要求

- 设置密码页面与登录页面共享相同的视觉风格（深色背景 `#0f1923`，卡片 `#1a2736`，绿色按钮 `#4ade80`）
- 页面顶部保持 🐶 logo 和标题
- 错误提示使用红色框（与现有 `.error-msg` 一致）
- 密码输入框下方有实时验证提示（密码长度、匹配状态）
- 按钮禁用状态：密码不满足条件时禁用
- 成功后显示简短的成功动画或提示再跳转

#### 文件位置（绝对路径）

```
/root/puppy-stardew-server/docker/web-panel/auth.js
/root/puppy-stardew-server/docker/web-panel/server.js
/root/puppy-stardew-server/docker/web-panel/public/login.html
/root/puppy-stardew-server/docker/web-panel/public/js/app.js
/root/puppy-stardew-server/docker/web-panel/public/css/style.css (如需新增样式)
```

#### 测试检查清单

- [ ] 删除 `panel.json` → 访问面板 → 应显示设置密码页面
- [ ] 输入短密码（< 6 字符）→ 应提示错误
- [ ] 两次密码不一致 → 应提示错误
- [ ] 正确设置密码 → 应跳转到主面板
- [ ] 再次访问 → 应显示登录页面（非设置页面）
- [ ] 已有 `panel.json` 的旧用户 → 不应触发设置流程
- [ ] 中英文切换正常工作

---

## 任务 2：图标替换为 SVG（去 emoji，去 AI 味道）

### 背景

目前面板大量使用 emoji 作为图标（📊📋🖥️👥💾⚙️🧩🐶🟢🔴等），在不同系统上显示不一致，且看起来不够专业。

### 你的任务

**用手写风格的内联 SVG 替换所有 emoji 图标**，要求：

1. **风格**：简洁线条、2px 描边、无填充（stroke-only）、`currentColor` 继承颜色、圆角线帽 `stroke-linecap="round"`。像 Lucide/Feather 图标风格但手绘感更强。
2. **尺寸**：viewBox="0 0 24 24"，默认宽高 24px
3. **不要用任何图标库**——直接写 SVG path

#### 需要替换的图标清单

| 位置 | 当前 emoji | 替换为 SVG 描述 |
|------|----------|----------------|
| Logo (sidebar + login) | 🐶 | 简笔狗头轮廓（圆脸+两只耳朵+鼻子，可爱简洁） |
| Dashboard nav | 📊 | 竖条柱状图（3根高度不同的竖条） |
| Logs nav | 📋 | 带横线的文档/剪贴板 |
| Terminal nav | 🖥️ | 终端/命令行窗口（矩形+光标提示符 `>_`） |
| Players nav | 👥 | 两个人形轮廓 |
| Saves nav | 💾 | 软盘/存储图标 |
| Config nav | ⚙️ | 齿轮 |
| Mods nav | 🧩 | 拼图块 |
| Status online | 🟢 | 填充绿色小圆点（纯 CSS 或 SVG） |
| Status offline | 🔴 | 填充红色小圆点 |
| Status checking | ⏳ | 沙漏或旋转加载 |
| Players icon | 👥 | 同上人形 |
| Uptime | ⏱️ | 时钟 |
| Game day | 📅 | 日历 |
| Backups stat | 💾 | 同存储图标 |
| Mods stat | 🧩 | 同拼图块 |
| 按钮图标 | 📋🔄💾🗑️⬇️ | 对应的线条图标 |
| Mobile nav | 所有 emoji | 同 sidebar 图标 |
| Language toggle | 🌐 | 地球/globe |
| Logout | 🚪 | 退出/箭头向右+门 |

#### 实现方式

1. 在 `index.html` 中定义一个 `<svg style="display:none">` 的 sprite sheet（用 `<symbol>` + `<use>`），或者直接在 CSS 中用 `background-image: url("data:image/svg+xml,...")` —— 选择更简洁的方案
2. 推荐方案：创建一个全局 SVG sprite，放在 `index.html` 的 `<body>` 顶部：
```html
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
  <symbol id="icon-dashboard" viewBox="0 0 24 24">
    <path d="..." stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
  <!-- more symbols -->
</svg>
```
3. 然后在各处使用：`<svg class="icon"><use href="#icon-dashboard"/></svg>`
4. 在 `style.css` 中添加 `.icon` 基础样式

#### CSS 新增

```css
.icon {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex-shrink: 0;
}

.nav-icon .icon { width: 18px; height: 18px; }
.stat-icon .icon { width: 32px; height: 32px; }
.mob-nav-item .icon { width: 22px; height: 22px; }
```

#### 修改文件

```
/root/puppy-stardew-server/docker/web-panel/public/index.html
/root/puppy-stardew-server/docker/web-panel/public/login.html
/root/puppy-stardew-server/docker/web-panel/public/css/style.css
/root/puppy-stardew-server/docker/web-panel/public/js/app.js (app.js 中动态生成的 HTML 也使用 emoji，需要替换)
```

#### 关键注意事项

- `app.js` 中有很多地方动态生成 HTML 时使用了 emoji（如 `🧑‍🌾`、`🌾`、`📦` 等），也需要替换
- login.html 的 logo emoji `🐶` 也需要替换
- 所有按钮文本中的 emoji（如 `📋 View Logs`、`🔄 Restart`）也替换为 SVG + 文本
- 替换后确保移动端布局正常（mob-nav-item 的 SVG 大小适当）
- SVG 要**手画风格**，不要太精确完美的几何形状——线条可以稍微不对称，给人手绘感

#### 测试检查清单

- [ ] 所有页面无 emoji 残留（搜索代码中的 emoji unicode）
- [ ] 在 Chrome、Firefox、Safari 中图标显示一致
- [ ] 移动端底部导航图标大小合适
- [ ] 深色主题下图标颜色随 `currentColor` 正确继承
- [ ] 活跃状态的导航项颜色为绿色 `#4ade80`
- [ ] 状态指示器（在线/离线）颜色正确

---

## 任务 3：CPU 优化调研与实现

### 背景

此项目运行一个 Stardew Valley（星露谷物语）的专用游戏服务器。服务器使用 Docker 容器运行，架构如下：

- 游戏运行在 Xvfb（虚拟 X11 显示服务器）上，默认分辨率 1280x720@60Hz
- 使用 MonoGame/XNA 框架渲染
- 服务器无人观看画面，但游戏引擎仍在全力渲染
- CPU 使用率偏高（通常 40-100%）

**当前 Xvfb 启动命令**（见 `entrypoint.sh` 第 367 行）：
```bash
Xvfb :99 -screen 0 ${RESOLUTION_WIDTH}x${RESOLUTION_HEIGHT}x24 -ac +extension GLX +render -noreset &
```

**当前默认值**（见 `entrypoint.sh` 第 17-19 行）：
```bash
RESOLUTION_WIDTH=${RESOLUTION_WIDTH:-1280}
RESOLUTION_HEIGHT=${RESOLUTION_HEIGHT:-720}
REFRESH_RATE=${REFRESH_RATE:-60}
```

### 你的任务

请搜索网上的信息（Stardew Valley 专用服务器优化、Xvfb CPU 优化、MonoGame headless 模式、SDL 环境变量、SMAPI 性能优化等），然后提出并实现以下优化方案：

#### 1. Xvfb 优化（修改 `entrypoint.sh`）

研究并实现：
- 降低默认分辨率到合理值（如 800x600 或更低——但要确保游戏不会崩溃）
- 降低色深（24bit → 16bit 或 8bit——测试游戏是否能启动）
- 添加 Xvfb 优化参数（如 `-fbdir /dev/shm` 使用内存文件系统）
- 研究并设置 `LIBGL_ALWAYS_SOFTWARE=1` 的影响
- 添加性能相关的环境变量：
  - `SDL_VIDEODRIVER=dummy` 或 `SDL_VIDEODRIVER=x11` —— 研究哪个更好
  - `SDL_AUDIODRIVER=dummy` —— 禁用音频
  - `MONO_GC_PARAMS` —— 优化 Mono GC
  - `DOTNET_GCHeapHardLimit` —— 限制 GC 堆大小

#### 2. 游戏帧率限制

研究 Always On Server mod 的配置选项，看是否有：
- 降低游戏帧率的设置
- 跳过渲染的选项
- 减少 tick 频率的选项

查看 mod 配置文件位置：
```
/root/puppy-stardew-server/mods/Always On Server/config.json
```

#### 3. 新增 .env 配置项

在 `.env.example` 和 `docker-compose.yml` 中添加：
```
# Performance optimization / 性能优化
# LOW_PERF_MODE=true     # 低性能模式：最小化分辨率和渲染
# TARGET_FPS=30          # 目标帧率（默认 60）
```

#### 4. 在 entrypoint.sh 中实现低性能模式

当 `LOW_PERF_MODE=true` 时：
- Xvfb 分辨率降至最低可用（你的研究结果）
- 设置所有性能优化环境变量
- 降低刷新率
- 输出日志说明当前处于低性能模式

#### 修改文件

```
/root/puppy-stardew-server/docker/scripts/entrypoint.sh
/root/puppy-stardew-server/.env.example
/root/puppy-stardew-server/docker-compose.yml
/root/puppy-stardew-server/mods/Always On Server/config.json (如果有可优化的配置)
```

#### 重要限制

- **不能导致游戏崩溃或无法启动**——每个优化都要安全
- **不能破坏现有功能**——VNC 如果启用，仍然需要能看到画面
- **向后兼容**——默认行为不变，优化是 opt-in
- 在搜索优化方案时，请重点关注：
  - GitHub issues 中的 Stardew Valley 服务器项目
  - SMAPI 官方文档
  - Always On Server mod 的 Nexus Mods 页面
  - MonoGame 的 headless rendering 讨论
  - Xvfb 官方文档

#### 预期产出

1. 修改后的代码文件
2. 一个简短的 `CPU-OPTIMIZATION.md` 报告，说明：
   - 尝试了哪些优化
   - 哪些有效、哪些无效
   - 每个优化的预期 CPU 节省
   - 哪些优化需要重启容器
   - 未来可以进一步优化的方向

---

## 任务 4：代码审查与测试（全项目检查）

### 你的任务

对整个 `puppy-stardew-server` 项目进行全面代码审查和测试，给出改进建议。

#### 审查范围

```
/root/puppy-stardew-server/docker/web-panel/     # Node.js Web 面板
/root/puppy-stardew-server/docker/scripts/        # Bash 启动/管理脚本
/root/puppy-stardew-server/docker/Dockerfile      # Docker 构建
/root/puppy-stardew-server/docker-compose.yml     # 服务编排
/root/puppy-stardew-server/.env.example           # 配置模板
/root/puppy-stardew-server/mods/                  # 预装 mod 配置
```

#### 审查维度

**1. 安全审查**
- 检查 JWT 实现是否有漏洞（secret 泄露、token 过期处理等）
- 检查 API 端点是否都有正确的认证保护
- 检查是否有路径遍历漏洞（saves/backups 下载）
- 检查 WebSocket 认证是否安全
- 检查是否有 XSS 风险（前端 innerHTML 使用）
- 检查 .env 中敏感信息的处理
- 检查 Docker 安全配置（权限、capabilities）
- 检查终端 API 是否有命令注入风险

**2. 健壮性审查**
- 检查错误处理是否完善（try/catch、错误返回）
- 检查文件操作是否安全（原子写入、竞态条件）
- 检查进程管理是否可靠（PID 跟踪、僵尸进程）
- 检查日志轮转和磁盘空间管理
- 检查 WebSocket 重连逻辑
- 检查 shell 脚本中的边界情况（变量未设置、路径含空格等）

**3. 性能审查**
- 检查是否有内存泄漏风险（Map 未清理、事件监听未移除）
- 检查文件系统操作效率（不必要的同步 I/O）
- 检查轮询间隔是否合理
- 检查日志处理效率

**4. 代码质量**
- 检查代码结构和模块化
- 检查重复代码
- 检查注释质量
- 检查 i18n 完整性
- 检查前端代码组织

**5. Docker & 部署**
- Dockerfile 最佳实践（layer caching、image size）
- docker-compose.yml 配置合理性
- Health check 配置
- Volume 权限管理

#### 产出格式

请生成一个 `CODE-REVIEW.md` 文件，包含：

```markdown
# Puppy Stardew Server - 代码审查报告

## 执行摘要
- 审查日期: [date]
- 审查范围: [files reviewed]
- 总体评价: [1-2 sentences]

## 🔴 严重问题 (必须修复)
### 1. [问题标题]
- **位置**: `file:line`
- **描述**: ...
- **影响**: ...
- **建议修复**: ...

## 🟡 中等问题 (建议修复)
### 1. ...

## 🟢 轻微问题 (可选修复)
### 1. ...

## 💡 改进建议
### 1. ...

## ✅ 做得好的地方
### 1. ...
```

#### 注意

- **只做审查和报告，不要修改代码**
- 每个问题都要给出具体的文件和行号
- 每个问题都要给出具体的修复建议（包括代码片段）
- 优先级排序：安全 > 健壮性 > 性能 > 代码质量
