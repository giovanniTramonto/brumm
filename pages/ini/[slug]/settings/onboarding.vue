<script setup lang="ts">
const route = useRoute()
const slug = route.params.slug as string
await navigateTo(`/ini/${slug}/settings`, { replace: true })
</script>
