import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/auth/LoginPage.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/pages/auth/RegisterPage.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/auth/feishu/bindConfirm',
    name: 'FeishuBindConfirm',
    component: () => import('@/pages/auth/FeishuBindConfirmPage.vue'),
  },
  {
    path: '/auth/feishu/landing',
    name: 'FeishuLanding',
    component: () => import('@/pages/auth/FeishuLandingPage.vue'),
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/pages/dashboard/DashboardPage.vue'),
      },
      {
        path: 'projects',
        name: 'Projects',
        component: () => import('@/pages/project/ProjectListPage.vue'),
      },
      {
        path: 'projects/create',
        name: 'CreateProject',
        component: () => import('@/pages/project/CreateProjectPage.vue'),
      },
      {
        path: 'projects/:id',
        name: 'ProjectDetail',
        component: () => import('@/pages/project/ProjectDetailPage.vue'),
      },
      {
        path: 'projects/:id/brain',
        name: 'ProjectBrain',
        component: () => import('@/pages/project/ProjectBrainPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'vote',
        name: 'Vote',
        component: () => import('@/pages/vote/VoteListPage.vue'),
      },
      {
        path: 'vote/:id',
        name: 'VoteDetail',
        component: () => import('@/pages/vote/VoteDetailPage.vue'),
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/pages/profile/ProfilePage.vue'),
      },
      {
        path: 'admin',
        name: 'Admin',
        component: () => import('@/pages/admin/AdminPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'feishu-config',
        name: 'FeishuConfig',
        component: () => import('@/pages/feishu/FeishuConfigPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'ai-config',
        name: 'AiConfig',
        component: () => import('@/pages/ai-config/AiConfigPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'bulletin',
        name: 'Bulletin',
        component: () => import('@/pages/bulletin/BulletinPage.vue'),
      },
      {
        path: 'meeting/:id',
        name: 'Meeting',
        component: () => import('@/pages/meeting/MeetingPage.vue'),
      },
      {
        path: 'auctions',
        name: 'Auctions',
        component: () => import('@/pages/auctions/AuctionsPage.vue'),
      },
      {
        path: 'notifications',
        name: 'Notifications',
        component: () => import('@/pages/NotificationPage.vue'),
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, _from, next) => {
  const token = localStorage.getItem('access_token');
  if (to.meta.requiresAuth && !token) {
    next({ name: 'Login' });
  } else if (to.meta.guestOnly && token) {
    next({ name: 'Dashboard' });
  } else {
    // Ensure user data and permissions are loaded when authenticated
    if (token) {
      const { useAuthStore } = await import('@/stores/auth');
      const authStore = useAuthStore();
      if (!authStore.userLoaded) {
        await authStore.fetchUser();
      }
      const { usePermissionStore } = await import('@/stores/permission');
      const permissionStore = usePermissionStore();
      if (!permissionStore.loaded) {
        await permissionStore.fetchPermissions();
      }
    }
    next();
  }
});

export default router;
