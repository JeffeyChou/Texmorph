import { defineConfig } from 'vitepress';

export default defineConfig({
  // GitHub Pages serves the project site under /Texmorph/; the workflow sets DOCS_BASE.
  base: process.env.DOCS_BASE ?? '/',
  title: 'texmorph',
  description: 'Seekable formula morphing for the web',
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['adr/**', 'review/**', 'reports/**', 'PLAN.md', 'PROGRESS.md', 'HANDOFF.md', 'STABILITY.md', 'security.md'],
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Renderers', link: '/renderers/katex' },
      { text: 'Integrations', link: '/integrations/gsap' },
      { text: 'API', link: '/api/' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is texmorph?', link: '/guide/introduction' },
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'How it works', link: '/guide/how-it-works' },
          ],
        },
        {
          text: 'Essentials',
          items: [
            { text: 'Matching and morphMap', link: '/guide/matching' },
            { text: 'Easing and motion', link: '/guide/easing' },
            { text: 'Chaining steps', link: '/guide/chaining-steps' },
            { text: 'Errors and diagnostics', link: '/guide/errors' },
          ],
        },
        {
          text: 'Going further',
          items: [
            { text: 'Choosing a renderer', link: '/guide/choosing-a-renderer' },
            { text: 'Production checklist', link: '/guide/production' },
            { text: 'Versioning and stability', link: '/guide/stability' },
          ],
        },
      ],
      '/renderers/': [
        {
          text: 'Renderers',
          items: [
            { text: 'KaTeX', link: '/renderers/katex' },
            { text: 'MathJax', link: '/renderers/mathjax' },
            { text: 'Writing a renderer', link: '/renderers/custom' },
          ],
        },
      ],
      '/integrations/': [
        {
          text: 'Integrations',
          items: [
            { text: 'GSAP', link: '/integrations/gsap' },
            { text: 'Web Component', link: '/integrations/web-component' },
            { text: 'Remotion', link: '/integrations/remotion' },
            { text: 'Script tag', link: '/integrations/script-tag' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: '@texmorph/katex', link: '/api/katex' },
            { text: '@texmorph/mathjax', link: '/api/mathjax' },
            { text: '@texmorph/dom', link: '/api/dom' },
            { text: '@texmorph/core', link: '/api/core' },
            { text: '@texmorph/gsap', link: '/api/gsap' },
            { text: '@texmorph/element', link: '/api/element' },
            { text: '@texmorph/remotion', link: '/api/remotion' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/JeffeyChou/Texmorph' }],
    search: { provider: 'local' },
    editLink: { pattern: 'https://github.com/JeffeyChou/Texmorph/edit/main/docs/:path' },
    footer: { message: 'Released under the MIT License.' },
  },
});
