<template>
  <div
    v-if="segments.length > 0"
    class="container_metricThresholdBar"
    :title="titleText"
    role="img"
    :aria-label="titleText"
  >
    <!-- 分段放进独立轨道裁切圆角；当前值指示条在轨道外，不会被裁掉 -->
    <span class="container_metricThresholdBar_track">
      <span
        v-for="(seg, i) in segments"
        :key="i"
        class="container_metricThresholdBar_seg"
        :class="`container_metricThresholdBar_seg_${seg.kind}`"
        :style="{ width: seg.pct + '%' }"
      />
    </span>
    <!-- 当前值位置指示 -->
    <span
      v-if="valuePct !== null"
      class="container_metricThresholdBar_marker"
      :style="{ left: valuePct + '%' }"
      aria-hidden="true"
    />
  </div>
  <span v-else class="container_metricThresholdBar_none">—</span>
</template>

<script setup lang="ts">
// 阈值迷你条：展示当前值落在 正常/预警/告警 区间中的位置，替代两个裸数字。
// 区间划分（自左向右）：告警下界之外=alarm、预警与告警界之间=warning、预警区间内=normal。
const props = withDefaults(defineProps<{
  value?: number | null
  warnMin?: number | null
  warnMax?: number | null
  alarmMin?: number | null
  alarmMax?: number | null
}>(), {
  value: null,
  warnMin: null,
  warnMax: null,
  alarmMin: null,
  alarmMax: null,
})

interface Seg { kind: 'normal' | 'warning' | 'alarm', pct: number }

function fmt(v: number): string {
  return String(Number.isInteger(v) ? v : Math.round(v * 100) / 100)
}

// 展示域：所有有效数值的范围内再软扩展 15%，保证边缘区间可见
const domain = computed<[number, number] | null>(() => {
  const { value, warnMin: wMin, warnMax: wMax, alarmMin: aMin, alarmMax: aMax } = props
  if (wMin === null && wMax === null && aMin === null && aMax === null) return null

  const lows = [wMin, aMin].filter((v): v is number => v !== null)
  const highs = [wMax, aMax].filter((v): v is number => v !== null)
  if (lows.length === 0 && highs.length === 0) return null

  // 单边界时构造对称范围，避免除零
  let low = lows.length > 0 ? Math.min(...lows) : Math.min(...highs) - Math.max(1, ...highs.map(Math.abs))
  let high = highs.length > 0 ? Math.max(...highs) : Math.max(...lows) + Math.max(1, ...lows.map(Math.abs))
  if (value !== null) {
    low = Math.min(low, props.value!)
    high = Math.max(high, props.value!)
  }
  const span = Math.max(high - low, Math.abs(low), Math.abs(high), 1)
  return [low - span * 0.12, high + span * 0.12]
})

const segments = computed<Seg[]>(() => {
  const d = domain.value
  if (!d) return []
  const [lo, hi] = d

  // 在展示域内取告警/预警边界作为分界点
  const bounds = [lo]
  for (const b of [props.alarmMin, props.warnMin, props.warnMax, props.alarmMax]) {
    if (b !== null && b > lo && b < hi) bounds.push(b)
  }
  bounds.push(hi)

  const segs: Seg[] = []
  for (let i = 0; i < bounds.length - 1; i++) {
    const start = bounds[i]
    const end = bounds[i + 1]
    if (start === undefined || end === undefined) continue
    let kind: Seg['kind'] = 'normal'
    if (props.alarmMin !== null && end <= props.alarmMin) kind = 'alarm'
    else if (props.alarmMax !== null && start >= props.alarmMax) kind = 'alarm'
    else if (props.warnMin !== null && end <= props.warnMin) kind = 'warning'
    else if (props.warnMax !== null && start >= props.warnMax) kind = 'warning'
    segs.push({ kind, pct: end - start })
  }

  // 归一化为百分比宽度并过滤零宽段
  const total = segs.reduce((s, x) => s + x.pct, 0)
  if (total <= 0) return []
  return segs
    .map((s) => ({ ...s, pct: (s.pct / total) * 100 }))
    .filter((s) => s.pct > 0.2)
})

const valuePct = computed<number | null>(() => {
  const d = domain.value
  if (props.value === null || !d) return null
  const [lo, hi] = d
  const pct = ((props.value - lo) / (hi - lo)) * 100
  return Math.min(98.5, Math.max(1.5, pct))
})

const titleText = computed(() => {
  const range = (min: number | null, max: number | null) =>
    `${min === null ? '-∞' : fmt(min)} ~ ${max === null ? '+∞' : fmt(max)}`
  const hasWarn = props.warnMin !== null || props.warnMax !== null
  const hasAlarm = props.alarmMin !== null || props.alarmMax !== null
  const parts: string[] = [`当前值 ${props.value === null ? '—' : fmt(props.value)}`]
  if (hasWarn) parts.push(`预警 ${range(props.warnMin, props.warnMax)}`)
  if (hasAlarm) parts.push(`告警 ${range(props.alarmMin, props.alarmMax)}`)
  return parts.join('；')
})
</script>

<style lang="scss" scoped>
.container_metricThresholdBar {
  position: relative;
  display: block;
  width: 100%;
  min-width: 120px;
  height: 8px;
}

.container_metricThresholdBar_track {
  display: flex;
  gap: 1px;
  height: 100%;
  border-radius: $radius-pill;
  background: var(--tc-hover);
  overflow: hidden;
}

.container_metricThresholdBar_seg {
  height: 100%;

  &_normal { background: var(--tc-normal-soft); }
  &_warning { background: var(--tc-warning-soft); }
  &_alarm { background: var(--tc-alarm-soft); }
}

.container_metricThresholdBar_marker {
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 3px;
  margin-left: -1.5px;
  border-radius: $radius-pill;
  background: $color-text;
  box-shadow: 0 0 0 1px var(--tc-card-bg);
  transition: left $dur-slow $ease-out;
}

.container_metricThresholdBar_none {
  color: $color-text-secondary;
}
</style>
