import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import HomePage from '../views/HomePage.vue'
import LoginPage from '../views/Login.vue'
import CartePage from '../views/Carte.vue'
import SignalementPage from '../views/Signalement.vue'
import SignalementsListPage from '../views/SignalementsList.vue'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/carte'
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginPage
  },
  {
    path: '/carte',
    name: 'Carte',
    component: CartePage
  },
  {
    path: '/signalement',
    name: 'Signalement',
    component: SignalementPage
  },
  {
    path: '/signalements',
    name: 'SignalementsList',
    component: SignalementsListPage
  },
  {
    path: '/home',
    name: 'Home',
    component: HomePage
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
