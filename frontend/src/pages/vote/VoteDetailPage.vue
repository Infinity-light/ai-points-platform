<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { voteApi, type VoteSession, type VoteRecord } from '@/services/vote';
import { taskApi, type Task } from '@/services/task';
import { useAuthStore } from '@/stores/auth';
import BaseButton from '@/components/ui/BaseButton.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import { ChevronLeft } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const sessionId = computed(() => route.params.id as string);
const session = ref<VoteSession | null>(null);
const tasks = ref<Task[]>([]);
const votes = ref<VoteRecord[]>([]);
const loading = ref(true);
const voteLoading = ref(false);
const closeLoading = ref(false);
const myVote = ref<boolean | null>(null);

const isHrOrAdmin = computed(() =>
  ['hr_admin', 'super_admin', 'project_lead'].includes(authStore.user?.role ?? ''),
);

async function load() {
  loading.value = true;
  try {
    const [sessionRes, votesRes] = await Promise.all([
      voteApi.getSession(sessionId.value),
      voteApi.getVotes(sessionId.value),
    ]);
    session.value = sessionRes.data;
    votes.value = votesRes.data;

    // Check my vote
    const myRecord = votesRes.data.find((v) => v.userId === authStore.user?.id);
    myVote.value = myRecord?.vote ?? null;

    // Load tasks
    if (session.value.taskIds.length > 0) {
      const taskResults = await Promise.all(
        session.value.taskIds.map((tid) =>
          taskApi.get(session.value!.projectId, tid).catch(() => null),
        ),
      );
      tasks.value = taskResults
        .filter((t): t is Awaited<ReturnType<typeof taskApi.get>> => t !== null)
        .map((r) => r.data);
    }
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function castVote(vote: boolean) {
  if (voteLoading.value || myVote.value !== null) return;
  voteLoading.value = true;
  try {
    await voteApi.castVote(sessionId.value, vote);
    myVote.value = vote;
    await load();
  } finally {
    voteLoading.value = false;
  }
}

async function closeSession() {
  if (!confirm('确认关闭投票并统计结果？')) return;
  closeLoading.value = true;
  try {
    await voteApi.closeSession(sessionId.value);
    await load();
  } finally {
    closeLoading.value = false;
  }
}

const yesCount = computed(() => votes.value.filter((v) => v.vote).length);
const noCount = computed(() => votes.value.filter((v) => !v.vote).length);
const yesWeight = computed(() =>
  votes.value.filter((v) => v.vote).reduce((sum, v) => sum + Number(v.weight), 0),
);
const totalWeight = computed(() =>
  votes.value.reduce((sum, v) => sum + Number(v.weight), 0),
);
const yesRatio = computed(() =>
  totalWeight.value > 0 ? yesWeight.value / totalWeight.value : 0,
);

const statusLabels: Record<string, string> = {
  open: '投票中',
  closed: '已关闭',
  passed: '✓ 已通过',
  failed: '✗ 未通过',
};

const statusClasses: Record<string, string> = {
  open: 'bg-primary/10 text-primary',
  passed: 'bg-green-500/10 text-green-400',
  failed: 'bg-destructive/10 text-destructive',
  closed: 'bg-secondary text-muted-foreground',
};
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <div class="flex items-center gap-3 mb-6">
      <button
        class="text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
        @click="router.push('/vote')"
      >
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-xl font-heading font-bold text-foreground">投票会议</h1>
    </div>

    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="h-24 bg-secondary rounded-lg animate-pulse" />
    </div>

    <template v-else-if="session">
      <!-- Status + Actions -->
      <div class="glass-card p-5 mb-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span
              class="px-3 py-1 text-sm rounded-full font-medium"
              :class="statusClasses[session.status]"
            >
              {{ statusLabels[session.status] }}
            </span>
            <span class="text-sm font-mono text-muted-foreground">
              {{ session.taskIds.length }} 个任务 · {{ votes.length }} 人已投票
            </span>
          </div>

          <div v-if="session.status === 'open' && isHrOrAdmin">
            <BaseButton variant="outline" size="sm" :loading="closeLoading" @click="closeSession" class="transition-colors duration-200">
              关闭投票
            </BaseButton>
          </div>
        </div>

        <!-- Live results bar -->
        <div v-if="votes.length > 0" class="mt-4 space-y-2">
          <div class="flex justify-between text-xs font-mono text-muted-foreground">
            <span>赞成 {{ yesCount }} ({{ (yesRatio * 100).toFixed(0) }}% 加权)</span>
            <span>反对 {{ noCount }}</span>
          </div>
          <div class="h-3 bg-secondary rounded-full overflow-hidden flex">
            <div
              class="h-full bg-green-500 transition-all"
              :style="{ width: `${yesRatio * 100}%` }"
            />
            <div class="h-full bg-destructive flex-1" />
          </div>
          <p
            v-if="session.result.participationRatio !== undefined"
            class="text-xs font-mono text-muted-foreground"
          >
            参与率：{{ (session.result.participationRatio * 100).toFixed(0) }}%
            （需 >50% 参与且 >50% 赞成通过）
          </p>
        </div>

        <!-- Vote buttons -->
        <div v-if="session.status === 'open'" class="mt-4">
          <div v-if="myVote !== null" class="text-sm text-muted-foreground">
            您已投票：
            <span :class="myVote ? 'text-green-400 font-medium' : 'text-destructive font-medium'">
              {{ myVote ? '✓ 赞成' : '✗ 反对' }}
            </span>
          </div>
          <div v-else class="flex gap-3">
            <BaseButton class="flex-1 transition-colors duration-200" size="sm" :loading="voteLoading" @click="castVote(true)">
              ✓ 赞成
            </BaseButton>
            <BaseButton
              variant="outline"
              class="flex-1 transition-colors duration-200"
              size="sm"
              :loading="voteLoading"
              @click="castVote(false)"
            >
              ✗ 反对
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- Tasks list -->
      <div class="space-y-3">
        <h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          本次投票任务
        </h2>
        <div
          v-for="task in tasks"
          :key="task.id"
          class="glass-card p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <StatusBadge :status="task.status" />
                <p class="font-medium text-sm text-foreground">{{ task.title }}</p>
              </div>
              <p v-if="task.description" class="text-xs text-muted-foreground">
                {{ task.description }}
              </p>
            </div>
            <div class="text-right text-xs">
              <div v-if="task.metadata?.aiScores" class="space-y-0.5">
                <p class="font-mono font-medium text-foreground">
                  {{ task.metadata.aiScores.average.toFixed(1) }}/5
                </p>
                <p class="text-muted-foreground">AI均分</p>
              </div>
              <div v-if="task.estimatedPoints" class="font-mono text-muted-foreground mt-1">
                预估 {{ task.estimatedPoints }}分
              </div>
            </div>
          </div>

          <!-- AI Score breakdown -->
          <div
            v-if="task.metadata?.aiScores"
            class="mt-3 grid grid-cols-3 gap-2 text-center"
          >
            <div
              v-for="(label, key) in { research: '调查', planning: '规划', execution: '执行' }"
              :key="key"
              class="bg-secondary/50 rounded-md py-1.5"
            >
              <p class="text-sm font-mono font-medium">
                {{ task.metadata.aiScores[key as keyof typeof task.metadata.aiScores] }}
              </p>
              <p class="text-xs text-muted-foreground">{{ label }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
