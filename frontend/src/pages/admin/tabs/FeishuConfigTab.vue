<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  feishuConfigApi,
  type FeishuConfig,
  type FeishuRoleMapping,
  type SyncLog,
} from '@/services/feishu-config';
import type { RoleDto } from '@/services/rbac';
import { Copy, Check, RefreshCw, Trash2, Plus } from 'lucide-vue-next';

// ─── Config Section ──────────────────────────────────────────────────────────

const config = ref<FeishuConfig | null>(null);
const configLoading = ref(false);
const configError = ref('');
const configSaving = ref(false);
const configSaved = ref(false);

const formAppId = ref('');
const formAppSecret = ref('');
const formEnabled = ref(false);

const testLoading = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);

async function loadConfig() {
  configLoading.value = true;
  configError.value = '';
  try {
    const data = await feishuConfigApi.getConfig();
    config.value = data;
    formAppId.value = data.appId;
    formEnabled.value = data.enabled;
    formAppSecret.value = '';
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      config.value = null;
    } else {
      configError.value = '加载飞书配置失败';
    }
  } finally {
    configLoading.value = false;
  }
}

async function saveConfig() {
  if (!formAppId.value.trim()) {
    configError.value = '请填写 App ID';
    return;
  }
  if (!formAppSecret.value.trim() && !config.value?.hasSecret) {
    configError.value = '请填写 App Secret';
    return;
  }
  configSaving.value = true;
  configError.value = '';
  try {
    const data = await feishuConfigApi.saveConfig({
      appId: formAppId.value.trim(),
      appSecret: formAppSecret.value.trim() || '(unchanged)',
      enabled: formEnabled.value,
    });
    config.value = data;
    formAppSecret.value = '';
    configSaved.value = true;
    setTimeout(() => { configSaved.value = false; }, 2000);
    void loadMappings();
  } catch {
    configError.value = '保存配置失败';
  } finally {
    configSaving.value = false;
  }
}

async function testConnection() {
  testLoading.value = true;
  testResult.value = null;
  try {
    const res = await feishuConfigApi.testConnection();
    testResult.value = {
      success: res.success,
      message: res.success ? `连接成功：${res.tenantName ?? ''}` : (res.message ?? '连接失败'),
    };
  } catch {
    testResult.value = { success: false, message: '连接测试失败，请检查配置' };
  } finally {
    testLoading.value = false;
  }
}

// ─── Webhook Section ─────────────────────────────────────────────────────────

const copiedWebhook = ref(false);
const copiedToken = ref(false);

async function copyWebhookUrl() {
  if (!config.value?.webhookUrl) return;
  await navigator.clipboard.writeText(config.value.webhookUrl);
  copiedWebhook.value = true;
  setTimeout(() => { copiedWebhook.value = false; }, 2000);
}

async function copyVerifyToken() {
  if (!config.value?.webhookVerifyToken) return;
  await navigator.clipboard.writeText(config.value.webhookVerifyToken);
  copiedToken.value = true;
  setTimeout(() => { copiedToken.value = false; }, 2000);
}

// ─── Role Mapping Section ─────────────────────────────────────────────────────

const mappings = ref<FeishuRoleMapping[]>([]);
const mappingsLoading = ref(false);
const mappingsError = ref('');
const roles = ref<RoleDto[]>([]);

const newMappingFeishuRole = ref('');
const newMappingPlatformRoleId = ref('');
const addingMapping = ref(false);

async function loadMappings() {
  if (!config.value) return;
  mappingsLoading.value = true;
  mappingsError.value = '';
  try {
    const [mappingsRes, rolesRes] = await Promise.all([
      feishuConfigApi.listMappings(),
      feishuConfigApi.listRoles(),
    ]);
    mappings.value = mappingsRes.items;
    roles.value = rolesRes;
  } catch {
    mappingsError.value = '加载角色映射失败';
  } finally {
    mappingsLoading.value = false;
  }
}

async function addMapping() {
  if (!newMappingFeishuRole.value.trim() || !newMappingPlatformRoleId.value) return;
  addingMapping.value = true;
  try {
    const created = await feishuConfigApi.createMapping({
      feishuRoleName: newMappingFeishuRole.value.trim(),
      platformRoleId: newMappingPlatformRoleId.value,
    });
    mappings.value.push(created);
    newMappingFeishuRole.value = '';
    newMappingPlatformRoleId.value = '';
  } catch {
    mappingsError.value = '创建映射失败';
  } finally {
    addingMapping.value = false;
  }
}

async function deleteMapping(id: string) {
  if (!confirm('确认删除此角色映射？')) return;
  try {
    await feishuConfigApi.deleteMapping(id);
    mappings.value = mappings.value.filter((m) => m.id !== id);
  } catch {
    mappingsError.value = '删除映射失败';
  }
}

// ─── Sync Section ─────────────────────────────────────────────────────────────

const syncLogs = ref<SyncLog[]>([]);
const syncLogsLoading = ref(false);
const syncLogsError = ref('');
const syncTriggering = ref(false);

const latestLog = computed(() => syncLogs.value[0] ?? null);

async function loadSyncLogs() {
  if (!config.value) return;
  syncLogsLoading.value = true;
  syncLogsError.value = '';
  try {
    const res = await feishuConfigApi.listSyncLogs({ page: 1, limit: 20 });
    syncLogs.value = res.items;
  } catch {
    syncLogsError.value = '加载同步日志失败';
  } finally {
    syncLogsLoading.value = false;
  }
}

async function triggerSync() {
  syncTriggering.value = true;
  try {
    await feishuConfigApi.triggerSync();
    setTimeout(() => { void loadSyncLogs(); }, 1500);
  } catch {
    syncLogsError.value = '触发同步失败';
  } finally {
    syncTriggering.value = false;
  }
}

function formatDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function syncStatusLabel(status: SyncLog['status']) {
  const map: Record<SyncLog['status'], string> = {
    pending: '待处理',
    running: '同步中',
    success: '成功',
    failed: '失败',
  };
  return map[status] ?? status;
}

function syncStatusClass(status: SyncLog['status']) {
  const map: Record<SyncLog['status'], string> = {
    pending: 'bg-yellow-500/10 text-yellow-400',
    running: 'bg-blue-500/10 text-blue-400',
    success: 'bg-green-500/10 text-green-400',
    failed: 'bg-red-500/10 text-red-400',
  };
  return map[status] ?? '';
}

// ─── Init ─────────────────────────────────────────────────────────────────────

onMounted(async () => {
  await loadConfig();
  if (config.value) {
    void loadMappings();
    void loadSyncLogs();
  }
});
</script>

<template>
  <div class="space-y-6">
    <h2 class="font-heading font-semibold text-foreground">飞书集成</h2>

    <!-- ═══ 配置区 ═══ -->
    <div class="glass-card p-6 space-y-4">
      <h3 class="text-sm font-semibold text-foreground">应用配置</h3>
      <p class="text-xs text-muted-foreground">在飞书开放平台创建自建应用后，将 App ID 和 App Secret 填入下方。</p>

      <div v-if="configLoading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="h-10 bg-secondary rounded-lg animate-pulse" />
      </div>

      <template v-else>
        <p v-if="configError" class="text-sm text-destructive">{{ configError }}</p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">App ID</label>
            <input
              v-model="formAppId"
              placeholder="cli_xxxxxxxxxx"
              class="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">
              App Secret
              <span v-if="config?.hasSecret" class="text-xs text-muted-foreground ml-1">（已保存，留空保持不变）</span>
            </label>
            <input
              v-model="formAppSecret"
              type="password"
              :placeholder="config?.hasSecret ? '留空保持不变' : '请输入 App Secret'"
              class="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>
        </div>

        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <div
              class="relative w-10 h-6 rounded-full transition-colors cursor-pointer"
              :class="formEnabled ? 'bg-primary' : 'bg-secondary'"
              @click="formEnabled = !formEnabled"
            >
              <div
                class="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform"
                :class="formEnabled ? 'translate-x-5' : 'translate-x-1'"
              />
            </div>
            <span class="text-sm text-foreground">启用飞书登录</span>
          </label>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <button
            class="px-4 py-2 bg-secondary text-foreground rounded-lg text-sm hover:bg-secondary/80 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-2"
            :disabled="testLoading || !formAppId.trim()"
            @click="testConnection"
          >
            <RefreshCw class="w-4 h-4" :class="testLoading ? 'animate-spin' : ''" />
            {{ testLoading ? '测试中...' : '测试连接' }}
          </button>
          <button
            class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
            :disabled="configSaving"
            @click="saveConfig"
          >
            {{ configSaving ? '保存中...' : configSaved ? '已保存' : '保存配置' }}
          </button>
          <span
            v-if="testResult"
            class="text-sm"
            :class="testResult.success ? 'text-green-400' : 'text-destructive'"
          >
            {{ testResult.message }}
          </span>
        </div>
      </template>
    </div>

    <!-- ═══ Webhook 区 ═══ -->
    <div v-if="config" class="glass-card p-6 space-y-4">
      <h3 class="text-sm font-semibold text-foreground">Webhook 配置</h3>
      <p class="text-xs text-muted-foreground">将以下 URL 和 Token 填入飞书开放平台的事件订阅页面。</p>

      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">Webhook URL</label>
          <div class="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
            <code class="flex-1 text-xs font-mono text-foreground break-all select-all">{{ config.webhookUrl }}</code>
            <button
              class="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              @click="copyWebhookUrl"
            >
              <Check v-if="copiedWebhook" class="w-4 h-4 text-green-400" />
              <Copy v-else class="w-4 h-4" />
            </button>
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">Verify Token</label>
          <div class="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
            <code class="flex-1 text-xs font-mono text-foreground break-all select-all">{{ config.webhookVerifyToken }}</code>
            <button
              class="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              @click="copyVerifyToken"
            >
              <Check v-if="copiedToken" class="w-4 h-4 text-green-400" />
              <Copy v-else class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ 角色映射区 ═══ -->
    <div v-if="config" class="glass-card p-6 space-y-4">
      <h3 class="text-sm font-semibold text-foreground">角色映射</h3>
      <p class="text-xs text-muted-foreground">将飞书通讯录中的职位名映射到平台角色，同步时自动为成员分配对应权限。</p>

      <p v-if="mappingsError" class="text-sm text-destructive">{{ mappingsError }}</p>

      <div v-if="mappingsLoading" class="space-y-2">
        <div v-for="i in 3" :key="i" class="h-10 bg-secondary rounded animate-pulse" />
      </div>

      <template v-else>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
              <th class="pb-2 text-left font-medium">飞书职位名</th>
              <th class="pb-2 text-left font-medium">平台角色</th>
              <th class="pb-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="mapping in mappings" :key="mapping.id" class="hover:bg-white/5 transition-colors">
              <td class="py-2 text-foreground">{{ mapping.feishuRoleName }}</td>
              <td class="py-2 text-muted-foreground">{{ mapping.platformRoleName }}</td>
              <td class="py-2 text-right">
                <button
                  class="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                  @click="deleteMapping(mapping.id)"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </td>
            </tr>
            <tr v-if="mappings.length === 0">
              <td colspan="3" class="py-4 text-center text-muted-foreground text-xs">
                暂无映射，在下方添加
              </td>
            </tr>
            <!-- Add row -->
            <tr class="border-t border-border">
              <td class="pt-3 pr-2">
                <input
                  v-model="newMappingFeishuRole"
                  placeholder="飞书职位名，如：研发"
                  class="w-full border border-border rounded px-2 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                  @keyup.enter="addMapping"
                />
              </td>
              <td class="pt-3 pr-2">
                <select
                  v-model="newMappingPlatformRoleId"
                  class="w-full border border-border rounded px-2 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                >
                  <option value="">选择平台角色</option>
                  <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</option>
                </select>
              </td>
              <td class="pt-3 text-right">
                <button
                  class="text-primary hover:text-primary/80 transition-colors cursor-pointer disabled:opacity-50"
                  :disabled="addingMapping || !newMappingFeishuRole.trim() || !newMappingPlatformRoleId"
                  @click="addMapping"
                >
                  <Plus class="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </template>
    </div>

    <!-- ═══ 同步区 ═══ -->
    <div v-if="config" class="glass-card p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-foreground">通讯录同步</h3>
        <button
          class="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
          :disabled="syncTriggering"
          @click="triggerSync"
        >
          <RefreshCw class="w-4 h-4" :class="syncTriggering ? 'animate-spin' : ''" />
          {{ syncTriggering ? '同步中...' : '全量同步' }}
        </button>
      </div>

      <!-- Status cards -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-secondary/40 rounded-lg px-4 py-3">
          <p class="text-xs text-muted-foreground mb-1">上次同步时间</p>
          <p class="text-sm font-medium text-foreground">{{ formatDate(latestLog?.completedAt ?? null) }}</p>
        </div>
        <div class="bg-secondary/40 rounded-lg px-4 py-3">
          <p class="text-xs text-muted-foreground mb-1">部门数</p>
          <p class="text-sm font-medium text-foreground">{{ latestLog?.stats?.departmentCount ?? '—' }}</p>
        </div>
        <div class="bg-secondary/40 rounded-lg px-4 py-3">
          <p class="text-xs text-muted-foreground mb-1">用户数</p>
          <p class="text-sm font-medium text-foreground">{{ latestLog?.stats?.userCount ?? '—' }}</p>
        </div>
      </div>

      <p v-if="syncLogsError" class="text-sm text-destructive">{{ syncLogsError }}</p>

      <!-- Sync logs table -->
      <div v-if="syncLogsLoading" class="space-y-2">
        <div v-for="i in 3" :key="i" class="h-10 bg-secondary rounded animate-pulse" />
      </div>

      <div v-else-if="syncLogs.length === 0" class="text-center py-4 text-muted-foreground text-xs">
        暂无同步记录
      </div>

      <div v-else class="overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
              <th class="pb-2 text-left font-medium">时间</th>
              <th class="pb-2 text-left font-medium">类型</th>
              <th class="pb-2 text-left font-medium">状态</th>
              <th class="pb-2 text-left font-medium">统计</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="log in syncLogs" :key="log.id" class="hover:bg-white/5 transition-colors">
              <td class="py-2 text-xs text-muted-foreground">{{ formatDate(log.startedAt) }}</td>
              <td class="py-2 text-xs text-foreground">{{ log.type === 'full' ? '全量' : '增量' }}</td>
              <td class="py-2">
                <span class="text-xs px-1.5 py-0.5 rounded" :class="syncStatusClass(log.status)">
                  {{ syncStatusLabel(log.status) }}
                </span>
              </td>
              <td class="py-2 text-xs text-muted-foreground">
                <template v-if="log.stats">
                  新增 {{ log.stats.created ?? 0 }}，更新 {{ log.stats.updated ?? 0 }}，停用 {{ log.stats.deactivated ?? 0 }}
                </template>
                <template v-else-if="log.error">
                  {{ log.error }}
                </template>
                <template v-else>—</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 未配置提示 -->
    <div v-if="!configLoading && !config" class="glass-card p-8 text-center text-muted-foreground text-sm">
      尚未配置飞书集成，请在上方填写 App ID 和 App Secret 后保存。
    </div>
  </div>
</template>
