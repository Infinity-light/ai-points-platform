<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { auctionApi, type Auction, type Bid, type AuctionStatus } from '@/services/auction';
import { Gavel, Clock, Trophy, ChevronRight, X, Plus } from 'lucide-vue-next';

// ─── 状态 ────────────────────────────────────────────────────────────────────
const auctions = ref<Auction[]>([]);
const selectedAuction = ref<(Auction & { bids: Bid[] }) | null>(null);
const loading = ref(true);
const detailLoading = ref(false);
const error = ref('');
const bidAmount = ref<number>(0);
const bidLoading = ref(false);
const bidError = ref('');
const filterStatus = ref<AuctionStatus | ''>('');

// ─── 计算属性 ─────────────────────────────────────────────────────────────────
const filteredAuctions = computed(() => {
  if (!filterStatus.value) return auctions.value;
  return auctions.value.filter((a) => a.status === filterStatus.value);
});

const highestBid = computed(() => {
  if (!selectedAuction.value?.bids?.length) return null;
  return selectedAuction.value.bids[0];
});

const minNextBid = computed(() => {
  if (!selectedAuction.value) return 0;
  return highestBid.value ? highestBid.value.amount + 1 : selectedAuction.value.minBid;
});

const isAuctionOpen = computed(() =>
  selectedAuction.value?.status === 'open' && new Date() < new Date(selectedAuction.value.endsAt),
);

// ─── 方法 ─────────────────────────────────────────────────────────────────────
async function loadAuctions() {
  loading.value = true;
  error.value = '';
  try {
    const res = await auctionApi.list();
    auctions.value = res.data;
  } catch (e) {
    error.value = '加载竞拍列表失败';
  } finally {
    loading.value = false;
  }
}

async function openDetail(auction: Auction) {
  detailLoading.value = true;
  bidError.value = '';
  try {
    const res = await auctionApi.get(auction.id);
    selectedAuction.value = res.data;
    bidAmount.value = minNextBid.value;
  } catch (e) {
    error.value = '加载竞拍详情失败';
  } finally {
    detailLoading.value = false;
  }
}

function closeDetail() {
  selectedAuction.value = null;
  bidError.value = '';
}

async function submitBid() {
  if (!selectedAuction.value) return;
  bidLoading.value = true;
  bidError.value = '';
  try {
    await auctionApi.placeBid(selectedAuction.value.id, bidAmount.value);
    // Reload detail to get updated bids
    const res = await auctionApi.get(selectedAuction.value.id);
    selectedAuction.value = res.data;
    bidAmount.value = minNextBid.value;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    bidError.value = err.response?.data?.message ?? '出价失败，请重试';
  } finally {
    bidLoading.value = false;
  }
}

function formatTimeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return '已截止';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}分钟`;
}

function statusLabel(status: AuctionStatus): string {
  const map: Record<AuctionStatus, string> = {
    open: '进行中',
    closed: '已结束',
    cancelled: '已取消',
  };
  return map[status] ?? status;
}

function statusClass(status: AuctionStatus): string {
  if (status === 'open') return 'text-green-400 bg-green-400/10';
  if (status === 'closed') return 'text-blue-400 bg-blue-400/10';
  return 'text-muted-foreground bg-secondary';
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    task_claim: '任务认领',
    reward: '奖励',
    custom: '自定义',
  };
  return map[type] ?? type;
}

onMounted(loadAuctions);
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <!-- 标题 -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Gavel class="w-6 h-6 text-primary" />
          竞拍
        </h1>
        <p class="text-sm text-muted-foreground mt-0.5">工分竞拍活动</p>
      </div>
      <!-- 状态筛选 -->
      <div class="flex gap-2">
        <button
          v-for="s in (['', 'open', 'closed', 'cancelled'] as const)"
          :key="s"
          class="px-3 py-1.5 text-xs rounded-full border transition-colors duration-150"
          :class="filterStatus === s
            ? 'border-primary text-primary bg-primary/10'
            : 'border-border text-muted-foreground hover:text-foreground'"
          @click="filterStatus = s"
        >
          {{ s === '' ? '全部' : statusLabel(s) }}
        </button>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="h-20 bg-secondary rounded-xl animate-pulse" />
    </div>

    <!-- 错误 -->
    <div v-else-if="error" class="glass-card p-8 text-center text-muted-foreground text-sm">
      {{ error }}
    </div>

    <!-- 空列表 -->
    <div v-else-if="filteredAuctions.length === 0" class="glass-card p-12 text-center">
      <Gavel class="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      <p class="text-muted-foreground text-sm">暂无竞拍活动</p>
    </div>

    <!-- 竞拍列表 -->
    <div v-else class="space-y-3">
      <button
        v-for="auction in filteredAuctions"
        :key="auction.id"
        class="glass-card w-full p-4 text-left hover:border-primary/40 transition-colors duration-150 group"
        @click="openDetail(auction)"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="statusClass(auction.status)">
                {{ statusLabel(auction.status) }}
              </span>
              <span class="text-xs text-muted-foreground">{{ typeLabel(auction.type) }}</span>
            </div>
            <p class="text-sm font-medium text-foreground truncate">{{ auction.description }}</p>
            <div class="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span class="flex items-center gap-1">
                <Trophy class="w-3.5 h-3.5" />
                当前最高：<span class="text-foreground font-medium">
                  {{ auction.winningBid !== null ? auction.winningBid : (auction.minBid + ' 起') }}
                </span>
              </span>
              <span class="flex items-center gap-1">
                <Clock class="w-3.5 h-3.5" />
                {{ auction.status === 'open' ? formatTimeLeft(auction.endsAt) : '已截止' }}
              </span>
            </div>
          </div>
          <ChevronRight class="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1 transition-colors" />
        </div>
      </button>
    </div>

    <!-- 详情抽屉 -->
    <Teleport to="body">
      <div
        v-if="selectedAuction"
        class="fixed inset-0 z-50 flex justify-end"
        @click.self="closeDetail"
      >
        <div class="bg-background border-l border-border w-full max-w-md h-full overflow-y-auto shadow-2xl">
          <div class="p-6">
            <!-- 详情头部 -->
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-lg font-heading font-semibold text-foreground">竞拍详情</h2>
              <button class="p-1.5 rounded-lg hover:bg-secondary transition-colors" @click="closeDetail">
                <X class="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div v-if="detailLoading" class="space-y-3">
              <div v-for="i in 3" :key="i" class="h-16 bg-secondary rounded-lg animate-pulse" />
            </div>

            <template v-else>
              <!-- 基本信息 -->
              <div class="glass-card p-4 mb-4">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="statusClass(selectedAuction.status)">
                    {{ statusLabel(selectedAuction.status) }}
                  </span>
                  <span class="text-xs text-muted-foreground">{{ typeLabel(selectedAuction.type) }}</span>
                </div>
                <p class="text-sm text-foreground mb-3">{{ selectedAuction.description }}</p>
                <div class="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p class="text-muted-foreground mb-0.5">最低出价</p>
                    <p class="text-foreground font-medium">{{ selectedAuction.minBid }}</p>
                  </div>
                  <div>
                    <p class="text-muted-foreground mb-0.5">截止时间</p>
                    <p class="text-foreground font-medium">{{ formatTimeLeft(selectedAuction.endsAt) }}</p>
                  </div>
                </div>
              </div>

              <!-- 赢家 -->
              <div v-if="selectedAuction.status === 'closed' && selectedAuction.winnerId" class="glass-card p-4 mb-4 border-primary/30">
                <div class="flex items-center gap-2 text-primary mb-1">
                  <Trophy class="w-4 h-4" />
                  <span class="text-sm font-medium">竞拍结果</span>
                </div>
                <p class="text-xs text-muted-foreground">
                  赢家出价：<span class="text-foreground font-semibold">{{ selectedAuction.winningBid }}</span>
                </p>
              </div>

              <!-- 出价输入 -->
              <div v-if="isAuctionOpen" class="glass-card p-4 mb-4">
                <p class="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Plus class="w-4 h-4" />
                  我要出价
                </p>
                <div class="flex gap-2">
                  <input
                    v-model.number="bidAmount"
                    type="number"
                    :min="minNextBid"
                    class="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                    :placeholder="`最低 ${minNextBid}`"
                  />
                  <button
                    class="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="bidLoading || bidAmount < minNextBid"
                    @click="submitBid"
                  >
                    {{ bidLoading ? '出价中...' : '出价' }}
                  </button>
                </div>
                <p v-if="bidError" class="text-xs text-destructive mt-2">{{ bidError }}</p>
                <p class="text-xs text-muted-foreground mt-1">当前最低出价：{{ minNextBid }}</p>
              </div>

              <!-- 出价历史 -->
              <div>
                <h3 class="text-sm font-medium text-foreground mb-3">出价历史</h3>
                <div v-if="!selectedAuction.bids?.length" class="text-center py-6 text-muted-foreground text-xs">
                  暂无出价记录
                </div>
                <div v-else class="space-y-2">
                  <div
                    v-for="(bid, index) in selectedAuction.bids"
                    :key="bid.id"
                    class="flex items-center justify-between p-3 rounded-lg"
                    :class="index === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-secondary'"
                  >
                    <div class="flex items-center gap-2">
                      <Trophy v-if="index === 0" class="w-3.5 h-3.5 text-primary" />
                      <span class="text-xs text-muted-foreground">{{ new Date(bid.createdAt).toLocaleString('zh-CN') }}</span>
                    </div>
                    <span class="text-sm font-semibold" :class="index === 0 ? 'text-primary' : 'text-foreground'">
                      {{ bid.amount }}
                    </span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
