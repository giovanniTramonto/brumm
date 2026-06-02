export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss'],

  typescript: {
    strict: true,
    typeCheck: false,
  },

  routeRules: {
    '/register': { prerender: true },
    '/**': { ssr: false },
  },

  runtimeConfig: {
    public: {},
  },

  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css',
    configPath: 'tailwind.config.ts',
  },

  nitro: {
    preset: 'netlify',
  },

  app: {
    head: {
      title: 'Brumm – Verwaltungssoftware für Elterninitiativ-Kitas',
      htmlAttrs: { lang: 'de' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Brumm ist die Verwaltungssoftware für Elterninitiativ-Kindertagesstätten in Berlin. Mitglieder verwalten, Vertragsunterlagen einreichen, Kostenerstattungen berechnen.',
        },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Brumm' },
        { property: 'og:url', content: 'https://brumm.berlin' },
        { property: 'og:title', content: 'Brumm – Verwaltungssoftware für Elterninitiativ-Kitas' },
        {
          property: 'og:description',
          content:
            'Brumm ist die Verwaltungssoftware für Elterninitiativ-Kindertagesstätten in Berlin. Mitglieder verwalten, Vertragsunterlagen einreichen, Kostenerstattungen berechnen.',
        },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: 'Brumm – Verwaltungssoftware für Elterninitiativ-Kitas' },
        {
          name: 'twitter:description',
          content:
            'Brumm ist die Verwaltungssoftware für Elterninitiativ-Kindertagesstätten in Berlin.',
        },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },
})
