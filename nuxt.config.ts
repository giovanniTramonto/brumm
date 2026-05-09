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
    databaseUrl: '',
    googleServiceAccountEmail: '',
    googleServiceAccountKey: '',
    resendApiKey: '',
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
      title: 'Jita – Vereinsverwaltung',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Kindergarten-Vereinsverwaltung' },
      ],
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
    },
  },
})
