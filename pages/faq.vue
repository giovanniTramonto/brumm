<script setup lang="ts">
definePageMeta({ layout: 'public' })
useHead({ title: 'FAQ – Brumm' })
</script>

<template>
  <main id="main-content" class="mx-auto max-w-5xl px-6 py-12 tablet:py-24">
    <h1 class="text-3xl font-bold text-gray-900">FAQ</h1>

    <section class="mt-12" aria-labelledby="datenspeicher">
      <h2 id="datenspeicher" class="text-xl font-semibold text-gray-900">Datenspeicher einrichten</h2>
      <p class="mt-3 text-sm text-gray-500">
        Brumm speichert alle Mitgliederdaten ausschließlich in der eigenen Datenbank und im eigenen Datei-Speicher des Vereins. Für die Einrichtung benötigt ihr:
      </p>
      <ol class="mt-4 space-y-3 text-gray-500 list-decimal pl-5">
        <li>
          Eine <strong class="text-gray-700">PostgreSQL-Datenbank</strong> für Mitgliederdaten. Den Connection String unter <strong class="text-gray-700">Einstellungen → Datenbank</strong> eintragen.
        </li>
        <li>
          Einen <strong class="text-gray-700">S3-kompatiblen Speicher</strong> für Dateien (Vertragsvorlagen, Vertragsunterlagen, Infos-Dokumente) – z.&nbsp;B. AWS S3, Cloudflare R2 oder Hetzner Object Storage. Bucket, Region und Zugangsdaten unter <strong class="text-gray-700">Einstellungen → Datenspeicher</strong> eintragen.
        </li>
      </ol>
    </section>

    <section class="mt-12" aria-labelledby="isbj">
      <h2 id="isbj" class="text-xl font-semibold text-gray-900">ISBJ-Trägerportal anbinden</h2>
      <p class="mt-3 text-sm text-gray-500">
        Brumm kann eure Kitaverträge direkt aus dem ISBJ-Trägerportal lesen und auf dem Dashboard anzeigen. Aktuell liest Brumm nur – es ändert nichts in ISBJ und speichert die Vertragsdaten nicht. Später sollen sich Verträge auch direkt aus Brumm heraus ändern lassen; dafür braucht der Benutzer dann das Recht zum Bearbeiten von Kitaverträgen.
      </p>
      <p class="mt-6 text-xs font-medium uppercase tracking-wide text-gray-500">Was ihr braucht</p>
      <ol class="mt-2 space-y-3 text-gray-500 list-decimal pl-5">
        <li>
          Zugang zur <strong class="text-gray-700">Dienstschnittstelle</strong>: per E-Mail an <span class="text-gray-700">traeger-service@senbjf.berlin.de</span> mit dem Betreff „Dienstschnittstelle" beantragen.
        </li>
        <li>
          Das <strong class="text-gray-700">Zertifikat</strong> (Datei mit der Endung .p12) – es kommt per E-Mail. Das zugehörige <strong class="text-gray-700">Passwort (PIN)</strong> kommt separat per Brief an die Adresse des Administrators. Rechnet also mit etwas Wartezeit.
        </li>
        <li>
          Einen <strong class="text-gray-700">eigenen Benutzer</strong> für Brumm, den der Administrator im ISBJ-Selfservice-Portal anlegt. Unter <strong class="text-gray-700">Rechte &amp; Rollen → Trägerportal</strong> braucht er die Rolle <strong class="text-gray-700">Dienstschnittstelle</strong> und das <strong class="text-gray-700">Recht, Kitaverträge eurer Einrichtung zu bearbeiten</strong>.
        </li>
        <li>
          Einen <strong class="text-gray-700">API-Key</strong> für genau diesen Benutzer – im Selfservice-Portal beim Benutzer unter <strong class="text-gray-700">Aktionen → APIKey erstellen</strong>.
        </li>
      </ol>
      <p class="mt-6 text-xs font-medium uppercase tracking-wide text-gray-500">In Brumm eintragen</p>
      <p class="mt-2 text-sm text-gray-500">
        Unter <strong class="text-gray-700">Einstellungen → ISBJ Trägerportal</strong> Benutzername, Träger- und Einrichtungsnummer, API-Key, Zertifikat und Passwort eintragen. Das Feld <strong class="text-gray-700">Host</strong> leer lassen. Zertifikat, Passwort und API-Key werden verschlüsselt gespeichert. Mit <strong class="text-gray-700">Verbindung testen</strong> prüft ihr, ob alles passt.
      </p>
      <p class="mt-6 text-xs font-medium uppercase tracking-wide text-gray-500">Wenn es nicht klappt</p>
      <ul class="mt-2 space-y-3 text-gray-500 list-disc pl-5">
        <li><strong class="text-gray-700">„Zertifikat-Passwort ist falsch"</strong> – die PIN aus dem Brief prüfen und neu eintragen.</li>
        <li><strong class="text-gray-700">„Client-Zertifikat nicht akzeptiert"</strong> – das Zertifikat passt nicht zum Zugang oder ist nicht freigeschaltet. Beim ISBJ-Trägerservice nachfragen.</li>
        <li><strong class="text-gray-700">„Anmeldung abgelehnt (401/403)"</strong> – Benutzername und API-Key prüfen. Der API-Key muss zu genau diesem Benutzer gehören, und der Benutzer braucht die Rolle Dienstschnittstelle.</li>
        <li><strong class="text-gray-700">Verbindung klappt, aber es werden keine Verträge angezeigt</strong> – ISBJ liefert nur Verträge, für die der Benutzer das Recht zum Bearbeiten von Kitaverträgen eurer Einrichtung hat. Dieses Recht im Selfservice-Portal ergänzen.</li>
      </ul>
    </section>
  </main>
</template>
