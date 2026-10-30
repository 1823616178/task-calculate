// API 接口目录：供 /api-docs 页面展示。内容与 doc/API.md、server/api 实现保持一致，
// 新增或修改接口时请同步更新本文件。

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'WS' | 'MQTT'

/** 调用所需凭证：admin 表示 JWT admin 或具备对应 permission 的 ApiKey。 */
export type ApiAuth = 'public' | 'login' | 'admin' | 'apiKey' | 'read'

export interface ApiParam {
  name: string
  /** path 路径参数 / query 查询参数 / body 请求体字段 / header 请求头 */
  in: 'path' | 'query' | 'body' | 'header'
  type: string
  required?: boolean
  desc: string
}

export interface ApiEndpoint {
  method: ApiMethod
  path: string
  summary: string
  auth: ApiAuth
  desc?: string
  params?: ApiParam[]
  request?: string
  response?: string
  /** 主要错误码 → 含义 */
  errors?: Record<string, string>
}

export interface ApiGroup {
  key: string
  label: string
  desc: string
  endpoints: ApiEndpoint[]
}

export const API_AUTH_LABELS: Record<ApiAuth, string> = {
  public: '公开',
  login: '登录',
  admin: 'admin / 授权 ApiKey',
  apiKey: 'ApiKey',
  read: '登录 / ApiKey',
}

export const API_GROUPS: ApiGroup[] = [
  {
    key: 'ingest',
    label: '数据上报',
    desc: 'ApiKey 认证，要求 data:write；三个通道共用同一报文与处理管道，只能写入 Key 授权的系统',
    endpoints: [
      {
        method: 'POST',
        path: '/api/ingest',
        summary: 'HTTP 上报一条检测值',
        auth: 'apiKey',
        desc: '不支持批量，一条报文一个值；必须带 Content-Length（勿用 chunked），单报文 ≤64KB。每 Key 20 条/秒（突发 50）。',
        params: [
          { name: 'X-Api-Key', in: 'header', type: 'string', required: true, desc: '形如 dk_xxxx 的上报 Key' },
          { name: 'systemCode', in: 'body', type: 'string 1~64', required: true, desc: 'Key 授权系统的 code' },
          { name: 'metricCode', in: 'body', type: 'string 1~64', required: true, desc: '系统下已存在的指标 code' },
          { name: 'value', in: 'body', type: 'number', required: true, desc: '有限数；不要传 null / "" / 布尔' },
          { name: 'timestamp', in: 'body', type: 'string ≤40', desc: 'ISO 8601 带时区；缺省为服务端接收时间' },
        ],
        request: '{"systemCode": "line1", "metricCode": "temp", "value": 87.5, "timestamp": "2026-09-17T17:30:00+08:00"}',
        response: '{"recordId": 123, "status": "warning"}',
        errors: {
          400: '报文非法',
          401: 'Key 无效或已禁用',
          403: 'Key 不属于该 systemCode（或系统不存在）',
          404: 'metricCode 不存在',
          411: '缺少 Content-Length',
          413: '请求体超过 64KB',
          429: '限流 / 过载，可退避重试',
        },
      },
      {
        method: 'WS',
        path: '/ws/ingest',
        summary: 'WebSocket 长连接上报',
        auth: 'apiKey',
        desc: '连接后先收到 auth.required，发送 apiKey 完成认证，之后每帧一条报文。回执不带请求 id 且可能乱序；Key 被禁用/轮换后下一帧收到 "api key revoked" 并断开。',
        request: '← {"type": "auth.required"}\n→ {"apiKey": "dk_..."}\n← {"type": "auth.ok"}\n→ {"systemCode": "line1", "metricCode": "temp", "value": 87.5}',
        response: '{"type": "ingest.ok", "recordId": 124, "status": "warning"}\n{"type": "error", "message": "..."}',
      },
      {
        method: 'MQTT',
        path: 'metric/{systemCode}/{metricCode}',
        summary: 'MQTT 上报（按主题寻址）',
        auth: 'apiKey',
        desc: '服务端以 QoS0 订阅、无回执；不要设置 retain。也可发布到主题 "ingest"，payload 中带 systemCode 与 metricCode；payload 中的同名字段优先于主题。',
        request: '{"apiKey": "dk_...", "value": 87.5, "timestamp": "2026-09-17T17:30:00+08:00"}',
      },
    ],
  },
  {
    key: 'read',
    label: '按编码读取',
    desc: '登录用户可读全部系统；具有 data:read 的 ApiKey 可读其 systemIds 范围，allSystems=true 时可读全部（每 Key 5 次/秒，突发 20）',
    endpoints: [
      {
        method: 'GET',
        path: '/api/systems/by-code/:code',
        summary: '按系统编码获取系统与指标当前值',
        auth: 'read',
        params: [
          { name: 'code', in: 'path', type: 'string', required: true, desc: '系统 code' },
          { name: 'X-Api-Key', in: 'header', type: 'string', desc: '不带 JWT 时使用' },
        ],
        response: '{"system": {"id": 1, "code": "line1", "name": "一号产线", ...}, "metrics": [{"id": 1, "code": "temp", "lastValue": 66.6, "lastStatus": "normal", ...}]}',
        errors: { 401: '未认证或 Key 无效', 403: '缺 data:read 或访问未授权系统', 404: '系统不存在（JWT）', 429: '限流' },
      },
      {
        method: 'GET',
        path: '/api/systems/by-code/:code/records',
        summary: '按系统编码查询历史记录',
        auth: 'read',
        desc: '分页语义同 GET /api/records。',
        params: [
          { name: 'code', in: 'path', type: 'string', required: true, desc: '系统 code' },
          { name: 'metricCode', in: 'query', type: 'string', desc: '按指标 code 过滤' },
          { name: 'status', in: 'query', type: 'normal|warning|alarm|none', desc: '按状态过滤' },
          { name: 'from / to', in: 'query', type: 'ISO 8601', desc: 'reportedAt 闭区间' },
          { name: 'pageSize', in: 'query', type: 'int 1~100', desc: '默认 20' },
          { name: 'page', in: 'query', type: 'int ≥1', desc: '偏移分页，默认 1' },
          { name: 'beforeId', in: 'query', type: 'int', desc: '游标分页，传上一页的 nextCursor' },
        ],
        response: '{"list": [...], "total": 1, "page": 1, "pageSize": 20, "nextCursor": null}',
        errors: { 403: 'ApiKey 越权', 404: 'metricCode 不存在' },
      },
    ],
  },
  {
    key: 'auth',
    label: '认证与健康',
    desc: '支持账号密码登录，也支持 ApiKey 登录；API 调用可直接发送 X-Api-Key，并按权限及系统范围鉴权',
    endpoints: [
      {
        method: 'POST',
        path: '/api/auth/login',
        summary: '登录',
        auth: 'public',
        desc: '账号密码登录写入 tc_token；具有 data:read 的 Key 也可提交 {"apiKey":"dk_..."}，写入 httpOnly tc_api_key。连续失败 5 次锁定 15 分钟。',
        params: [
          { name: 'username', in: 'body', type: 'string 1~64', desc: '账号密码登录时必填' },
          { name: 'password', in: 'body', type: 'string 1~128', desc: '账号密码登录时必填' },
          { name: 'apiKey', in: 'body', type: 'string', desc: 'ApiKey 登录时提交；存在合法 apiKey 时优先按 Key 登录' },
        ],
        request: '{"username": "admin", "password": "******"}',
        response: '{"token": "eyJhbGciOi..." | null, "user": {"id": 1, "username": "admin", "role": "admin", "authType": "user|apiKey", "permissions": [], "systemIds": [], "allSystems": true}}',
        errors: { 400: '字段缺失', 401: '用户名/密码错误或 Key 无效', 403: '账号已禁用或 Key 缺少 data:read', 429: '已锁定，见 Retry-After' },
      },
      {
        method: 'POST',
        path: '/api/auth/logout',
        summary: '退出登录',
        auth: 'public',
        desc: '同时清除 tc_token 与 tc_api_key Cookie；不会吊销已签发的 JWT。',
        response: '{"ok": true}',
      },
      {
        method: 'GET',
        path: '/api/auth/me',
        summary: '当前用户',
        auth: 'login',
        desc: 'JWT 内容取自 token；ApiKey 会重新校验启用状态、权限和系统范围。',
        response: '{"user": {"id": 1, "username": "admin", "role": "admin"}}',
      },
      {
        method: 'GET',
        path: '/api/health',
        summary: '健康检查',
        auth: 'public',
        desc: 'db 与 mqtt 都正常时 200，否则 503（响应体不变）。',
        response: '{"ok": true, "db": true, "mqtt": true, "dashboardPeers": 1, "time": "2026-09-17T09:19:24.870Z"}',
      },
    ],
  },
  {
    key: 'systems',
    label: '系统与指标',
    desc: '读取要求 data:read；写操作分别要求 systems:manage / metrics:manage，并继续校验 Key 的系统范围。PUT 均为部分更新',
    endpoints: [
      {
        method: 'GET',
        path: '/api/systems',
        summary: '系统列表 + 指标 + 状态汇总',
        auth: 'read',
        desc: '获取指标当前值与状态的最快方式，也是 code → id 的映射来源。ApiKey 返回其授权的一个或多个系统。',
        response: '{"systems": [{"id": 1, "code": "line1", "name": "一号产线", "summary": {"normal": 1, "warning": 0, "alarm": 0, "none": 2}, "metrics": [...]}], "globalRetentionDays": null}',
      },
      {
        method: 'GET',
        path: '/api/systems/:id',
        summary: '系统详情',
        auth: 'read',
        desc: 'ApiKey 只能读取授权系统；范围外系统或不存在的系统返回 403。',
        response: '{"system": {...}, "metrics": [...]}',
        errors: { 400: 'invalid id', 404: 'system not found' },
      },
      {
        method: 'POST',
        path: '/api/systems',
        summary: '创建系统',
        auth: 'admin',
        params: [
          { name: 'code', in: 'body', type: 'string 1~64', required: true, desc: '^[\\w-]+$，全局唯一，不可修改' },
          { name: 'name', in: 'body', type: 'string 1~128', required: true, desc: '名称' },
          { name: 'description', in: 'body', type: 'string | null', desc: '≤512' },
          { name: 'retentionDays', in: 'body', type: 'int | null', desc: '0~36500；null 跟随全局，0 永久保留' },
        ],
        request: '{"code": "line1", "name": "一号产线", "retentionDays": 90}',
        response: '{"system": {...}}',
        errors: { 409: 'code 重复' },
      },
      {
        method: 'PUT',
        path: '/api/systems/:id',
        summary: '更新系统',
        auth: 'admin',
        desc: '可改 name、description、retentionDays；code 会被忽略。',
        response: '{"system": {...}}',
      },
      {
        method: 'DELETE',
        path: '/api/systems/:id',
        summary: '删除系统',
        auth: 'admin',
        desc: '级联删除该系统下所有指标、历史记录、告警规则与静默窗口；全局 ApiKey 保留，只移除该系统的授权范围。',
        response: '{"ok": true}',
      },
      {
        method: 'POST',
        path: '/api/metrics',
        summary: '创建指标',
        auth: 'admin',
        params: [
          { name: 'systemId', in: 'body', type: 'int', required: true, desc: '所属系统 id' },
          { name: 'code', in: 'body', type: 'string 1~64', required: true, desc: '系统内唯一，不可修改' },
          { name: 'name', in: 'body', type: 'string 1~128', required: true, desc: '名称' },
          { name: 'unit', in: 'body', type: 'string | null', desc: '≤32' },
          { name: 'warnMin / warnMax / alarmMin / alarmMax', in: 'body', type: 'number | null', desc: '阈值' },
        ],
        request: '{"systemId": 1, "code": "temp", "name": "温度", "unit": "℃", "warnMax": 70, "alarmMax": 90}',
        response: '{"metric": {...}}',
        errors: { 400: '阈值关系不合法', 404: '系统不存在', 409: 'code 重复' },
      },
      {
        method: 'PUT',
        path: '/api/metrics/:id',
        summary: '更新指标',
        auth: 'admin',
        desc: '可改 name、unit 与四个阈值（传 null 清除阈值）。',
        response: '{"metric": {...}}',
      },
      {
        method: 'DELETE',
        path: '/api/metrics/:id',
        summary: '删除指标',
        auth: 'admin',
        desc: '级联删除该指标的历史记录与告警规则。',
        response: '{"ok": true}',
      },
      {
        method: 'GET',
        path: '/api/metrics/:id/stats',
        summary: '时间窗口聚合（趋势图数据）',
        auth: 'read',
        desc: 'ApiKey 只能读取授权系统的指标。没有数据的时间桶不会出现在 points 中；1d 窗口按 UTC 零点对齐。',
        params: [
          { name: 'window', in: 'query', type: 'auto|1m|5m|15m|1h|1d', desc: '默认 auto，使点数 ≤240' },
          { name: 'from', in: 'query', type: 'ISO 8601', desc: '默认 to 前 24 小时' },
          { name: 'to', in: 'query', type: 'ISO 8601', desc: '默认当前时间；区间最长 366 天' },
        ],
        response: '{"metric": {"id": 1, "code": "temp", "name": "温度", "unit": "℃"}, "windowSeconds": 3600, "from": "...", "to": "...", "points": [{"t": "2026-09-17T09:00:00.000Z", "min": 66.6, "max": 66.6, "avg": 66.6, "count": 1}]}',
      },
    ],
  },
  {
    key: 'records',
    label: '历史记录',
    desc: '登录用户可跨系统查询；ApiKey 强制限定到 systemIds/allSystems 范围。支持游标分页与 CSV 导出',
    endpoints: [
      {
        method: 'GET',
        path: '/api/records',
        summary: '查询历史记录',
        auth: 'read',
        desc: '按 reportedAt 降序、id 降序。ApiKey 省略 systemId 时返回全部授权系统，指定范围外系统/指标返回 403。全量拉取推荐循环 beforeId=nextCursor 直到为 null。',
        params: [
          { name: 'systemId', in: 'query', type: 'int', desc: '按系统过滤' },
          { name: 'metricId', in: 'query', type: 'int', desc: '按指标过滤' },
          { name: 'status', in: 'query', type: 'normal|warning|alarm|none', desc: '按状态过滤' },
          { name: 'from / to', in: 'query', type: 'ISO 8601', desc: 'reportedAt 闭区间' },
          { name: 'pageSize', in: 'query', type: 'int 1~100', desc: '默认 20' },
          { name: 'page', in: 'query', type: 'int ≥1', desc: '偏移分页，默认 1' },
          { name: 'beforeId', in: 'query', type: 'int', desc: '游标分页（推荐），传了则忽略 page' },
        ],
        response: '{"list": [{"id": "1", "metricId": 1, "value": 66.6, "status": "normal", "channel": "http", "reportedAt": "...", "metric": {...}}], "total": 1, "page": 1, "pageSize": 20, "nextCursor": null}',
        errors: { 400: 'invalid beforeId' },
      },
      {
        method: 'GET',
        path: '/api/records/export',
        summary: '导出 CSV',
        auth: 'read',
        desc: '筛选与 ApiKey 范围规则同上（无分页），另有 limit 1~100000（默认 10000）。按 reportedAt 升序流式输出，带 UTF-8 BOM。',
        response: 'id,system,metric,value,unit,status,channel,reported_at\n1,line1,温度(temp),66.6,℃,normal,http,2026-09-17T09:19:40.000Z',
      },
    ],
  },
  {
    key: 'apiKeys',
    label: 'ApiKey',
    desc: '要求 apiKeys:manage。Key 具有 permissions + systemIds/allSystems；不能下放当前 Key 自己没有的权限或范围。完整 key 只显示一次',
    endpoints: [
      {
        method: 'GET',
        path: '/api/api-keys',
        summary: 'Key 列表',
        auth: 'admin',
        params: [{ name: 'systemId', in: 'query', type: 'int', desc: '按授权系统过滤（可选）' }],
        response: '{"apiKeys": [{"id": 1, "systemIds": [1,2], "allSystems": false, "permissions": ["data:read","data:write"], "name": "网关", "maskedKey": "dk_12345…", "enabled": true}]}',
      },
      {
        method: 'POST',
        path: '/api/api-keys',
        summary: '创建 Key',
        auth: 'admin',
        params: [
          { name: 'name', in: 'body', type: 'string 1~128', required: true, desc: '名称' },
          { name: 'systemIds', in: 'body', type: 'int[]', desc: '授权系统；allSystems=false 时至少一项' },
          { name: 'allSystems', in: 'body', type: 'boolean', desc: '授权全部现有及未来系统，默认 false' },
          { name: 'permissions', in: 'body', type: 'ApiPermission[]', desc: '默认 data:read + data:write' },
        ],
        response: '{"apiKey": {"id": 1, "systemIds": [1,2], "allSystems": false, "permissions": ["data:read","data:write"], "name": "网关", "enabled": true, "key": "dk_..."}}',
      },
      {
        method: 'PUT',
        path: '/api/api-keys/:id',
        summary: '修改名称 / 启停 / 权限 / 系统范围',
        auth: 'admin',
        request: '{"name": "网关", "enabled": false}',
        response: '{"apiKey": {"id": 1, "systemIds": [1,2], "allSystems": false, "permissions": ["data:read"], ...}}',
      },
      {
        method: 'POST',
        path: '/api/api-keys/:id/rotate',
        summary: '轮换 Key',
        auth: 'admin',
        response: '{"apiKey": {"id": 1, "key": "dk_..."}}',
      },
      {
        method: 'DELETE',
        path: '/api/api-keys/:id',
        summary: '删除 Key',
        auth: 'admin',
        response: '{"ok": true}',
      },
    ],
  },
  {
    key: 'alert',
    label: '告警',
    desc: '要求 alerts:manage；规则与静默受系统范围约束。通知渠道是全局资源，写入/删除/测试还要求 allSystems=true',
    endpoints: [
      {
        method: 'GET',
        path: '/api/alert/channels',
        summary: '渠道列表',
        auth: 'admin',
        response: '{"channels": [{"id": 1, "type": "webhook", "name": "...", "target": "https://...", "secret": null, "enabled": true}]}',
      },
      {
        method: 'POST',
        path: '/api/alert/channels',
        summary: '创建渠道',
        auth: 'admin',
        params: [
          { name: 'type', in: 'body', type: 'webhook|dingtalk|wecom|email', required: true, desc: '渠道类型' },
          { name: 'name', in: 'body', type: 'string 1~128', required: true, desc: '名称' },
          { name: 'target', in: 'body', type: 'string 1~512', required: true, desc: '机器人/回调 URL；email 为逗号分隔收件人' },
          { name: 'secret', in: 'body', type: 'string | null', desc: '钉钉加签密钥' },
          { name: 'enabled', in: 'body', type: 'boolean', desc: '默认 true' },
        ],
        response: '{"channel": {...}}',
      },
      { method: 'PUT', path: '/api/alert/channels/:id', summary: '更新渠道（部分更新）', auth: 'admin', response: '{"channel": {...}}' },
      { method: 'DELETE', path: '/api/alert/channels/:id', summary: '删除渠道', auth: 'admin', desc: '级联删除关联规则。', response: '{"ok": true}' },
      {
        method: 'POST',
        path: '/api/alert/channels/:id/test',
        summary: '发送测试通知',
        auth: 'admin',
        response: '{"ok": true}',
        errors: { 502: '发送失败' },
      },
      {
        method: 'GET',
        path: '/api/alert/rules',
        summary: '规则列表',
        auth: 'admin',
        params: [{ name: 'systemId', in: 'query', type: 'int', desc: '按系统过滤' }],
        response: '{"rules": [{"id": 1, "metricId": 1, "channelId": 1, "notifyWarning": true, "notifyAlarm": true, "cooldownSeconds": 300, "enabled": true, "metric": {...}, "channel": {...}}]}',
      },
      {
        method: 'POST',
        path: '/api/alert/rules',
        summary: '创建规则',
        auth: 'admin',
        params: [
          { name: 'metricId', in: 'body', type: 'int', required: true, desc: '创建后不可改' },
          { name: 'channelId', in: 'body', type: 'int', required: true, desc: '创建后不可改' },
          { name: 'notifyWarning', in: 'body', type: 'boolean', desc: '默认 true' },
          { name: 'notifyAlarm', in: 'body', type: 'boolean', desc: '默认 true' },
          { name: 'cooldownSeconds', in: 'body', type: 'int 0~86400', desc: '默认 300；0 不限' },
          { name: 'enabled', in: 'body', type: 'boolean', desc: '默认 true' },
        ],
        response: '{"rule": {...}}',
        errors: { 409: '同一指标 + 渠道已有规则' },
      },
      {
        method: 'PUT',
        path: '/api/alert/rules/:id',
        summary: '更新规则',
        auth: 'admin',
        desc: '仅可改 notifyWarning / notifyAlarm / cooldownSeconds / enabled。',
        response: '{"rule": {...}}',
      },
      { method: 'DELETE', path: '/api/alert/rules/:id', summary: '删除规则', auth: 'admin', response: '{"ok": true}' },
      {
        method: 'GET',
        path: '/api/alert/silences',
        summary: '静默窗口列表',
        auth: 'admin',
        desc: '带 systemId 时包含全局 + 该系统 + 该系统下指标级的静默。',
        params: [{ name: 'systemId', in: 'query', type: 'int', desc: '按系统过滤' }],
        response: '{"silences": [...]}',
      },
      {
        method: 'POST',
        path: '/api/alert/silences',
        summary: '创建静默窗口',
        auth: 'admin',
        desc: 'metricId 非空为指标级；仅 systemId 非空为系统级；都为空为全局。静默期间数据照常入库，只是不发通知。',
        params: [
          { name: 'systemId', in: 'body', type: 'int | null', desc: '系统' },
          { name: 'metricId', in: 'body', type: 'int | null', desc: '指标' },
          { name: 'startAt / endAt', in: 'body', type: 'ISO 8601', required: true, desc: 'endAt > startAt' },
          { name: 'reason', in: 'body', type: 'string ≤255', desc: '默认空' },
        ],
        response: '{"silence": {...}}',
      },
      { method: 'DELETE', path: '/api/alert/silences/:id', summary: '删除静默窗口', auth: 'admin', response: '{"ok": true}' },
    ],
  },
  {
    key: 'admin',
    label: '用户与审计',
    desc: '分别要求 users:manage、audit:read、maintenance:run；清理操作还要求 allSystems=true',
    endpoints: [
      {
        method: 'GET',
        path: '/api/users',
        summary: '用户列表',
        auth: 'admin',
        response: '{"users": [{"id": 1, "username": "admin", "role": "admin", "enabled": true, "createdAt": "..."}], "currentUserId": 1}',
      },
      {
        method: 'POST',
        path: '/api/users',
        summary: '创建用户',
        auth: 'admin',
        params: [
          { name: 'username', in: 'body', type: 'string 1~64', required: true, desc: '^[\\w-]+$' },
          { name: 'password', in: 'body', type: 'string 6~128', required: true, desc: '密码' },
          { name: 'role', in: 'body', type: 'admin|viewer', desc: '默认 viewer' },
        ],
        response: '{"user": {...}}',
        errors: { 409: '用户名重复' },
      },
      {
        method: 'PUT',
        path: '/api/users/:id',
        summary: '更新用户',
        auth: 'admin',
        desc: '可改 password、role、enabled。不能禁用自己，不能禁用或降级最后一个可用管理员。',
        response: '{"user": {"id": 2, "username": "viewer", "role": "viewer", "enabled": true}}',
      },
      {
        method: 'DELETE',
        path: '/api/users/:id',
        summary: '删除用户',
        auth: 'admin',
        desc: '不能删除自己或最后一个可用管理员。',
        response: '{"ok": true}',
      },
      {
        method: 'GET',
        path: '/api/audit',
        summary: '审计日志',
        auth: 'admin',
        params: [
          { name: 'username', in: 'query', type: 'string', desc: '精确匹配' },
          { name: 'action', in: 'query', type: 'string', desc: '前缀匹配，如 apiKey.' },
          { name: 'from / to', in: 'query', type: 'ISO 8601', desc: '时间范围' },
          { name: 'page / pageSize', in: 'query', type: 'int', desc: 'pageSize 1~100，默认 50' },
        ],
        response: '{"list": [{"id": "12", "userId": 1, "username": "admin", "action": "apiKey.create", "target": "line1/网关", "detail": null, "createdAt": "..."}], "total": 12, "page": 1, "pageSize": 50}',
      },
      {
        method: 'POST',
        path: '/api/maintenance/cleanup',
        summary: '立即执行保留策略清理',
        auth: 'admin',
        desc: '平时每天 03:05 自动执行。',
        response: '{"cleaned": 5230, "details": [{"systemId": 1, "days": 90, "deleted": 5230}]}',
      },
    ],
  },
  {
    key: 'realtime',
    label: '实时推送',
    desc: '看板与第三方大屏实时接收最新值；ApiKey 要求 data:read，并只接收其授权系统',
    endpoints: [
      {
        method: 'WS',
        path: '/ws/dashboard',
        summary: '指标实时更新推送',
        auth: 'read',
        desc: '同源页面自动携带 Cookie；程序可用 ?token=<JWT> 或握手头 X-Api-Key。浏览器原生 WebSocket 可用 ?apiKey=<key>（注意查询串日志泄漏）。连接后不推送初始快照，请先调 GET /api/systems 再增量应用。',
        response: '{"type": "metric.update", "data": {"systemId": 1, "systemCode": "line1", "metricId": 1, "metricCode": "temp", "metricName": "温度", "unit": "℃", "value": 87.5, "status": "warning", "reportedAt": "2026-09-17T09:30:00.000Z"}}',
      },
    ],
  },
]
