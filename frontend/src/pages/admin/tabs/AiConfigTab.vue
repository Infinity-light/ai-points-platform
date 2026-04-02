<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  aiConfigApi,
  type AiProvider,
  type AiProviderKey,
  type OpenApiKey,
  type CreateProviderPayload,
} from '@/services/ai-config';
import { Plus, Trash2, Key, Eye, EyeOff, Copy, Check } from 'lucide-vue-next';

// ─── Sub-tab ────────────────────────────────────────────────────────────────

type SubTab = 'providers' | 'openapi';
const activeSubTab = ref<SubTab>('providers');

// ─── AI Providers ───────────────────────────────────────────────────────────

const providers = ref<AiProvider[]>([]);
const providerLoading = ref(false);
const providerError = ref('');

// Provider form
const showProviderForm = ref(false);
const providerForm = ref<CreateProviderPayload>({
  name: '',
  type: 'anthropic',
  baseUrl: '',
});
const providerSaving = ref(false);

// Expanded provider keys
const expandedProviderId = ref<string | null>(null);
const providerKeys = ref<AiProviderKey[]>([]);
const keysLoading = ref(false);
const newKeyValue = ref('');
const newKeyMasked = ref(true);
const addingKey = ref(false);

async function loadProviders() {
  providerLoading.value = true;
  providerError.value = '';
  try {
    const res = await aiConfigApi.listProviders();
    providers.value = res.data;
  } catch {
    providerError.value = '加载 AI 服务源失败';
  } finally {
    providerLoading.value = false;
  }
}

async function createProvider() {
  if (!providerForm.value.name.trim()) return;
  providerSaving.value = true;
  try {
    const res = await aiConfigApi.createProvider({
      ...providerForm.value,
      baseUrl: providerForm.value.baseUrl || undefined,
    });
    providers.value.push(res.data);
    showProviderForm.value = false;
    providerForm.value = { name: '', type: 'anthropic', baseUrl: '' };
  } catch {
    providerError.value = '创建失败';
  } finally {
    providerSaving.value = false;
  }
}

async function removeProvider(id: string) {
  if (!confirm('确认删除此 AI 服务源？关联的 Key 也会被删除。')) return;
  try {
    await aiConfigApi.removeProvider(id);
    providers.value = providers.value.filter((p) => p.id !== id);
    if (expandedProviderId.value === id) expandedProviderId.value = null;
  } catch {
    providerError.value = '删除失败';
  }
}

async function toggleKeys(providerId: string) {
  if (expandedProviderId.value === providerId) {
    expandedProviderId.value = null;
    return;
  }
  expandedProviderId.value = providerId;
  keysLoading.value = true;
  try {
    const res = await aiConfigApi.listKeys(providerId);
    providerKeys.value = res.data;
  } catch {
    providerKeys.value = [];
  } finally {
    keysLoading.value = false;
  }
}

async function addProviderKey() {
  if (!newKeyValue.value.trim() || !expandedProviderId.value) return;
  addingKey.value = true;
  try {
    const res = await aiConfigApi.addKey(expandedProviderId.value, {
      apiKey: newKeyValue.value.trim(),
    });
    providerKeys.value.push(res.data);
    newKeyValue.value = '';
  } catch {
    providerError.value = '添加 Key 失败';
  } finally {
    addingKey.value = false;
  }
}

async function removeProviderKey(keyId: string) {
  if (!expandedProviderId.value) return;
  try {
    await aiConfigApi.removeKey(expandedProviderId.value, keyId);
    providerKeys.value = providerKeys.value.filter((k) => k.id !== keyId);
  } catch {
    providerError.value = '删除 Key 失败';
  }
}

// ─── Open API Keys ──────────────────────────────────────────────────────────

const openApiKeys = ref<OpenApiKey[]>([]);
const openApiLoading = ref(false);
const openApiError = ref('');

// Generate key
const showGenerateForm = ref(false);
const generateLabel = ref('');
const generating = ref(false);
const generatedRawKey = ref<string | null>(null);
const copied = ref(false);

async function loadOpenApiKeys() {
  openApiLoading.value = true;
  openApiError.value = '';
  try {
    const res = await aiConfigApi.listOpenApiKeys();
    openApiKeys.value = res.data;
  } catch {
    openApiError.value = '加载 Open API Key 失败';
  } finally {
    openApiLoading.value = false;
  }
}

async function generateOpenApiKey() {
  if (!generateLabel.value.trim()) return;
  generating.value = true;
  try {
    const res = await aiConfigApi.createOpenApiKey({
      label: generateLabel.value.trim(),
    });
    generatedRawKey.value = res.data.rawKey;
    openApiKeys.value.unshift(res.data.key);
    generateLabel.value = '';
  } catch {
    openApiError.value = '生成 Key 失败';
  } finally {
    generating.value = false;
  }
}

function closeGeneratedKey() {
  generatedRawKey.value = null;
  showGenerateForm.value = false;
}

async function copyKey() {
  if (!generatedRawKey.value) return;
  await navigator.clipboard.writeText(generatedRawKey.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}

async function revokeOpenApiKey(id: string) {
  if (!confirm('确认吊销此 API Key？吊销后立即生效，无法恢复。')) return;
  try {
    await aiConfigApi.revokeOpenApiKey(id);
    openApiKeys.value = openApiKeys.value.filter((k) => k.id !== id);
  } catch {
    openApiError.value = '吊销失败';
  }
}

// ─── Init ───────────────────────────────────────────────────────────────────

onMounted(() => {
  void loadProviders();
  void loadOpenApiKeys();
});

const providerTypes = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI (GPT)' },
  { value: 'azure_openai', label: 'Azure OpenAI' },
  { value: 'custom', label: '自定义' },
] as const;

function formatDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <div>
    <h2 class="font-heading font-semibold text-foreground mb-4">AI 配置</h2>

    <!-- Sub-tabs -->
    <div class="flex gap-1 border-b border-border mb-4">
      <button
        v-for="tab in [{ key: 'providers', label: 'AI 服务源' }, { key: 'openapi', label: 'Open API' }]"
        :key="tab.key"
        class="px-4 py-2 text-sm font-medium transition-colors duration-200 border-b-2 -mb-px cursor-pointer"
        :class="activeSubTab === tab.key
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="activeSubTab = tab.key as SubTab"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- ═══ AI Providers Tab ═══ -->
    <div v-if="activeSubTab === 'providers'">
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-muted-foreground">管理调用外部 LLM 的 API 源和 Key 轮询池</p>
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
          @click="showProviderForm = !showProviderForm"
        >
          <Plus class="w-4 h-4" />
          添加源
        </button>
      </div>

      <!-- Create form -->
      <div v-if="showProviderForm" class="glass-card p-4 mb-4 space-y-3">
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">名称</label>
            <input
              v-model="providerForm.name"
              placeholder="如：Claude 主力"
              class="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">类型</label>
            <select
              v-model="providerForm.type"
              class="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            >
              <option v-for="t in providerTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">Base URL（可选）</label>
            <input
              v-model="providerForm.baseUrl"
              placeholder="留空使用默认"
              class="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>
        </div>
        <div class="flex gap-2">
          <button
            class="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
            :disabled="providerSaving || !providerForm.name.trim()"
            @click="createProvider"
          >
            {{ providerSaving ? '创建中...' : '创建' }}
          </button>
          <button
            class="px-4 py-1.5 bg-secondary text-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
            @click="showProviderForm = false"
          >
            取消
          </button>
        </div>
      </div>

      <p v-if="providerError" class="text-sm text-destructive mb-3">{{ providerError }}</p>

      <!-- Loading -->
      <div v-if="providerLoading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="h-16 bg-secondary rounded-lg animate-pulse" />
      </div>

      <!-- Empty -->
      <div v-else-if="providers.length === 0" class="glass-card p-8 text-center text-muted-foreground text-sm">
        还没有配置 AI 服务源，点击「添加源」开始
      </div>

      <!-- Provider list -->
      <div v-else class="space-y-2">
        <div v-for="provider in providers" :key="provider.id" class="glass-card overflow-hidden">
          <div class="flex items-center gap-4 px-4 py-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-foreground">{{ provider.name }}</span>
                <span class="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                  {{ providerTypes.find(t => t.value === provider.type)?.label ?? provider.type }}
                </span>
                <span
                  class="w-2 h-2 rounded-full"
                  :class="provider.isActive ? 'bg-green-400' : 'bg-red-400'"
                />
              </div>
              <p v-if="provider.baseUrl" class="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                {{ provider.baseUrl }}
              </p>
            </div>
            <button
              class="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer flex items-center gap-1"
              @click="toggleKeys(provider.id)"
            >
              <Key class="w-3.5 h-3.5" />
              {{ expandedProviderId === provider.id ? '收起' : 'Key 管理' }}
            </button>
            <button
              class="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              @click="removeProvider(provider.id)"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>

          <!-- Keys panel -->
          <div v-if="expandedProviderId === provider.id" class="border-t border-border bg-secondary/30 px-4 py-3">
            <div v-if="keysLoading" class="text-xs text-muted-foreground">加载中...</div>
            <div v-else>
              <div v-if="providerKeys.length === 0" class="text-xs text-muted-foreground mb-2">
                暂无 Key，添加后自动组成轮询池
              </div>
              <div v-else class="space-y-1.5 mb-3">
                <div
                  v-for="pk in providerKeys"
                  :key="pk.id"
                  class="flex items-center justify-between text-xs bg-background/50 rounded px-3 py-2"
                >
                  <div class="flex items-center gap-3">
                    <span class="font-mono text-foreground">{{ pk.keyMask }}</span>
                    <span
                      class="w-1.5 h-1.5 rounded-full"
                      :class="pk.isActive ? 'bg-green-400' : 'bg-yellow-400'"
                    />
                    <span class="text-muted-foreground">调用 {{ pk.usageCount }} 次</span>
                  </div>
                  <button
                    class="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                    @click="removeProviderKey(pk.id)"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div class="flex gap-2">
                <div class="relative flex-1">
                  <input
                    v-model="newKeyValue"
                    :type="newKeyMasked ? 'password' : 'text'"
                    placeholder="粘贴 API Key..."
                    class="w-full border border-border rounded px-3 py-1.5 text-xs bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary pr-8 transition-colors"
                    @keyup.enter="addProviderKey"
                  />
                  <button
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    @click="newKeyMasked = !newKeyMasked"
                  >
                    <EyeOff v-if="newKeyMasked" class="w-3.5 h-3.5" />
                    <Eye v-else class="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  class="px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
                  :disabled="addingKey || !newKeyValue.trim()"
                  @click="addProviderKey"
                >
                  {{ addingKey ? '...' : '添加' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ Open API Tab ═══ -->
    <div v-if="activeSubTab === 'openapi'">
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-muted-foreground">管理平台 Open API Key，允许外部工具调用平台接口</p>
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
          @click="showGenerateForm = true; generatedRawKey = null;"
        >
          <Plus class="w-4 h-4" />
          生成 Key
        </button>
      </div>

      <p v-if="openApiError" class="text-sm text-destructive mb-3">{{ openApiError }}</p>

      <!-- Generate modal -->
      <div v-if="showGenerateForm" class="glass-card p-4 mb-4">
        <template v-if="!generatedRawKey">
          <h4 class="text-sm font-medium text-foreground mb-3">生成新的 API Key</h4>
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1">用途标签</label>
              <input
                v-model="generateLabel"
                placeholder="如：Claude Code 集成"
                class="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
              />
            </div>
            <div class="flex gap-2">
              <button
                class="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
                :disabled="generating || !generateLabel.trim()"
                @click="generateOpenApiKey"
              >
                {{ generating ? '生成中...' : '生成' }}
              </button>
              <button
                class="px-4 py-1.5 bg-secondary text-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
                @click="showGenerateForm = false"
              >
                取消
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <h4 class="text-sm font-medium text-foreground mb-2">Key 已生成</h4>
          <p class="text-xs text-amber-400 mb-3">
            请立即复制保存，关闭后将无法再次查看完整 Key。
          </p>
          <div class="flex items-center gap-2 bg-background rounded-lg border border-border px-3 py-2 mb-3">
            <code class="flex-1 text-xs font-mono text-foreground break-all select-all">
              {{ generatedRawKey }}
            </code>
            <button
              class="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              @click="copyKey"
            >
              <Check v-if="copied" class="w-4 h-4 text-green-400" />
              <Copy v-else class="w-4 h-4" />
            </button>
          </div>
          <button
            class="px-4 py-1.5 bg-secondary text-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
            @click="closeGeneratedKey"
          >
            已复制，关闭
          </button>
        </template>
      </div>

      <!-- Loading -->
      <div v-if="openApiLoading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="h-12 bg-secondary rounded-lg animate-pulse" />
      </div>

      <!-- Empty -->
      <div v-else-if="openApiKeys.length === 0" class="glass-card p-8 text-center text-muted-foreground text-sm">
        还没有 Open API Key，点击「生成 Key」开始
      </div>

      <!-- Key list -->
      <div v-else class="glass-card overflow-hidden">
        <table class="w-full">
          <thead>
            <tr class="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
              <th class="px-4 py-2 text-left font-medium">标签</th>
              <th class="px-4 py-2 text-left font-medium">Key 前缀</th>
              <th class="px-4 py-2 text-left font-medium">状态</th>
              <th class="px-4 py-2 text-left font-medium">最后使用</th>
              <th class="px-4 py-2 text-left font-medium">创建时间</th>
              <th class="px-4 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="key in openApiKeys" :key="key.id" class="hover:bg-white/5 transition-colors">
              <td class="px-4 py-3 text-sm font-medium text-foreground">{{ key.label }}</td>
              <td class="px-4 py-3 text-xs font-mono text-muted-foreground">{{ key.keyPrefix }}...</td>
              <td class="px-4 py-3">
                <span
                  class="text-xs px-1.5 py-0.5 rounded"
                  :class="key.isActive
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-red-500/10 text-red-400'"
                >
                  {{ key.isActive ? '有效' : '已吊销' }}
                </span>
              </td>
              <td class="px-4 py-3 text-xs text-muted-foreground">{{ formatDate(key.lastUsedAt) }}</td>
              <td class="px-4 py-3 text-xs text-muted-foreground">{{ formatDate(key.createdAt) }}</td>
              <td class="px-4 py-3 text-right">
                <button
                  v-if="key.isActive"
                  class="text-xs text-destructive hover:text-destructive/80 transition-colors cursor-pointer"
                  @click="revokeOpenApiKey(key.id)"
                >
                  吊销
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
