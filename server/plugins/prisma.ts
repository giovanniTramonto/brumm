import { prisma } from "~/server/utils/prisma"

export default defineNitroPlugin(async () => {
  await prisma.$connect()
})
