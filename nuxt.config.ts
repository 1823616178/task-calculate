import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config
// 数据库/MQTT/JWT 等环境变量由 server/database/data-source.ts 与各服务直接读取 process.env（scripts/ 下脚本也要用），此处不再声明 runtimeConfig 以免两套默认值漂移。
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devServer: {
    host: process.env.HOST || process.env.NUXT_HOST || '0.0.0.0',
    port: Number(process.env.PORT || process.env.NUXT_PORT || 48980),
  },
  devtools: { enabled: true },
  modules: ['@pinia/nuxt'],
  css: ['~/assets/scss/global.scss'],
  components: [
    // 关闭目录前缀，组件按文件名注册（ui/Modal.vue → Modal、modals/SystemFormModal.vue → SystemFormModal）
    { path: '~/components', pathPrefix: false },
  ],
  app: {
    // 页面/布局切换过渡（prefers-reduced-motion 下由 global.scss 统一关闭）
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' },
    head: {
      // 首屏前应用本地主题，避免暗色模式闪烁（FOUC）
      script: [
        {
          innerHTML:
            "(function(){try{if(localStorage.getItem('tc_theme')==='dark')document.documentElement.dataset.theme='dark'}catch(e){}})()",
        },
      ],
    },
  },
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          // `~` 别名在 additionalData 中不可靠，改用 loadPaths + 文件名引用
          loadPaths: [fileURLToPath(new URL('./app/assets/scss', import.meta.url))],
          additionalData: '@use "variables" as *;\n@use "mixins" as *;\n',
        },
      },
    },
  },
  nitro: {
    experimental: {
      websocket: true,
      tasks: true,
    },
    // TypeORM 在运行时动态 require 驱动，需显式内联进产物（运行镜像不含完整 node_modules）
    externals: {
      inline: ['mysql2'],
    },
    // 每日 03:05 清理过期历史记录（保留策略见 server/services/retentionService.ts）
    scheduledTasks: {
      '0 5 3 * *': ['records:cleanup'],
    },
  },
})
