<script setup lang="ts">
import { computed } from 'vue';

interface ButtonAction {
  label: string;
  type?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

interface Props {
  // Button alignment
  align?: 'left' | 'center' | 'right' | 'space-between';
  // Buttons configuration
  primaryButton?: ButtonAction;
  secondaryButton?: ButtonAction;
  dangerButton?: ButtonAction;
  // Additional classes
  class?: string;
  // Show as text (no background)
  textOnly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  align: 'right',
  primaryButton: undefined,
  secondaryButton: undefined,
  dangerButton: undefined,
  class: '',
  textOnly: false,
});

const emit = defineEmits<{
  primaryClick: [];
  secondaryClick: [];
  dangerClick: [];
}>();

// Computed alignment classes
const alignClasses = computed(() => {
  const alignMap = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    'space-between': 'justify-between',
  };
  return alignMap[props.align];
});

// Button type classes
function getButtonClasses(type: 'primary' | 'secondary' | 'danger' | 'ghost' = 'primary') {
  const typeClasses = {
    primary: 'ui-button--primary',
    secondary: 'ui-button--secondary',
    danger: 'ui-button--danger',
    ghost: 'ui-button--ghost',
  };

  return ['ui-button', typeClasses[type]];
}

// Handle button clicks
function handlePrimaryClick() {
  if (!props.primaryButton?.disabled && !props.primaryButton?.loading) {
    if (props.primaryButton?.onClick) {
      props.primaryButton.onClick();
    }
    emit('primaryClick');
  }
}

function handleSecondaryClick() {
  if (!props.secondaryButton?.disabled && !props.secondaryButton?.loading) {
    if (props.secondaryButton?.onClick) {
      props.secondaryButton.onClick();
    }
    emit('secondaryClick');
  }
}

function handleDangerClick() {
  if (!props.dangerButton?.disabled && !props.dangerButton?.loading) {
    if (props.dangerButton?.onClick) {
      props.dangerButton.onClick();
    }
    emit('dangerClick');
  }
}
</script>

<template>
  <div :class="['flex flex-col-reverse sm:flex-row gap-2 sm:gap-3', alignClasses, props.class]">
    <!-- Left side buttons (for space-between alignment) -->
    <slot name="left"></slot>

    <!-- Secondary button (shown first on mobile, left on desktop) -->
    <button
      v-if="secondaryButton"
      type="button"
      :class="getButtonClasses('secondary')"
      :disabled="secondaryButton.disabled || secondaryButton.loading"
      @click="handleSecondaryClick"
    >
      {{ secondaryButton.loading ? '...' : secondaryButton.label }}
    </button>

    <!-- Danger button -->
    <button
      v-if="dangerButton"
      type="button"
      :class="getButtonClasses('danger')"
      :disabled="dangerButton.disabled || dangerButton.loading"
      @click="handleDangerClick"
    >
      {{ dangerButton.loading ? '...' : dangerButton.label }}
    </button>

    <!-- Primary button (shown last on mobile, right on desktop) -->
    <button
      v-if="primaryButton"
      type="button"
      :class="getButtonClasses(primaryButton.type || 'primary')"
      :disabled="primaryButton.disabled || primaryButton.loading"
      @click="handlePrimaryClick"
    >
      {{ primaryButton.loading ? '...' : primaryButton.label }}
    </button>

    <!-- Right side buttons (custom content) -->
    <slot name="right"></slot>
  </div>
</template>

<style scoped>
button {
  box-sizing: border-box;
}
</style>
