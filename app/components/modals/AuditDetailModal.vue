<template>
  <UiModal
    :model-value="visible"
    size="sm"
    title="审计详情"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
  >
    <dl class="container_auditDetailModal_meta">
      <div class="container_auditDetailModal_row">
        <dt>时间</dt>
        <dd>{{ formatDate(log?.createdAt) }}</dd>
      </div>
      <div class="container_auditDetailModal_row">
        <dt>操作者</dt>
        <dd>{{ log?.username || '—' }}</dd>
      </div>
      <div class="container_auditDetailModal_row">
        <dt>动作</dt>
        <dd><code>{{ log?.action }}</code></dd>
      </div>
      <div class="container_auditDetailModal_row">
        <dt>目标</dt>
        <dd>{{ log?.target || '—' }}</dd>
      </div>
    </dl>

    <p class="container_auditDetailModal_label">详情</p>
    <pre v-if="pretty" class="container_auditDetailModal_json">{{ pretty }}</pre>
    <p v-else class="container_auditDetailModal_none">{{ log?.detail || '（无详情）' }}</p>

    <template #footer>
      <UiCopy v-if="log?.detail" :text="log.detail" display="" />
      <UiButton variant="secondary" @click="emit('update:visible', false)">关闭</UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
export interface AuditLogRow {
  id: string
  username: string
  action: string
  target: string
  detail: string | null
  createdAt: string
}

// 审计详情弹窗：格式化展示 JSON（此前被 title 属性截断）
const props = defineProps<{
  visible: boolean
  log?: AuditLogRow | null
}>()

const emit = defineEmits<{ 'update:visible': [boolean] }>()

const pretty = computed<string>(() => {
  const d = props.log?.detail
  if (!d) return ''
  try {
    return JSON.stringify(JSON.parse(d), null, 2)
  } catch {
    return d
  }
})
</script>

<style lang="scss" scoped>
.container_auditDetailModal_meta {
  margin: 0 0 $space-4;
  display: flex;
  flex-direction: column;
  gap: $space-2;
}

.container_auditDetailModal_row {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: $space-3;
}

.container_auditDetailModal_row dt {
  color: $color-text-secondary;
  font-size: $font-sm;
}

.container_auditDetailModal_row dd {
  margin: 0;
  font-size: $font-sm;
  word-break: break-all;
}

.container_auditDetailModal_label {
  margin: 0 0 $space-2;
  font-size: $font-xs;
  font-weight: 600;
  color: $color-text-secondary;
}

.container_auditDetailModal_json {
  margin: 0;
  padding: $space-3;
  max-height: 320px;
  overflow: auto;
  border-radius: $radius-md;
  background: var(--tc-code-bg);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: $font-xs;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;

  @include scrollbar;
}

.container_auditDetailModal_none {
  margin: 0;
  color: $color-text-secondary;
  font-size: $font-sm;
}
</style>
