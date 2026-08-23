<script setup lang="ts">
interface Props {
  modelValue: string;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  rows?: number;
  resize?: boolean;
  fontMono?: boolean;
  ariaLabel?: string;
}

withDefaults(defineProps<Props>(), {
  placeholder: '',
  rows: 3,
  resize: false,
  fontMono: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <textarea
    class="input-field textarea"
    :class="[
      { 'state-danger-border': error, 'opacity-50 cursor-not-allowed': disabled },
      { 'resize-none': !resize },
      { 'font-mono': fontMono },
    ]"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :rows="rows"
    :aria-label="ariaLabel"
    @input="handleInput"
  />
</template>

<style scoped>
@reference "../../../../style.css";
.input-field {
  @apply p-1.5 sm:p-2.5 border border-border rounded-md bg-bg-secondary text-text-primary focus:border-accent focus:outline-none transition-colors text-xs sm:text-sm;
}

.input-field:disabled {
  @apply cursor-not-allowed;
}

.input-field.state-danger-border {
  border-color: var(--state-danger-border);
}

.textarea {
  @apply w-full;
}

.textarea::placeholder {
  @apply text-text-secondary;
}
</style>
