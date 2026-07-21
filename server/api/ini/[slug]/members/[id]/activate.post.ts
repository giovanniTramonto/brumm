import { sendActivationEmail } from '~/server/utils/email'
import { createMagicLink, SEVEN_DAYS } from '~/server/utils/magicLink'
import { getMemberData } from '~/server/utils/memberData'
import { assertValidTransition } from '~/server/utils/memberStatus'
import { prisma } from '~/server/utils/prisma'
import { s3CopyFile } from '~/server/utils/storage/s3/files'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')

  const canManageMembers =
    currentUser.role === 'SUPERUSER' ||
    (currentUser.role === 'MANAGER' && currentUser.isMemberManager)
  if (!canManageMembers) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const user = await prisma.user.findFirst({
    where: { id: memberId, clubId: club.id },
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  assertValidTransition(user.status, 'ACTIVE')

  const updated = await prisma.user.update({
    where: { id: memberId },
    data: { status: 'ACTIVE' },
  })

  const [md, readTemplates, existingReadDocs] = await Promise.all([
    getMemberData(memberId, club),
    prisma.documentTemplate.findMany({
      where: { clubId: club.id, documentType: 'read' },
      select: { id: true, s3Key: true, fileName: true },
    }),
    prisma.memberDocument.findMany({
      where: { memberId, template: { clubId: club.id } },
      select: { templateId: true },
    }),
  ])

  const alreadyHasDoc = new Set(existingReadDocs.map((d) => d.templateId))
  const toCreate = readTemplates.filter((t) => !alreadyHasDoc.has(t.id))

  await Promise.all(
    toCreate.map(async (template) => {
      let newS3Key: string | null = null
      if (template.s3Key) {
        try {
          const result = await s3CopyFile(club.id, template.s3Key, `members/${memberId}/contract`)
          newS3Key = result.key
        } catch {
          // non-fatal
        }
      }
      await prisma.memberDocument.create({
        data: {
          memberId,
          templateId: template.id,
          readAt: new Date(),
          s3Key: newS3Key,
          fileName: template.fileName,
        },
      })
    }),
  )

  if (md) {
    const emails = [md.email1, ...(md.email2 ? [md.email2] : [])]
    const slug = getRouterParam(event, 'slug')
    const magicLink = await createMagicLink({ userId: memberId, expiresInMs: SEVEN_DAYS })
    const loginUrl = `${process.env.APP_URL}/ini/${slug}/auth/verify/${magicLink.token}`
    await sendActivationEmail({
      to: emails,
      clubName: club.name,
      childName: `${md.firstName} ${md.lastName}`,
      loginUrl,
    })
  }

  return { member: updated }
})
