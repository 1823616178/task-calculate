<template>
  <div class="container_apiDocs">
    <UiPageHead title="API 接口" description="平台对外开放的上报、查询与管理接口；完整接入说明见 doc/API.md">
      <template #actions>
        <div class="container_apiDocs_search">
          <UiInput v-model.trim="keyword" placeholder="搜索路径或说明" />
        </div>
      </template>
    </UiPageHead>

    <UiCard class="container_apiDocs_intro" flat>
      <dl class="container_apiDocs_introList">
        <div>
          <dt>Base URL</dt>
          <dd><UiCopy :text="origin" :display="origin" /></dd>
        </div>
        <div>
          <dt>ApiKey 调用</dt>
          <dd><code>X-Api-Key: dk_…</code></dd>
        </div>
        <div>
          <dt>账号调用</dt>
          <dd><code>Authorization: Bearer &lt;token&gt;</code></dd>
        </div>
        <div>
          <dt>错误响应</dt>
          <dd><code>{"statusCode", "statusMessage", "message"}</code></dd>
        </div>
      </dl>
    </UiCard>

    <UiTabs v-model="activeGroup" :tabs="tabs" class="container_apiDocs_tabs" />

    <UiEmpty v-if="visibleGroups.length === 0" text="没有匹配的接口" />

    <section
      v-for="group in visibleGroups"
      :key="group.key"
      class="container_apiDocs_group"
    >
      <header class="container_apiDocs_groupHead">
        <h2 class="container_apiDocs_groupTitle">{{ group.label }}</h2>
        <p class="container_apiDocs_groupDesc">{{ group.desc }}</p>
      </header>

      <div class="container_apiDocs_list">
        <article
          v-for="ep in group.endpoints"
          :key="endpointId(ep)"
          class="container_apiDocs_item"
          :class="{ container_apiDocs_item_open: expanded.has(endpointId(ep)) }"
        >
          <button
            type="button"
            class="container_apiDocs_row"
            :aria-expanded="expanded.has(endpointId(ep)) ? 'true' : 'false'"
            @click="toggle(ep)"
          >
            <span class="container_apiDocs_method" :class="`container_apiDocs_method_${ep.method.toLowerCase()}`">
              {{ ep.method }}
            </span>
            <code class="container_apiDocs_path">{{ ep.path }}</code>
            <span class="container_apiDocs_summary">{{ ep.summary }}</span>
            <UiBadge :variant="AUTH_VARIANTS[ep.auth]" size="sm" class="container_apiDocs_auth">
              {{ API_AUTH_LABELS[ep.auth] }}
            </UiBadge>
            <span class="container_apiDocs_chevron" aria-hidden="true">›</span>
          </button>

          <div v-if="expanded.has(endpointId(ep))" class="container_apiDocs_detail">
            <p v-if="ep.desc" class="container_apiDocs_desc">{{ ep.desc }}</p>

            <div v-if="ep.params?.length" class="container_apiDocs_block">
              <h3 class="container_apiDocs_blockTitle">参数</h3>
              <div class="container_apiDocs_tableWrap">
                <table class="container_apiDocs_table">
                  <thead>
                    <tr>
                      <th>名称</th>
                      <th>位置</th>
                      <th>类型</th>
                      <th>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in ep.params" :key="`${p.in}:${p.name}`">
                      <td>
                        <code>{{ p.name }}</code>
                        <span v-if="p.required" class="container_apiDocs_required" title="必填">*</span>
                      </td>
                      <td>{{ PARAM_IN_LABELS[p.in] }}</td>
                      <td class="container_apiDocs_type">{{ p.type }}</td>
                      <td>{{ p.desc }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="container_apiDocs_samples">
              <div v-if="ep.request" class="container_apiDocs_block">
                <div class="container_apiDocs_blockHead">
                  <h3 class="container_apiDocs_blockTitle">请求示例</h3>
                  <UiCopy :text="pretty(ep.request)" />
                </div>
                <pre class="container_apiDocs_code">{{ pretty(ep.request) }}</pre>
              </div>
              <div v-if="ep.response" class="container_apiDocs_block">
                <div class="container_apiDocs_blockHead">
                  <h3 class="container_apiDocs_blockTitle">响应示例</h3>
                  <UiCopy :text="pretty(ep.response)" />
                </div>
                <pre class="container_apiDocs_code">{{ pretty(ep.response) }}</pre>
              </div>
            </div>

            <div v-if="ep.errors" class="container_apiDocs_block">
              <h3 class="container_apiDocs_blockTitle">错误码</h3>
              <ul class="container_apiDocs_errors">
                <li v-for="(msg, code) in ep.errors" :key="code">
                  <code>{{ code }}</code>
                  <span>{{ msg }}</span>
                </li>
              </ul>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">

useHead({ title: 'API 接口' })
import type { UiTabItem } from '../components/ui/UiTabs.vue'
import type { ApiAuth, ApiEndpoint, ApiGroup, ApiParam } from '../utils/apiCatalog'

// API 接口文档页：数据来自 utils/apiCatalog.ts，按分组 tab + 关键字筛选，点击展开参数与示例

const AUTH_VARIANTS: Record<ApiAuth, 'normal' | 'warning' | 'alarm' | 'primary' | 'neutral'> = {
  public: 'normal',
  login: 'primary',
  read: 'primary',
  admin: 'alarm',
  apiKey: 'warning',
}

const PARAM_IN_LABELS: Record<ApiParam['in'], string> = {
  path: '路径',
  query: '查询',
  body: '请求体',
  header: '请求头',
}

const keyword = ref('')
const activeGroup = ref('all')
const expanded = reactive(new Set<string>())

// SSR 与客户端一致取请求地址，避免水合不一致
const origin = useRequestURL().origin

function endpointId(ep: ApiEndpoint): string {
  return `${ep.method} ${ep.path}`
}

function matches(ep: ApiEndpoint, kw: string): boolean {
  if (!kw) return true
  return [ep.method, ep.path, ep.summary, ep.desc ?? ''].some((s) => s.toLowerCase().includes(kw))
}

// 关键字过滤后的分组（空分组剔除），tab 计数与列表共用
const filteredGroups = computed<ApiGroup[]>(() => {
  const kw = keyword.value.toLowerCase()
  return API_GROUPS
    .map((g) => ({ ...g, endpoints: g.endpoints.filter((ep) => matches(ep, kw)) }))
    .filter((g) => g.endpoints.length > 0)
})

const tabs = computed<UiTabItem[]>(() => {
  const total = filteredGroups.value.reduce((n, g) => n + g.endpoints.length, 0)
  return [
    { key: 'all', label: '全部', count: total },
    ...API_GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      count: filteredGroups.value.find((f) => f.key === g.key)?.endpoints.length ?? 0,
    })),
  ]
})

const visibleGroups = computed(() =>
  activeGroup.value === 'all'
    ? filteredGroups.value
    : filteredGroups.value.filter((g) => g.key === activeGroup.value),
)

function toggle(ep: ApiEndpoint) {
  const id = endpointId(ep)
  if (expanded.has(id)) expanded.delete(id)
  else expanded.add(id)
}

// JSON 示例格式化缩进；多行报文（WS 交互流程、CSV）原样展示
function pretty(sample: string): string {
  try {
    return JSON.stringify(JSON.parse(sample), null, 2)
  } catch {
    return sample
  }
}
</script>

<style lang="scss" scoped>
.container_apiDocs {
  max-width: 1200px;
  margin: 0 auto;
  padding: $space-5 $space-4 $space-6;
}

.container_apiDocs_search {
  width: 260px;

  @include down('sm') {
    width: 100%;
  }
}

.container_apiDocs_intro {
  margin-bottom: $space-4;
  animation: tc-rise $dur-slow $ease-out 60ms both;
}

.container_apiDocs_introList {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: $space-3 $space-4;
  margin: 0;

  dt {
    margin-bottom: $space-1;
    color: $color-text-secondary;
    font-size: $font-xs;
  }

  dd {
    margin: 0;
    min-width: 0;
  }
}

.container_apiDocs_tabs {
  margin-bottom: $space-4;
}

.container_apiDocs_group {
  margin-bottom: $space-6;
  animation: tc-rise $dur-slow $ease-out 120ms both;
}

.container_apiDocs_groupHead {
  margin-bottom: $space-3;
}

.container_apiDocs_groupTitle {
  margin: 0;
  font-size: $font-lg;
  font-weight: 600;
}

.container_apiDocs_groupDesc {
  margin: $space-1 0 0;
  color: $color-text-secondary;
  font-size: $font-sm;
}

.container_apiDocs_list {
  border: 1px solid $color-border;
  border-radius: $radius-card;
  background: var(--tc-card-bg);
  overflow: hidden;
}

.container_apiDocs_item + .container_apiDocs_item {
  border-top: 1px solid $color-border;
}

.container_apiDocs_row {
  display: flex;
  align-items: center;
  gap: $space-3;
  width: 100%;
  min-height: $control-lg + 4;
  padding: $space-2 $space-4;
  border: none;
  background: transparent;
  color: inherit;
  font-size: $font-base;
  text-align: left;
  cursor: pointer;
  transition: background-color $dur-fast $ease-out;

  &:hover {
    background: var(--tc-hover);
  }

  &:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 2px var(--tc-focus-ring);
  }

  @include down('sm') {
    flex-wrap: wrap;
    gap: $space-2;
  }
}

.container_apiDocs_method {
  flex-shrink: 0;
  width: 58px;
  padding: 2px 0;
  border-radius: $radius-sm;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: $font-xs;
  font-weight: 700;
  text-align: center;

  &_get { background: var(--tc-primary-soft); color: $color-primary; }
  &_post { background: var(--tc-normal-soft); color: $color-normal; }
  &_put { background: var(--tc-warning-soft); color: var(--tc-warning); }
  &_delete { background: var(--tc-alarm-soft); color: $color-alarm; }
  &_ws,
  &_mqtt { background: var(--tc-none-soft); color: $color-text-secondary; }
}

.container_apiDocs_path {
  flex-shrink: 0;
  padding: 0;
  background: none;
  font-size: $font-sm;
  font-weight: 600;
}

.container_apiDocs_summary {
  flex: 1;
  min-width: 0;
  color: $color-text-secondary;
  font-size: $font-sm;

  @include truncate;
}

.container_apiDocs_auth {
  flex-shrink: 0;
}

.container_apiDocs_chevron {
  flex-shrink: 0;
  color: $color-text-secondary;
  font-size: $font-lg;
  line-height: 1;
  transition: transform $dur-base $ease-out;
}

.container_apiDocs_item_open .container_apiDocs_chevron {
  transform: rotate(90deg);
}

.container_apiDocs_detail {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-2 $space-4 $space-4;
  background: var(--tc-bg-subtle);
  border-top: 1px dashed $color-border;
  animation: tc-fade $dur-base $ease-out both;
}

.container_apiDocs_desc {
  margin: $space-2 0 0;
  font-size: $font-sm;
  line-height: 1.7;
}

.container_apiDocs_block {
  min-width: 0;
}

.container_apiDocs_blockHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
}

.container_apiDocs_blockTitle {
  margin: 0 0 $space-2;
  color: $color-text-secondary;
  font-size: $font-xs;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.container_apiDocs_tableWrap {
  overflow-x: auto;

  @include scrollbar(6px);
}

.container_apiDocs_table {
  width: 100%;
  border-collapse: collapse;
  font-size: $font-sm;

  th,
  td {
    padding: $space-2 $space-3;
    border-bottom: 1px solid $color-border;
    text-align: left;
    vertical-align: top;
  }

  th {
    background: var(--tc-th-bg);
    color: $color-text-secondary;
    font-weight: 500;
    white-space: nowrap;
  }

  td:nth-child(-n + 2) {
    white-space: nowrap;
  }
}

.container_apiDocs_type {
  color: $color-text-secondary;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: $font-xs;
}

.container_apiDocs_required {
  margin-left: 2px;
  color: $color-danger;
  font-weight: 700;
}

.container_apiDocs_samples {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: $space-4;

  @include down('sm') {
    grid-template-columns: 1fr;
  }
}

.container_apiDocs_code {
  margin: 0;
  padding: $space-3;
  max-height: 360px;
  overflow: auto;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  background: var(--tc-card-bg);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: $font-xs;
  line-height: 1.6;
  white-space: pre;

  @include scrollbar(6px);
}

.container_apiDocs_errors {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2 $space-4;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: $font-sm;

  li {
    display: inline-flex;
    align-items: center;
    gap: $space-2;
  }
}
</style>
