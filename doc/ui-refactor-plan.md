# UI 优化方案

> 目标：把当前"能用但简陋"的界面升级为一套**统一的设计系统 + 组件库 + 导航骨架**，
> 顺带修掉体检中发现的真实缺陷。范围覆盖全部 8 个页面、5 个业务组件、导航、弹窗与相关交互逻辑。
>
> 📦 归档说明（2026-09-05）：本方案已基本实施落地——`layouts/`、`app/components/ui/` 组件库、
> 导航骨架、暗色模式均已就位。下文"现状体检"描述的是改造前的历史状态，非当前现状；验收清单仅作存档，不逐项更新。

---

## 一、现状体检

### 1.1 架构层：没有布局层，一切靠页面自己拼

- `app/app.vue` 只有 3 行 —— `<NuxtPage />`，**没有 `layouts/`**。
- 于是 9 处页面各写一份 `&_header {}`（`grep '&_header {' app/pages` = 9 处）。
- 后果最严重的一条：**主题切换按钮、退出登录、用户名、实时连接状态只存在于看板页 `app/pages/index.vue`**。
  用户进入 `/records`、`/users`、`/audit`、`/channels`、`/systems/[id]` 后，
  既不能切主题也不能登出，必须先"返回看板"。这不是审美问题，是功能缺失。

### 1.2 导航层：扁平文字链，无状态、无层级、无回路

- 看板页的导航是一排 6 个裸 `NuxtLink`（`index.vue:9-13`），无当前页高亮、无分组、无图标。
- 其余页面的导航只有一个"返回看板"（`records.vue:5`、`channels.vue:5`、`users.vue:5`、`audit.vue:5`）。
  **横向跳转全部断链**：从历史记录去审计日志必须回看板中转。
- `systems/[id].vue:4` 只有"← 返回"，**没有面包屑**，不知道自己在哪一层。
- admin 专属入口（通知渠道/用户/审计）与通用入口混在同一排，权限边界在视觉上不可见。
- `channels.vue:105` / `users.vue` 用 `onMounted` 里 `navigateTo('/')` 做鉴权 —— 非 admin 会先看到页面闪一下再被踢走。

### 1.3 弹窗与反馈层：**完全没有弹窗体系，全是浏览器原生对话框**

全项目 0 处 modal / dialog / drawer / toast（`grep -i` 结果为空）。取而代之的是：

| 用法 | 位置 | 问题 |
|---|---|---|
| `confirm()` × 6 | `systems/index.vue:107`、`channels.vue:182`、`users.vue:165`、`systems/[id].vue:240`、`ApiKeyManager.vue:117,129`、`SilenceManager.vue:146` | 系统级弹窗，无法配色/暗色/文案排版；删除系统这种**级联删除全部历史记录**的操作与普通删除同等确认强度 |
| `alert()` × 13 | 遍布各页错误分支 | 阻塞式、丑、无法区分成功/失败/警告 |
| `prompt()` × 1 | `users.vue:139` 重置密码 | **密码在原生输入框里明文可见**，且无二次确认、无强度校验 |

同时反馈通道也不统一：有的错误写进卡片内的 `<p class="..._error">`，有的走 `alert()`，
`channels.vue` 的成功提示又用 `hint` 文本 —— 同一个应用里三套反馈范式。

### 1.4 表单层：全是"一行 flex 塞 N 个 input"

- `systems/index.vue:11-17`：编码/名称/描述 + 按钮挤一行。
- `channels.vue:9-25`：类型/名称/目标/密钥 + 按钮挤一行。
- `users.vue:9-16`、`AlertRuleManager.vue:4-30`、`SilenceManager.vue:4-19` 同构。
- **最严重**：`systems/[id].vue:99-108` 新建指标，**一行 7 个 input**
  （编码、名称、单位、预警下限、预警上限、告警下限、告警上限），
  全靠 placeholder 表意，没有 label、没有必填标记、没有字段分组，
  也没有"预警区间必须包含在告警区间内"这类跨字段校验提示。
- 指标编辑更奇特（`systems/[id].vue:44-72`）：admin 打开页面时**表格每一行的每个单元格直接就是输入框**，
  一个 9 列表格里同时有 6 个 input × N 行，无编辑态/浏览态之分，误改风险高且视觉噪音极大。

### 1.5 组件层：复用率约等于零

| 重复项 | 次数 |
|---|---|
| `background: $color-primary`（主按钮样式手抄） | 12 |
| `border-collapse: collapse`（表格样式手抄） | 9 |
| `padding: 7px 10px`（输入框尺寸硬编码） | 11 |
| `border-radius: 6px` 硬编码 | 31 |
| `font-size: 13px` 硬编码 | 31 |

根因有二：
1. **token 太薄**。`_variables.scss` 只有 12 个颜色 + `$radius-card: 8px` + `$spacing: 16px`。
   没有间距梯度、字号梯度、控件高度、阴影、层级、动效时长 —— 所以只能到处写死数值。
2. **命名规范反向阻碍复用**。`doc/class-naming.md` 强制 `container_{页面名}_...`，
   同一个"主按钮"在 6 个页面必须写 6 个不同 class 名，样式自然抄 6 遍。
   规范里只给了"全局共享组件用组件名顶替第二段"一句话，但从未落地成基础组件。

### 1.6 视觉层

- 无阴影、无层次，卡片与背景只靠 1px 边框区分，整体扁平发灰。
- 状态**只用颜色**编码（正常绿/预警黄/告警红），色觉障碍用户不可辨。
- `StatusBadge` 暗色模式下白字压在 `--tc-warning: #fbbf24` 上，对比度不足 3:1。
- 无 `:focus-visible` 样式，键盘导航看不见焦点。
- 表格操作列里"详情/删除"同为纯文字，**危险操作与普通操作视觉权重相同**。
- 无骨架屏。看板加载态只有一行居中的"加载中…"（`index.vue:22`），
  `systems/index.vue` 的表格甚至连空态行都没有（channels/records/audit 有，systems 漏了）。
- 全站 `max-width: 1200px` 固定，**无任何媒体查询**，窄屏下 9 列表格直接横向溢出、头部链接换行错位。

### 1.7 逻辑缺陷（体检中发现的真实 bug）

1. **`TrendChart.vue` 变量遮蔽导致运行时报错**
   `:70` `const window = ref<'auto'|...>('auto')` 遮蔽了全局 `window`，
   `:77` `window.addEventListener('resize', resize)` 实际调用的是 ref 对象 → `TypeError`，
   `onMounted` 抛错，**图表 resize 监听从未注册**，`:81` 的解绑同样无效。
2. **暗色模式漏配**
   `systems/index.vue` 的 `&_create_input` 没写 `background`（channels.vue 写了 `var(--tc-card-bg)`），
   暗色下这三个输入框是白底黑框，与全站割裂。
3. **ECharts 不跟随主题**
   `TrendChart` 的 `setOption` 使用 ECharts 默认配色（深灰轴线/文字），暗色模式下几乎不可读，
   且切换主题时没有任何 `watch` 去重绘。
4. **缺少 `app/error.vue`**，404 与运行时错误落到 Nuxt 默认错误页，与应用风格完全不符。
5. **鉴权白屏**：`auth.global.ts` 首次进入要 `await auth.fetchMe()`，期间没有任何 loading 反馈。
6. **表单内按钮缺 `type="button"`**，`login.vue` 之外的表单若后续包 `<form>` 会误触提交。
7. **实时连接断开只有一个静态 badge**，不提示、不可手动重连。

---

## 二、设计原则

1. **一处定义，处处复用**：token → 基础组件 → 页面。页面里不应再出现 `padding: 7px 10px`。
2. **反馈单一范式**：破坏性操作走 Confirm 弹窗，异步结果走 Toast，表单错误走字段内联。三者不混用。
3. **表单进弹窗**：列表页只负责"看"，"增/改"统一进 Modal，页面主体让位给数据。
4. **无障碍不是可选项**：焦点可见、状态不只靠颜色、弹窗可 ESC 可 focus trap、操作按钮有 aria-label。
5. **渐进式落地**：每一批改动独立可验收，不做一次性大爆炸重写。

---

## 三、方案

### P0　设计 token 扩容

**`app/assets/scss/_variables.scss`** 补齐编译期常量梯度：

```scss
// 间距（4 的倍数）
$space-1: 4px;  $space-2: 8px;  $space-3: 12px; $space-4: 16px;
$space-5: 24px; $space-6: 32px; $space-8: 48px;

// 圆角
$radius-sm: 4px; $radius-md: 6px; $radius-lg: 10px; $radius-xl: 14px; $radius-pill: 999px;

// 字号 / 行高
$font-xs: 12px; $font-sm: 13px; $font-base: 14px; $font-lg: 16px; $font-xl: 20px; $font-2xl: 28px;

// 控件高度（统一输入框与按钮的视觉基线）
$control-sm: 28px; $control-md: 34px; $control-lg: 40px;

// 层级
$z-dropdown: 100; $z-sticky: 200; $z-mask: 900; $z-modal: 1000; $z-toast: 1100;

// 动效
$dur-fast: 120ms; $dur-base: 200ms; $ease-out: cubic-bezier(.16, 1, .3, 1);

// 断点
$bp-sm: 640px; $bp-md: 960px; $bp-lg: 1280px;
```

**`app/assets/scss/global.scss`** 在 `:root` 与 `html[data-theme='dark']` **成对**补齐语义变量
（现有 20 个 → 约 32 个）：

```
--tc-bg-subtle     次级背景（表头、条纹行、禁用底）
--tc-hover         悬停底色
--tc-active        选中/激活底色
--tc-primary-soft  主色浅底（选中态、chip）
--tc-shadow-1/2    卡片与浮层阴影（暗色下降低不透明度、提高扩散）
--tc-focus-ring    焦点环颜色
--tc-overlay       弹窗遮罩
--tc-code-bg       <code> 底色（ApiKey / action 字段在用）
```

**`_mixins.scss`** 新增：`@mixin focus-ring`、`@mixin truncate`、`@mixin scrollbar`、
`@mixin elevate($level)`、`@mixin respond-to($bp)`，并把 `@mixin card` 改为接受 `$padding`、`$hoverable` 参数。

> 关键约束：`_variables.scss` 里的颜色是 `var()` 引用，**不能对其做 SCSS `rgba()` 运算**
> （文件头注释已警告）。所有半透明底色必须在 `global.scss` 里以 `--tc-*-soft` 形式成对声明。

---

### P1　布局与导航骨架

#### 新增文件

```
app/layouts/default.vue        应用主框架（除 login 外全部页面）
app/layouts/blank.vue          login / error 用
app/components/app/AppHeader.vue     顶栏：品牌 + 主导航 + 工具区
app/components/app/AppNav.vue        主导航（桌面横排 / 移动端抽屉）
app/components/app/AppUserMenu.vue   用户名 + 角色 + 主题切换 + 退出
app/components/app/AppBreadcrumb.vue 面包屑
app/components/app/AppRealtimeBadge.vue  实时连接状态（脉冲点 + 断线可点击重连）
app/error.vue                  404 / 500 统一错误页
```

#### 导航信息架构

采用 **sticky 顶栏 + 面包屑**（不用侧边栏 —— 本应用主体是 9 列宽表格，横向空间比纵向更稀缺）：

```
[LOGO 数据检测汇总]  看板 │ 系统 │ 历史记录 ‖ 通知渠道 │ 用户 │ 审计     ●实时  ☾  admin ▾
                     ————————— 全员 —————————   ——— admin 专属（视觉分组）———
```

- 当前路由高亮（`NuxtLink` 的 `router-link-active`，`/systems/*` 归入"系统"）。
- admin 分组用一条竖分隔线 + 略淡的底色区隔，**非 admin 直接不渲染**（而不是渲染后跳走）。
- 宽度 < `$bp-md` 时主导航收进汉堡抽屉，工具区保留主题与用户菜单。
- 面包屑只在二级页出现：`系统管理 / 产线一号 (line1)`。

#### 逻辑改动

- 各页面删除自己的 `<header>` 与对应 SCSS（约 9 × 20 行）。
- 鉴权前移：admin-only 页面用 `definePageMeta({ middleware: 'admin' })` + 新增 `app/middleware/admin.ts`，
  在导航前拦截，消除 `onMounted` 里 `navigateTo` 造成的页面闪现。
- `useTheme().init()` 从 `index.vue` 移到 `default.vue`，保证任意页面进入都生效。
- `realtime.connect()` 提升到 layout，页面间切换不再反复建连/断连。

---

### P2　基础组件库 `app/components/ui/`

| 组件 | 要点 |
|---|---|
| `UiButton` | `variant`: primary / secondary / ghost / danger / link；`size`: sm/md/lg；`loading`（内置 spinner，自动 disabled）；`block`；默认 `type="button"` |
| `UiInput` / `UiSelect` / `UiTextarea` / `UiNumber` | 统一 `$control-md` 高度、focus-ring、暗色底色（一次性修掉 1.7-②）、`invalid` 态、前后缀插槽 |
| `UiField` | label + 必填星号 + hint + error，包裹上述控件，解决"全靠 placeholder"问题 |
| `UiSwitch` | 替换 12 处"启用/禁用"文字按钮 |
| `UiCard` / `UiSection` | 替换 `@include card` 的散用，带 title / actions 插槽 |
| `UiTable` | 列配置化；`loading` → 骨架行；`empty` 插槽（统一补齐 systems 页缺失的空态）；表头 sticky；窄屏自动包裹横向滚动容器 + 阴影提示 |
| `UiPagination` | 统一 records（游标分页）与 audit（页码分页）两套分页 UI，逻辑差异由 props 吸收 |
| `UiBadge` | `StatusBadge` 的底座；支持 `dot` 变体、size；**状态附带形状/图标区分**，不只靠颜色 |
| `UiEmpty` / `UiSkeleton` / `UiSpinner` | 三态统一 |
| `UiCopy` | 一键复制 + 复制成功反馈（ApiKey、Webhook 地址用） |
| `UiTabs` | 系统详情页分区用 |
| `UiTag` | 筛选条件 chips |

命名遵循规范中"全局共享组件用组件名顶替第二段"：`container_uiButton_primary`、`container_uiTable_header` …

---

### P3　弹窗与反馈体系

#### 组件与 composable

```
app/components/ui/UiModal.vue        Teleport to body / 遮罩 / ESC 关闭 / focus trap /
                                     打开时锁 body 滚动 / 进出场动效 / size: sm|md|lg|full /
                                     具名插槽 header|body|footer
app/components/ui/UiConfirm.vue      基于 UiModal 的确认框，支持 danger 变体
app/components/ui/UiToastHost.vue    右上角堆叠，success/error/warning/info，自动消失可悬停暂停
app/composables/useModal.ts          编程式打开/关闭，管理多层弹窗栈
app/composables/useConfirm.ts        Promise 化：const ok = await confirm({ title, danger, confirmText })
app/composables/useToast.ts          toast.success('已保存') / toast.error(msg)
```

`UiToastHost` 挂在 `layouts/default.vue`，全局单例。

#### 替换映射（逐处）

| 现状 | 改为 |
|---|---|
| 6 处 `confirm()` | `await useConfirm()`，danger 变体 |
| 删除系统（级联删历史记录）`systems/index.vue:107` | **强确认**：要求输入系统 code 才可提交 |
| 13 处 `alert()` | `toast.error(...)`；表单类错误改为字段内联 |
| `channels.vue` 的 `hint` 成功文本 | `toast.success(...)` |
| `users.vue:139` `prompt()` 改密 | `ResetPasswordModal`：`type=password` + 二次确认 + 长度/强度校验 |
| ApiKey "新 Key 仅显示一次" `<p>` | `NewApiKeyModal`：等宽字体展示 + `UiCopy` + "我已妥善保存"勾选后才能关闭 |

#### 新增表单弹窗（把行内表单搬进去）

```
SystemFormModal      新建/编辑系统（编码 名称 描述 保留天数）
MetricFormModal      新建/编辑指标 —— 分两组：基本信息 / 阈值区间，
                     带阈值关系校验（warnMin ≤ warnMax、告警区间应包含预警区间）+ 区间示意条
ChannelFormModal     新建/编辑渠道 —— 按 type 动态渲染字段（dingtalk 显示加签密钥）
UserFormModal        新建用户（用户名 密码 角色）
AlertRuleFormModal   新建规则（指标 渠道 通知级别 冷却）
SilenceFormModal     新建静默（作用域 起止时间 原因）+ 快捷"接下来 1/4/8 小时"
ApiKeyFormModal      新建 ApiKey
AuditDetailModal     审计详情 JSON 展开查看（当前被 title 属性截断）
```

---

### P4　逐页 / 逐组件改造清单

#### `login.vue`
品牌区（Logo + 产品名 + 一句话说明）；`UiField` 化的输入框（用户名/密码带图标、密码可见切换）；
错误内联而非独立 `<p>`；按钮 loading 态；记住用户名（localStorage）；背景加低饱和渐变 + 暗色适配。

#### `index.vue`（看板）
- 顶部新增 **KPI 汇总条**：系统总数 / 正常 / 预警 / 告警 / 最近上报时间，点击可跳转筛选后的历史记录。
- 系统卡片：左侧 4px 状态色条（取该系统最差状态）；hover 抬升；整卡可点进详情；
  汇总数字改为 `UiBadge` 且 0 值弱化。
- 指标卡片：数值用等宽数字（`font-variant-numeric: tabular-nums`）避免跳动；
  新增**阈值迷你条**（当前值在 正常/预警/告警 区间中的位置），比裸数字信息量高得多；
  上报时间改相对时间（"12 秒前"）并对超时未上报标灰。
- 加载态改 `UiSkeleton` 卡片网格；无系统时 `UiEmpty` + "新建系统"入口。
- WS 推送到达时对应指标卡做一次高亮闪动（当前实时更新完全无感）。

#### `systems/index.vue`
新建表单 → `SystemFormModal`（页面顶部只留"新建系统"按钮）；表格换 `UiTable`（补空态 + 骨架）；
加搜索框（按编码/名称过滤）；汇总列改色块条；删除走强确认；顺带修掉暗色输入框 bug。

#### `systems/[id].vue`（465 行，最需要拆）
- 面包屑 + 系统信息头卡（名称/编码/描述/保留天数 + "编辑"按钮开 Modal，取代当前三个裸 input）。
- 下方改 `UiTabs`：**指标 / 趋势 / 告警规则 / 静默窗口 / ApiKey**，
  取代现在 6 个 `<section>` 一路堆到底、需要滚很久的布局。
- 指标表格：**取消"永远是输入框"的编辑方式**，改为浏览态 + 行内"编辑"按钮开 `MetricFormModal`；
  阈值列用区间示意条展示而非两个数字框；新建指标的 7 个 input 全部进 Modal 分组。

#### `records.vue`
筛选区改 `UiField` 布局 + **快捷时间范围**（最近 1h / 24h / 7d / 自定义）+ 已选条件 chips + 一键重置；
表格换 `UiTable`（骨架 + 空态 + 状态色左边框）；分页换 `UiPagination`（保留 keyset 游标逻辑，仅换壳）
并支持每页条数选择；导出 CSV 加 loading 与完成 toast（当前点了没有任何反馈）。

#### `channels.vue`
新建 → `ChannelFormModal`；启用/禁用 → `UiSwitch`；"测试"按钮加 loading 与结果 toast；
target 列 `UiCopy` + 悬浮完整展示；类型列加图标区分（钉钉/企微/邮件/Webhook）。

#### `users.vue`
新建 → `UserFormModal`；重置密码 → `ResetPasswordModal`（消除明文 prompt）；
角色用 `UiBadge`（admin 主色 / viewer 中性）；禁用行整体降透明度；
"当前用户"标记改 `UiTag`；删除走 danger 确认。

#### `audit.vue`
筛选加 action 下拉枚举（现在要手打前缀"user."）+ 时间范围；
detail 列点击开 `AuditDetailModal` 格式化展示；action 用 `<code>` + `--tc-code-bg`；表格补骨架。

#### `StatusBadge.vue`
迁到 `UiBadge` 底座；新增 `dot` / `size` prop；**状态附加图标**（✓ / ! / ✕ / –）解决纯色编码；
修正暗色下 warning 徽标对比度（改为深色文字压浅色底，或加深底色）。

#### `TrendChart.vue`
- 修 `window` 遮蔽 bug（重命名为 `bucket`），并把 `window.addEventListener('resize')`
  换成 `ResizeObserver` 观察容器（侧栏/标签页切换导致的尺寸变化 resize 事件捕捉不到）。
- **主题联动**：抽出 `chartTheme` computed，从 CSS 变量读取轴线/文字/分割线色，
  `watch(theme)` 时 `setOption` 重绘。
- 指标多选从一排 checkbox 改为可横向滚动的 chips（指标多时当前会挤爆工具栏）。
- 加载态骨架、错误态重试按钮；tooltip 样式跟随主题；
- 新增"最小-最大区间带"（数据里已有 min/max，当前只画了 avg，白白浪费）；加导出 PNG。

#### `AlertRuleManager` / `SilenceManager` / `ApiKeyManager`
表单进 Modal；表格换 `UiTable`；启用/停用换 `UiSwitch`；删除走确认；
`AlertRuleManager` 无渠道时的提示升级为 `UiEmpty` + 直达"新建渠道"的按钮。

---

### P5　逻辑与健壮性修复清单

1. `TrendChart` `window` 变量遮蔽 → 重命名（**运行时报错，优先级最高**）。
2. `systems/index.vue` 输入框暗色底色缺失 → 由 `UiInput` 统一解决。
3. ECharts 主题联动 + `ResizeObserver`。
4. 新增 `app/error.vue`（404 / 500，带回看板按钮）。
5. 新增 `app/middleware/admin.ts`，替代 `onMounted` 内的跳转，消除页面闪现。
6. 鉴权首屏 loading 骨架，消除白屏。
7. 全站补 `:focus-visible` 焦点环；弹窗 focus trap + ESC + 返回焦点还原。
8. 所有非提交按钮显式 `type="button"`。
9. 响应式：`$bp-md` 以下顶栏收抽屉、表格横向滚动、看板网格降为单列、筛选区纵向堆叠。
10. 实时断线：badge 可点击手动重连 + 断线 toast 提示（当前静默失败）。
11. `formatTime` / `errorMessage` 在 7 个文件里各写一遍 → 抽 `app/utils/format.ts`、`app/utils/error.ts`。
12. 表格数字列统一 `tabular-nums` + 右对齐。
13. 尊重 `prefers-reduced-motion`，关闭动效。

---

### P6　命名规范修订（`doc/class-naming.md`）

现行规范强制页面名做第二段，导致基础样式无法共享。**追加两条**，不推翻既有约定：

1. **基础组件族**：`app/components/ui/` 下组件一律用 `container_ui{组件名}_{位置名}_{状态名}`
   （如 `container_uiButton_primary`、`container_uiTable_body_empty`），页面**禁止**再自行实现按钮/输入框/表格样式。
2. **布局族**：`app/components/app/` 下用 `container_app{组件名}_...`（如 `container_appHeader_nav_active`）。

同时在规范里补一句：**页面 SCSS 中不得出现硬编码的 px 间距/圆角/字号**，一律用 P0 的 token。

---

## 四、实施批次

| 批次 | 内容 | 产出/验收 |
|---|---|---|
| **B1 地基** | P0 token + P6 规范修订 + `utils/format`、`utils/error` 抽取 | 视觉无变化，`grep 'padding: 7px'` 归零的前置条件就绪 |
| **B2 骨架** | P1 布局与导航 + `admin` 中间件 + `error.vue` | 任意页面都能切主题/登出/横向跳转；非 admin 不再闪现 |
| **B3 组件库** | P2 全部基础组件 + P3 弹窗/Toast 体系（含 composable） | 组件可独立预览；`grep -c 'confirm(\|alert(\|prompt('` = 0 的前置就绪 |
| **B4 列表页** | systems / channels / users / audit / records 五页接入组件库与弹窗 | 5 页表单全部入 Modal，反馈全走 Toast |
| **B5 详情与图表** | `systems/[id]` 拆 Tabs + 指标编辑改造；`TrendChart` 主题联动与 bug 修复 | 详情页单屏可导航；暗色下图表可读 |
| **B6 看板与打磨** | 看板 KPI 条/阈值条/骨架/实时高亮；响应式；无障碍；`prefers-reduced-motion` | 375px 宽无横向溢出；键盘可完成全部操作 |

**顺序不可打乱**：B1/B2/B3 是纯增量、不改现有页面行为，风险最低；B4 起才动业务页面。

---

## 五、验收标准

- [ ] `grep -rn 'confirm(\|alert(\|prompt(' app` 结果为 0
- [ ] `grep -rn 'padding: 7px\|border-radius: 6px\|font-size: 13px' app` 结果为 0（全部走 token）
- [ ] `grep -c '&_header {' app/pages` 为 0（头部收敛到 layout）
- [ ] 8 个页面在亮/暗两种主题下逐屏走查，无白底输入框、无低对比文字
- [ ] 375px / 768px / 1440px 三档宽度无横向溢出、无遮挡
- [ ] 仅用键盘可完成：登录 → 建系统 → 建指标 → 建规则 → 删除（含弹窗内 Tab 循环与 ESC 关闭）
- [ ] 所有异步操作有 loading 态，所有失败有可读提示，所有列表有空态与骨架
- [ ] `npm run test` 通过（UI 改造不应触及 `tests/` 中的阈值判定与报文校验逻辑）

---

## 六、工作量估算

| 批次 | 新增/改动文件 | 估时 |
|---|---|---|
| B1 | 3 改 + 2 新 | 0.5 天 |
| B2 | 7 新 + 8 改 | 1.5 天 |
| B3 | 约 18 新 | 2.5 天 |
| B4 | 5 页 + 8 个 Modal | 3 天 |
| B5 | 2 大文件重构 | 2 天 |
| B6 | 全站打磨 | 1.5 天 |

合计约 **11 人日**。B1–B3 完成后界面已有明显改观（导航可用 + 弹窗替换原生对话框），可作为第一个可交付节点。
