<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { approvalApi, type ApprovalConfig } from '@/services/approval';
import { Save } from 'lucide-vue-next';

const loading = ref(true);
const error = ref('');

interface ConfigForm {
  id?: string;
  configType: string;
  deptApproverMode: string;
  financePersonId: string;
  finalApproverId: string;
}

const reimbursementForm = ref<ConfigForm>({
  configType: 'reimbursement',
  deptApproverMode: 'auto',
  financePersonId: '',
  finalApproverId: '',
});

const assetForm = ref<ConfigForm>({
  configType: 'asset_operation',
  deptApproverMode: 'auto',
  financePersonId: '',
  finalApproverId: '',
});

const savingReimbursement = ref(false);
const savingAsset = ref(false);
const saveReimbursementError = ref('');
const saveAssetError = ref('');
const saveReimbursementSuccess = ref(false);
const saveAssetSuccess = ref(false);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const configs = await approvalApi.getConfigs();
    for (const cfg of configs) {
      if (cfg.configType === 'reimbursement') {
        reimbursementForm.value = {
          id: cfg.id,
          configType: cfg.configType,
          deptApproverMode: cfg.deptApproverMode,
          financePersonId: cfg.financePersonId ?? '',
          finalApproverId: cfg.finalApproverId ?? '',
        };
      } else if (cfg.configType === 'asset_operation') {
        assetForm.value = {
          id: cfg.id,
          configType: cfg.configType,
          deptApproverMode: cfg.deptApproverMode,
          financePersonId: cfg.financePersonId ?? '',
          finalApproverId: cfg.finalApproverId ?? '',
        };
      }
    }
  } catch {
    error.value = '加载审批配置失败';
  } finally {
    loading.value = false;
  }
}

async function saveReimbursement() {
  savingReimbursement.value = true;
  saveReimbursementError.value = '';
  saveReimbursementSuccess.value = false;
  try {
    const payload: Partial<ApprovalConfig> = {
      configType: reimbursementForm.value.configType,
      deptApproverMode: reimbursementForm.value.deptApproverMode,
      financePersonId: reimbursementForm.value.financePersonId || null,
      finalApproverId: reimbursementForm.value.finalApproverId || null,
    };
    await approvalApi.upsertConfig(payload);
    saveReimbursementSuccess.value = true;
    setTimeout(() => { saveReimbursementSuccess.value = false; }, 2000);
  } catch {
    saveReimbursementError.value = '保存失败';
  } finally {
    savingReimbursement.value = false;
  }
}

async function saveAsset() {
  savingAsset.value = true;
  saveAssetError.value = '';
  saveAssetSuccess.value = false;
  try {
    const payload: Partial<ApprovalConfig> = {
      configType: assetForm.value.configType,
      deptApproverMode: assetForm.value.deptApproverMode,
      financePersonId: assetForm.value.financePersonId || null,
      finalApproverId: assetForm.value.finalApproverId || null,
    };
    await approvalApi.upsertConfig(payload);
    saveAssetSuccess.value = true;
    setTimeout(() => { saveAssetSuccess.value = false; }, 2000);
  } catch {
    saveAssetError.value = '保存失败';
  } finally {
    savingAsset.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-heading font-semibold text-foreground">审批配置</h3>
      <p class="text-sm text-muted-foreground">配置报销与资产操作的审批链路</p>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-24 bg-secondary rounded-xl animate-pulse" />
    </div>

    <div v-else-if="error" class="text-sm text-red-400 bg-red-400/10 rounded-lg px-4 py-3">{{ error }}</div>

    <template v-else>
      <!-- 报销审批链 -->
      <div class="glass-card p-5 space-y-4">
        <h4 class="text-base font-medium text-foreground border-b border-border pb-3">报销审批链</h4>

        <div class="grid grid-cols-1 gap-4">
          <div>
            <label class="block text-xs text-muted-foreground mb-1.5">部门审批人模式</label>
            <select
              v-model="reimbursementForm.deptApproverMode"
              class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
            >
              <option value="auto">自动（取部门负责人）</option>
              <option value="manual">手动指定</option>
              <option value="skip">跳过此步</option>
            </select>
          </div>

          <div>
            <label class="block text-xs text-muted-foreground mb-1.5">财务负责人 ID</label>
            <input
              v-model="reimbursementForm.financePersonId"
              class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              placeholder="财务负责人用户 UUID（留空则跳过此步）"
            />
          </div>

          <div>
            <label class="block text-xs text-muted-foreground mb-1.5">最终审批人 ID</label>
            <input
              v-model="reimbursementForm.finalApproverId"
              class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              placeholder="最终审批人用户 UUID（留空则跳过此步）"
            />
          </div>
        </div>

        <p v-if="saveReimbursementError" class="text-xs text-destructive">{{ saveReimbursementError }}</p>
        <p v-if="saveReimbursementSuccess" class="text-xs text-green-400">保存成功</p>

        <div class="flex justify-end">
          <button
            class="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="savingReimbursement"
            @click="saveReimbursement"
          >
            <Save class="w-4 h-4" />
            {{ savingReimbursement ? '保存中...' : '保存配置' }}
          </button>
        </div>
      </div>

      <!-- 资产操作审批链 -->
      <div class="glass-card p-5 space-y-4">
        <h4 class="text-base font-medium text-foreground border-b border-border pb-3">资产操作审批链</h4>

        <div class="grid grid-cols-1 gap-4">
          <div>
            <label class="block text-xs text-muted-foreground mb-1.5">部门审批人模式</label>
            <select
              v-model="assetForm.deptApproverMode"
              class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
            >
              <option value="auto">自动（取部门负责人）</option>
              <option value="manual">手动指定</option>
              <option value="skip">跳过此步</option>
            </select>
          </div>

          <div>
            <label class="block text-xs text-muted-foreground mb-1.5">财务负责人 ID</label>
            <input
              v-model="assetForm.financePersonId"
              class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              placeholder="财务负责人用户 UUID（留空则跳过此步）"
            />
          </div>

          <div>
            <label class="block text-xs text-muted-foreground mb-1.5">最终审批人 ID</label>
            <input
              v-model="assetForm.finalApproverId"
              class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              placeholder="最终审批人用户 UUID（留空则跳过此步）"
            />
          </div>
        </div>

        <p v-if="saveAssetError" class="text-xs text-destructive">{{ saveAssetError }}</p>
        <p v-if="saveAssetSuccess" class="text-xs text-green-400">保存成功</p>

        <div class="flex justify-end">
          <button
            class="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="savingAsset"
            @click="saveAsset"
          >
            <Save class="w-4 h-4" />
            {{ savingAsset ? '保存中...' : '保存配置' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
