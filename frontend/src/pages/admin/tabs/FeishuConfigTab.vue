<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  feishuConfigApi,
  type FeishuConfig,
  type FeishuRoleMapping,
  type SyncLog,
  type ScopeStatus,
  type AutoConfigStepResult,
} from '@/services/feishu-config';
import type { RoleDto } from '@/services/rbac';
import {
  Copy, Check, RefreshCw, Trash2, Plus,
  ExternalLink, ChevronRight, ChevronDown,
  Settings, Shield, Upload, Zap, Users, FolderSync,
  AlertCircle, CheckCircle2,
} from 'lucide-vue-next';

// ─── State ───────────────────────────────────────────────────────────────────

const config = ref<FeishuConfig | null>(null);
const configLoading = ref(true);
const mode = ref<'wizard' | 'dashboard'>('wizard');
const wizardStep = ref(1);
const TOTAL_STEPS = 6;

// ─── Step 1: App creation / credentials ──────────────────────────────────────

const formAppId = ref('');
const formAppSecret = ref('');
const formEnabled = ref(true);
const configSaving = ref(false);
const configError = ref('');

// Test connection
const testLoading = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);

// ─── Step 2: Scope check ────────────────────────────────────────────────────

const scopes = ref<ScopeStatus[]>([]);
const scopesLoading = ref(false);
const scopesCopied = ref(false);

const REQUIRED_SCOPES = [
  'contact:user.base:readonly',
  'contact:department.base:readonly',
  'contact:user.employee_id:readonly',
  'authen:user.base:readonly',
];

// ─── Step 4: Auto config ─────────────────────────────────────────────────────

const autoConfigRunning = ref(false);
const autoConfigResults = ref<AutoConfigStepResult[]>([]);
const autoConfigDone = ref(false);

// ─── Step 5: Role mapping ────────────────────────────────────────────────────

const mappings = ref<FeishuRoleMapping[]>([]);
const mappingsLoading = ref(false);
const mappingsError = ref('');
const roles = ref<RoleDto[]>([]);
const newMappingFeishuRole = ref('');
const newMappingPlatformRoleId = ref('');
const addingMapping = ref(false);

// ─── Step 6: Sync ────────────────────────────────────────────────────────────

const syncLogs = ref<SyncLog[]>([]);
const syncLogsLoading = ref(false);
const syncTriggering = ref(false);
const latestLog = computed(() => syncLogs.value[0] ?? null);

// ─── Dashboard: expanded sections ────────────────────────────────────────────

const expandedCards = ref<Set<string>>(new Set());

function toggleCard(key: string) {
  if (expandedCards.value.has(key)) expandedCards.value.delete(key);
  else expandedCards.value.add(key);
}

// ─── Webhook copy ────────────────────────────────────────────────────────────

const copiedWebhook = ref(false);
const copiedToken = ref(false);

async function copyToClipboard(text: string, which: 'webhook' | 'token' | 'scope') {
  await navigator.clipboard.writeText(text);
  if (which === 'webhook') { copiedWebhook.value = true; setTimeout(() => { copiedWebhook.value = false; }, 2000); }
  else if (which === 'token') { copiedToken.value = true; setTimeout(() => { copiedToken.value = false; }, 2000); }
  else { copiedWebhook.value = true; setTimeout(() => { copiedWebhook.value = false; }, 2000); }
}

// ─── Data loading ────────────────────────────────────────────────────────────

async function loadConfig() {
  configLoading.value = true;
  try {
    const data = await feishuConfigApi.getConfig();
    config.value = data;
    if (data.appId) {
      formAppId.value = data.appId;
      formEnabled.value = data.enabled;
      mode.value = 'dashboard';
    }
  } catch {
    config.value = null;
  } finally {
    configLoading.value = false;
  }
}

async function loadMappings() {
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

async function loadSyncLogs() {
  syncLogsLoading.value = true;
  try {
    const res = await feishuConfigApi.listSyncLogs({ page: 1, limit: 20 });
    syncLogs.value = res.items;
  } catch { /* ignore */ }
  finally { syncLogsLoading.value = false; }
}

// ─── Step 1 actions ──────────────────────────────────────────────────────────

async function saveManualConfig() {
  if (!formAppId.value.trim()) { configError.value = '请填写 App ID'; return; }
  if (!formAppSecret.value.trim() && !config.value?.hasSecret) { configError.value = '请填写 App Secret'; return; }
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
    wizardStep.value = 2;
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
      message: res.success ? '连接成功' : (res.message ?? '连接失败'),
    };
  } catch {
    testResult.value = { success: false, message: '连接测试失败' };
  } finally {
    testLoading.value = false;
  }
}

// ─── Step 2 actions ──────────────────────────────────────────────────────────

async function checkScopes() {
  scopesLoading.value = true;
  try {
    const res = await feishuConfigApi.checkScopes();
    scopes.value = res.scopes;
  } catch {
    scopes.value = REQUIRED_SCOPES.map((s) => ({ scope: s, description: s, granted: false }));
  } finally {
    scopesLoading.value = false;
  }
}

async function copyAllScopes() {
  await navigator.clipboard.writeText(REQUIRED_SCOPES.join('\n'));
  scopesCopied.value = true;
  setTimeout(() => { scopesCopied.value = false; }, 2000);
}

// ─── Step 4 actions ──────────────────────────────────────────────────────────

async function runAutoConfig() {
  autoConfigRunning.value = true;
  autoConfigResults.value = [];
  try {
    const res = await feishuConfigApi.autoConfigure();
    autoConfigResults.value = res.results;
    autoConfigDone.value = true;
  } catch {
    autoConfigResults.value = [{ step: 'all', success: false, message: '自动配置失败' }];
  } finally {
    autoConfigRunning.value = false;
  }
}

// ─── Step 5 actions ──────────────────────────────────────────────────────────

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

// ─── Step 6 actions ──────────────────────────────────────────────────────────

async function triggerSync() {
  syncTriggering.value = true;
  try {
    await feishuConfigApi.triggerSync();
    setTimeout(() => { void loadSyncLogs(); }, 1500);
  } catch { /* ignore */ }
  finally { syncTriggering.value = false; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function syncStatusLabel(status: SyncLog['status']) {
  return ({ pending: '待处理', running: '同步中', success: '成功', failed: '失败' })[status] ?? status;
}

function syncStatusClass(status: SyncLog['status']) {
  return ({
    pending: 'bg-yellow-500/10 text-yellow-400',
    running: 'bg-blue-500/10 text-blue-400',
    success: 'bg-green-500/10 text-green-400',
    failed: 'bg-red-500/10 text-red-400',
  })[status] ?? '';
}

function autoConfigStepLabel(step: string) {
  return ({ webhook: 'Webhook URL', events: '事件订阅', contacts_range: '通讯录范围' })[step] ?? step;
}

function switchToWizard() {
  mode.value = 'wizard';
  wizardStep.value = 1;
}

function finishWizard() {
  mode.value = 'dashboard';
}

const stepIcons = [Settings, Shield, Upload, Zap, Users, FolderSync] as const;
const stepLabels = ['连接应用', '配置权限', '发布应用', '自动配置', '角色映射', '同步通讯录'];

const feishuConsoleUrl = computed(() =>
  formAppId.value ? `https://open.feishu.cn/app/${formAppId.value}` : 'https://open.feishu.cn/app',
);

// ─── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(async () => {
  await loadConfig();
  if (config.value?.appId) {
    void loadMappings();
    void loadSyncLogs();
  }
});

// When entering steps that need data
watch(wizardStep, (step) => {
  if (step === 5 && mappings.value.length === 0) void loadMappings();
  if (step === 6 && syncLogs.value.length === 0) void loadSyncLogs();
});
</script>

<template>
  <div>
    <div class="mb-4">
      <h2 class="font-heading font-semibold text-foreground">飞书集成</h2>
      <p class="text-xs text-muted-foreground mt-1">配置飞书自建应用，启用 OAuth 登录和通讯录同步</p>
    </div>

    <!-- Loading -->
    <div v-if="configLoading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="h-16 bg-secondary rounded-lg animate-pulse" />
    </div>

    <!-- ═══════════════ WIZARD MODE ═══════════════ -->
    <template v-else-if="mode === 'wizard'">
      <!-- Stepper indicator -->
      <div class="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
        <template v-for="(label, idx) in stepLabels" :key="idx">
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 cursor-pointer"
            :class="
              wizardStep === idx + 1
                ? 'bg-primary/15 text-primary'
                : wizardStep > idx + 1
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-secondary text-muted-foreground'
            "
            @click="idx + 1 <= wizardStep ? wizardStep = idx + 1 : undefined"
          >
            <CheckCircle2 v-if="wizardStep > idx + 1" class="w-3.5 h-3.5" />
            <component :is="stepIcons[idx]" v-else class="w-3.5 h-3.5" />
            {{ label }}
          </button>
          <ChevronRight v-if="idx < stepLabels.length - 1" class="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
        </template>
      </div>

      <!-- ─── Step 1: Connect App ─── -->
      <div v-if="wizardStep === 1" class="glass-card p-6 space-y-4">
        <h3 class="text-sm font-semibold text-foreground">步骤 1：连接飞书应用</h3>

        <div class="space-y-3">
          <p class="text-xs text-muted-foreground">
            在
            <a href="https://open.feishu.cn/app" target="_blank" class="text-primary underline">飞书开放平台</a>
            创建自建应用后，将凭据填入下方。
          </p>

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
                <span v-if="config?.hasSecret" class="text-xs text-muted-foreground ml-1">（已保存）</span>
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

          <p v-if="configError" class="text-sm text-destructive">{{ configError }}</p>

          <div class="flex items-center gap-3">
            <button
              class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
              :disabled="configSaving"
              @click="saveManualConfig"
            >
              {{ configSaving ? '保存中...' : '保存并继续' }}
            </button>
            <button
              class="px-4 py-2 bg-secondary text-foreground rounded-lg text-sm hover:bg-secondary/80 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-2"
              :disabled="testLoading || !formAppId.trim()"
              @click="testConnection"
            >
              <RefreshCw class="w-3.5 h-3.5" :class="testLoading ? 'animate-spin' : ''" />
              测试连接
            </button>
            <span v-if="testResult" class="text-sm" :class="testResult.success ? 'text-green-400' : 'text-destructive'">
              {{ testResult.message }}
            </span>
          </div>
        </div>
      </div>

      <!-- ─── Step 2: Configure Permissions ─── -->
      <div v-else-if="wizardStep === 2" class="glass-card p-6 space-y-4">
        <h3 class="text-sm font-semibold text-foreground">步骤 2：在飞书控制台添加权限</h3>
        <p class="text-xs text-muted-foreground">请在飞书开放平台为应用添加以下权限范围（Scope）。</p>

        <div class="space-y-2">
          <div
            v-for="scope in (scopes.length > 0 ? scopes : REQUIRED_SCOPES.map(s => ({ scope: s, description: s, granted: false })))"
            :key="typeof scope === 'string' ? scope : scope.scope"
            class="flex items-center gap-3 bg-secondary/40 rounded-lg px-3 py-2"
          >
            <CheckCircle2
              v-if="typeof scope !== 'string' && scope.granted"
              class="w-4 h-4 text-green-400 shrink-0"
            />
            <AlertCircle v-else class="w-4 h-4 text-muted-foreground/50 shrink-0" />
            <code class="text-xs font-mono text-foreground flex-1">{{ typeof scope === 'string' ? scope : scope.scope }}</code>
            <button
              class="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              @click="copyToClipboard(typeof scope === 'string' ? scope : scope.scope, 'scope')"
            >
              <Copy class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <button
            class="px-3 py-1.5 bg-secondary text-foreground rounded-lg text-xs hover:bg-secondary/80 transition-colors cursor-pointer flex items-center gap-1.5"
            @click="copyAllScopes"
          >
            <Copy class="w-3.5 h-3.5" />
            {{ scopesCopied ? '已复制' : '一键复制全部' }}
          </button>
          <a
            :href="`${feishuConsoleUrl}/security/permission`"
            target="_blank"
            class="px-3 py-1.5 bg-secondary text-foreground rounded-lg text-xs hover:bg-secondary/80 transition-colors inline-flex items-center gap-1.5"
          >
            打开飞书权限页面 <ExternalLink class="w-3.5 h-3.5" />
          </a>
          <button
            class="px-3 py-1.5 bg-secondary text-foreground rounded-lg text-xs hover:bg-secondary/80 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
            :disabled="scopesLoading"
            @click="checkScopes"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="scopesLoading ? 'animate-spin' : ''" />
            检测权限状态
          </button>
        </div>
      </div>

      <!-- ─── Step 3: Publish App ─── -->
      <div v-else-if="wizardStep === 3" class="glass-card p-6 space-y-4">
        <h3 class="text-sm font-semibold text-foreground">步骤 3：发布应用</h3>
        <p class="text-xs text-muted-foreground">添加权限后需要发布新版本，权限才会生效。请在飞书控制台提交发布。</p>

        <div class="bg-secondary/40 rounded-lg p-4 space-y-2">
          <p class="text-sm text-foreground">操作步骤：</p>
          <ol class="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>在飞书开放平台进入应用 → 应用发布 → 创建版本</li>
            <li>填写版本号和更新说明，提交审核</li>
            <li>租户管理员在飞书管理后台审核通过即可</li>
          </ol>
        </div>

        <a
          :href="`${feishuConsoleUrl}/publish`"
          target="_blank"
          class="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          打开飞书应用发布页 <ExternalLink class="w-3.5 h-3.5" />
        </a>
      </div>

      <!-- ─── Step 4: Auto Configure ─── -->
      <div v-else-if="wizardStep === 4" class="glass-card p-6 space-y-4">
        <h3 class="text-sm font-semibold text-foreground">步骤 4：自动配置</h3>
        <p class="text-xs text-muted-foreground">平台将自动配置 Webhook URL、事件订阅和通讯录访问范围。请确保应用已发布后再执行。</p>

        <div v-if="autoConfigResults.length > 0" class="space-y-2">
          <div
            v-for="r in autoConfigResults"
            :key="r.step"
            class="flex items-center gap-3 bg-secondary/40 rounded-lg px-3 py-2"
          >
            <CheckCircle2 v-if="r.success" class="w-4 h-4 text-green-400 shrink-0" />
            <AlertCircle v-else class="w-4 h-4 text-red-400 shrink-0" />
            <span class="text-sm text-foreground flex-1">{{ autoConfigStepLabel(r.step) }}</span>
            <span v-if="!r.success && r.message" class="text-xs text-destructive">{{ r.message }}</span>
          </div>
        </div>

        <button
          class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-2"
          :disabled="autoConfigRunning"
          @click="runAutoConfig"
        >
          <Zap class="w-4 h-4" />
          {{ autoConfigRunning ? '配置中...' : autoConfigDone ? '重新配置' : '开始自动配置' }}
        </button>
      </div>

      <!-- ─── Step 5: Role Mapping ─── -->
      <div v-else-if="wizardStep === 5" class="glass-card p-6 space-y-4">
        <h3 class="text-sm font-semibold text-foreground">步骤 5：角色映射</h3>
        <p class="text-xs text-muted-foreground">将飞书通讯录中的职位名映射到平台角色，同步时自动为成员分配对应权限。</p>

        <p v-if="mappingsError" class="text-sm text-destructive">{{ mappingsError }}</p>

        <div v-if="mappingsLoading" class="space-y-2">
          <div v-for="i in 3" :key="i" class="h-10 bg-secondary rounded animate-pulse" />
        </div>

        <table v-else class="w-full text-sm">
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
                <button class="text-muted-foreground hover:text-destructive transition-colors cursor-pointer" @click="deleteMapping(mapping.id)">
                  <Trash2 class="w-4 h-4" />
                </button>
              </td>
            </tr>
            <tr v-if="mappings.length === 0">
              <td colspan="3" class="py-4 text-center text-muted-foreground text-xs">暂无映射，可直接跳过此步骤</td>
            </tr>
            <tr class="border-t border-border">
              <td class="pt-3 pr-2">
                <input
                  v-model="newMappingFeishuRole"
                  placeholder="飞书职位名"
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
      </div>

      <!-- ─── Step 6: Sync ─── -->
      <div v-else-if="wizardStep === 6" class="glass-card p-6 space-y-4">
        <h3 class="text-sm font-semibold text-foreground">步骤 6：同步通讯录</h3>
        <p class="text-xs text-muted-foreground">执行全量同步，将飞书组织架构（部门+成员）导入平台。</p>

        <div class="flex items-center gap-3">
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
            <p class="text-xs text-muted-foreground mb-1">上次同步</p>
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

        <!-- Sync logs -->
        <div v-if="syncLogs.length > 0" class="overflow-hidden">
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
                  <template v-else-if="log.error">{{ log.error }}</template>
                  <template v-else>—</template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Navigation buttons -->
      <div class="flex items-center justify-between mt-4">
        <button
          v-if="wizardStep > 1"
          class="px-4 py-2 bg-secondary text-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
          @click="wizardStep--"
        >
          上一步
        </button>
        <div v-else />
        <button
          v-if="wizardStep < TOTAL_STEPS"
          class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
          @click="wizardStep++"
        >
          {{ wizardStep === 1 && !config?.appId ? '跳过此步骤' : '下一步' }}
        </button>
        <button
          v-else
          class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors cursor-pointer"
          @click="finishWizard"
        >
          完成配置
        </button>
      </div>
    </template>

    <!-- ═══════════════ DASHBOARD MODE ═══════════════ -->
    <template v-else-if="mode === 'dashboard'">
      <div class="space-y-3">
        <!-- Connection status card -->
        <div class="glass-card p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 class="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p class="text-sm font-medium text-foreground">飞书已连接</p>
                <p class="text-xs text-muted-foreground">App ID: {{ config?.appId }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="px-3 py-1.5 bg-secondary text-foreground rounded-lg text-xs hover:bg-secondary/80 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
                :disabled="testLoading"
                @click="testConnection"
              >
                <RefreshCw class="w-3 h-3" :class="testLoading ? 'animate-spin' : ''" />
                测试
              </button>
              <button
                class="px-3 py-1.5 bg-secondary text-foreground rounded-lg text-xs hover:bg-secondary/80 transition-colors cursor-pointer"
                @click="switchToWizard"
              >
                重新配置
              </button>
            </div>
          </div>
          <span v-if="testResult" class="text-xs mt-2 block" :class="testResult.success ? 'text-green-400' : 'text-destructive'">
            {{ testResult.message }}
          </span>
        </div>

        <!-- Permission status card -->
        <div class="glass-card overflow-hidden">
          <button
            class="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
            @click="toggleCard('scopes')"
          >
            <div class="flex items-center gap-3">
              <Shield class="w-4 h-4 text-muted-foreground" />
              <span class="text-sm font-medium text-foreground">权限状态</span>
            </div>
            <ChevronDown v-if="expandedCards.has('scopes')" class="w-4 h-4 text-muted-foreground" />
            <ChevronRight v-else class="w-4 h-4 text-muted-foreground" />
          </button>
          <div v-if="expandedCards.has('scopes')" class="px-4 pb-4 space-y-2">
            <div
              v-for="scope in (scopes.length > 0 ? scopes : REQUIRED_SCOPES.map(s => ({ scope: s, description: s, granted: false })))"
              :key="typeof scope === 'string' ? scope : scope.scope"
              class="flex items-center gap-2 text-xs"
            >
              <CheckCircle2 v-if="typeof scope !== 'string' && scope.granted" class="w-3.5 h-3.5 text-green-400" />
              <AlertCircle v-else class="w-3.5 h-3.5 text-muted-foreground/50" />
              <code class="font-mono text-foreground">{{ typeof scope === 'string' ? scope : scope.scope }}</code>
            </div>
            <button
              class="px-3 py-1.5 bg-secondary text-foreground rounded text-xs hover:bg-secondary/80 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5 mt-2"
              :disabled="scopesLoading"
              @click="checkScopes"
            >
              <RefreshCw class="w-3 h-3" :class="scopesLoading ? 'animate-spin' : ''" />
              刷新
            </button>
          </div>
        </div>

        <!-- Webhook card -->
        <div class="glass-card overflow-hidden">
          <button
            class="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
            @click="toggleCard('webhook')"
          >
            <div class="flex items-center gap-3">
              <Zap class="w-4 h-4 text-muted-foreground" />
              <span class="text-sm font-medium text-foreground">Webhook 配置</span>
            </div>
            <ChevronDown v-if="expandedCards.has('webhook')" class="w-4 h-4 text-muted-foreground" />
            <ChevronRight v-else class="w-4 h-4 text-muted-foreground" />
          </button>
          <div v-if="expandedCards.has('webhook')" class="px-4 pb-4 space-y-2">
            <div>
              <label class="block text-xs text-muted-foreground mb-1">Webhook URL</label>
              <div class="flex items-center gap-2 bg-background border border-border rounded px-2 py-1.5">
                <code class="flex-1 text-xs font-mono text-foreground break-all select-all">{{ config?.webhookUrl }}</code>
                <button class="shrink-0 cursor-pointer" @click="copyToClipboard(config?.webhookUrl ?? '', 'webhook')">
                  <Check v-if="copiedWebhook" class="w-3.5 h-3.5 text-green-400" />
                  <Copy v-else class="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div>
              <label class="block text-xs text-muted-foreground mb-1">Verify Token</label>
              <div class="flex items-center gap-2 bg-background border border-border rounded px-2 py-1.5">
                <code class="flex-1 text-xs font-mono text-foreground break-all select-all">{{ config?.webhookVerifyToken }}</code>
                <button class="shrink-0 cursor-pointer" @click="copyToClipboard(config?.webhookVerifyToken ?? '', 'token')">
                  <Check v-if="copiedToken" class="w-3.5 h-3.5 text-green-400" />
                  <Copy v-else class="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Role mapping card -->
        <div class="glass-card p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <Users class="w-4 h-4 text-muted-foreground" />
              <span class="text-sm font-medium text-foreground">角色映射</span>
              <span class="text-xs text-muted-foreground">{{ mappings.length }} 条</span>
            </div>
          </div>
          <p v-if="mappingsError" class="text-xs text-destructive">{{ mappingsError }}</p>
          <table v-if="mappings.length > 0 || !mappingsLoading" class="w-full text-sm">
            <tbody class="divide-y divide-border">
              <tr v-for="mapping in mappings" :key="mapping.id" class="hover:bg-white/5 transition-colors">
                <td class="py-1.5 text-xs text-foreground">{{ mapping.feishuRoleName }}</td>
                <td class="py-1.5 text-xs text-muted-foreground">{{ mapping.platformRoleName }}</td>
                <td class="py-1.5 text-right">
                  <button class="text-muted-foreground hover:text-destructive transition-colors cursor-pointer" @click="deleteMapping(mapping.id)">
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
              <tr class="border-t border-border">
                <td class="pt-2 pr-2">
                  <input
                    v-model="newMappingFeishuRole"
                    placeholder="飞书职位名"
                    class="w-full border border-border rounded px-2 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                    @keyup.enter="addMapping"
                  />
                </td>
                <td class="pt-2 pr-2">
                  <select
                    v-model="newMappingPlatformRoleId"
                    class="w-full border border-border rounded px-2 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                  >
                    <option value="">选择角色</option>
                    <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</option>
                  </select>
                </td>
                <td class="pt-2 text-right">
                  <button
                    class="text-primary hover:text-primary/80 transition-colors cursor-pointer disabled:opacity-50"
                    :disabled="addingMapping || !newMappingFeishuRole.trim() || !newMappingPlatformRoleId"
                    @click="addMapping"
                  >
                    <Plus class="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Sync card -->
        <div class="glass-card p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <FolderSync class="w-4 h-4 text-muted-foreground" />
              <span class="text-sm font-medium text-foreground">通讯录同步</span>
            </div>
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
              :disabled="syncTriggering"
              @click="triggerSync"
            >
              <RefreshCw class="w-3 h-3" :class="syncTriggering ? 'animate-spin' : ''" />
              {{ syncTriggering ? '同步中...' : '全量同步' }}
            </button>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div class="bg-secondary/40 rounded-lg px-3 py-2">
              <p class="text-xs text-muted-foreground">上次同步</p>
              <p class="text-sm font-medium text-foreground">{{ formatDate(latestLog?.completedAt ?? null) }}</p>
            </div>
            <div class="bg-secondary/40 rounded-lg px-3 py-2">
              <p class="text-xs text-muted-foreground">部门</p>
              <p class="text-sm font-medium text-foreground">{{ latestLog?.stats?.departmentCount ?? '—' }}</p>
            </div>
            <div class="bg-secondary/40 rounded-lg px-3 py-2">
              <p class="text-xs text-muted-foreground">成员</p>
              <p class="text-sm font-medium text-foreground">{{ latestLog?.stats?.userCount ?? '—' }}</p>
            </div>
          </div>

          <!-- Recent sync logs -->
          <div v-if="syncLogs.length > 0" class="overflow-hidden">
            <table class="w-full text-xs">
              <tbody class="divide-y divide-border">
                <tr v-for="log in syncLogs.slice(0, 5)" :key="log.id" class="hover:bg-white/5 transition-colors">
                  <td class="py-1.5 text-muted-foreground">{{ formatDate(log.startedAt) }}</td>
                  <td class="py-1.5 text-foreground">{{ log.type === 'full' ? '全量' : '增量' }}</td>
                  <td class="py-1.5">
                    <span class="px-1.5 py-0.5 rounded" :class="syncStatusClass(log.status)">
                      {{ syncStatusLabel(log.status) }}
                    </span>
                  </td>
                  <td class="py-1.5 text-muted-foreground">
                    <template v-if="log.stats">+{{ log.stats.created ?? 0 }} / ~{{ log.stats.updated ?? 0 }}</template>
                    <template v-else>—</template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
