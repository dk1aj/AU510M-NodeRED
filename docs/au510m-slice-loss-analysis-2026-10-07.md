# AU-510M: Slice-Verlust vor Rollback und beim neuen TUNE-Schwingen

Untersuchung am 7. Oktober 2026; Uhrzeiten Europe/Berlin (UTC+2).
Runtime bleibt v4.23. Ausschließlich lesende Untersuchung und neue Dokumentation;
keine Radioanfrage, neue Verbindung, Subscription, Parseränderung oder Deployment.

## Ergebnis

Das vorhandene Systemjournal enthält die im temporären RAM-Abnahmeexport fehlende
Sekunde vor dem Rollback. Das Radio meldete tatsächlich `slice 0 in_use=0 active=0`.
Diese Meldung liegt **vor** dem Rollback. Ein Zusammenhang des Slice-Verlusts mit
dem etwa 15 Minuten zuvor erfolgten v4.24-Deployment ist weiterhin nicht belegt.
Der Rollback kann diese vorher eingegangene Meldung nicht ausgelöst haben.

Der letzte vollständige Slice-Status nennt explizit seinen `client_handle`.
Ein vorheriger Client-Status ordnet denselben Handle einem Programmnamen zu.
Damit ist die Zuordnung des Slice-Besitzers direkt belegt; sie beweist weder
Kommandosender noch physischen Auslöser, Crash, Netzfehler oder Ursache des Schwingens.
Ein Status-Header allein wurde nicht zur Identifizierung eines Kommandosenders benutzt.

| Zeitpunkt | Direkte Beobachtung |
|---|---|
| 18:11:31.421860 | Slice 0/A: in_use=1, active=1, client_handle=0x07540F15 |
| Vorheriger Client-Status | Handle 0x07540F15: program=SmartSDR-Win |
| 18:11:51.498545 | Derselbe Client: disconnected, forced=0, wan_validation_failed=0, duplicate_client_id=0 |
| 18:11:51.499536 | Slice 0: in_use=0, tx=1, active=0 — 991 µs nach Abmeldung |
| 18:11:51.904 | Temporärer Wächter protokolliert Slice-Gate-Fehler |
| 18:11:52.205755 | Node-RED beginnt „Stopping modified flows“ für den Rollback — ca. 706 ms nach Slice-Entfernung |
| 18:11:52.265595 | „Started modified flows“ |
| 18:32:35.534340 | AetherSDR-Handle 0x3EB038C8 meldet disconnected |
| 18:32:35.537165 | Dessen zuvor explizit zugeordneter Slice 0 wird entfernt — 2825 µs später |
| 18:32:35.573 | Kanonisches Active-slice-Feld wird leer, Diagnose seq 4632 |
| 18:33:26.500 | AetherSDR meldet sich mit neuem Handle an, Diagnose seq 4738 |
| 18:33:26.661 | Slice 0 wieder vorhanden, Diagnose seq 4739 |

Mikrosekunden stammen aus Journal-Empfangszeitstempeln. Sie sind keine Messung der
Zeitpunkte physischer Benutzeraktionen oder der ursprünglichen Radiosendezeit.
Die Diagnose-Zeiten liegen separat im lokalen Diagnose-Record; die beiden Quellen
werden nicht als identische Zeitmessung ausgegeben. Keine rekonstruierten Original-
Diagnosesequenzen für die fehlende 18:11-Iteration werden erfunden.
`forced=0` beweist insbesondere keinen freiwilligen Benutzer-Disconnect.

## Parser und bestehende Slice-Verarbeitung

Der installierte `flexradio-js/Radio.js` protokolliert `_receiveMessage` vor
`flex.decode`. Das Journal liefert somit die eingegangene Protokollzeile, zusätzlich
zum späteren normalisierten Diagnoseereignis. Der installierte Decoder erkennt
beide `slice 0 in_use=0 tx=1 active=0`-Zeilen als topic=slice/0, payload.in_use=0.

Die unveränderte Function `au510m_live_state` löscht bei `payload.in_use=0` den
Slice und dessen S-Metercache. Die Anzeige verwendet genau einen aktiven Slice;
ohne ihn werden Frequenz, Mode und Active slice zu `--`. Der separat abgeleitete
RX-Status kann bestehen bleiben. Das erklärt die leeren Slice-Felder bei weiter
vorhandenen Meter-/Verbindungsdaten; es ist kein Beweis eines Radio-TCP-Abbruchs.

Zwei isolierte Offline-Proben mit dem tatsächlichen Function-Quelltext und den
aufgezeichneten, vom installierten Decoder gelesenen Slice-Meldungen: **PASS**.
Vorher A, danach kein Slice und Frequenz `--`; null erzeugte Commands. Die Probe
verwendet den aufgezeichneten letzten vollständigen Slice als Startzustand und
einen ausdrücklich synthetischen frischen Connection-Heartbeat. Sie isoliert die
Löschlogik; sie ist kein vollständiger Replay aller damaligen Runtime-Eingaben.
Keine Slice-Parser- oder Cachekorrektur ist durch diese Befunde begründet.

Die gesicherten lokalen `_sendRequest`-Logs enthalten 2138 Requests, davon 2005
Subscriptions, 130 `meter list` und drei Initialisierungsrequests unter `client`.
Kein lokales `slice remove`/`slice delete`, kein lokaler TUNE-/PTT-Request wurde
in diesem ausgewählten Journalabschnitt beobachtet. Fremde Client-Kommandos sind
damit nicht erfasst. Das ist keine Vollständigkeitsbehauptung über alle Sender.

## PA_FAULT und ATU OK

`reason=PA_FAULT` ist direkt im Interlock-Status vorhanden, allerdings schon am
Anfang des ausgewählten Journals um **17:30:01.643212**, lange vor dem v4.24-Deploy.
Auch unmittelbar vor dem Verlust stehen `state=READY` und `tx_allowed=1` zusammen
mit diesem Reason. Nach Slice-Entfernung folgen RECEIVE und tx_allowed=0 mit
unverändertem Reason. Der ausgewählte Abschnitt enthält 885 solche Reason-Meldungen.
Daraus wird kein neuer TX_FAULT, frischer PA-Fehler oder kausaler Fehlergrund abgeleitet.
Ob das Reason-Feld einen früheren Zustand fortschreibt, ist nicht geklärt.

**„ATU OK“** wird als Benutzerbeobachtung separat festgehalten. Exakter Beobachtungs-
zeitpunkt und technischer Ursprung sind unbekannt; im ausgewählten Journal wurden
keine `atu`-Statuszeilen gefunden. Es wird kein ATU-Zustand zur Incidentzeit erfunden
und weder eine ATU-Ursache noch deren Ausschluss behauptet.

## Belege, Grenzen und weiteres Vorgehen

- [Ausgewählte Original-Journalzeilen und lokale Requests](measurements/au510m-slice-loss-journal-2026-10-07.json)
- [Strukturierte Analyse und Offline-Proben](measurements/au510m-slice-loss-analysis-2026-10-07.json)
- [Gesicherter neuer Schwingungs-Vorfall](au510m-natural-oscillation-2026-10-07-1832.md)

Journal-Extrakt SHA-256:
`b8b3d7eb2faa9997e3d47db5c44f14ff3f5024bd370cd681f9b52bb2f24777d3`.
Die früheren unveränderlichen Aufzeichnungen wurden nicht verändert. Ihre damalige
Aussage einer fehlenden RAM-Iteration bleibt historisch richtig; deren Ereignisse
sind jetzt aus einer anderen vorhandenen Quelle teilweise belegt. Das ersetzt
keine verlorenen originalen RAM-Records oder eine vollständige Incidentaufnahme.

Aktuelle lesende Prüfung um 18:40:43: v4.23, RX, Slice 0/A, 7.064 MHz/LSB,
frischer Watcherstatus und kanonische Seitendaten; METER-RX-Nullstellung korrekt.
Visuelle Browserprüfung weiterhin nicht verfügbar.

Der Benutzer hat nach der Untersuchung ausdrücklich klargestellt:
„ich habe Aethersdr geschlossen um das schwingen zu stoppen“.
Die AetherSDR-Abmeldung am Ende des neuen Vorfalls ist somit laut Benutzer eine
bewusste Gegenmaßnahme gegen das bereits laufende Schwingen. Die anschließend
radioseitig gemeldete Slice-Entfernung darf nicht als Auslöser dieses Schwingens
interpretiert werden. Exakte physische Aktionszeit und technische Kommandokette
bleiben unbeobachtet; die Benutzerangabe wird separat von den direkten Radiologs
bewahrt. Die Abmeldung belegt keinen selbstständigen AetherSDR-Absturz.

Offen bleiben der frühere SmartSDR-Win-Disconnect um 18:11 und die ursprüngliche
Ursache des Schwingens. Ein kausaler Client für das Schwingen bleibt UNKNOWN.
Kein erneutes TUNE zur Fehlerprovokation erforderlich.

Das verpflichtende Slice-Gate wird nicht abgeschwächt. Vor einem erneuten v4.24-
Versuch müssen die zurückgerollte Integration und deren Gesamtvalidierung erneut
hergestellt werden; der derzeitige v4.24-Testentwurf erwartet bewusst mehr als der
aktive v4.23-Core liefert. Dieser Untersuchungsauftrag ändert keine Runtime.

Old version: v4.23. New version: v4.23, unverändert (nur Analyse).
Deployment: keines. Commit: keiner. Push: keiner. Vorhandene Entwürfe bleiben
uncommitted; Working tree nicht sauber. STOP FOR REVIEW.
