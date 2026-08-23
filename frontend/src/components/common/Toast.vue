<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { PhCheckCircle, PhXCircle, PhWarning, PhInfo, PhX } from '@phosphor-icons/vue';
import { useI18n } from 'vue-i18n';

type ToastType = 'info' | 'success' | 'error' | 'warning';

interface Props {
  message: string;
  type?: ToastType;
  duration?: number;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
  duration: 3000,
});

const { t } = useI18n();

const emit = defineEmits<{
  close: [];
}>();

const show = ref(true);

onMounted(() => {
  if (props.duration > 0) {
    setTimeout(() => {
      show.value = false;
      setTimeout(() => emit('close'), 300);
    }, props.duration);
  }
});

function handleClose() {
  show.value = false;
  setTimeout(() => emit('close'), 300);
}
</script>

<template>
  <div
    v-if="show"
    :class="['toast', `toast-${type}`, show ? 'toast-show' : 'toast-hide']"
    :role="type === 'error' || type === 'warning' ? 'alert' : 'status'"
    :aria-live="type === 'error' || type === 'warning' ? 'assertive' : 'polite'"
  >
    <div class="flex items-center gap-3">
      <PhCheckCircle v-if="type === 'success'" :size="20" />
      <PhXCircle v-else-if="type === 'error'" :size="20" />
      <PhWarning v-else-if="type === 'warning'" :size="20" />
      <PhInfo v-else :size="20" />
      <span class="flex-1 toast-message selectable-text">{{ message }}</span>
      <button
        type="button"
        class="text-xl opacity-70 hover:opacity-100 transition-opacity"
        :title="t('common.close')"
        :aria-label="t('common.close')"
        @click="handleClose"
      >
        <PhX :size="20" />
      </button>
    </div>
  </div>
</template>

<style scoped>
@reference "../../style.css";
.toast {
  @apply z-[60] px-5 py-3 rounded-lg shadow-lg border min-w-[300px] max-w-md;
}
.toast-show {
  animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-hide {
  animation: slideOut 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-info {
  background-color: var(--state-info-background);
  border-color: var(--state-info-border);
  color: var(--state-info-color);
}
.toast-success {
  background-color: var(--state-success-background);
  border-color: var(--state-success-border);
  color: var(--state-success-color);
}
.toast-error {
  background-color: var(--state-danger-background);
  border-color: var(--state-danger-border);
  color: var(--state-danger-color);
}
.toast-warning {
  background-color: var(--state-warning-background);
  border-color: var(--state-warning-border);
  color: var(--state-warning-color);
}
.toast-message {
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  cursor: text;
}
@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
@keyframes slideOut {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(-20px);
    opacity: 0;
  }
}
</style>
