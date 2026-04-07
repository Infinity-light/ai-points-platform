<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { assetApi, type Asset } from '@/services/asset';
import { Package, Plus, Search, X } from 'lucide-vue-next';

const router = useRouter();

const assets = ref<Asset[]>([]);
const loading = ref(true);
const error = ref('');

const filterType = ref('');
const filterStatus = ref('');
const filterCategory = ref('');
const searchQuery = ref('');

const showCreateModal = ref(false);
const createLoading = ref(false);
const createError = ref('');
const createForm = ref({
  name: '',
  assetType: 'physical',
  category: '',
  vendor: '',
  serialNumber: '',
  purchasePrice: '',
  notes: '',
});

const assetTypes = ['physical', 'digital', 'license', 'equipment', 'vehicle', 'furniture'];
const assetStatuses = ['in_stock', 'in_use', 'under_repair', 'loaned', 'disposed', 'expired'];

const filteredAssets = computed(() => {
  return assets.value.filter((a) => {
    if (filterType.value && a.assetType !== filterType.value) return false;
    if (filterStatus.value && a.status !== filterStatus.value) return false;
    if (filterCategory.value && !a.category.includes(filterCategory.value)) return false;
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.assetCode.toLowerCase().includes(q) ||
        (a.vendor?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    assets.value = await assetApi.list();
  } catch {
    error.value = '加载资产列表失败';
  } finally {
    loading.value = false;
  }
}

function statusClass(status: string): string {
  const map: Record<string, string> = {
    in_stock: 'text-blue-400 bg-blue-400/10',
    in_use: 'text-green-400 bg-green-400/10',
    under_repair: 'text-amber-400 bg-amber-400/10',
    loaned: 'text-purple-400 bg-purple-400/10',
    disposed: 'text-muted-foreground bg-secondary',
    expired: 'text-red-400 bg-red-400/10',
  };
  return map[status] ?? 'text-muted-foreground bg-secondary';
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    in_stock: '库存',
    in_use: '使用中',
    under_repair: '维修中',
    loaned: '借出',
    disposed: '已处置',
    expired: '已过期',
  };
  return map[status] ?? status;
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    physical: '实物',
    digital: '数字',
    license: '许可证',
    equipment: '设备',
    vehicle: '车辆',
    furniture: '家具',
  };
  return map[type] ?? type;
}

function openCreateModal() {
  createForm.value = {
    name: '',
    assetType: 'physical',
    category: '',
    vendor: '',
    serialNumber: '',
    purchasePrice: '',
    notes: '',
  };
  createError.value = '';
  showCreateModal.value = true;
}

async function submitCreate() {
  if (!createForm.value.name.trim()) {
    createError.value = '请填写资产名称';
    return;
  }
  createLoading.value = true;
  createError.value = '';
  try {
    const asset = await assetApi.create({
      name: createForm.value.name.trim(),
      assetType: createForm.value.assetType,
      category: createForm.value.category.trim(),
      vendor: createForm.value.vendor.trim() || undefined,
      serialNumber: createForm.value.serialNumber.trim() || undefined,
      purchasePrice: createForm.value.purchasePrice ? Number(createForm.value.purchasePrice) : undefined,
      notes: createForm.value.notes.trim() || undefined,
    });
    showCreateModal.value = false;
    await router.push(`/assets/${asset.id}`);
  } catch {
    createError.value = '创建失败，请重试';
  } finally {
    createLoading.value = false;
  }
}

function clearFilters() {
  filterType.value = '';
  filterStatus.value = '';
  filterCategory.value = '';
  searchQuery.value = '';
}

onMounted(load);
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <!-- 标题 -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Package class="w-6 h-6 text-primary" />
          资产管理
        </h1>
        <p class="text-sm text-muted-foreground mt-0.5">统一管理企业固定资产和数字资产</p>
      </div>
      <button
        class="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150"
        @click="openCreateModal"
      >
        <Plus class="w-4 h-4" />
        新增资产
      </button>
    </div>

    <!-- 筛选栏 -->
    <div class="glass-card p-4 mb-5 flex flex-wrap items-center gap-3">
      <div class="relative flex-1 min-w-48">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          v-model="searchQuery"
          class="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          placeholder="搜索资产名称、编号..."
        />
      </div>
      <select
        v-model="filterType"
        class="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
      >
        <option value="">所有类型</option>
        <option v-for="t in assetTypes" :key="t" :value="t">{{ typeLabel(t) }}</option>
      </select>
      <select
        v-model="filterStatus"
        class="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
      >
        <option value="">所有状态</option>
        <option v-for="s in assetStatuses" :key="s" :value="s">{{ statusLabel(s) }}</option>
      </select>
      <input
        v-model="filterCategory"
        class="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
        placeholder="分类筛选..."
      />
      <button
        v-if="filterType || filterStatus || filterCategory || searchQuery"
        class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        @click="clearFilters"
      >
        <X class="w-3.5 h-3.5" />
        清除
      </button>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 5" :key="i" class="h-14 bg-secondary rounded-xl animate-pulse" />
    </div>

    <!-- 错误 -->
    <div v-else-if="error" class="glass-card p-8 text-center text-red-400 text-sm">{{ error }}</div>

    <!-- 空列表 -->
    <div v-else-if="filteredAssets.length === 0" class="glass-card p-12 text-center">
      <Package class="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      <p class="text-muted-foreground text-sm">{{ assets.length === 0 ? '暂无资产，点击「新增资产」开始' : '没有符合筛选条件的资产' }}</p>
    </div>

    <!-- 资产表格 -->
    <div v-else class="overflow-hidden rounded-xl border border-border">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-secondary/50 border-b border-border">
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">资产编号</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">名称</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">类型</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">分类</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">状态</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">供应商</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">采购价格</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr
            v-for="asset in filteredAssets"
            :key="asset.id"
            class="hover:bg-secondary/20 transition-colors cursor-pointer"
            @click="router.push(`/assets/${asset.id}`)"
          >
            <td class="px-4 py-3 font-mono text-xs text-muted-foreground">{{ asset.assetCode }}</td>
            <td class="px-4 py-3 text-foreground font-medium">{{ asset.name }}</td>
            <td class="px-4 py-3">
              <span class="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-muted-foreground">
                {{ typeLabel(asset.assetType) }}
              </span>
            </td>
            <td class="px-4 py-3 text-muted-foreground">{{ asset.category || '—' }}</td>
            <td class="px-4 py-3">
              <span
                class="px-2 py-0.5 rounded-full text-xs font-medium"
                :class="statusClass(asset.status)"
              >
                {{ statusLabel(asset.status) }}
              </span>
            </td>
            <td class="px-4 py-3 text-muted-foreground">{{ asset.vendor || '—' }}</td>
            <td class="px-4 py-3 text-foreground">
              {{ asset.purchasePrice != null ? '¥' + asset.purchasePrice.toLocaleString() : '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增资产模态框 -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        @click.self="showCreateModal = false"
      >
        <div class="glass-card w-full max-w-lg p-6 shadow-2xl">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-heading font-semibold text-foreground">新增资产</h2>
            <button
              class="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              @click="showCreateModal = false"
            >
              <X class="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs text-muted-foreground mb-1.5">资产名称 *</label>
              <input
                v-model="createForm.name"
                class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                placeholder="资产名称"
              />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-muted-foreground mb-1.5">资产类型</label>
                <select
                  v-model="createForm.assetType"
                  class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                >
                  <option v-for="t in assetTypes" :key="t" :value="t">{{ typeLabel(t) }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-muted-foreground mb-1.5">分类</label>
                <input
                  v-model="createForm.category"
                  class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                  placeholder="如：办公设备"
                />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-muted-foreground mb-1.5">供应商</label>
                <input
                  v-model="createForm.vendor"
                  class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                  placeholder="供应商名称"
                />
              </div>
              <div>
                <label class="block text-xs text-muted-foreground mb-1.5">序列号</label>
                <input
                  v-model="createForm.serialNumber"
                  class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                  placeholder="SN/序列号"
                />
              </div>
            </div>
            <div>
              <label class="block text-xs text-muted-foreground mb-1.5">采购价格（元）</label>
              <input
                v-model="createForm.purchasePrice"
                type="number"
                min="0"
                class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                placeholder="0.00"
              />
            </div>
            <div>
              <label class="block text-xs text-muted-foreground mb-1.5">备注</label>
              <textarea
                v-model="createForm.notes"
                rows="2"
                class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                placeholder="补充说明..."
              />
            </div>
          </div>

          <p v-if="createError" class="text-xs text-destructive mt-3">{{ createError }}</p>

          <div class="flex gap-2 justify-end mt-5">
            <button
              class="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-white/5 transition-colors duration-150"
              @click="showCreateModal = false"
            >
              取消
            </button>
            <button
              class="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="createLoading"
              @click="submitCreate"
            >
              {{ createLoading ? '创建中...' : '创建资产' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
