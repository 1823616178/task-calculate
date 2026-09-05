# 代码审查报告（2026-09-05）

> 范围：全仓库（server / app / scripts / 部署配置 / 文档），仅分析未改动源码。
> 基线提交：`af1f0c9 初次提交`，分支 `main`。
> 结论：整体结构清晰（缓存、迁移、限流、审计、组件库均已到位），但存在若干会影响**生产正确性**与**安全性**的确定问题。

---

## 零、验证结果

| 检查项 | 命令 | 结果 |
| --- | --- | --- |
| 单元测试 | `npm test` | ✅ 7 个测试文件 / 67 个用例全部通过 |
| 生产构建 | `npm run build` | ✅ 成功，但告警：客户端存在 **570 KB** 单 chunk |
| 类型检查 | `nuxi typecheck` | ❌ **未执行** —— 项目未安装 `typescript` / `vue-tsc` |

现有测试集中在纯函数与 Zod schema（`tests/`：alerting、loginGuard、payload、semaphore、statsRetention、status、validation），
**没有** API 集成测试、数据库事务测试、WebSocket 测试、组件测试或端到端测试。
这正是下面 P0-1 这类"必然 500"的运行时错误能进入仓库的直接原因。

---

## 一、优先修复（P0）

### P0-1 用户更新接口在保存成功后必然抛 500

- 位置：`server/api/users/[id].put.ts:14`（`const current = requireAdmin(event)`）与 `server/api/users/[id].put.ts:46`
- 问题：第 46 行调用 `recordAudit(admin, ...)`，但作用域内**不存在 `admin` 变量**，实际变量名为 `current`。

影响链：

1. 密码 / 角色 / 启用状态**已经写入数据库**（`await repo.save(user)` 在前）；
2. 随后抛出 `ReferenceError`，接口返回 500；
3. 前端提示"失败"，管理员很可能重复操作（重复改密、反复切换角色）；
4. 该次变更**没有任何审计记录**，与 `audit_logs` 的设计目标相悖。

修复：`recordAudit(current, 'user.update', user.username, { ... })`。
建议同时补一条接口级测试覆盖"更新成功 → 返回 200 且写入审计"。

### P0-2 CI 没有做真正的 TypeScript 类型检查

- 位置：`package.json:5`（scripts 中无 `typecheck` / `lint`）、`.github/workflows/ci.yml:22`（只有 `npm test` 与 `npm run build`）
- 问题：Nuxt 的 `nuxt build` 不做完整类型检查，因此 P0-1 那种未定义变量可以一路通过 CI 合入。

建议：

- devDependencies 增加 `typescript`、`vue-tsc`；
- 增加脚本 `"typecheck": "nuxt typecheck"`；
- 引入 ESLint（或更轻的 Oxlint），至少开启 `no-undef` / `no-unused-vars` 等基础规则；
- CI 顺序调整为 **lint → typecheck → test → build**，任一失败即阻断。

### P0-3 并发与乱序上报会破坏 "metrics.last_*" 的最新状态语义

- 位置：`server/services/ingestService.ts:125`（`const prevStatus = metric.lastStatus`，`metric` 来自**共享缓存**）、
  `server/services/ingestService.ts:131`–`149`（事务内**无条件**更新 `lastValue/lastStatus/lastReportedAt`，随后再改写内存缓存）
- 问题：读取旧状态与写入新状态之间没有串行化，也没有比较 `reportedAt`。

同一指标并发上报或延迟报文到达时可能出现：

- **较旧的 `reportedAt` 覆盖较新的最新值**（last_* 与真实最新记录不一致）；
- 状态跃迁判定基于过期的 `prevStatus`，导致告警**重复发送、漏发或顺序颠倒**；
- WebSocket 看板被旧事件"回滚"到过期数值。

建议：

- 按指标维度串行化（进程内 per-metric 队列 / 互斥），或在事务中 `SELECT ... FOR UPDATE` 锁定指标行；
- `last_*` 仅在 `reportedAt` **不早于**已存值时更新；
- 跃迁判定使用事务锁内读到的 `lastStatus`，而不是缓存快照。

### P0-4 MQTT 通道没有实现 README 所述的 ApiKey 系统隔离

- 位置：`server/services/mqttService.ts:70`（`client.on('message', ...)`）、`server/services/mqttService.ts:93`（`await ingestData(payload, 'mqtt')`）
- 问题：`ingestData` 的系统隔离依赖 `options.expectedSystemId`（见 `server/services/ingestService.ts:117`），
  但 MQTT 分支**不传该参数**，等于跳过校验；topic 中的 `systemCode` 完全由发布方指定。

后果：任何能向 broker 发布消息的客户端，都可以向**任意系统**写入数据并触发告警/通知。
`docker-compose.yml:10` 默认把 1883 映射到宿主机，进一步放大暴露面。

建议（任选其一或组合）：

- 使用 EMQX 用户体系 + ACL，按系统划分 topic 前缀，由 broker 侧完成鉴权；
- 或在 payload / topic 中携带可校验凭证，解析后传入 `expectedSystemId`；
- Docker 示例默认不要暴露无保护的 1883 端口（或默认绑定 `127.0.0.1`）。

### P0-5 Docker 健康检查存在假阳性

- 位置：`server/api/health.get.ts:18`（DB/MQTT 全失败仍返回 HTTP 200，仅 JSON 里 `ok:false`）、
  `Dockerfile:37`（`wget -qO- .../api/health` 只看 HTTP 状态码）
- 后果：数据库或 MQTT 已断开时，容器仍被判定为 healthy，`depends_on: service_healthy`、编排滚动更新与外部探针全部失效。

建议：`ok === false` 时返回 **503**（保留 JSON body 便于排查），或让 HEALTHCHECK 解析 `ok` 字段。

---

## 二、重要改进（P1）

### 2.1 生产配置不应回退到固定 JWT 密钥

- `server/utils/jwt.ts:10`：`process.env.JWT_SECRET || 'dev-secret-change-me'`
- `docker-compose.yml:35`：`JWT_SECRET: ${JWT_SECRET:-dev-secret-change-me}`

已知默认密钥意味着任何人都能伪造管理员 token。建议：`NODE_ENV=production` 且缺少 `JWT_SECRET` 时**拒绝启动**，仅开发模式允许回退。

### 2.2 Seed 固定账号与固定 ApiKey

- `scripts/seed.ts:20`：固定创建 `admin` / `admin123`，并写入固定演示 ApiKey（`scripts/const.ts` 中的 `DEMO_API_KEY`）。

建议：限定为开发模式执行；生产首次启动改为生成随机密码并强制首次登录修改，演示 ApiKey 同理。

### 2.3 ApiKey 明文入库

- `server/database/entities/ApiKey.ts:21`：`key: { type: 'varchar', length: 64, unique: true }`

建议只保存 SHA-256/HMAC 摘要 + 用于展示的前缀（如 `ak_ab12…`），校验时比对摘要。
这样数据库泄露不会直接等同于所有系统的写入权限泄露。列表脱敏、创建时一次性返回明文的现有交互无需改动。

### 2.4 阈值关系校验只存在于前端

- 前端：`app/components/modals/MetricFormModal.vue:142` 的 `validateThresholds()` 校验 warnMin ≤ warnMax、alarmMin ≤ alarmMax、预警区间 ⊆ 告警区间；
- 服务端：`server/utils/validation.ts:53` 的 `metricInputSchema` 只校验每个阈值是有限数字，**接受倒置或互相冲突的区间**。

直接调用 API 可以创建"永远 warning/alarm"的指标，进而制造告警风暴。
建议把关系校验用 `.superRefine()` 下沉到共享 Zod schema，前后端复用同一份规则。

### 2.5 历史记录日期校验过弱

- `server/utils/validation.ts:67`：`from` / `to` 仅 `z.string().max(40)`。

非法日期字符串会一路进入 TypeORM，可能变成 500；同时**没有校验 `from < to`**。
统计与导出接口已采用更严格的校验，建议统一到同一个日期 schema。

### 2.6 CSV 未防公式注入

- `server/utils/csv.ts:2`：`csvEscape` 只处理引号 / 逗号 / 换行等**语法**转义。

以 `=`、`+`、`-`、`@` 开头的字段在 Excel / WPS / Numbers 中会被当作公式执行。
指标名称、单位等用户可控字段进入导出文件时存在公式注入风险。建议对这些前缀加 `'` 前置或包裹为文本。

### 2.7 HTTP / WS ingest 缺少并发与体积保护

MQTT 侧有信号量（`semaphore`）限流，但 HTTP 与 WebSocket 接入没有等价的并发上限、有界队列或请求体大小限制。
拿到有效 ApiKey 后可以制造大量数据库并发写入；"截断 payload"发生在**完整请求已读入内存之后**，无法防止大请求耗尽内存。

建议：接入层设置 body size limit、per-key 速率限制与有界并发队列，与 MQTT 侧保持一致。

---

## 三、前端与性能（P2）

集中在 `app/components/TrendChart.vue`：

| 问题 | 位置 | 说明 |
| --- | --- | --- |
| x 轴数据与 series 数据不同构 | `TrendChart.vue:228`、`:311` vs `:270` | xAxis 声明 `type: 'category'` 且 data 为**格式化标签**，series 的 data 用的是原始 ISO 时间；category 轴按值匹配刻度，易出现数据与刻度错位 |
| tooltip 显示全局极值 | `TrendChart.vue:294` | `min`/`max` 取整段数据的 `Math.min/max`，而非当前 hover 桶的极值 |
| 辅助系列过滤不完整 | `TrendChart.vue:294` 附近 | 只过滤了 `-band` 后缀，`-band-base` 系列会漏进 tooltip 产生多余行 |
| formatter 拼接 HTML 未转义 | tooltip `formatter` | 指标名称直接拼进 HTML，存在**存储型 HTML 注入**风险 |
| 竞态：慢请求覆盖新结果 | `load()` | 多次调用没有取消或请求序号保护，较慢的旧请求可能覆盖新筛选结果 |
| selected 初始化时机 | 组件 setup | `selected` 只在组件创建时从 props 初始化；首屏数据异步到达后不会自动选中前三项 |

**打包体积**：生产构建提示一个 570 KB 客户端 chunk，确认主要来自 ECharts。
建议仅在"趋势"标签实际打开时懒加载 `TrendChart` 及 ECharts（`defineAsyncComponent` + 动态 `import`），首屏可省下绝大部分体积。

---

## 四、文档一致性问题

| 文件 | 问题 | 建议 |
| --- | --- | --- |
| `doc/usage-api.md:1` | 内容是另一个"AI 额度仪表盘"项目的接口文档，与本仓库无关 | 删除、移出仓库，或在开头明确标注来源与适用范围 |
| `doc/ui-refactor-plan.md:8` | 仍把"没有布局层和组件库"描述为**当前现状**，但改造已基本落地；验收清单全部未勾选 | 改为归档实施记录，标注完成状态与实际落地情况 |
| `README.md:21`、`README.md:154` | 称 `docker compose` 启动 **MySQL + EMQX + app 三容器**，实际 `docker-compose.yml:1` 只有 emqx 与 app，MySQL 指向宿主机（`host.docker.internal`） | 更正为"两容器 + 外部 MySQL"，并补充宿主机 MySQL 的前置要求 |
| `README` 端口 vs `scripts/demo-publish.ts:8` | README 默认端口 48980，演示脚本默认请求 `http://127.0.0.1:3001`，且脚本**没有像 seed 一样加载 `.env`** | 按 README 执行 `npm run demo` 通常直接失败；脚本应加载 `.env` 并以 `PORT` 为默认值 |
| `doc/class-naming.md` | 规范禁止页面硬编码 px，但当前页面仍有大量宽度 / 间距 / 字号硬编码 | 要么补齐 token 化改造，要么把规范调整为与实际执行一致 |

---

## 五、建议修复顺序

1. **P0-1 + P0-2**：修掉 `recordAudit(admin)` 运行时错误，同时补上 typecheck / lint 与 CI 阻断——先堵住"同类问题继续进生产"的口子。
2. **P0-3 + P0-4**：ingest 顺序一致性（per-metric 串行化 / 行锁 + `reportedAt` 比较）与 MQTT 侧鉴权。
3. **P0-5 + 2.1**：健康检查返回 503；生产缺少 `JWT_SECRET` 时拒绝启动。
4. **API 集成测试**：覆盖用户更新、ingest 并发与乱序、鉴权边界、健康检查状态码。
5. **收口**：趋势图 6 项问题 + ECharts 懒加载 + 文档一致性。

---

## 附：本次审查检查清单

- [ ] P0-1 `server/api/users/[id].put.ts:46` 未定义变量 `admin`
- [ ] P0-2 缺少 typecheck / lint，CI 未阻断类型错误
- [ ] P0-3 ingest 并发与乱序破坏 `metrics.last_*`
- [ ] P0-4 MQTT 通道未传 `expectedSystemId`
- [ ] P0-5 健康检查假阳性（始终 200）
- [ ] P1 JWT 默认密钥 / seed 固定口令 / ApiKey 明文 / 阈值与日期校验 / CSV 公式注入 / ingest 限流
- [ ] P2 TrendChart 六项问题 + 570 KB chunk 懒加载
- [ ] 文档：usage-api 归属、ui-refactor 归档、README 容器与端口、class 规范落地
