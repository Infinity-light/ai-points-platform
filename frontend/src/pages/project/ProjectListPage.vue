<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { projectApi, type Project } from '@/services/project';
import BaseButton from '@/components/ui/BaseButton.vue';
import { Plus, Folder } from 'lucide-vue-next';

const router = useRouter();
const projects = ref<Project[]>([]);
const loading = ref(true);
const error = ref('');

async function loadProjects() {
  try {
    const res = await projectApi.list(true);
    projects.value = res.data;
  } catch {
    error.value = '加载项目失败，请刷新重试';
  } finally {
    loading.value = false;
  }
}

onMounted(loadProjects);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-heading font-bold text-foreground">我的项目</h1>
        <p class="text-sm text-muted-foreground mt-0.5">管理您参与的项目</p>
      </div>
      <BaseButton @click="router.push('/projects/create')" class="transition-colors duration-200">
        <Plus class="w-4 h-4 mr-2" />
        创建项目
      </BaseButton>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="glass-card p-5 animate-pulse">
        <div class="h-5 bg-secondary rounded w-1/3 mb-3" />
        <div class="h-4 bg-secondary rounded w-1/2" />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error"
      class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg">
      {{ error }}
    </div>

    <!-- Empty state -->
    <div v-else-if="projects.length === 0"
      class="text-center py-16 text-muted-foreground">
      <Folder class="w-12 h-12 mx-auto mb-4 opacity-30" />
      <p class="text-sm">还没有加入任何项目</p>
      <BaseButton class="mt-4 transition-colors duration-200" variant="outline" size="sm" @click="router.push('/projects/create')">
        创建第一个项目
      </BaseButton>
    </div>

    <!-- Project grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="project in projects"
        :key="project.id"
        class="glass-card-hover p-5 cursor-pointer"
        @click="router.push(`/projects/${project.id}`)"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-foreground truncate">{{ project.name }}</h3>
            <p v-if="project.description" class="text-sm text-muted-foreground mt-1 line-clamp-2">
              {{ project.description }}
            </p>
          </div>
          <span
            class="ml-3 flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            :class="project.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-secondary text-muted-foreground'"
          >
            {{ project.status === 'active' ? '进行中' : '已归档' }}
          </span>
        </div>

        <div class="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span class="font-mono">结算轮次：第 {{ project.settlementRound }} 轮</span>
          <span>·</span>
          <span>{{ formatDate(project.createdAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
