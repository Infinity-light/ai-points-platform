import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type Theme = 'light' | 'dark';

export const useThemeStore = defineStore('theme', () => {
  const saved = localStorage.getItem('theme') as Theme | null;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = ref<Theme>(saved ?? (prefersDark ? 'dark' : 'dark'));

  function apply(t: Theme) {
    document.documentElement.classList.toggle('dark', t === 'dark');
  }

  // Apply on init
  apply(theme.value);

  watch(theme, (t) => {
    apply(t);
    localStorage.setItem('theme', t);
  });

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  }

  return { theme, toggle };
});
