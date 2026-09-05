// 统计窗口自动选择：在候选步长里挑最小的、使点数不超过 maxPoints 的窗口
export const WINDOW_STEPS_SECONDS = [60, 300, 900, 3600, 86_400] as const

export function pickWindowSeconds(
  spanSeconds: number,
  maxPoints = 240,
  steps: readonly number[] = WINDOW_STEPS_SECONDS,
): number {
  if (spanSeconds <= 0) return steps[0]
  for (const step of steps) {
    if (Math.ceil(spanSeconds / step) <= maxPoints) return step
  }
  return steps[steps.length - 1]
}
