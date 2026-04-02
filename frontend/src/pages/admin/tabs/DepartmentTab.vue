<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '@/lib/axios';
import { ChevronRight, ChevronDown, Users } from 'lucide-vue-next';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DepartmentNode {
  id: string;
  name: string;
  feishuDeptId: string | null;
  memberCount?: number;
  children?: DepartmentNode[];
}

interface DepartmentMember {
  id: string;
  name: string;
  email: string;
  tenantRoleName: string | null;
  feishuUserId: string | null;
}

interface MembersResponse {
  items: DepartmentMember[];
  total: number;
  page: number;
  limit: number;
}

// ─── State ────────────────────────────────────────────────────────────────────

const departments = ref<DepartmentNode[]>([]);
const deptLoading = ref(false);
const deptError = ref('');
const expandedIds = ref<Set<string>>(new Set());

const selectedDept = ref<DepartmentNode | null>(null);
const members = ref<DepartmentMember[]>([]);
const membersLoading = ref(false);
const membersTotal = ref(0);
const membersPage = ref(1);
const membersLimit = 20;

// ─── Department tree ──────────────────────────────────────────────────────────

async function loadDepartments() {
  deptLoading.value = true;
  deptError.value = '';
  try {
    const res = await api.get<DepartmentNode[]>('/departments/tree');
    departments.value = res.data;
  } catch {
    deptError.value = '加载部门树失败';
  } finally {
    deptLoading.value = false;
  }
}

function toggleExpand(node: DepartmentNode) {
  if (expandedIds.value.has(node.id)) {
    expandedIds.value.delete(node.id);
  } else {
    expandedIds.value.add(node.id);
  }
}

async function selectDept(node: DepartmentNode) {
  selectedDept.value = node;
  membersPage.value = 1;
  await loadMembers(node.id);
}

// ─── Members ──────────────────────────────────────────────────────────────────

async function loadMembers(deptId: string) {
  membersLoading.value = true;
  try {
    const res = await api.get<MembersResponse>(`/departments/${deptId}/members`, {
      params: { page: membersPage.value, limit: membersLimit },
    });
    members.value = res.data.items;
    membersTotal.value = res.data.total;
  } catch {
    members.value = [];
    membersTotal.value = 0;
  } finally {
    membersLoading.value = false;
  }
}

async function goToPage(page: number) {
  membersPage.value = page;
  if (selectedDept.value) {
    await loadMembers(selectedDept.value.id);
  }
}

function totalPages() {
  return Math.ceil(membersTotal.value / membersLimit);
}

function avatarInitial(name: string) {
  return name ? name.charAt(0).toUpperCase() : '?';
}

// ─── Init ─────────────────────────────────────────────────────────────────────

onMounted(() => {
  void loadDepartments();
});
</script>

<template>
  <div>
    <div class="mb-4">
      <h2 class="font-heading font-semibold text-foreground">部门管理</h2>
      <p class="text-xs text-muted-foreground mt-1">部门数据来源于飞书，如需修改请在飞书管理后台操作</p>
    </div>

    <!-- Loading -->
    <div v-if="deptLoading" class="flex gap-4">
      <div class="w-64 space-y-2">
        <div v-for="i in 6" :key="i" class="h-8 bg-secondary rounded animate-pulse" />
      </div>
      <div class="flex-1 space-y-2">
        <div v-for="i in 5" :key="i" class="h-12 bg-secondary rounded animate-pulse" />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="deptError" class="text-sm text-destructive">{{ deptError }}</div>

    <!-- Empty (no departments synced) -->
    <div v-else-if="departments.length === 0" class="glass-card p-10 text-center text-muted-foreground text-sm">
      尚未同步飞书通讯录，请前往「飞书集成」Tab 配置并同步
    </div>

    <!-- Main layout -->
    <div v-else class="flex gap-4 min-h-[480px]">
      <!-- Left: Department Tree -->
      <div class="w-64 shrink-0 glass-card p-3 overflow-auto">
        <p class="text-xs font-medium text-muted-foreground px-2 pb-2 border-b border-border mb-2">部门列表</p>
        <DeptTreeNode
          v-for="node in departments"
          :key="node.id"
          :node="node"
          :expanded-ids="expandedIds"
          :selected-id="selectedDept?.id ?? null"
          @toggle="toggleExpand"
          @select="selectDept"
        />
      </div>

      <!-- Right: Members -->
      <div class="flex-1 glass-card p-4">
        <template v-if="!selectedDept">
          <div class="h-full flex items-center justify-center text-muted-foreground text-sm">
            <div class="text-center">
              <Users class="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>点击左侧部门查看成员</p>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-foreground">{{ selectedDept.name }}</h3>
            <span class="text-xs text-muted-foreground">共 {{ membersTotal }} 人</span>
          </div>

          <div v-if="membersLoading" class="space-y-2">
            <div v-for="i in 5" :key="i" class="h-12 bg-secondary rounded animate-pulse" />
          </div>

          <div v-else-if="members.length === 0" class="text-center py-10 text-muted-foreground text-sm">
            该部门暂无成员
          </div>

          <div v-else class="space-y-1">
            <div
              v-for="member in members"
              :key="member.id"
              class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <!-- Avatar placeholder -->
              <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span class="text-xs font-medium text-primary">{{ avatarInitial(member.name) }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-foreground truncate">{{ member.name }}</p>
                <p class="text-xs text-muted-foreground truncate">{{ member.email }}</p>
              </div>
              <span v-if="member.tenantRoleName" class="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">
                {{ member.tenantRoleName }}
              </span>
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="totalPages() > 1" class="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border">
            <button
              class="px-3 py-1 text-xs rounded bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors cursor-pointer"
              :disabled="membersPage <= 1"
              @click="goToPage(membersPage - 1)"
            >
              上一页
            </button>
            <span class="text-xs text-muted-foreground">{{ membersPage }} / {{ totalPages() }}</span>
            <button
              class="px-3 py-1 text-xs rounded bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors cursor-pointer"
              :disabled="membersPage >= totalPages()"
              @click="goToPage(membersPage + 1)"
            >
              下一页
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Footer note -->
    <p class="text-xs text-muted-foreground mt-3 text-center">
      部门数据来源于飞书，如需修改请在飞书管理后台操作
    </p>
  </div>
</template>

<!-- Recursive tree node component -->
<script lang="ts">
import { defineComponent, h, type PropType } from 'vue';

interface TreeNode {
  id: string;
  name: string;
  feishuDeptId: string | null;
  memberCount?: number;
  children?: TreeNode[];
}

export const DeptTreeNode = defineComponent({
  name: 'DeptTreeNode',
  props: {
    node: { type: Object as PropType<TreeNode>, required: true },
    expandedIds: { type: Object as PropType<Set<string>>, required: true },
    selectedId: { type: String as PropType<string | null>, default: null },
    depth: { type: Number, default: 0 },
  },
  emits: ['toggle', 'select'],
  setup(props, { emit }) {
    return () => {
      const node = props.node;
      const hasChildren = (node.children?.length ?? 0) > 0;
      const isExpanded = props.expandedIds.has(node.id);
      const isSelected = props.selectedId === node.id;

      const chevron = hasChildren
        ? h(isExpanded ? ChevronDown : ChevronRight, { class: 'w-3.5 h-3.5 text-muted-foreground shrink-0' })
        : h('span', { class: 'w-3.5 h-3.5 shrink-0' });

      const row = h(
        'div',
        {
          class: [
            'flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors select-none',
            isSelected
              ? 'bg-primary/15 text-primary'
              : 'hover:bg-secondary/60 text-foreground',
          ],
          style: { paddingLeft: `${8 + props.depth * 16}px` },
          onClick: () => {
            if (hasChildren) emit('toggle', node);
            emit('select', node);
          },
        },
        [
          chevron,
          h('span', { class: 'truncate flex-1' }, node.name),
          node.memberCount != null
            ? h('span', { class: 'text-xs text-muted-foreground shrink-0' }, String(node.memberCount))
            : null,
        ],
      );

      const children =
        isExpanded && hasChildren
          ? h(
              'div',
              {},
              node.children!.map((child) =>
                h(DeptTreeNode, {
                  key: child.id,
                  node: child,
                  expandedIds: props.expandedIds,
                  selectedId: props.selectedId,
                  depth: props.depth + 1,
                  onToggle: (n: TreeNode) => emit('toggle', n),
                  onSelect: (n: TreeNode) => emit('select', n),
                }),
              ),
            )
          : null;

      return h('div', {}, [row, children]);
    };
  },
});
</script>
