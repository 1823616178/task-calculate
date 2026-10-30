# task-calculate 接入文档（API Integration Guide）

> 适用对象：需要向平台**上报检测值**的业务系统 / 设备 / 脚本，以及需要**读取数据、管理配置或接收告警**的第三方系统；同时面向人类开发者与 AI 编码代理。
>
> 文档对照实现：`server/` 目录，核对日期 2026-09-20。接口无版本前缀，字段以本文与源码为准。
>
> **AI 代理阅读提示**：先读 [§0 速查契约](#0-速查契约给-ai-与赶时间的人)，它是完整、自洽的最小接入规范；需要细节时按章节号跳转。示例字段、状态码与当前源码一致，示例 id 和时间仅用于说明。

---

## 目录

- [0. 速查契约（给 AI 与赶时间的人）](#0-速查契约给-ai-与赶时间的人)
- [1. 核心概念](#1-核心概念)
- [2. 接入流程与最小示例](#2-接入流程与最小示例)
- [3. 通用约定](#3-通用约定)
- [4. 数据上报（ApiKey 认证）](#4-数据上报apikey-认证)
  - [4.1 统一报文](#41-统一报文)
  - [4.2 HTTP 通道](#42-http-通道)
  - [4.3 WebSocket 通道](#43-websocket-通道)
  - [4.4 MQTT 通道](#44-mqtt-通道)
  - [4.5 限流与容量](#45-限流与容量)
  - [4.6 错误与重试策略](#46-错误与重试策略)
  - [4.7 各语言示例](#47-各语言示例)
- [5. 状态判定规则](#5-状态判定规则)
- [6. 查询与管理 API（JWT / ApiKey 认证）](#6-查询与管理-apijwt--apikey-认证)
  - [6.0 权限一览](#60-权限一览)
  - [6.1 认证](#61-认证)
  - [6.2 健康检查](#62-健康检查)
  - [6.3 系统 Systems](#63-系统-systems)
  - [6.4 指标 Metrics](#64-指标-metrics)
  - [6.5 历史记录 Records](#65-历史记录-records)
  - [6.6 ApiKey](#66-apikey)
  - [6.7 告警](#67-告警)
  - [6.8 用户](#68-用户)
  - [6.9 审计与维护](#69-审计与维护)
- [7. 实时推送 /ws/dashboard](#7-实时推送-wsdashboard)
- [8. 告警出站通知格式（Webhook 接收方）](#8-告警出站通知格式webhook-接收方)
- [9. 数据模型](#9-数据模型)
- [10. 注意事项与已知行为](#10-注意事项与已知行为)
- [附录 A：TypeScript 类型定义](#附录-atypescript-类型定义)
- [附录 B：接入自检清单](#附录-b接入自检清单)

---

## 0. 速查契约（给 AI 与赶时间的人）

```yaml
service: task-calculate（数据检测汇总平台）
base_url: http://<host>:48980        # 开发默认端口，生产以部署为准；无路径前缀
content_type: application/json; charset=utf-8
cors: 未开启（浏览器跨域直调会失败，请从服务端调用）

# ---- 上报（写入检测值）----
ingest_auth: ApiKey（正式生成格式为 dk_ + 24 位十六进制；要求 data:write）
api_key_scope: permissions 控制能力；systemIds 控制系统集合；allSystems=true 表示全部现有及未来系统
ingest_prerequisite: system 与 metric 必须由管理员预先创建；平台不会自动建指标
ingest_payload:                      # 三个通道完全一致
  systemCode: string, 1..64, 必填
  metricCode: string, 1..64, 必填
  value:      number, 有限数, 必填；服务端四舍五入到 2 位小数（不要传 null/""/布尔）
  timestamp:  string, ≤40, 可选, 推荐 ISO 8601 且带时区，如 "2026-09-17T10:00:00+08:00"；缺省=服务端收到时间
  # 其他字段允许携带，会随原始报文截断(2048 字符)存档，但不参与业务
batch: 不支持，一条报文一个值

http:
  request: POST /api/ingest
  headers: { X-Api-Key: <key>, Content-Type: application/json }   # 必须带 Content-Length（勿用 chunked）
  success: 200 {"recordId": 123, "status": "normal|warning|alarm|none"}
  errors:  400 报文非法 | 401 Key 无效/禁用 | 403 Key 不属于该 systemCode(或 systemCode 不存在)
           | 404 metricCode 不存在 | 411 缺 Content-Length | 413 >64KB | 429 限流/过载 | 500
  retry:   仅 429/5xx/网络错误 可退避重试；4xx(除429) 不要重试

websocket:
  url: ws://<host>:48980/ws/ingest
  flow: 连接 → 收 {"type":"auth.required"} → 发 {"apiKey":"<key>"} → 收 {"type":"auth.ok"}
        → 每帧发一条报文 → 收 {"type":"ingest.ok","recordId":..,"status":..} 或 {"type":"error","message":..}
  notes: 认证失败服务端会关闭连接；回执不带请求 id 且可能乱序；Key 被禁用/轮换后下一帧收到 "api key revoked" 并断开

mqtt:
  broker: EMQX, tcp 1883（地址/账号由部署方提供）
  topics: "metric/{systemCode}/{metricCode}" payload {"apiKey":"<key>","value":87.5,"timestamp"?:"..."}
          "ingest"                           payload {"apiKey":"<key>","systemCode":..,"metricCode":..,"value":..,"timestamp"?:..}
  notes: 服务端以 QoS0 订阅（至多一次）、无回执；不要设置 retain；payload 中同名字段优先于主题

limits: 每 Key 20 条/秒(突发 50)；HTTP 另有每 IP 50 次/秒(突发 100)；单报文 ≤64KB

# ---- 读取/管理 ----
read_auth: ApiKey 用 Header "X-Api-Key: <key>" 或登录后的 tc_api_key Cookie；账号登录用 JWT/Cookie
read_scope: JWT 可读全部系统；ApiKey 要求 data:read，只能读取 systemIds/allSystems 授权范围，越权返回 403
read_endpoints: GET /api/systems*、/api/records*、/api/metrics/:id/stats，以及 /ws/dashboard
read_limits: REST 每 Key 5/s(突发20)，每 IP 20/s(突发50)；JWT 查询不经过这组 ApiKey 限流
management_auth: admin JWT 拥有全部权限；ApiKey 可按 permissions 调用管理接口，并继续受系统范围限制
api_key_login: 具有 data:read 的 Key 可 POST /api/auth/login {"apiKey":"dk_..."}，成功写入 httpOnly tc_api_key Cookie
roles: viewer 只读（系统/记录/统计/导出）；admin 全部
error_body: {"error":true,"url":"...","statusCode":400,"statusMessage":"...","message":"..."}
realtime: ws://<host>:48980/ws/dashboard?token=<jwt> 或 ?apiKey=<key> → 推送 {"type":"metric.update","data":{...}}
```

---

## 1. 核心概念

| 概念 | 说明 | 标识 |
|---|---|---|
| **System（系统）** | 一个数据来源方，如"一号产线"。 | `code`（全局唯一，字母/数字/`_`/`-`，创建后不可改）+ 数字 `id` |
| **Metric（指标）** | 系统下的一个检测项，如"温度"，带单位与阈值。 | `code`（系统内唯一，创建后不可改）+ 数字 `id` |
| **ApiKey** | 可登录控制台或直接调用 API 的凭证。`permissions` 控制功能，`systemIds` / `allSystems` 控制系统范围；明文仅在创建/轮换时返回一次，库内只存 SHA-256 摘要。 | 正式生成：`dk_` + 24 位十六进制 |
| **Record（记录）** | 每条上报产生一条历史记录，含值、判定状态、通道、原始报文。 | 数字 `id`（JSON 中为**字符串**，见 §10） |
| **Status（状态）** | `normal` 正常 / `warning` 预警 / `alarm` 告警 / `none` 未配置阈值。 | — |
| **User（用户）** | 看板/管理 API 的使用者，角色 `admin` 或 `viewer`。 | JWT |
| **告警** | 通知渠道（webhook/钉钉/企微/邮件）× 规则（指标 → 渠道）× 静默窗口。 | — |

上报寻址用 **code**（`systemCode` + `metricCode`），管理 API 用数字 **id**。

---

## 2. 接入流程与最小示例

```
 管理员（admin JWT）                                   数据提交方（ApiKey）
 ───────────────────                                   ───────────────────
 ① POST /api/systems        创建系统 → 得 system.id
 ② POST /api/metrics        在系统下创建指标并配阈值
 ③ POST /api/api-keys       设置 permissions + 系统范围，签发 Key → 明文 key（仅此一次）
                    ── 线下安全交付 systemCode / metricCode 列表 / key ──▶
                                                       ④ 任选 HTTP / WS / MQTT 上报
                                                       ⑤ 根据返回 status 或错误码处理
 ⑥（可选）第三方用同一 Key 登录控制台、调用已授权 API，并从 /ws/dashboard 接收授权系统
```

也可以在 Web 界面完成：①② 在系统管理页，③ 在顶级“ApiKey”管理页。开发环境 `npm run seed` 已预置：

| 项 | 值 |
|---|---|
| 管理员 | `admin` / `admin123` |
| 系统 | `line1`（一号产线） |
| 指标 | `temp`（℃，预警 10~70，告警 0~90）、`humidity`（%RH，预警 30~70，告警 10~90）、`pressure`（kPa，预警 80~120，告警 50~150） |
| ApiKey | `dk_line1_6f3a9c2e8b1d4f70` |

> `dk_line1_...` 是仅用于开发联调的固定 seed Key，不符合正式随机 Key 的格式；生产环境执行 seed 时会改为随机生成且只打印一次。

**示例：用 curl 完成 ①②③**

```bash
BASE=http://127.0.0.1:48980
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | jq -r .token)
AUTH="Authorization: Bearer $TOKEN"

SYS_ID=$(curl -s -X POST $BASE/api/systems -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"code":"boiler2","name":"二号锅炉","description":"锅炉房","retentionDays":180}' | jq .system.id)

curl -s -X POST $BASE/api/metrics -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"systemId\":$SYS_ID,\"code\":\"water_temp\",\"name\":\"出水温度\",\"unit\":\"℃\",\"warnMin\":40,\"warnMax\":85,\"alarmMin\":20,\"alarmMax\":95}"

curl -s -X POST $BASE/api/api-keys -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"systemIds\":[$SYS_ID],\"permissions\":[\"data:read\",\"data:write\"],\"name\":\"锅炉 PLC 网关\"}"
# => {"apiKey":{"id":2,"systemIds":[2],"allSystems":false,"permissions":["data:read","data:write"],"name":"锅炉 PLC 网关","enabled":true,"key":"dk_9f0c..."}}
```

**示例：用一个 ApiKey 完成“上报 → 快照 → 历史”闭环**

```bash
BASE=http://127.0.0.1:48980
API_KEY=dk_line1_6f3a9c2e8b1d4f70

# 1. 上报；curl 会自动发送 Content-Length
curl -sS -X POST "$BASE/api/ingest" \
  -H "X-Api-Key: $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"systemCode":"line1","metricCode":"temp","value":66.6}'

# 2. 获取授权系统及全部指标当前值（seed Key 只授权 line1）
curl -sS "$BASE/api/systems" -H "X-Api-Key: $API_KEY"

# 3. 不依赖数字 id，按 code 查询最近历史
curl -sS "$BASE/api/systems/by-code/line1/records?metricCode=temp&pageSize=20" \
  -H "X-Api-Key: $API_KEY"
```

上面的 seed Key 具有 `data:read`、`data:write`，系统范围为 `[line1]`，因此也可用于 `GET /api/records`、导出、统计和 `/ws/dashboard`，但不能调用管理接口。

---

## 3. 通用约定

### 3.1 基址与传输

| 项 | 值 |
|---|---|
| 默认基址 | `http://<host>:48980`（`PORT` 环境变量可改；生产通常经反向代理走 HTTPS/WSS） |
| 路径前缀 | 无，REST 在 `/api/*`，WebSocket 在 `/ws/*` |
| 编码 | 请求/响应均为 UTF-8 JSON（CSV 导出除外） |
| CORS | **未开启**。浏览器页面跨域调用会被拦截，请从后端调用或同源部署 |
| 健康检查 | `GET /api/health`（无需认证） |

### 3.2 认证方式

| 用途 | 方式 | 适用接口 |
|---|---|---|
| 数据上报 | 具有 `data:write` 的 ApiKey：HTTP 头 `X-Api-Key`；WS 首帧 `{"apiKey"}`；MQTT payload 字段 `apiKey` | `/api/ingest`、`/ws/ingest`、MQTT |
| 数据查询 | 具有 `data:read` 的 `X-Api-Key: <key>`，或 JWT /登录 Cookie | 系统/记录/导出/统计的 GET 接口、`/ws/dashboard` |
| 管理操作 | admin JWT，或具有相应管理 permission 的 ApiKey；ApiKey 仍受系统范围约束 | 增删改、用户、ApiKey、告警、审计与维护接口 |
| 控制台登录 | 用户名/密码，或 `POST /api/auth/login {"apiKey":"dk_..."}` | 写入 `tc_token` 或 `tc_api_key` httpOnly Cookie |

```http
# ApiKey：按 permissions 和系统范围调用
X-Api-Key: dk_...

# JWT：admin 全权限，viewer 只读
Authorization: Bearer eyJhbGciOi...
```

- JWT 由 `POST /api/auth/login` 签发，有效期 **24 小时**，无刷新接口，过期后重新登录。
- ApiKey 登录不签发 JWT，响应 `token` 为 `null`，而是写入有效期 24 小时的 `tc_api_key` httpOnly Cookie；每次请求都会重新解析 Key（受最多约 30 秒缓存影响）。
- REST 查询的 ApiKey 限额为每 Key 5 次/秒、突发 20 次；鉴权前另有每 IP 20 次/秒、突发 50 次。JWT 查询不经过这组 ApiKey 限流。
- 查询接口同时带两种凭证时，有效 JWT / 登录 Cookie 优先，按用户权限读取；否则尝试 `X-Api-Key`。
- 任意 REST API 都可直接发送 `X-Api-Key`；Key 有效但缺少所需 permission，或资源超出授权系统范围时返回 403。
- ApiKey 与 JWT 都是 Bearer 凭证。只通过 HTTPS/WSS 传输，不写入仓库、URL、日志或错误信息；唯一例外是浏览器原生 WebSocket 连接 `/ws/dashboard` 时可选的 `?apiKey=` 兼容方式（见 §7）。

### 3.3 时间格式

- **响应**中的时间均为 ISO 8601 UTC，例如 `"2026-09-17T09:19:40.000Z"`。
- **查询参数**（`from`/`to`/`startAt`/`endAt`）必须是带时区的 ISO 8601：`2026-09-17T00:00:00Z` 或 `2026-09-17T08:00:00+08:00`。不带时区会返回 400。
- 上报 `timestamp` 当前由 JavaScript `Date` 解析，能解析但不带时区的字符串会使用服务端本地时区，存在歧义；接入方仍应始终发送带 `Z` 或显式偏移的 ISO 8601。
- 记录时间存储精度为**秒**。实时 `metric.update.reportedAt` 可能仍带输入的毫秒，但历史查询会显示数据库持久化后的秒级时间。

### 3.4 错误响应格式

所有 REST 错误返回统一结构，HTTP 状态码与 `statusCode` 一致：

```json
{
  "error": true,
  "url": "http://127.0.0.1:48980/api/ingest",
  "statusCode": 404,
  "statusMessage": "unknown metricCode: nope (system: line1)",
  "message": "unknown metricCode: nope (system: line1)"
}
```

程序判断请用 **HTTP 状态码**；`message` 是给人看的（部分管理接口为中文），不保证稳定。参数校验失败的 `message` 形如 `字段路径: 原因; 字段路径: 原因`。

通用状态码：

| 码 | 含义 |
|---|---|
| 400 | 参数/报文校验失败、非法 id |
| 401 | 未认证或凭证无效/过期 |
| 403 | 无权限（非 admin 调用管理接口；ApiKey 越权读写其他系统） |
| 404 | 资源不存在 |
| 409 | 唯一性冲突（code/用户名/规则重复） |
| 411 / 413 | 上报缺 Content-Length / 请求体过大 |
| 429 | 限流或过载 |
| 5xx | 服务端错误（可重试） |

### 3.5 JSON、ID 与数值约定

- JSON 字段使用 `camelCase`；未说明的额外字段通常会被忽略。上报报文例外：额外字段会随原始 `payload` 存档。
- 普通实体 id 是 number；MySQL `bigint` 字段（历史记录、审计日志）在列表 JSON 中是 string。`recordId` 与 `nextCursor` 为 number，详见 §10。
- 可清空字段在更新时传 JSON `null`；省略表示“不修改”。
- 布尔字段应传 JSON `true`/`false`，不要传字符串。特别是告警规则的 `z.coerce.boolean()` 会把非空字符串 `"false"` 也转成 true。
- 上报 `value` 先转换为 number，再以 `Math.round(value * 100) / 100` 四舍五入到两位小数；入库、状态判定、响应与推送都使用舍入后的值。

---

## 4. 数据上报（ApiKey 认证）

三个通道共用同一条处理管道：**校验报文 → 校验 Key 与系统绑定 → 解析指标 → 阈值判定 → 事务入库 → 看板推送 → （状态跃迁时）异步告警**。选哪个通道只取决于你的环境：

| 通道 | 适合 | 有无回执 | 投递保证 |
|---|---|---|---|
| HTTP | 绝大多数服务端/脚本，低频到中频 | 有（同步返回） | 由调用方重试保证 |
| WebSocket | 长连接、中高频持续上报，省握手开销 | 有（异步帧，无请求 id） | 由调用方保证 |
| MQTT | IoT 设备/网关，已有 MQTT 基础设施 | **无** | 至多一次（QoS0） |

### 4.1 统一报文

```json
{
  "systemCode": "line1",
  "metricCode": "temp",
  "value": 87.5,
  "timestamp": "2026-09-17T17:30:00+08:00"
}
```

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| `systemCode` | string | 是 | 去首尾空格后 1~64 字符；必须是 **ApiKey 授权系统** 的 code |
| `metricCode` | string | 是 | 去首尾空格后 1~64 字符；必须是该系统下**已存在**的指标 |
| `value` | number | 是 | 有限数（非 NaN/Infinity）。数字字符串如 `"87.5"` 会被转换接受，并四舍五入到两位小数 |
| `timestamp` | string | 否 | 数据实际采集时间，≤40 字符，建议 ISO 8601 **带时区**。省略则取服务端接收时间。纯数字时间戳（如 `"1789636780000"`）不受支持，会 400 |

补充：

- **不支持批量**：请求体必须是单个 JSON 对象，数组会返回 400。
- **额外字段**：允许携带（如 `"deviceId"`、`"seq"`），不参与业务，但会随原始报文存入记录的 `payload` 字段（超过 2048 字符截断）。可用于追溯，但不要放口令、token 等敏感信息。MQTT payload 中的顶层 `apiKey` 会在入库前剥离；HTTP/WS 请求本来就不应把 Key 放进业务报文。
- **不要**把 `value` 传成 `null`、`""`、`true/false`：它们会被强制转换为 `0`/`1` 并被接受，产生错误数据。
- **小数精度**：如 `33.335` 会按当前 JavaScript 浮点与舍入规则保存为 `33.34`；阈值判断也使用 `33.34`。
- **乱序/补报**：`timestamp` 早于该指标已记录的最新时间时，数据**照常入库**（可在历史/统计中看到），但不会更新指标"最新值"、不推送看板、不触发告警。
- **同秒时间戳**：数据库只保存到秒；两条报文落在同一秒时，后处理完成的报文可能覆盖指标最新值，即使其原始毫秒略早。需要严格顺序时让时间戳至少按秒递增，或在上游串行发送。
- **未来时间**：带明显超前的 `timestamp` 会成为"最新值"，之后所有早于它的正常上报都被视为过期报文，直到真实时间追上。请保证设备时钟准确，或省略 `timestamp`。

### 4.2 HTTP 通道

```http
POST /api/ingest HTTP/1.1
Host: 127.0.0.1:48980
Content-Type: application/json
Content-Length: 58
X-Api-Key: dk_line1_6f3a9c2e8b1d4f70

{"systemCode":"line1","metricCode":"temp","value":66.6}
```

**成功** `200`：

```json
{"recordId": 1, "status": "normal"}
```

| 字段 | 说明 |
|---|---|
| `recordId` | 新记录 id（number） |
| `status` | 本条值的判定结果：`normal`/`warning`/`alarm`/`none` |

**失败**：

| 状态码 | message 示例 | 原因 | 处理 |
|---|---|---|---|
| 400 | `invalid payload: metricCode: Invalid input: expected string, received undefined` | 字段缺失/类型错/数组 | 修正报文，不重试 |
| 400 | `invalid timestamp: xxx` | 时间无法解析 | 修正格式 |
| 401 | `invalid api key` | Key 缺失、错误、被禁用、被删除或已轮换 | 联系管理员，不重试 |
| 403 | `api key not allowed for this system` | 缺少 `data:write`，或 `systemCode` 不在 Key 授权范围（**系统不存在也返回 403**） | 核对 permission 与 systemCode |
| 404 | `unknown metricCode: xxx (system: line1)` | 指标未创建 | 请管理员建指标 |
| 411 | `content-length required` | 使用了 `Transfer-Encoding: chunked` | 发送定长请求体 |
| 413 | `payload too large` | 请求体 > 64 KB | 精简报文 |
| 429 | `rate limited` / `too many concurrent requests` | 超出限流或服务繁忙 | 退避重试 |
| 500 | `internal ingest error` | 服务端异常（如数据库不可用） | 退避重试 |

> 注意：Key 校验先于报文校验。401 时不会检查报文内容。

### 4.3 WebSocket 通道

地址：`ws://<host>:48980/ws/ingest`（HTTPS 部署下为 `wss://`）。所有帧均为 **JSON 文本帧**。

**时序**

```
客户端                                    服务端
  │──────── WebSocket 握手 ────────────────▶│
  │◀── {"type":"auth.required","message":"send {\"apiKey\":\"...\"} first"}
  │── {"apiKey":"dk_line1_6f3a9c2e8b1d4f70"} ▶│
  │◀── {"type":"auth.ok"}                    │   （Key 无效：{"type":"error","message":"invalid api key"} 后断开）
  │── {"systemCode":"line1","metricCode":"temp","value":66} ▶│
  │◀── {"type":"ingest.ok","recordId":2,"status":"normal"}   │
  │── {"systemCode":"line1","metricCode":"nope","value":1}  ▶│
  │◀── {"type":"error","message":"unknown metricCode: nope (system: line1)"}
```

**服务端下行消息**

| type | 字段 | 含义 | 连接是否保持 |
|---|---|---|---|
| `auth.required` | `message` | 连接建立，请发送认证帧 | 是 |
| `auth.ok` | — | 认证成功 | 是 |
| `ingest.ok` | `recordId`, `status` | 一条报文入库成功 | 是 |
| `error` | `message` | 见下表 | 视情况 |

| error.message | 原因 | 连接 |
|---|---|---|
| `invalid api key` | 认证帧 Key 无效（或首帧不是认证帧） | **关闭** |
| `api key revoked` | 已认证后 Key 被禁用/删除/轮换 | **关闭** |
| `invalid JSON` | 帧不是合法 JSON | 保持 |
| `frame too large` | 单帧 > 64 KB | 保持 |
| `rate limited` | 超出每 Key 速率 | 保持 |
| `too many concurrent requests` | 服务繁忙 | 保持 |
| `invalid payload: ...` / `invalid timestamp: ...` | 报文校验失败 | 保持 |
| `api key not allowed for this system` | 越权 systemCode | 保持 |
| `unknown metricCode: ...` | 指标不存在 | 保持 |
| `internal ingest error` | 服务端异常 | 保持 |

**客户端实现要点**

1. 未认证前发送的第一帧**一律被当作认证帧**；不要在 `auth.ok` 之前发数据。
2. 回执**不含请求 id**，且多帧并发处理时**回执顺序可能与发送顺序不一致**。需要逐条确认时，采用"发一条、等一条回执、再发下一条"，或在报文里加自定义字段自行对账（服务端不会回显）。
3. 服务端没有应用层心跳。连接断开（网络、代理空闲超时、服务重启、Key 失效）后应指数退避重连（如 1s 起、上限 30s），重连后重新认证。
4. 收到 `rate limited` 应降低发送速率。

### 4.4 MQTT 通道

平台服务端常驻订阅 Broker（EMQX）上的两个主题，Broker 地址与连接账号由部署方提供（默认 `mqtt://<host>:1883`）。**ApiKey 放在 payload 里**，与 Broker 的连接账号无关。

**方式一：主题携带 code（推荐）**

```
Topic:   metric/line1/temp
Payload: {"apiKey":"dk_line1_6f3a9c2e8b1d4f70","value":87.5,"timestamp":"2026-09-17T17:30:00+08:00"}
```

**方式二：统一主题**

```
Topic:   ingest
Payload: {"apiKey":"dk_line1_6f3a9c2e8b1d4f70","systemCode":"line1","metricCode":"pressure","value":100}
```

规则：

- payload 必须是 JSON **对象**且包含字符串 `apiKey`；裸数字（如 `87.5`）会因缺 Key 被丢弃。
- 方式一中若 payload 也写了 `systemCode`/`metricCode`，**以 payload 为准**。
- `apiKey` 在入库前被剥离，不会存入记录。
- **没有回执**：成功或失败都只写服务端日志（`[mqtt] ingested ...` / `[mqtt] rejected message ...`）。上报方无法得知 401/403/404 类错误，接入时请先用 HTTP 通道验证 Key、code 与报文正确，再切到 MQTT。
- 服务端以 **QoS 0** 订阅，端到端最多为"至多一次"；服务端或 Broker 断线期间的消息会丢失。需要可靠投递请用 HTTP 并自行重试。
- **不要设置 retain 标志**：保留消息会在服务端每次重连订阅时被重复入库。
- 服务端消费并发 20、排队上限 500，洪峰溢出的消息被丢弃并记日志。

### 4.5 限流与容量

| 维度 | 限制 | 超限表现 |
|---|---|---|
| 上报每 ApiKey（HTTP、WS 各自独立计数） | 令牌桶：20 条/秒，突发 50 | HTTP 429 / WS `rate limited` |
| HTTP 上报每客户端 IP（校验 Key 之前） | 50 次/秒，突发 100 | HTTP 429 |
| 单请求体 / 单帧 | 64 KB | HTTP 413 / WS `frame too large` |
| HTTP 并发处理 | 50 并发 + 200 排队 | HTTP 429 |
| WS 并发处理 | 50 并发 + 200 排队 | WS `too many concurrent requests` |
| MQTT 消费 | 20 并发 + 500 排队 | 静默丢弃 |
| MQTT 通道每 Key 速率 | 无单独限制（受消费队列约束） | — |
| REST 查询每 ApiKey | 5 次/秒，突发 20 | HTTP 429 |
| REST 查询每客户端 IP（校验 Key 之前） | 20 次/秒，突发 50 | HTTP 429 |
| `/ws/dashboard` | 当前无消息速率限制；仅在握手时鉴权 | — |

限流计数在单个服务进程内存中；若部署多实例，限额按实例计算。

> 服务位于反向代理之后时，上报/查询的每 IP 限流可能看到代理地址，使多个客户端共享额度。高并发接入请与部署方确认代理转发和可信 IP 配置。

### 4.6 错误与重试策略

| 情况 | 是否重试 | 建议 |
|---|---|---|
| 网络错误、超时、连接被拒 | 是 | 指数退避（1s、2s、4s…，上限 30~60s），加随机抖动 |
| 429 | 是 | 退避重试，并降低发送速率 |
| 500 / 502 / 503 / 504 | 是 | 退避重试 |
| 400 / 411 / 413 | 否 | 修复报文，记录日志 |
| 401 | 否 | 暂停上报并告警，等待新 Key |
| 403 / 404 | 否 | 核对 systemCode / metricCode，请管理员补建指标 |

重试时**保留原始 `timestamp`**，这样补发的数据会落在正确的时间点。平台没有幂等键：若请求实际已成功、但客户端没收到响应就重试，会产生重复记录。对重复敏感的场景，可在报文中带自定义 `seq` 字段，事后通过 `payload` 排查。

### 4.7 各语言示例

#### curl

```bash
curl -sS -X POST http://127.0.0.1:48980/api/ingest \
  -H 'Content-Type: application/json' \
  -H 'X-Api-Key: dk_line1_6f3a9c2e8b1d4f70' \
  -d '{"systemCode":"line1","metricCode":"temp","value":87.5}'
```

#### Python（requests，含重试）

```python
import time, random, requests
from datetime import datetime, timezone

BASE = "http://127.0.0.1:48980"
API_KEY = "dk_line1_6f3a9c2e8b1d4f70"
RETRYABLE = {429, 500, 502, 503, 504}

def report(system_code: str, metric_code: str, value: float, ts: datetime | None = None, max_retries: int = 5) -> dict:
    body = {
        "systemCode": system_code,
        "metricCode": metric_code,
        "value": float(value),
        "timestamp": (ts or datetime.now(timezone.utc)).isoformat(),  # 首次生成，重试时复用
    }
    for attempt in range(max_retries + 1):
        try:
            r = requests.post(f"{BASE}/api/ingest", json=body,
                              headers={"X-Api-Key": API_KEY}, timeout=10)
        except requests.RequestException:
            if attempt == max_retries:
                raise
        else:
            if r.ok:
                return r.json()  # {"recordId": 1, "status": "normal"}
            if r.status_code not in RETRYABLE or attempt == max_retries:
                raise RuntimeError(f"ingest failed {r.status_code}: {r.json().get('message')}")
        time.sleep(min(30, 2 ** attempt) + random.random())

print(report("line1", "temp", 87.5))
```

#### Node.js ≥ 18（fetch）

```js
const BASE = 'http://127.0.0.1:48980'
const API_KEY = 'dk_line1_6f3a9c2e8b1d4f70'

export async function report(systemCode, metricCode, value, timestamp = new Date().toISOString()) {
  const res = await fetch(`${BASE}/api/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
    body: JSON.stringify({ systemCode, metricCode, value, timestamp }), // 字符串 body 会自动带 Content-Length
  })
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data.message), { status: res.status })
  return data // { recordId, status }
}
```

#### Java 11+（HttpClient）

```java
var client = HttpClient.newHttpClient();
var json = "{\"systemCode\":\"line1\",\"metricCode\":\"temp\",\"value\":87.5}";
var req = HttpRequest.newBuilder(URI.create("http://127.0.0.1:48980/api/ingest"))
    .header("Content-Type", "application/json")
    .header("X-Api-Key", "dk_line1_6f3a9c2e8b1d4f70")
    .POST(HttpRequest.BodyPublishers.ofString(json))   // 定长，自动带 Content-Length
    .build();
var resp = client.send(req, HttpResponse.BodyHandlers.ofString());
System.out.println(resp.statusCode() + " " + resp.body());
```

#### Go

```go
body := strings.NewReader(`{"systemCode":"line1","metricCode":"temp","value":87.5}`)
req, _ := http.NewRequest("POST", "http://127.0.0.1:48980/api/ingest", body) // strings.Reader 会设置 ContentLength
req.Header.Set("Content-Type", "application/json")
req.Header.Set("X-Api-Key", "dk_line1_6f3a9c2e8b1d4f70")
resp, err := http.DefaultClient.Do(req)
```

#### WebSocket（Node.js ≥ 22 内置 WebSocket / 浏览器）

```js
function connect() {
  const ws = new WebSocket('ws://127.0.0.1:48980/ws/ingest')
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data)
    switch (msg.type) {
      case 'auth.required': ws.send(JSON.stringify({ apiKey: 'dk_line1_6f3a9c2e8b1d4f70' })); break
      case 'auth.ok':       ws.send(JSON.stringify({ systemCode: 'line1', metricCode: 'temp', value: 66 })); break
      case 'ingest.ok':     console.log('stored', msg.recordId, msg.status); break
      case 'error':         console.warn('ingest error:', msg.message); break
    }
  }
  ws.onclose = () => setTimeout(connect, 3000) // 生产环境用指数退避
}
connect()
```

#### WebSocket（Python，websockets 库）

```python
import asyncio, json, websockets

async def main():
    async with websockets.connect("ws://127.0.0.1:48980/ws/ingest") as ws:
        assert json.loads(await ws.recv())["type"] == "auth.required"
        await ws.send(json.dumps({"apiKey": "dk_line1_6f3a9c2e8b1d4f70"}))
        ack = json.loads(await ws.recv())
        if ack["type"] != "auth.ok":
            raise RuntimeError(ack)
        for v in (66, 71, 93):
            await ws.send(json.dumps({"systemCode": "line1", "metricCode": "temp", "value": v}))
            print(json.loads(await ws.recv()))  # 逐条等待回执，保证一一对应

asyncio.run(main())
```

#### MQTT（Python，paho-mqtt 2.x）

```python
import json, paho.mqtt.client as mqtt

c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
# c.username_pw_set("user", "pass")   # 若 Broker 开启了认证
c.connect("127.0.0.1", 1883)
c.loop_start()
c.publish("metric/line1/temp",
          json.dumps({"apiKey": "dk_line1_6f3a9c2e8b1d4f70", "value": 87.5}),
          qos=1, retain=False).wait_for_publish()
c.loop_stop(); c.disconnect()
```

#### MQTT（命令行）

```bash
mosquitto_pub -h 127.0.0.1 -p 1883 -t 'metric/line1/temp' \
  -m '{"apiKey":"dk_line1_6f3a9c2e8b1d4f70","value":87.5}'
```

仓库自带联调脚本：`npm run demo`（三通道各发一轮）、`npm run demo -- --loop`（每 2 秒经 MQTT 发随机值）。

---

## 5. 状态判定规则

每个指标有 4 个可选阈值（`null` 表示不限）：`warnMin`、`warnMax`、`alarmMin`、`alarmMax`。判定逻辑（`server/services/statusService.ts`）：

```
if 四个阈值全为 null                          → none
if value < alarmMin 或 value > alarmMax       → alarm
if value < warnMin  或 value > warnMax        → warning
else                                          → normal
```

- 边界值**不算越界**：`value == warnMax` 判为 `normal`。
- 约束（创建/更新指标时校验）：`warnMin ≤ warnMax`、`alarmMin ≤ alarmMax`，且预警区间必须在告警区间内（`warnMin ≥ alarmMin`、`warnMax ≤ alarmMax`）。
- 只配置单侧也可以，例如只设 `alarmMax: 90`。

以 `temp`（预警 10~70，告警 0~90）为例：

| value | 状态 |
|---|---|
| -1 | alarm |
| 0 | warning |
| 5 | warning |
| 10 ~ 70 | normal |
| 80 | warning |
| 90 | warning |
| 90.1 | alarm |

阈值成功修改后会**立即**对之后的新数据生效，不会重算历史记录；当前更新接口缺陷见 §6.4。

**告警触发**：仅当指标"最新状态"发生**跃迁**且新状态为 `warning` 或 `alarm` 时触发（如 normal→warning、warning→alarm、alarm→warning）。持续处于同一状态、恢复到 normal/none 均不通知。之后依次检查静默窗口 → 匹配规则（指标 × 渠道，按 notifyWarning/notifyAlarm 过滤）→ 冷却时间 → 发送（失败重试 1 次）。

---

## 6. 查询与管理 API（JWT / ApiKey 认证）

本章命令示例沿用：`BASE=http://127.0.0.1:48980`、`API_KEY=<明文 Key>`、`TOKEN=<账号密码登录返回的 JWT>`。查询串中的 ISO 时间包含 `+08:00` 时应进行 URL 编码，或直接使用 `Z` 格式。

### 6.0 权限一览

| 方法 | 路径 | 权限 |
|---|---|---|
| POST | `/api/auth/login` | 公开 |
| POST | `/api/auth/logout` | 公开 |
| GET | `/api/auth/me` | 登录 |
| GET | `/api/health` | 公开 |
| GET | `/api/systems*`、`/api/records*`、`/api/metrics/:id/stats`、`/ws/dashboard` | JWT viewer/admin，或 `data:read` |
| POST/PUT/DELETE | `/api/systems*` | admin，或 `systems:manage` |
| POST/PUT/DELETE | `/api/metrics*` | admin，或 `metrics:manage` |
| * | `/api/api-keys*` | admin，或 `apiKeys:manage` |
| * | `/api/alert/*` | admin，或 `alerts:manage` |
| * | `/api/users*` | admin，或 `users:manage` |
| GET | `/api/audit` | admin，或 `audit:read` |
| POST | `/api/maintenance/cleanup` | admin，或 `maintenance:run` + `allSystems=true` |

ApiKey 权限白名单：

| permission | 能力 |
|---|---|
| `data:read` | 系统快照、详情、历史、导出、统计、`/ws/dashboard` |
| `data:write` | HTTP / WS / MQTT 数据上报 |
| `systems:manage` | 更新/删除授权系统；创建系统还要求 `allSystems=true` |
| `metrics:manage` | 在授权系统中创建、更新、删除指标 |
| `apiKeys:manage` | 管理不超过自身权限与系统范围的 Key |
| `alerts:manage` | 读取渠道、管理授权系统的规则/静默；修改或测试全局渠道要求 `allSystems=true` |
| `users:manage` | 用户管理（全局能力） |
| `audit:read` | 审计日志读取（全局能力） |
| `maintenance:run` | 执行保留策略清理；还要求 `allSystems=true` |

系统范围与功能权限是两道独立检查：

- `systemIds: [1, 2]` 只授权列出的系统；`allSystems: true` 授权全部现有及未来系统，此时忽略 `systemIds`。
- `GET /api/systems` 返回全部授权系统；历史查询省略 `systemId` 时，也会自动限制到整个授权集合。
- 通过系统 id/code 或指标 id 访问范围外资源返回 `403`；不存在资源对 ApiKey 通常也返回 403，避免探测。已确认授权系统后再查未知 `metricCode` 返回 404。
- admin JWT 不受 permission 或系统范围限制；viewer JWT 只有读取能力。
- Key 有效但缺权限时返回 403；没有凭证或 Key 无效/禁用时返回 401。

查询调用的最小请求头：

```bash
# ApiKey：可用于读取或管理，具体取决于权限
curl -sS http://127.0.0.1:48980/api/systems \
  -H 'X-Api-Key: dk_line1_6f3a9c2e8b1d4f70'

# JWT：admin 拥有全部权限，viewer 只读
curl -sS http://127.0.0.1:48980/api/systems \
  -H 'Authorization: Bearer eyJhbGciOi...'
```

路径参数 `:id` 必须是正整数，否则 `400 invalid id`；JWT 查询或管理时资源不存在返回 `404 xxx not found`（ApiKey 查询按上述防探测规则可能返回 403）。

PUT 接口均为**部分更新**：只修改传入的字段。可为空字段传 `null` 表示清空。

### 6.1 认证

#### POST /api/auth/login

账号密码请求：

```json
{"username": "admin", "password": "admin123"}
```

账号密码成功 `200`：

```json
{"token": "eyJhbGciOi...", "user": {"id": 1, "username": "admin", "role": "admin", "authType": "user", "permissions": [], "systemIds": [], "allSystems": true}}
```

同时写入有效期 24 小时的 httpOnly、`SameSite=Lax` Cookie `tc_token`；HTTPS 请求会带 `Secure`。程序调用应保存响应中的 `token`，之后发送 `Authorization: Bearer <token>`。

ApiKey 登录请求：

```json
{"apiKey": "dk_9f0c..."}
```

Key 必须具有 `data:read`（控制台所有页面都依赖系统快照）。成功时不签发 JWT，而是写入有效期 24 小时的 httpOnly `tc_api_key` Cookie：

```json
{
  "token": null,
  "user": {
    "id": -2,
    "username": "锅炉数据服务",
    "role": "admin",
    "authType": "apiKey",
    "permissions": ["data:read", "data:write", "metrics:manage"],
    "systemIds": [1, 2],
    "allSystems": false
  }
}
```

这里的 `role` 仅供控制台展示和兼容前端：只含 `data:read/data:write` 时为 `viewer`，含任一管理 permission 时为 `admin`。服务端授权始终以 `permissions` 和系统范围为准，不以该 `role` 字段判断。

```bash
TOKEN=$(curl -sS -X POST http://127.0.0.1:48980/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | jq -r .token)

# ApiKey 控制台登录并保存 Cookie
curl -sS -c cookies.txt -X POST http://127.0.0.1:48980/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"apiKey":"dk_9f0c..."}'
```

| 码 | 说明 |
|---|---|
| 400 | 请求既不是合法的 username/password，也不是合法的 apiKey 结构 |
| 401 | 用户名/密码错误，或 ApiKey 无效/禁用 |
| 403 | 账号已禁用，或 ApiKey 缺少控制台登录所需的 `data:read` |
| 429 | 同一“用户名+IP”或 ApiKey 登录来源 IP 连续失败 5 次，锁定 15 分钟；响应头 `Retry-After`（秒） |

#### POST /api/auth/logout

无需认证。同时清除当前响应域下的 `tc_token` 与 `tc_api_key` Cookie，返回 `{"ok": true}`。**不会吊销 JWT**：客户端已保存的 token 在过期前仍然有效。

#### GET /api/auth/me

```json
{"user": {"id": 1, "username": "admin", "role": "admin", "authType": "user", "permissions": [], "systemIds": [], "allSystems": true}}
```

接受 JWT、`tc_api_key` Cookie 或 `X-Api-Key`。JWT 内容取自 token 本身，不查数据库，因此用户被禁用或改角色后，旧 token 内容在过期前不会变化；ApiKey 会重新校验启用状态，并返回当前权限和系统范围。

### 6.2 健康检查

#### GET /api/health

```json
{"ok": true, "db": true, "mqtt": true, "dashboardPeers": 1, "time": "2026-09-17T09:19:24.870Z"}
```

无需认证。

| 字段 | 说明 |
|---|---|
| `ok` | `db && mqtt` |
| `db` | MySQL `SELECT 1` 是否成功 |
| `mqtt` | 平台订阅端是否已连接 Broker |
| `dashboardPeers` | 当前 `/ws/dashboard` 连接数 |
| `time` | 服务端当前 UTC 时间 |

`db` 与 `mqtt` 都正常时返回 200，否则 **503**（响应体结构不变）。MQTT 断开时 HTTP/WS 上报仍然可用，但健康检查会报 503。

### 6.3 系统 Systems

#### GET /api/systems — 系统列表 + 指标 + 状态汇总

```json
{
  "systems": [
    {
      "id": 1, "code": "line1", "name": "一号产线", "description": "演示系统：一号产线设备监控",
      "retentionDays": null, "createdAt": "2026-08-27T00:18:30.794Z",
      "summary": {"normal": 1, "warning": 0, "alarm": 0, "none": 2},
      "metrics": [
        {
          "id": 1, "systemId": 1, "code": "temp", "name": "温度", "unit": "℃",
          "warnMin": 10, "warnMax": 70, "alarmMin": 0, "alarmMax": 90,
          "lastValue": 66.6, "lastStatus": "normal", "lastReportedAt": "2026-09-17T09:19:40.000Z",
          "createdAt": "2026-08-27T00:18:30.803Z"
        }
      ]
    }
  ],
  "globalRetentionDays": null
}
```

这是获取所有指标**当前值与状态**的最快方式，也是"code → id"的映射来源。

使用 ApiKey 调用时返回 `systemIds` 中的全部系统，或在 `allSystems=true` 时返回全部系统；使用 JWT 时返回全部系统。系统与指标均按 `id` 升序；`summary` 是该系统各指标 `lastStatus` 的计数。`globalRetentionDays` 为环境变量 `RETENTION_DAYS` 的有效正整数值，否则为 `null`。

```bash
curl -sS "$BASE/api/systems" -H "X-Api-Key: $API_KEY"
```

#### GET /api/systems/:id

```json
{"system": {<System>}, "metrics": [<Metric>, ...]}
```

ApiKey 只能传其授权系统的 id。

| 结果 | JWT | ApiKey |
|---|---|---|
| 目标存在且有权访问 | 200 | 200 |
| 目标不存在 | 404 | 403 |
| 目标属于其他系统 | 可读取 | 403 |

#### GET /api/systems/by-code/:code — 按编码读取系统

与 `GET /api/systems/:id` 响应相同，适合只拿到 `systemCode` 的第三方程序。`code` 必须满足 `^[\w-]+$`、长度 1~64。JWT 可读取任意系统；ApiKey 的 `code` 必须属于其授权范围。

```bash
curl -sS "$BASE/api/systems/by-code/line1" -H "X-Api-Key: $API_KEY"
```

#### GET /api/systems/by-code/:code/records — 按编码读取历史记录

分页与响应格式同 `GET /api/records`。系统 code 必须属于 ApiKey 的授权范围；未知 `metricCode` 返回 404。

| 参数 | 默认 | 说明 |
|---|---|---|
| `metricCode` | — | 指标 code，1~64，`^[\w-]+$` |
| `status` | — | `normal` / `warning` / `alarm` / `none` |
| `from` / `to` | — | `reportedAt` 闭区间，ISO 8601 且带时区 |
| `page` | 1 | 偏移分页页码；传 `beforeId` 时忽略 |
| `pageSize` | 20 | 1~100 |
| `beforeId` | — | 上一页响应的 `nextCursor` |

```bash
curl -sS "$BASE/api/systems/by-code/line1/records?metricCode=temp&status=alarm&pageSize=100" \
  -H "X-Api-Key: $API_KEY"
```

#### POST /api/systems（admin / `systems:manage` + `allSystems`）

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| `code` | string | 是 | 1~64，`^[\w-]+$`，全局唯一，**不可修改** |
| `name` | string | 是 | 1~128 |
| `description` | string \| null | 否 | ≤512 |
| `retentionDays` | int \| null | 否 | 0~36500；`null`=跟随全局 `RETENTION_DAYS`，`0`=永久保留 |

返回 `{"system": <System>}`；code 重复 409。

#### PUT /api/systems/:id（admin / `systems:manage`）

可改 `name`、`description`、`retentionDays`（`code` 传了也会被忽略）。空请求体是合法的 no-op。返回 `{"system": <System>}`。

#### DELETE /api/systems/:id（admin / `systems:manage`）

**级联删除**该系统下所有指标、历史记录、相关告警规则与静默窗口；不可恢复。全局 ApiKey 不会被删除，只会从其 `systemIds` 中移除该系统。返回 `{"ok": true}`。

### 6.4 指标 Metrics

#### POST /api/metrics（admin / `metrics:manage`）

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| `systemId` | int | 是 | 所属系统 id |
| `code` | string | 是 | 1~64，`^[\w-]+$`，系统内唯一，**不可修改** |
| `name` | string | 是 | 1~128 |
| `unit` | string \| null | 否 | ≤32 |
| `warnMin` / `warnMax` / `alarmMin` / `alarmMax` | number \| null | 否 | 有限数；约束见 §5 |

返回 `{"metric": <Metric>}`；系统不存在 404，code 重复 409，阈值关系不合法 400。

```bash
curl -sS -X POST "$BASE/api/metrics" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"systemId":1,"code":"temp","name":"温度","unit":"℃","warnMin":10,"warnMax":70,"alarmMin":0,"alarmMax":90}'
```

#### PUT /api/metrics/:id（admin / `metrics:manage`）

可改 `name`、`unit`、四个阈值（传 `null` 清除阈值）。返回 `{"metric": <Metric>}`。

> ⚠️ **当前已知缺陷（复核于 2026-09-20）**：该接口任何请求都会返回 500。原因是 `server/api/metrics/[id].put.ts` 对带 `superRefine` 的 schema 调用了 `.omit()`，zod v4 会直接抛出 `.omit() cannot be used on object schemas containing refinements`。修复前不要依赖此接口；删除后重建会同时删除该指标历史记录。

#### DELETE /api/metrics/:id（admin / `metrics:manage`）

级联删除该指标的历史记录与告警规则。返回 `{"ok": true}`。

#### GET /api/metrics/:id/stats — 时间窗口聚合（趋势图数据）

ApiKey 只能读取其授权系统下的指标；范围外或不存在的指标返回 403。JWT 用户读取不存在的指标返回 404。

| 参数 | 默认 | 说明 |
|---|---|---|
| `window` | `auto` | `auto` \| `1m` \| `5m` \| `15m` \| `1h` \| `1d`；auto 选使点数 ≤240 的最小窗口 |
| `from` | `to` 前 24 小时 | ISO 8601 带时区 |
| `to` | 当前时间 | ISO 8601 带时区；区间为 `(from, to]`，最长 366 天 |

```json
{
  "metric": {"id": 1, "code": "temp", "name": "温度", "unit": "℃"},
  "windowSeconds": 3600,
  "from": "2026-09-16T09:19:40.489Z",
  "to": "2026-09-17T09:19:40.489Z",
  "points": [
    {"t": "2026-09-17T09:00:00.000Z", "min": 66.6, "max": 66.6, "avg": 66.6, "count": 1}
  ]
}
```

没有数据的时间桶**不会出现**在 `points` 中，画图时需自行补空。`1d` 窗口按 UTC 零点对齐分桶。

- 查询区间为 `(from, to]`：不含 `from`，包含 `to`。
- `window=auto` 从 `1m → 5m → 15m → 1h → 1d` 中选择预计点数不超过 240 的最小窗口。
- `avg` 可能包含多位小数；客户端展示时自行格式化，不要用格式化后的值继续计算。

```bash
curl -sS "$BASE/api/metrics/1/stats?window=5m&from=2026-09-19T00:00:00Z&to=2026-09-20T00:00:00Z" \
  -H "X-Api-Key: $API_KEY"
```

### 6.5 历史记录 Records

#### GET /api/records

ApiKey 调用时返回授权系统集合内的记录；省略 `systemId` 会自动使用整个 `systemIds` 范围（`allSystems=true` 时不过滤），传入范围外系统或指标返回 403。

| 参数 | 类型 | 说明 |
|---|---|---|
| `systemId` | int | 按系统过滤 |
| `metricId` | int | 按指标过滤 |
| `status` | `normal`\|`warning`\|`alarm`\|`none` | 按状态过滤 |
| `from` / `to` | ISO 8601 带时区 | `reportedAt` 闭区间 |
| `pageSize` | int 1~100 | 默认 20 |
| `page` | int ≥1 | 偏移分页，默认 1 |
| `beforeId` | int | **游标分页**（推荐）：传上一页返回的 `nextCursor`；传了则忽略 `page` |

排序：`reportedAt` 降序，其次 `id` 降序。

```json
{
  "list": [
    {
      "id": "1", "metricId": 1, "value": 66.6, "status": "normal", "channel": "http",
      "payload": "{\"systemCode\":\"line1\",\"metricCode\":\"temp\",\"value\":66.6}",
      "reportedAt": "2026-09-17T09:19:40.000Z", "createdAt": "2026-09-17T01:19:40.372Z",
      "metric": {<Metric>}
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "nextCursor": null
}
```

- `total`：满足筛选条件的总数（与游标无关）。
- `nextCursor`：还有下一页时为最后一条的 id（number），否则 `null`。
- 全量拉取推荐：首次不传 `beforeId`，之后循环 `beforeId=nextCursor`，直到 `nextCursor` 为 `null`。
- `beforeId` 必须指向当前 `systemId` / `metricId` 筛选范围内的记录；不存在或不在范围内都返回 `400 invalid beforeId`。

```bash
# 首次请求
curl -sS "$BASE/api/records?status=alarm&pageSize=100" \
  -H "X-Api-Key: $API_KEY"

# 下一页：把上一次的 nextCursor 作为 beforeId
curl -sS "$BASE/api/records?status=alarm&pageSize=100&beforeId=12345" \
  -H "X-Api-Key: $API_KEY"
```

#### GET /api/records/export — CSV 导出

参数同上（无分页参数），另有 `limit`（1~100000，默认 10000）。按 `reportedAt` **升序**流式输出，文件带 UTF-8 BOM，响应头 `Content-Disposition: attachment; filename="records-YYYYMMDDHHmmss.csv"`。
ApiKey 的系统范围规则与 `GET /api/records` 相同。

```csv
id,system,metric,value,unit,status,channel,reported_at
1,line1,温度(temp),66.6,℃,normal,http,2026-09-17T09:19:40.000Z
```

文本列以 `=`、`+`、`@` 或非数字 `-` 开头时，服务端会前置单引号，降低 Excel/表格软件公式注入风险。

```bash
curl -sS "$BASE/api/records/export?metricId=1&from=2026-09-01T00:00:00Z&limit=10000" \
  -H "X-Api-Key: $API_KEY" \
  -o records.csv
```

### 6.6 ApiKey

权限：admin JWT 或 `apiKeys:manage`。

Web 控制台使用顶部“ApiKey”入口（`/api-keys`）进行全局管理；这里列出所有当前身份可管理的 Key，不需要先进入某个系统。

#### 授权字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `systemIds` | int[] | 显式授权的系统 id；`allSystems=false` 时至少一项 |
| `allSystems` | boolean | 默认 false；true 表示全部现有及未来系统，并忽略 `systemIds` |
| `permissions` | `ApiPermission[]` | 至少一项；默认 `["data:read","data:write"]`，可选值见 §6.0 |
| `name` | string 1~128 | Key 名称/调用方名称 |

| 方法 | 路径 | 请求体 | 响应 |
|---|---|---|---|
| GET | `/api/api-keys?systemId=` | — | `{"apiKeys":[{"id","systemIds","allSystems","permissions","name","maskedKey","enabled","lastUsedAt","createdAt"}]}` |
| POST | `/api/api-keys` | 上述授权字段 | `{"apiKey":{...授权字段,"enabled":true,"key":"dk_..."}}` |
| PUT | `/api/api-keys/:id` | `{"name"?,"enabled"?,"systemIds"?,"allSystems"?,"permissions"?}` | `{"apiKey":{...}}` |
| POST | `/api/api-keys/:id/rotate` | — | `{"apiKey":{"id","key":"dk_..."}}` |
| DELETE | `/api/api-keys/:id` | — | `{"ok": true}` |

创建一个可登录控制台、读取 1/2 号系统并维护其指标的 Key：

```bash
curl -sS -X POST "$BASE/api/api-keys" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "数据运维服务",
    "systemIds": [1, 2],
    "allSystems": false,
    "permissions": ["data:read", "data:write", "metrics:manage"]
  }'
```

权限下放规则：

- admin JWT 可以创建和管理任意 Key。
- 通过 `apiKeys:manage` 调用时，只能查看、创建或修改**权限集合和系统范围都不超过当前 Key** 的目标 Key；不能借此提升自身权限。
- 只有 `allSystems=true` 的管理 Key 才能下放 `allSystems=true`；有限范围 Key 只能选择自身 `systemIds` 的子集。
- `GET ?systemId=1` 返回能访问该系统的 Key（包括 `allSystems=true`），再按当前管理 Key 可下放的范围过滤。

生命周期与安全：

- 完整 `key` **只在创建和轮换响应中出现一次**，平台无法找回，丢失只能轮换。
- `maskedKey` 只包含明文前 8 个字符和省略号，不能用于认证。数据库保存 SHA-256 摘要。
- 禁用、删除、轮换、权限或系统范围修改会在当前实例清缓存，并立即断开该 Key 已建立的看板 WS；上报 WS 在下一帧复核。多实例其他节点的新请求最多可能延迟约 30 秒，已建立连接仍需依赖跨实例协调或重连。
- `lastUsedAt` 最多每 60 秒更新一次。
- 轮换只替换密钥内容，不改变名称、权限、系统范围或 `enabled`；若原本禁用，轮换后仍禁用。
- ApiKey 是全局实体，不归属于任何单个系统；删除系统只移除对应 `systemIds` 授权，不会删除 Key。`allSystems=true` 的 Key 不受影响。

### 6.7 告警

权限：admin JWT 或 `alerts:manage`。

ApiKey 管理规则和静默时，只能操作其授权系统下的指标/系统；创建或删除全局静默要求 `allSystems=true`。通知渠道本身是全局资源：列表要求 `alerts:manage`，创建、更新、删除、测试还要求 `allSystems=true`，避免有限范围 Key 影响其他系统的规则。

#### 通知渠道 `/api/alert/channels`

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | `webhook`\|`dingtalk`\|`wecom`\|`email` | 必填 |
| `name` | string 1~128 | 必填 |
| `target` | string 1~512 | webhook/钉钉/企微：完整机器人或回调 URL；email：收件人，多个用逗号分隔 |
| `secret` | string \| null | 钉钉加签密钥；其他类型不使用 |
| `enabled` | boolean | 默认 true |

| 方法 | 路径 | 响应 |
|---|---|---|
| GET | `/api/alert/channels` | `{"channels":[<Channel>]}`（含 `secret` 明文） |
| POST | `/api/alert/channels` | `{"channel": <Channel>}` |
| PUT | `/api/alert/channels/:id` | 部分更新，`{"channel": <Channel>}` |
| DELETE | `/api/alert/channels/:id` | 级联删除规则，`{"ok": true}` |
| POST | `/api/alert/channels/:id/test` | 发一条测试通知；成功 `{"ok": true}`，失败 `502 发送失败: ...` |

- 渠道列表会返回 `target` 与 `secret` 明文，只能暴露给可信管理员。
- `/test` 会直接尝试发送，即使该渠道 `enabled=false`；它不经过规则、静默窗口或冷却判断。
- email 渠道需服务端配置 `SMTP_HOST`，并按需配置 `SMTP_PORT`、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_FROM`。

#### 告警规则 `/api/alert/rules`

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `metricId` | int | 必填 | 创建后不可改 |
| `channelId` | int | 必填 | 创建后不可改；同一指标+渠道只能有一条（409） |
| `notifyWarning` | boolean | true | 进入 warning 时通知 |
| `notifyAlarm` | boolean | true | 进入 alarm 时通知 |
| `cooldownSeconds` | int 0~86400 | 300 | 同一规则两次通知的最小间隔；0=不限 |
| `enabled` | boolean | true | |

| 方法 | 路径 | 响应 |
|---|---|---|
| GET | `/api/alert/rules?systemId=` | `{"rules":[<Rule 含 metric、channel 对象>]}` |
| POST | `/api/alert/rules` | `{"rule": <Rule>}` |
| PUT | `/api/alert/rules/:id` | 仅可改 notifyWarning/notifyAlarm/cooldownSeconds/enabled，`{"rule": <Rule>}` |
| DELETE | `/api/alert/rules/:id` | `{"ok": true}` |

> 布尔字段请传 JSON `true/false`；`notifyWarning`/`notifyAlarm` 若传字符串 `"false"` 会被当成 true。

冷却时间从一次**成功发送**后开始计算，保存在当前服务进程内；发送失败不会进入冷却，多实例之间也不共享冷却状态。

#### 静默窗口 `/api/alert/silences`

| 字段 | 类型 | 说明 |
|---|---|---|
| `systemId` | int \| null | |
| `metricId` | int \| null | |
| `startAt` / `endAt` | ISO 8601 带时区 | 必填，`endAt > startAt` |
| `reason` | string ≤255 | 默认 `""` |

作用域：`metricId` 非空 → 指标级；仅 `systemId` 非空 → 系统级；都为空 → **全局**。同时传 `systemId` 与 `metricId` 时，指标必须属于该系统，否则 400。静默期间数据照常入库和推送，只是不发通知。

| 方法 | 路径 | 响应 |
|---|---|---|
| GET | `/api/alert/silences?systemId=` | `{"silences":[...]}`；带 systemId 时包含全局 + 该系统 + 该系统下指标级的静默 |
| POST | `/api/alert/silences` | `{"silence": <Silence>}` |
| DELETE | `/api/alert/silences/:id` | `{"ok": true}` |

静默判断使用服务端当前时间，生效区间两端都包含（`startAt <= now <= endAt`），不是使用上报报文的 `timestamp` 判断。

### 6.8 用户

权限：admin JWT 或 `users:manage`。

| 方法 | 路径 | 请求体 | 响应 |
|---|---|---|---|
| GET | `/api/users` | — | `{"users":[{"id","username","role","enabled","createdAt"}],"currentUserId"}` |
| POST | `/api/users` | `{"username": ^[\w-]+$ 1~64, "password": 6~128, "role"?: "admin"\|"viewer"(默认 viewer)}` | `{"user": {...}}` |
| PUT | `/api/users/:id` | `{"password"?, "role"?, "enabled"?}` | `{"user": {"id","username","role","enabled"}}` |
| DELETE | `/api/users/:id` | — | `{"ok": true}` |

保护规则（400）：不能删除/禁用自己；不能删除、禁用或降级最后一个可用管理员。

用户名创建后不可修改。重置密码、改角色或禁用用户都不会撤销已经签发的 JWT；调用者自身若在仍有其他管理员时被降级，其旧 token 仍会携带原 admin 角色，最长 24 小时后才失效。

第三方程序优先使用最小权限 ApiKey：只读时授予 `data:read`，并在 `systemIds` 中选择所需系统；无需为跨系统读取专门创建共享 viewer 账号。

### 6.9 审计与维护

#### GET /api/audit

要求 admin JWT 或 `audit:read`。

参数：`username`（精确匹配）、`action`（前缀匹配，如 `apiKey.`）、`from`/`to`、`page`、`pageSize`（1~100，默认 50）。

```json
{"list": [{"id": "12", "userId": 1, "username": "admin", "action": "apiKey.create", "target": "line1/网关", "detail": null, "createdAt": "..."}], "total": 12, "page": 1, "pageSize": 50}
```

`action` 取值：`system.create|update|delete`、`metric.create|update|delete`、`apiKey.create|update|rotate|delete`、`channel.create|update|delete|test`、`rule.create|update|delete`、`silence.create|delete`、`user.create|update|delete`、`retention.cleanup`。`detail` 为 JSON 字符串或 null。

结果按审计 id 降序；`total` 是筛选后的总数。登录成功/失败和普通读取当前不写审计日志。

#### POST /api/maintenance/cleanup

要求 admin JWT；ApiKey 则必须同时具有 `maintenance:run` 且 `allSystems=true`。

立即按保留策略清理一次（平时每天 03:05 自动执行）。

```json
{"cleaned": 5230, "details": [{"systemId": 1, "days": 90, "deleted": 5230}]}
```

- 系统级 `retentionDays` 优先于环境变量 `RETENTION_DAYS`；`null` 表示跟随全局，`0` 表示永久保留。
- 删除条件是 `reportedAt < 当前时间 - days`，每批最多删除 5000 条并循环执行。
- `details` 只包含本次实际删除了记录的系统；没有过期数据的系统不会出现。

---

## 7. 实时推送 /ws/dashboard

用于第三方大屏或服务实时接收指标最新值。JWT 连接接收所有系统；具有 `data:read` 的 ApiKey 只接收其 `systemIds`，`allSystems=true` 时接收全部系统。

**连接**

- 浏览器同源页面：用户名/密码或 ApiKey 登录后，Cookie 自动携带，直接连 `ws://<host>/ws/dashboard`。
- 程序：`ws://<host>:48980/ws/dashboard?token=<JWT>`（任意角色）。token 会出现在 URL 中，注意代理日志。
- ApiKey：非浏览器客户端优先在握手头传 `X-Api-Key`；浏览器原生 WebSocket 无法设置请求头，可使用 `ws://<host>:48980/ws/dashboard?apiKey=<key>`。查询参数会进入代理日志，生产环境应使用 WSS 并清理访问日志中的查询串。

**认证失败**：收到 `{"type":"error","code":"unauthorized","message":"unauthorized"}` 后连接被关闭，此时应重新登录，而不是重连。

**认证成功没有单独的 `auth.ok` 帧**。连接会保持打开，直到有新数据才收到第一条消息。连接后也不会推送初始快照，请先调用 `GET /api/systems` 取当前状态，再增量应用推送。

```json
{
  "type": "metric.update",
  "data": {
    "systemId": 1, "systemCode": "line1",
    "metricId": 1, "metricCode": "temp", "metricName": "温度", "unit": "℃",
    "value": 87.5, "status": "warning",
    "reportedAt": "2026-09-17T09:30:00.000Z"
  }
}
```

- 每条成功入库、且不是过期补报的上报都会推送一次，无论状态是否变化。
- 连接只接收推送，客户端发送的消息会被忽略。
- JWT 连接不会因 token 到期被主动断开；ApiKey 经管理接口禁用、删除、轮换或修改授权后，当前实例会主动断开对应连接，客户端重连时按新授权重新校验。
- 建议断线后按 1s 起、上限 30s 指数退避重连，重连后重新拉取 `/api/systems` 补齐断线期间的变化。

浏览器示例（Key 会出现在 URL 中，仅在无法设置握手头时使用）：

```js
const apiKey = 'dk_line1_6f3a9c2e8b1d4f70'
const ws = new WebSocket(`wss://example.com/ws/dashboard?apiKey=${encodeURIComponent(apiKey)}`)

ws.onmessage = ({ data }) => {
  const event = JSON.parse(data)
  if (event.type === 'metric.update') {
    console.log(event.data.systemCode, event.data.metricCode, event.data.value)
  }
}
ws.onclose = () => {
  // 指数退避重连；重连成功后重新 GET /api/systems 补快照
}
```

---

## 8. 告警出站通知格式（Webhook 接收方）

`type=webhook` 的渠道会对 `target` URL 发起：

```http
POST <target>
Content-Type: application/json
```

```json
{
  "type": "metric.alert",
  "data": {
    "systemCode": "line1",
    "systemName": "一号产线",
    "metricCode": "temp",
    "metricName": "温度",
    "value": 93.2,
    "unit": "℃",
    "status": "alarm",
    "prevStatus": "warning",
    "reportedAt": "2026-09-17T09:30:00.000Z",
    "text": "【告警】一号产线/温度 = 93.2℃\n- 系统：一号产线（line1）\n- 指标：温度（temp）\n- 当前值：93.2℃，状态 告警（原 预警）\n- 预警区间：10 ~ 70，告警区间：0 ~ 90\n- 发生时间：2026-09-17 17:30:00\n- 看板链接：http://.../systems"
  }
}
```

接收方要求：

- 10 秒内返回任意 **2xx** 算成功；非 2xx 或超时，平台会**立即重试 1 次**，仍失败则放弃（只记日志）。因此接收方可能收到重复通知。
- 请求**不带签名**。建议在 URL 中带不可猜测的路径或 token，并限制来源 IP。
- `status` 只会是 `warning` 或 `alarm`，平台不发恢复通知。
- 测试通知（`/test`）使用固定内容：`systemCode:"test"`、`value:0`、`status:"alarm"`、`prevStatus:"normal"`。
- `text` 中的"发生时间"按服务端本地时区格式化；程序请使用 `reportedAt`。`APP_URL` 未配置时不会出现“看板链接”这一行。
- Webhook 报文没有事件 id。接收方若要去重，可组合 `systemCode + metricCode + reportedAt + status` 作为业务去重键；若多次真实跃迁恰好具有完全相同的这些字段，去重键仍可能碰撞。

钉钉 / 企业微信渠道使用各自机器人标准的 `markdown` 消息，钉钉配置 `secret` 时按官方加签规则在 URL 追加 `timestamp` 与 `sign`。

---

## 9. 数据模型

```
System 1 ──< Metric 1 ──< MetricRecord
   │            │
   │            └──< AlertRule >── 1 AlertChannel
   └──< SilenceRule（也可挂在 Metric 上，或全局）
ApiKey（独立，通过 systemIds/allSystems 授权） / User（独立） / AuditLog（独立，username 快照）
```

| 实体 | 字段（JSON 名） |
|---|---|
| System | `id` `code` `name` `description` `retentionDays` `createdAt` |
| Metric | `id` `systemId` `code` `name` `unit` `warnMin` `warnMax` `alarmMin` `alarmMax` `lastValue` `lastStatus` `lastReportedAt` `createdAt` |
| MetricRecord | `id`(string) `metricId` `value` `status` `channel`(`http`\|`mqtt`\|`ws`) `payload`(原始报文 JSON 字符串 ≤2048) `reportedAt` `createdAt` |
| ApiKey（列表视图） | `id` `systemIds` `allSystems` `permissions` `name` `maskedKey` `enabled` `lastUsedAt` `createdAt` |
| AlertChannel | `id` `type` `name` `target` `secret` `enabled` `createdAt` |
| AlertRule | `id` `metricId` `channelId` `notifyWarning` `notifyAlarm` `cooldownSeconds` `enabled` `createdAt` |
| SilenceRule | `id` `systemId` `metricId` `startAt` `endAt` `reason` `createdAt` |
| User（管理视图） | `id` `username` `role` `enabled` `createdAt` |
| AuditLog | `id`(string) `userId` `username` `action` `target` `detail` `createdAt` |

检测值与阈值在数据库中使用双精度浮点；上报值在进入业务逻辑前已舍入到两位小数。各类普通 id 为 32 位整数，历史记录与审计日志 id 为 `bigint`。

---

## 10. 注意事项与已知行为

以下均为当前实现的真实行为，接入时请留意：

1. **记录 id 类型**：`MetricRecord.id`、`AuditLog.id` 在列表 JSON 中是**字符串**（如 `"1"`），但 ingest 返回的 `recordId` 与 `nextCursor` 是 **number**。比较前请统一类型。
2. **业务时间与入库时间不同**：`reportedAt` 是采集/上报时间，`createdAt` 是数据库入库时间，补报时两者本来就可能相差很大。业务排序与统计使用 `reportedAt`。
3. **持久化时间精度为秒**：`reportedAt` 的毫秒部分会被 MySQL `datetime` 丢弃，同一秒内的多条记录排序再依赖 `id`；同一秒内不能依靠毫秒保证“最新值”顺序。实时推送可能仍带原始毫秒。
4. **value 会转换并舍入**：`null`、`""`、`false` → 0，`true` → 1，都会被接受；正常数字再四舍五入到两位小数。客户端必须自行保证原始类型正确。
5. **未来时间戳会阻塞后续实时更新**；同一秒内后完成处理的报文可能覆盖最新值（§4.1）。
6. **ApiKey 防探测返回 403**：系统 id/code、数字指标 id 不存在或不在该 Key 的授权范围时，在受系统范围约束的查询中统一返回 403；已确认授权系统后查询未知 `metricCode` 返回 404，JWT 查询不存在资源通常也返回 404。
7. **MQTT 无回执、至多一次、勿用 retain**（§4.4）。
8. **上报 WS 回执无请求 id、可能乱序**（§4.3）；看板 WS 认证成功也没有确认帧（§7）。
9. **JWT 无法主动吊销**：退出登录、禁用用户、改角色都要等 token 过期（24h）才完全生效。
10. **已建立的看板 WS 不定时复核凭证**：JWT 过期不会主动断开；ApiKey 通过当前实例管理接口变更时会被主动断开，但数据库外部变更或其他实例上的变更仍要到重连才重新校验。
11. **健康检查依赖 MQTT**：MQTT 断开时 `/api/health` 返回 503，但 HTTP/WS 上报仍然正常。
12. **进程内状态不跨实例**：限流、告警冷却、登录锁定和缓存按实例计算，重启后清零。多实例中 ApiKey 禁用/轮换可能受其他实例最多约 30 秒缓存影响。
13. **无 CORS、无批量接口、无幂等键**。调用方超时后重试可能产生重复记录。
14. **`PUT /api/metrics/:id` 当前恒返回 500**（§6.4）。
15. 修改指标阈值只影响之后的新数据，不会重算历史状态。
16. 删除系统/指标会级联删除相关历史数据与告警配置，不可恢复；ApiKey 是全局实体，不随系统删除，只会移除相应系统范围。

---

## 附录 A：TypeScript 类型定义

可直接复制到客户端项目使用。

```ts
export type MetricStatus = 'normal' | 'warning' | 'alarm' | 'none'
export type IngestChannel = 'http' | 'mqtt' | 'ws'
export type UserRole = 'admin' | 'viewer'
export type AlertChannelType = 'webhook' | 'dingtalk' | 'wecom' | 'email'
export type ApiPermission =
  | 'data:read' | 'data:write'
  | 'systems:manage' | 'metrics:manage' | 'apiKeys:manage'
  | 'alerts:manage' | 'users:manage' | 'audit:read' | 'maintenance:run'

// ---- 上报 ----
export interface IngestPayload {
  systemCode: string        // 1..64
  metricCode: string        // 1..64
  value: number             // finite；服务端舍入到两位小数
  timestamp?: string        // ISO 8601 with offset
  [extra: string]: unknown  // 允许附加字段，仅存档
}
export interface IngestResult { recordId: number, status: MetricStatus }

export type IngestWsServerMessage =
  | { type: 'auth.required', message: string }
  | { type: 'auth.ok' }
  | ({ type: 'ingest.ok' } & IngestResult)
  | { type: 'error', message: string }

export interface ApiError {
  error: true
  url: string
  statusCode: number
  statusMessage: string
  message: string
}

export interface AuthUser {
  id: number
  username: string
  role: UserRole
  authType: 'user' | 'apiKey'
  permissions: ApiPermission[]
  systemIds: number[]
  allSystems: boolean
}
export interface LoginResponse { token: string | null, user: AuthUser }
export interface HealthResponse {
  ok: boolean
  db: boolean
  mqtt: boolean
  dashboardPeers: number
  time: string
}

// ---- 实体 ----
export interface System {
  id: number
  code: string
  name: string
  description: string | null
  retentionDays: number | null
  createdAt: string
}
export interface Metric {
  id: number
  systemId: number
  code: string
  name: string
  unit: string | null
  warnMin: number | null
  warnMax: number | null
  alarmMin: number | null
  alarmMax: number | null
  lastValue: number | null
  lastStatus: MetricStatus
  lastReportedAt: string | null
  createdAt: string
}
export interface SystemWithMetrics extends System {
  summary: Record<MetricStatus, number>
  metrics: Metric[]
}
export interface MetricRecord {
  id: string
  metricId: number
  value: number
  status: MetricStatus
  channel: IngestChannel
  payload: string | null
  reportedAt: string
  createdAt: string
  metric?: Metric
}
export interface ApiKeySummary {
  id: number
  systemIds: number[]
  allSystems: boolean
  permissions: ApiPermission[]
  name: string
  maskedKey: string
  enabled: boolean
  lastUsedAt: string | null
  createdAt: string
}
export interface AlertChannel {
  id: number
  type: AlertChannelType
  name: string
  target: string
  secret: string | null
  enabled: boolean
  createdAt: string
}
export interface AlertRule {
  id: number
  metricId: number
  channelId: number
  notifyWarning: boolean
  notifyAlarm: boolean
  cooldownSeconds: number
  enabled: boolean
  createdAt: string
  metric?: Metric
  channel?: AlertChannel
}
export interface SilenceRule {
  id: number
  systemId: number | null
  metricId: number | null
  startAt: string
  endAt: string
  reason: string
  createdAt: string
  system?: System
  metric?: Metric
}
export interface ManagedUser {
  id: number
  username: string
  role: UserRole
  enabled: boolean
  createdAt: string
}
export interface AuditLog {
  id: string
  userId: number | null
  username: string
  action: string
  target: string
  detail: string | null
  createdAt: string
}

// ---- 查询响应 ----
export interface SystemsResponse { systems: SystemWithMetrics[], globalRetentionDays: number | null }
export interface SystemDetailResponse { system: System, metrics: Metric[] }
export interface RecordsResponse {
  list: MetricRecord[]
  total: number
  page: number
  pageSize: number
  nextCursor: number | null
}
export interface StatsResponse {
  metric: Pick<Metric, 'id' | 'code' | 'name' | 'unit'>
  windowSeconds: number
  from: string
  to: string
  points: Array<{ t: string, min: number, max: number, avg: number, count: number }>
}
export interface ApiKeysResponse { apiKeys: ApiKeySummary[] }
export interface CreateApiKeyResponse {
  apiKey: {
    id: number
    systemIds: number[]
    allSystems: boolean
    permissions: ApiPermission[]
    name: string
    enabled: boolean
    key: string
  }
}
export interface RotateApiKeyResponse { apiKey: { id: number, key: string } }
export interface AuditResponse {
  list: AuditLog[]
  total: number
  page: number
  pageSize: number
}

// ---- 推送 / 出站 ----
export interface MetricUpdateEvent {
  type: 'metric.update'
  data: {
    systemId: number
    systemCode: string
    metricId: number
    metricCode: string
    metricName: string
    unit: string | null
    value: number
    status: MetricStatus
    reportedAt: string
  }
}
export type DashboardWsMessage =
  | MetricUpdateEvent
  | { type: 'error', code: 'unauthorized', message: 'unauthorized' }

export interface WebhookAlert {
  type: 'metric.alert'
  data: {
    systemCode: string
    systemName: string
    metricCode: string
    metricName: string
    value: number
    unit: string | null
    status: 'warning' | 'alarm'
    prevStatus: MetricStatus
    reportedAt: string
    text: string
  }
}
```

---

## 附录 B：接入自检清单

**数据提交方**

- [ ] 从管理员处拿到：`systemCode`、所有 `metricCode`、ApiKey 明文、服务地址（MQTT 还需 Broker 地址与账号）
- [ ] ApiKey 保存在配置/密钥管理中，不写进代码仓库，不打印到日志
- [ ] 用 curl 发一条 HTTP 上报，确认返回 `200 {"recordId","status"}`
- [ ] `value` 始终是数字；`timestamp` 省略或是带时区的 ISO 8601，且设备时钟已校准
- [ ] 已接受平台将 `value` 四舍五入到两位小数
- [ ] 一条报文一个值，发送频率 ≤ 20 条/秒/Key
- [ ] 429/5xx/网络错误做指数退避重试并复用原 `timestamp`；400/401/403/404 不重试并告警
- [ ] WS：等到 `auth.ok` 再发数据，断线自动重连并重新认证
- [ ] MQTT：payload 含 `apiKey`，不设 retain，已接受"无回执、可能丢失"
- [ ] 在看板或 `GET /api/records?metricId=` 中看到数据

**数据消费方**

- [ ] 已按最小权限设置 `permissions`；跨系统程序只选择必需的 `systemIds`，确需未来系统时才开启 `allSystems`
- [ ] 需要使用网页控制台时，已在登录页选择 ApiKey 登录，并确认页面只展示已授权功能与系统
- [ ] HTTP 查询带 `X-Api-Key`；收到 401 时更换 Key，收到 403 时核对系统/指标是否属于该 Key
- [ ] ApiKey REST 查询频率不超过 5 次/秒；429 时退避
- [ ] 先 `GET /api/systems` 取快照，再订阅 `/ws/dashboard` 增量更新
- [ ] 看板 WS 不等待 `auth.ok`；连接建立后直接等待 `metric.update`，断线重连后重新拉快照
- [ ] 浏览器若使用 `?apiKey=` 连接 WS，已确认 HTTPS/WSS 且代理日志不会记录查询串
- [ ] 全量拉取历史记录时使用 `beforeId` 游标分页
- [ ] 记录 `id` 按字符串处理，时间使用 `reportedAt`
- [ ] Webhook 接收端 10 秒内返回 2xx，能容忍重复通知

**平台管理员**

- [ ] 生产环境已设置强随机 `JWT_SECRET`，未使用开发 seed 密码/Key
- [ ] ApiKey 按调用方拆分，完整 Key 只交付一次，并准备禁用/轮换流程
- [ ] 授予 `apiKeys:manage` 时已确认该 Key 只能继续下放自身权限与系统范围的子集
- [ ] 仅为确实需要创建系统或执行全局清理的 Key 开启 `allSystems`
- [ ] 删除系统/指标前已备份历史数据；已知 `PUT /api/metrics/:id` 缺陷未被自动化流程调用
- [ ] 若多实例部署，已接受限流/冷却/缓存不共享，或在网关/共享存储层补齐
