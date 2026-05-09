export default defineEventHandler(async (event) => {
  const currentUser = event.context.user

  if (currentUser.role !== "SUPERUSER") {
    throw createError({ statusCode: 403, statusMessage: "Keine Berechtigung" })
  }

  const headers = [
    "firstName",
    "lastName",
    "birthDate",
    "guardian1Name",
    "guardian2Name",
    "email1",
    "email2",
    "groupId",
  ]

  const exampleRow = [
    "Max",
    "Mustermann",
    "2020-03-15",
    "Erika Mustermann",
    "Hans Mustermann",
    "erika@beispiel.de",
    "hans@beispiel.de",
    "",
  ]

  const csv = [headers.join(","), exampleRow.join(",")].join("\n")

  setHeader(event, "Content-Type", "text/csv; charset=utf-8")
  setHeader(event, "Content-Disposition", 'attachment; filename="import-vorlage.csv"')

  return csv
})
