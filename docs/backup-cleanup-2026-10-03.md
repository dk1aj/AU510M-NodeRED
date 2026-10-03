# Backup-Bereinigung — 2026-10-03

Runtime vor/nach Bereinigung: **v4.19 / v4.19**. Ausgangscommit: `a05a410`.

Reine Dateisystem-/Dokumentationspflege, kein Deployment oder Neustart.

## Inventar vor Löschung

Der gesamte Projektbaum wurde nach .bak/.bak.*, .bak_*, .backup/.backup.*,
.old, .orig, ~ und .save sowie Backup-/Archivverzeichnissen durchsucht.
.git wurde ausgelassen; node_modules wurde nur inventarisiert und nicht verändert.
Gefunden: 49 Dateien — 11 Namensmuster, 30 Dateien in backups/agct-watcher
und acht Dateien im versionierten archive/. Die Archivdateien sind erhaltene
Quellen und Dokumente, keine entbehrlichen Sicherungskopien.

| Kategorie | Anzahl | Entscheidung |
| --- | ---: | --- |
| A: klar entbehrliche Editor-/manuelle Kopien | 0 | Keine ohne weitere Belege gefunden |
| B: historische Projektstände/Archiv | 41 | Nur fünf nachgewiesene identische ältere Snapshots entfernt |
| C: aktuelle/relevante Recovery-Sicherung | 2 | Vollständig erhalten |
| D: geschützt oder Zweck unklar | 6 | Vollständig erhalten, geschützte Inhalte nicht geöffnet |

## Referenz- und Duplikatprüfung

Exakte Kandidatenpfade und Dateinamen wurden vor Löschung in versionierten
Projektdateien einschließlich deploy/restore-Helfern, Dokumentation, settings.js,
package-Scripts und systemd-Konfiguration unter /etc/systemd und
/lib/systemd/system gesucht. Es gab keine direkten Referenzen. Der generische
Backup-Pfad in deploy-agct-watcher.mjs bleibt erhalten.
Die geschützten Credential-/Konfigurationsdateien wurden nur per Metadaten
inventarisiert, nicht gelesen oder gehasht.

Die fünf entfernten Dateien waren byte-identisch mit jeweils einer neueren
Datei derselben Gruppe. SHA-256-Vergleich und erneuter Bytevergleich unmittelbar
vor unlink bestätigten die Identität. Eigenständige historische Stände bleiben.

| Entfernte ältere Kopie | Erhaltene identische neueste Kopie |
| --- | --- |
| `backups/agct-watcher/1790093289942.json` | `backups/agct-watcher/1790093731336.json` |
| `backups/agct-watcher/1790092761016.json` | `backups/agct-watcher/1790093042865.json` |
| `backups/agct-watcher/1790077344617.json` | `backups/agct-watcher/1790077786823.json` |
| `backups/agct-watcher/1790103400226.json` | `backups/agct-watcher/1790103514716.json` |
| `backups/agct-watcher/1790103489558.json` | `backups/agct-watcher/1790103514716.json` |

## Vollständige Dateiliste

| Kategorie | Pfad | Bytes | Git | Ergebnis |
| --- | --- | ---: | --- | --- |
| B | `archive/CODEX_HANDOVER-2026-09-22.md` | 1811 | getrackt | erhalten |
| B | `archive/README.md` | 493 | getrackt | erhalten |
| B | `archive/station-dashboard/README.md` | 10136 | getrackt | erhalten |
| B | `archive/station-dashboard/build.js` | 5765 | getrackt | erhalten |
| B | `archive/station-dashboard/dashboard.vue` | 5345 | getrackt | erhalten |
| B | `archive/station-dashboard/dk1aj-station.flow.json` | 19217 | getrackt | erhalten |
| B | `archive/station-dashboard/state.js` | 5315 | getrackt | erhalten |
| B | `archive/station-dashboard/test.js` | 5914 | getrackt | erhalten |
| B | `backups/agct-watcher/1790069426699.json` | 16906 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790069943578.json` | 27236 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790071313734.json` | 28372 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790071953479.json` | 44518 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790072628251.json` | 52350 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790077344617.json` | 50061 | lokal/ignoriert | entfernt: identisches Duplikat |
| B | `backups/agct-watcher/1790077786823.json` | 50061 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790082179427.json` | 44519 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790082637931.json` | 51873 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790092280018.json` | 52055 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790092721334.json` | 52055 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790092761016.json` | 54229 | lokal/ignoriert | entfernt: identisches Duplikat |
| B | `backups/agct-watcher/1790093042865.json` | 54229 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790093289942.json` | 54962 | lokal/ignoriert | entfernt: identisches Duplikat |
| B | `backups/agct-watcher/1790093459059.json` | 54962 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790093731336.json` | 54962 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790093915888.json` | 54955 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790094048524.json` | 55200 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790095197625.json` | 55034 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790095530234.json` | 55033 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790101805951.json` | 55075 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790103255547.json` | 55075 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790103400226.json` | 55920 | lokal/ignoriert | entfernt: identisches Duplikat |
| B | `backups/agct-watcher/1790103489558.json` | 55920 | lokal/ignoriert | entfernt: identisches Duplikat |
| B | `backups/agct-watcher/1790103514716.json` | 55920 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790104261735.json` | 55920 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790104359229.json` | 56790 | lokal/ignoriert | erhalten |
| B | `backups/agct-watcher/1790104384931.json` | 56790 | lokal/ignoriert | erhalten |
| B | `flows.json.bak_2026-06-21_2117` | 398839 | lokal/ignoriert | erhalten |
| B | `flows.json.bak_2026-06-21_2221` | 541545 | lokal/ignoriert | erhalten |
| B | `flows.json.bak_2026-06-22_0851` | 538510 | lokal/ignoriert | erhalten |
| B | `flows.json.bak_2026-06-22_2127` | 538500 | lokal/ignoriert | erhalten |
| B | `flows.json.bak_2026-06-22_2144` | 541098 | lokal/ignoriert | erhalten |
| C | `.flows.json.backup` | 240627 | lokal/ignoriert | erhalten |
| C | `backups/agct-watcher/1790113643054.json` | 55045 | lokal/ignoriert | erhalten |
| D | `.config.nodes.json.backup` | 47000 | lokal/ignoriert | erhalten |
| D | `.config.runtime.json.backup` | 133 | lokal/ignoriert | erhalten |
| D | `.config.users.json.backup` | 2674 | lokal/ignoriert | erhalten |
| D | `.flows_cred.json.backup` | 51 | lokal/ignoriert | erhalten |
| D | `backups/agct-watcher/before-3.2-example.json` | 58490 | lokal/ignoriert | erhalten |
| D | `node_modules/node-red-dashboard/gulpfile.old` | 5757 | lokal/ignoriert | erhalten |

## Ergebnis und Recovery

Entfernt: 5 Dateien, 271,092 Inhaltsbytes, 282,624 belegte Bytes (276 KiB).
Erhalten: 44 inventarisierte Dateien, 4,162,155 Inhaltsbytes (etwa 3,97 MiB).

Die aktuelle `.flows.json.backup` ist erhalten. Ihr geparster Inhalt stimmt
vollständig mit dem aktuellen flows.json überein, einschließlich v4.19.
Der neueste nummerierte Watcher-Snapshot und die jüngere manuelle Kopie
before-3.2-example.json sind ebenfalls erhalten. Alle übrigen einzigartigen
Backups, Credentials, generierten Konfigurationen, Archivquellen, Runtime-
Dateien, Abhängigkeiten, Release-Artefakte und Referenzbilder bleiben bestehen.

Hashvergleiche bestätigten unveränderte aktive Flows, settings.js,
package.json/package-lock.json, zentrale Version, Deployment-Scripts und
docs/reference. Sämtliche erhaltenen ungeschützten Inventardateien wurden
erneut gehasht; geschützte Dateien nur anhand Größe und Änderungszeit geprüft.

Freier Speicher vor Inventar: 72,791,121,920 Bytes.
Freier Speicher unmittelbar nach Löschung: 72,789,704,704 Bytes.
Diese Zahlen betreffen das gesamte laufende Dateisystem; seine Veränderung
ist nicht mit den 276 KiB entfernten Dateiblöcken gleichzusetzen.

Die bestehenden statischen Projektprüfungen bestanden nach der Bereinigung,
einschließlich Syntax, Referenzen, Exports, Vue, Watcher, Meter und Archivtests.
Ein lesender API-Vergleich bestätigte unveränderte deployte Flows und Runtime
v4.19. Runtime-Version und Deployment bleiben unverändert.

## Minimale Aufbewahrung

Git ist die primäre Historie versionierter Quellen. Aktuelles Recovery-Backup,
dokumentierte/referenzierte Sicherungen, einzigartige historische Snapshots,
geschütztes Material und unklare neuere Dateien bleiben erhalten. Von identischen
unreferenzierten Snapshot-Gruppen genügt die jeweils neueste nützliche Kopie.
Löschungen erfordern vorher Inventar, Referenzprüfung und erneuten Vergleich.
AGENTS.md und .gitignore wurden nicht verändert.
