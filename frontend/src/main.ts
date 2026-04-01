import { createApp } from 'vue';
import { createPinia } from 'pinia';
import VxeTable from 'vxe-table';
import 'vxe-table/lib/style.css';
import router from '@/router';
import App from '@/App.vue';
import '@/style.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(VxeTable);

// Initialize theme before mount to prevent flash
import { useThemeStore } from '@/stores/theme';
useThemeStore();

app.mount('#app');
