<template>
  <div class="container_users">
    <UiPageHead title="用户管理" description="管理员可管理全部配置，只读用户仅可查看数据">
      <template #actions>
        <UiButton variant="primary" @click="openCreate">+ 新建用户</UiButton>
      </template>
    </UiPageHead>

    <UiTable
      :columns="columns"
      :rows="users"
      row-key="id"
      :loading="loading"
      empty-text="暂无用户"
      skeleton-rows="4"
      :row-class="(u) => (u.enabled ? '' : 'container_users_rowDisabled')"
    >
      <template #cell_username="{ row }">
        <span class="container_users_name">
          <span
            class="container_users_avatar"
            :class="{ container_users_avatar_admin: row.role === 'admin' }"
            aria-hidden="true"
          >{{ row.username.slice(0, 1).toUpperCase() }}</span>
          {{ row.username }}
          <UiTag v-if="row.id === currentUserId">当前用户</UiTag>
        </span>
      </template>

      <template #cell_role="{ row }">
        <UiBadge :variant="row.role === 'admin' ? 'primary' : 'neutral'">
          {{ row.role === 'admin' ? '管理员' : '只读' }}
        </UiBadge>
      </template>

      <template #cell_enabled="{ row }">
        <UiBadge :variant="row.enabled ? 'normal' : 'alarm'" size="sm" dot>
          {{ row.enabled ? '正常' : '已禁用' }}
        </UiBadge>
      </template>

      <template #cell_createdAt="{ row }">
        {{ formatDate(row.createdAt) }}
      </template>

      <template #cell_actions="{ row }">
        <div class="container_users_actions">
          <UiButton variant="link" size="sm" @click="openReset(row)">重置密码</UiButton>
          <UiButton
            v-if="row.id !== currentUserId"
            variant="link"
            size="sm"
            @click="toggle(row)"
          >{{ row.enabled ? '禁用' : '启用' }}</UiButton>
          <UiButton
            v-if="row.id !== currentUserId"
            variant="link"
            size="sm"
            class="container_users_dangerLink"
            @click="remove(row)"
          >删除</UiButton>
        </div>
      </template>
    </UiTable>

    <UserFormModal v-model:visible="createVisible" @saved="() => void load()" />
    <ResetPasswordModal
      v-model:visible="resetVisible"
      :user="resetTarget"
      @saved="() => void load()"
    />
  </div>
</template>

<script setup lang="ts">

useHead({ title: '用户管理' })
import type { UserDto } from '../types'
import type { UiColumn } from '../components/ui/UiTable.vue'

const toast = useToast()

definePageMeta({ middleware: 'admin' })

const users = ref<UserDto[]>([])
const currentUserId = ref(0)
const loading = ref(false)

const createVisible = ref(false)
const resetVisible = ref(false)
const resetTarget = ref<UserDto | null>(null)

const columns: UiColumn[] = [
  { key: 'username', label: '用户名', width: '200px' },
  { key: 'role', label: '角色', width: '100px' },
  { key: 'enabled', label: '状态', width: '100px' },
  { key: 'createdAt', label: '创建时间', width: '180px' },
  { key: 'actions', label: '操作', width: '220px' },
]

onMounted(() => {
  void load()
})

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ users: UserDto[], currentUserId: number }>('/api/users')
    users.value = res.users
    currentUserId.value = res.currentUserId
  } finally {
    loading.value = false
  }
}

function openCreate() {
  createVisible.value = true
}

function openReset(u: UserDto) {
  resetTarget.value = u
  resetVisible.value = true
}

async function toggle(u: UserDto) {
  try {
    await $fetch(`/api/users/${u.id}`, { method: 'PUT', body: { enabled: !u.enabled } })
    await load()
    toast.info(`用户「${u.username}」已${u.enabled ? '禁用' : '启用'}`)
  } catch (err) {
    toast.error(errorMessage(err, '操作失败'))
  }
}

async function remove(u: UserDto) {
  const ok = await useConfirm().ask({
    title: `删除用户「${u.username}」？`,
    message: '删除后该用户将无法登录。',
    danger: true,
    confirmText: '删除',
  })
  if (!ok) return
  try {
    await $fetch(`/api/users/${u.id}`, { method: 'DELETE' })
    await load()
    toast.success(`用户「${u.username}」已删除`)
  } catch (err) {
    toast.error(errorMessage(err, '删除失败'))
  }
}
</script>

<style lang="scss" scoped>
.container_users {
  max-width: 1200px;
  margin: 0 auto;
  padding: $space-5 $space-4 $space-6;
}

.container_users_name {
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  font-weight: 500;
}

.container_users_avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: $radius-pill;
  background: var(--tc-hover);
  color: $color-text-secondary;
  font-size: $font-xs;
  font-weight: 600;
  flex-shrink: 0;

  &_admin {
    background: var(--tc-primary-soft);
    color: $color-primary;
  }
}

.container_users_actions {
  display: inline-flex;
  align-items: center;
  gap: $space-1;
  white-space: nowrap;
}

.container_users_dangerLink {
  color: $color-danger !important;
}
</style>

<style lang="scss">
// 禁用行整体降透明度（作用于 UiTable 内部的 tr，非 scoped）
.container_users_rowDisabled > td {
  opacity: 0.55;
}
</style>
