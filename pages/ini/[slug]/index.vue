<script setup lang="ts">
const route = useRoute()
await navigateTo(`/ini/${route.params.slug}/dashboard`, { replace: true })
</script>
