# class 命名规范

全项目统一使用以下规则书写 HTML class：

```
container_{页面名}_{组件名}_{位置名}_{状态名}_...
```

## 规则

- 一律以 `container` 开头，各段之间用单个下划线 `_` 连接。
- 段数按需取 2~5 段：`container_页面名` 是页面根节点；之后依次追加组件名、位置名、状态名。
- **页面名**：当前页面英文名，小写（如 `dashboard`、`login`、`systems`、`systemDetail`、`records`）。多词用驼峰。
- **组件名**：组件英文名，多词用驼峰（如 `metricCard`、`statusBadge`、`filterBar`）。
- **位置名**：元素在组件内的位置（如 `header`、`body`、`footer`、`title`、`value`、`actions`）。
- **状态名**：仅在需要按状态区分样式时出现，取值：`normal` / `warning` / `alarm` / `none` / `active` / `disabled` / `loading` / `connected` / `disconnected`。
- 全局共享组件没有"页面名"，用组件名顶替第二段（如 `container_statusBadge_alarm`）。
- 状态段用 Vue 动态绑定拼接：`:class="`container_dashboard_metricCard_value_${metric.lastStatus}`"`。

## 示例

```html
<!-- 看板页 -->
<div class="container_dashboard">
  <header class="container_dashboard_header">…</header>
  <div class="container_dashboard_systemGrid">
    <div class="container_dashboard_systemCard">
      <div class="container_dashboard_systemCard_header">…</div>
      <span class="container_dashboard_systemCard_summary_alarm">2</span>
      <div class="container_dashboard_metricCard">
        <div class="container_dashboard_metricCard_header">温度</div>
        <div class="container_dashboard_metricCard_value_alarm">95 ℃</div>
      </div>
    </div>
  </div>
</div>

<!-- 共享组件 -->
<span class="container_statusBadge_normal">normal</span>
```

## SCSS 书写约定

- 全局变量与 mixin 在 `app/assets/scss/_variables.scss`、`_mixins.scss`（已通过 vite additionalData 自动注入，直接用 `$color-alarm`、`@include card` 等）。
- 组件/页面样式写在各自 `<style lang="scss" scoped>` 内，按上述 class 嵌套组织：

```scss
.container_dashboard {
  padding: $spacing;

  &_header { … }
}
```

注意：嵌套时 `&_header` 这种写法要求父级是 `container_dashboard`，与命名规范天然一致。

## 基础组件族与布局族（修订）

现行"页面名做第二段"的规则导致基础样式无法跨页共享，为此追加两条约定（不推翻既有规则）：

1. **基础组件族**：`app/components/ui/` 下的组件一律用
   `container_ui{组件名}_{位置名}_{状态名}`（如 `container_uiButton_primary`、`container_uiTable_body_empty`）。
   页面**禁止**再自行实现按钮/输入框/表格等基础样式，一律引用 `ui/` 组件。
2. **布局族**：`app/components/app/` 与 `app/layouts/` 下用 `container_app{组件名}_...`
   （如 `container_appHeader_nav_active`）。

同时：**页面 SCSS 中不得出现硬编码的 px 间距 / 圆角 / 字号 / 控件高度**，
一律使用 `_variables.scss` 中 P0 梯度 token（`$space-*` / `$radius-*` / `$font-*` / `$control-*`）；
颜色一律引用既有 `$color-*` 或语义变量，禁止对 var() 颜色做 SCSS rgba() 运算。
