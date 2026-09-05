# task-calculate — 数据检测汇总平台

接收各类系统中"需要检测的值"（HTTP / MQTT / WebSocket 三通道），按阈值判定状态（normal / warning / alarm），入库汇总，并通过 WebSocket 实时推送到看板；状态跃迁可经告警规则推送到 Webhook / 钉钉 / 企业微信 / 邮件。

## 技术栈

- 全栈 Nuxt 4（Nitro Node 服务端）+ TypeORM + MySQL 8
- MQTT：EMQX 5（Docker），服务端 mqtt.js 常驻订阅（并发受信号量约束）
- WebSocket：Nitro crossws（`/ws/ingest` 接收、`/ws/dashboard` 推送）
- 告警：nodemailer（邮件）+ fetch（Webhook/钉钉加签/企微），规则级冷却 + 静默窗口
- 趋势图表：ECharts（按需引入），数据源为窗口聚合统计 API
- 数据治理：保留策略（全局/系统级，每日定时清理）、CSV 导出（流式）
- 治理配套：用户管理、ApiKey 生命周期管理、审计日志
- 前端：Pinia + SCSS（class 命名规范见 [doc/class-naming.md](doc/class-naming.md)）+ 暗色模式（CSS 变量主题切换）
- 认证：用户 JWT（httpOnly Cookie，WS 握手同源自动携带）；数据提交方 ApiKey
- 功能规划见 [doc/ROADMAP.md](doc/ROADMAP.md)

## 快速开始

```bash
# 1. 启动 EMQX（docker compose 只包含 emqx + app 两个容器，MySQL 需自备）
docker compose up -d emqx

# 2. 配置环境变量
cp .env.example .env

# 3. 安装依赖
npm install

# 4. 初始化数据（迁移 + admin 用户 + 演示系统/指标/ApiKey）
npm run seed

# 5. 启动开发服务器
npm run dev
```

> 前置要求：宿主机需有一个可用的 MySQL 8 实例，通过 `DB_HOST`/`DB_PORT`（默认 127.0.0.1:3307）连接。
> 默认端口为 48980；若该端口被占用，Nuxt 会自动选择其他端口，以终端输出为准。
> EMQX Dashboard 在 18083（admin/public），1883 默认仅绑定 127.0.0.1。
> 开发环境启动后打开 http://localhost:48980 ，使用 seed 创建的 `admin / admin123` 登录。

## 数据接入

三种通道报文一致：

```json
{ "systemCode": "line1", "metricCode": "temp", "value": 87.5, "timestamp": "可选 ISO 时间" }
```

- **HTTP**：`POST /api/ingest`，请求头 `X-Api-Key: <ApiKey>`
- **MQTT**：发布到主题 `metric/{systemCode}/{metricCode}` 或 `ingest`，payload 中必须携带 `"apiKey": "<ApiKey>"`（与服务端绑定系统隔离校验，例如 `{"apiKey":"...","value":87.5}`）
- **WebSocket**：连接 `/ws/ingest`，首帧 `{"apiKey": "<ApiKey>"}` 认证，之后每帧一条报文

演示 ApiKey（seed 创建）：`dk_line1_6f3a9c2e8b1d4f70`（绑定系统 `line1`）

联调脚本：

```bash
npm run demo              # 三种通道各发一轮
npm run demo -- --loop    # 每 2 秒经 MQTT 发随机数据（看板演示）
```

## 常用命令

```bash
npm run dev       # 开发
npm run build     # 生产构建
npm run seed      # 迁移 + 种子数据（幂等，生产环境需 SEED_ALLOW=1）
npm run demo      # 联调发数脚本
npm run test      # vitest 单测（阈值判定 / 报文校验）
npm run lint      # oxlint
npm run typecheck # nuxt typecheck
```

## 接口一览

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| POST | /api/auth/login | - | 登录，返回 token 并写 httpOnly Cookie（连续失败将限流锁定） |
| POST | /api/auth/logout | - | 退出 |
| GET | /api/auth/me | JWT | 当前用户 |
| POST | /api/ingest | ApiKey | HTTP 接收通道 |
| GET | /api/health | - | DB / MQTT 健康检查 |
| GET | /api/systems | JWT | 系统列表 + 状态汇总 + 指标（看板数据源） |
| POST | /api/systems | admin | 新建系统 |
| GET/PUT/DELETE | /api/systems/:id | JWT / admin | 系统详情 / 更新 / 删除（级联） |
| POST | /api/metrics | admin | 新建指标（含阈值） |
| PUT/DELETE | /api/metrics/:id | admin | 更新指标 / 删除 |
| GET | /api/records | JWT | 历史记录（systemId/metricId/status/from/to/page/pageSize 或 beforeId 游标） |
| GET | /api/records/export | JWT | CSV 导出（同筛选参数，流式，limit ≤ 10 万，带 BOM） |
| GET | /api/metrics/:id/stats | JWT | 聚合统计（window=auto\|1m\|5m\|15m\|1h\|1d + from/to），趋势图数据源 |
| POST | /api/maintenance/cleanup | admin | 手动触发一次保留策略清理（日常由每日 03:05 定时任务执行） |
| GET | /api/audit | admin | 审计日志（username/action 前缀/from/to/page/pageSize） |
| GET/POST | /api/alert/channels | admin | 通知渠道列表 / 新建（webhook/dingtalk/wecom/email） |
| PUT/DELETE | /api/alert/channels/:id | admin | 更新渠道 / 删除（级联规则） |
| POST | /api/alert/channels/:id/test | admin | 发送测试通知 |
| GET/POST | /api/alert/rules | admin | 告警规则列表（?systemId=）/ 新建 |
| PUT/DELETE | /api/alert/rules/:id | admin | 更新规则 / 删除 |
| GET/POST | /api/alert/silences | admin | 静默窗口列表（?systemId=）/ 新建 |
| DELETE | /api/alert/silences/:id | admin | 删除静默窗口 |
| GET/POST | /api/api-keys | admin | ApiKey 列表（脱敏，?systemId=）/ 创建（完整 key 仅返回一次） |
| PUT/DELETE | /api/api-keys/:id | admin | 更新（启用/禁用/改名）/ 删除 |
| POST | /api/api-keys/:id/rotate | admin | 轮换 Key，旧 Key 立即失效 |
| GET/POST | /api/users | admin | 用户列表 / 创建 |
| PUT/DELETE | /api/users/:id | admin | 改密/角色/禁用（保护最后一个可用管理员）/ 删除 |
| WS | /ws/ingest | ApiKey（首帧） | WS 接收通道 |
| WS | /ws/dashboard | JWT（同源 Cookie 优先，?token= 兜底） | 看板实时推送 |

## 告警通知

- 状态**跃迁**进入 warning/alarm 时触发（恢复与持续状态不重复通知），通知管道异步执行不阻塞接收
- 规则 = 指标 × 渠道，可勾选通知预警/告警、配置冷却间隔（秒，0 表示每次跃迁都发）
- 静默窗口支持 全局 / 系统 / 指标 三级作用域，维护期免打扰（照常入库只是不发通知）
- 钉钉机器人支持加签；邮件渠道需配置 SMTP 环境变量（见 `.env.example`）
- 多实例部署时冷却为进程内存实现，需迁移 Redis（见 ROADMAP 第 9 项）

## 目录说明

```
server/
  database/     DataSource、EntitySchema 实体、迁移
  plugins/      Nitro 启动插件（01 TypeORM 先就绪，02 MQTT 订阅）
  services/     ingestService（统一接收管道）/ statusService（阈值判定）/ alertingService（告警分发）/ retentionService（保留清理）/ broadcastService / mqttService
  tasks/        Nitro 定时任务（records/cleanup 每日清理过期记录）
  api/          REST 接口（系统/指标/记录/认证/告警/ApiKey/用户/审计/维护）
  routes/ws/    WebSocket 通道
app/
  pages/        login / index(看板) / systems / systems/[id] / records / channels / users / audit
  components/   StatusBadge / TrendChart / ApiKeyManager / AlertRuleManager / SilenceManager
  composables/  useTheme（暗色切换）
  stores/       auth / realtime(WS 重连) / dashboard(实时数据)
  assets/scss/  _variables.scss、_mixins.scss（自动注入）、global.scss（CSS 变量主题定义）
scripts/        seed.ts、demo-publish.ts
tests/          vitest 单测
```

## 稳定性设计

- 启动顺序：先连数据库并跑迁移，失败即中止启动；MQTT 独立重连不阻塞服务；停机时释放连接池并断开 MQTT
- 所有接收入口 zod 校验 + 兜底 try/catch，坏消息只记日志不影响其他消息
- `synchronize: false`，schema 变更只走迁移
- ingest 记录写入与最新值回写在同一事务；同一指标按序串行处理，乱序/过期报文不覆盖 `last_*` 也不触发告警
- 上报 payload 截断存储，防超大报文；HTTP / WS 通道与 MQTT 一致：请求体大小限制（64KB）、每 ApiKey 令牌桶限流、全局有界并发（溢出返回 429）
- MQTT 通道与 HTTP/WS 一致要求 ApiKey，凭 payload 中的 apiKey 完成系统绑定隔离校验
- 记录/指标/ApiKey 缓存 + 未知 code 负缓存（TTL），坏消息洪峰不打穿 DB
- MQTT 消费经信号量限流（并发 20 / 队列 500），洪峰丢帧记日志而非拖垮服务
- 登录按 用户名+IP 限流，连续失败锁定 15 分钟；用户可被管理员禁用（登录拦截，保护最后一个可用管理员）
- 看板 WS 认证走 httpOnly Cookie；断线指数退避重连（1s 起封顶 30s），会话过期停止重连并回登录页
- 历史记录支持 keyset 游标分页（`beforeId`），深翻页不做 OFFSET 扫描
- 告警通知失败重试 1 次后记日志；规则级冷却防通知风暴；静默窗口免打扰
- 数据保留：`RETENTION_DAYS` 全局默认 + 系统级 `retention_days` 覆盖（0=永久），每日 03:05 分批清理（LIMIT 5000 防长事务）
- 管理操作全量审计（谁/何时/对什么/做了什么），用户名做快照不受删户影响
- `GET /api/health` 暴露 DB / MQTT / WS 连接状态

## 部署

```bash
docker compose up -d --build   # EMQX + app 两容器（MySQL 由 DB_HOST 指向外部实例）
```

- app 容器多阶段构建，健康检查走 `/api/health`；依赖注入 `depends_on: service_healthy`
- 生产务必通过环境变量覆盖 `JWT_SECRET` 与数据库口令（见 `.env.example`）
