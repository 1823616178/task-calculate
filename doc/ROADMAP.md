# 功能规划（Roadmap）

基于现有架构（三通道接收 / 阈值判定 / 实时看板）的迭代规划。阶段一、二已全部完成，阶段三完成大部分。
工作量按单人投入估算，仅供参考。

---

## 阶段一：告警与运营闭环 ✅ 已完成

### 1. 告警通知渠道（邮件 / Webhook / 钉钉 / 企业微信机器人）✅

- **实现**：
  - `alert_channels`（type: webhook/dingtalk/wecom/email，target，secret 加签，enabled）、
    `alert_rules`（指标 × 渠道唯一，notifyWarning/notifyAlarm，规则级冷却 cooldownSeconds）
  - 触发点：`ingestService` 状态**跃迁**进入 warning/alarm 时 fire-and-forget 调用 `dispatchAlertNotifications`
  - 防通知风暴：跃迁判定（持续状态不重发）+ 规则级冷却；发送失败重试 1 次后记日志
  - 渠道实现：Webhook（POST JSON）/ 钉钉（HMAC-SHA256 加签）/ 企业微信（markdown）/ 邮件（nodemailer，SMTP 走环境变量）
  - UI：`/channels` 渠道管理页 + 系统详情页告警规则组件；渠道支持一键测试发送
- **状态**：已完成，端到端冒烟验证通过

### 2. 告警静默窗口（维护模式）✅

- **实现**：`silence_rules` 支持 全局/系统/指标 三级作用域与时间窗；命中静默照常入库只跳过通知；
  UI 在系统详情页配置（含 生效中/未开始/已结束 状态标识）。
- **状态**：已完成

### 3. ApiKey 管理界面 ✅

- **实现**：`/api/api-keys` CRUD + 轮换（旧 Key 立即失效）；`api_keys.last_used_at` 使用追踪（60s 节流回写）；
  列表脱敏展示；完整 key 仅创建/轮换时返回一次；UI 在系统详情页。
- **状态**：已完成

### 4. 用户管理 ✅

- **实现**：`/api/users` CRUD；users.enabled 字段 + 登录拦截；角色分配、重置密码；
  保护当前登录用户与最后一个可用管理员（禁用/降级/删除均校验）；UI `/users` 页。
- **状态**：已完成
- **已知边界**：已签发的 JWT 在有效期内（24h）仍可通过 API 认证，直到过期或重启前无法强制踢出——如需立即生效可在 requireAuth 增加用户状态查询（有 DB 开销）。

---

## 阶段二：数据分析与展示 ✅ 已完成

### 5. 历史趋势图表 ✅

- **实现**：系统详情页 TrendChart 组件（echarts/core 按需引入：Line/Grid/Tooltip/Legend/Canvas）；
  指标多选（默认前 3 个）、时间范围 1h/6h/24h/7d、聚合窗口 auto/1m/5m/15m/1h/1d；
  tooltip 展示均值与最小/最大；窗口自适应保证 ≤240 点。

### 6. 聚合统计 API ✅

- **实现**：`GET /api/metrics/:id/stats`——SQL 侧 `FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(...)/step)*step)` 分桶，
  返回每桶 min/max/avg/count；auto 窗口按跨度自动选步长；范围上限一年；参数 zod 校验。
- **冒烟**：窄窗隔离数据验证 min/max/avg/count 精确匹配。

### 7. 数据保留策略 ✅

- **实现**：`systems.retention_days` 系统级覆盖 + 全局 `RETENTION_DAYS`（env），0=永久；
  Nitro 定时任务 `records:cleanup` 每日 03:05 执行，分批 `DELETE ... LIMIT 5000` 防长事务；
  admin 可 `POST /api/maintenance/cleanup` 手动触发；系统编辑页可配置保留天数。
- **冒烟**：200 天前记录在策略生效后被清理、近期记录不受影响。

### 8. 记录导出 CSV ✅

- **实现**：`GET /api/records/export`——同 /api/records 筛选参数，async generator 分批
  （keyset 推进，无 OFFSET）流式输出，limit 上限 10 万；带 UTF-8 BOM，Excel 中文不乱码；前端一键导出。

---

## 阶段三：横向扩展与工程化（大部分完成）

### 9. 多实例部署支持 ⏳ 暂缓

- **背景**：当前为单实例假设——metric 缓存、broadcast peers、loginGuard、告警冷却、WS 会话均在进程内存。
- **方案**（按优先级）：
  - MQTT：改用 EMQX 共享订阅 `$share/g1/metric/+/+`，多实例不重复消费
  - 广播：Redis pub/sub 替代进程内 `broadcastService` 的 peers 集合（WS 连接仍各自持有）
  - 限流/缓存/冷却：loginGuard、ApiKey 缓存与告警冷却迁移 Redis
- **暂缓原因**：依赖 Redis 基础设施选型与部署形态确认，单实例阶段收益有限；其余改造均已模块化，迁移面收敛在 broadcastService/loginGuard/alertingService 三处。

### 10. 部署交付物 ✅

- **实现**：多阶段 Dockerfile（node:22-alpine，产物 + 生产 node_modules 合并解决 TypeORM 动态 require 驱动问题）；
  docker-compose 增加 app 服务（depends_on healthcheck 门控）；HEALTHCHECK 接 `/api/health`；
  GitHub Actions CI（npm ci → test → build）。
- **验证**：镜像构建成功；容器以 host 网络连宿主机 MySQL/EMQX 实测 health ok:true、登录/上报 200。

### 11. 审计日志 ✅

- **实现**：`audit_logs` 表（操作者快照/动作/目标/详情 JSON）；全部管理接口埋点
  （系统/指标/ApiKey 含轮换/用户/通知渠道含测试发送/规则/静默/保留清理）；
  `GET /api/audit` 分页查询（username 精确 + action 前缀 + 时间范围）；UI `/audit` 页。

### 12. 界面体验 ◐ 部分

- **已完成**：暗色模式——颜色变量全面 CSS 化（`:root` / `html[data-theme='dark']`），
  首屏内联脚本防闪烁（FOUC），看板头部切换按钮，localStorage 持久化。
- **待办**：移动端适配、alert/confirm 换 toast 组件。

---

## 技术债观察清单

- `ingestData` 全管道无单测（需测试库或 DB mock，可评估 testcontainers）
- records 的偏移分页与游标分页并存，前端完全切到游标后可移除偏移路径
- 登录限流/ApiKey 缓存/告警冷却为进程内存实现，多实例前需迁移 Redis（见第 9 项）
- JWT 无刷新机制：过期即整体重登，长会话场景可加 refresh token；已签发 token 在有效期内无法强制踢出
- Docker 镜像通过合并生产 node_modules 解决动态依赖，镜像体积有优化空间（可探索 strict ESM 驱动或 prisma 风格引擎）
