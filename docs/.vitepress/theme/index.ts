import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import MorphDemo from './MorphDemo.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('MorphDemo', MorphDemo);
  },
} satisfies Theme;
