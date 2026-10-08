# AU-510M: erneutes natürliches TUNE-Schwingen am 7. Oktober 2026

Status: **gesichert, offline ausgewertet; v4.24-Abnahme gestoppt**.
Alle folgenden Uhrzeiten sind Europe/Berlin (UTC+2).

## Runtime und Rollback

v4.24 wurde um 17:56 deployt. Der temporäre lesende Abnahmewächter erkannte um
18:11:51.904 einen fehlenden kanonischen aktiven Slice und führte den vorgesehenen
Rollback auf die gesicherten v4.23-Runtime-Dateien durch. Standarddeploy erfolgreich:
87 Nodes, Revision `4dbcd98127bec88e51bee713b6270417205d1b9da1dbaa8a80f054858506dc75`.
Das beweist den Slice-Verlust, jedoch keine Verursachung durch das Deployment.

Die letzte gesicherte v4.24-Abnahmeprobe stammt von 18:11:50.839: RX, TUNE=0 frisch,
Slice A, null Incidents und null Diagnosefehler. Der Wächter prüfte das Slice-Gate
vor dem Speichern der fehlschlagenden Iteration. Diese letzte Iteration wurde daher
vor dem Rollback nicht gesichert; der genaue Übergang ist eine Beweislücke.
Der Rollback setzte den RAM-Kontext zurück. Es wird keine lückenlose v4.24-Erfassung
über diesen Zeitpunkt behauptet.

Der nachfolgende neue Vorfall lief bereits unter v4.23, Run
`d48c6968-cba4-48a2-9312-91fc905b0e78`. Der v4.24-Live-Detektor war nicht aktiv.
Es gibt deshalb keinen nachgewiesenen Live-Trigger von v4.24 für diesen Vorfall.

## Neue Beobachtung

| Beobachtung | Beleg |
|---|---|
| Erster vollständiger Zyklus beginnt | 18:32:24.815, DIAG seq 3520 |
| Erste RX-Rückkehr | 18:32:25.582, seq 3541; TUNE=0 frisch |
| TUNE erneut aktiviert nach RX | 18:32:25.839, TUNE_CANDIDATE 0→1, seq 3542 |
| Dritter vollständiger Zyklus endet | 18:32:26.431, seq 3580 |
| Gesamt | 58 vollständige TX→RX-Zyklen in 10.757 s |
| RX-Rückkehr mit frischem TUNE=1 | 41 |
| Letzter vollständiger Zyklus endet | 18:32:35.572, seq 4629 |
| Slice entfernt | 18:32:35.537, seq 4569 |
| Slice wieder hinzugefügt | 18:33:26.661, seq 4739 |

Gezählt werden vollständige Ausflüge mit tatsächlichem TRANSMITTING,
UNKEY_REQUESTED/RETURN_TO_RX und abschließendem RADIO_RX; einzelne Übergänge zählen
nicht als Zyklen. Die Angaben zu TUNE sind beobachtete diagnostische Signale,
keine aus RF-Leistung abgeleitete Annahme und kein Beweis einer Ursache.

Im gesicherten Fenster liegt kein INTERLOCK_STATE TX_FAULT/TIMEOUT/STUCK_INPUT vor.
Auch im zehnsekündigen Vorläuferfenster des Replay-Triggers gibt es somit keinen
qualifizierenden Fault. Precursor und Grund bleiben UNKNOWN. Anders als beim
früheren Vorfall ist hier kein vorausgehender TX_FAULT belegt.
Trigger-Origin, Command-Origin und kausaler Client bleiben UNKNOWN; Clientanwesenheit
oder zeitliche Nähe werden nicht als Verursachung ausgegeben.

## Offline-Replay

Der unveränderte v4.24-Detektormodul-Entwurf wurde mit den gesicherten Records in
aufsteigender seq-Reihenfolge gespeist. Replay-Zeitbasis: aufgezeichnete Wall-Zeit
relativ zum ersten Record; ursprüngliche monotone Slot-Zeiten wurden nicht exportiert.
Die History-Funktion liefert nur bereits eingespeiste Records rückwärts innerhalb
des angeforderten Lookbacks. Kein Radiozugriff oder erneutes Deployment.

Ergebnis: **genau ein TUNE_RX_OSCILLATION-Incident**, Trigger nach drei vollständigen
Zyklen bei seq 3580, 1616 ms nach erstem Zyklusbeginn. Beide TUNE-Muster sind belegt:
Reaktivierung nach RX und frisches aktives TUNE bei weiteren RX-Rückkehrereignissen.
Erstes abnormales Ereignis: **TUNE_REACTIVATED_AFTER_RX**, seq 3542.
Der deduplizierte Incident erreicht 58 Zyklen. Keine Input-Order-Fehler oder
Candidate-Overflows; 18 unvollständige Zustandsausflüge werden verworfen.

Das Replay erreicht nach 120 Sekunden den POST-Zustand COMPLETE. Dies ist eine
Offline-Lifecycle-Prüfung, keine Live-v4.24-Aufzeichnung. PRE-Vollständigkeit bleibt
unbewertet: Der originale Runtime-Boundary-Provider wurde nicht rekonstruiert.
Die konservative Replay-Ausgabe `pre_trigger_complete=false` ist daher kein
Nachweis fehlender PRE-Records.

## Gesicherte Dateien und Grenzen

Zwei manuelle, lesende Context-Abfragen wurden zusammengeführt. Überlappende Records
wurden auf Identität geprüft. 1824 Records, seq 3144–4967, ohne Sequenzlücken;
Zeitraum 18:30:09.214–18:34:58.322. Das beweist kontinuierliche lokale Sequenzen,
keine vollständige Beobachtbarkeit externer Kommandos. Die Runtime meldet
`pending_expired=27`; fehlende Request-Verknüpfungen bleiben fehlend.
Keine Count-/Memory-Drops, Source-Overflows oder Diagnosefehler in den aktuellen
Metriken; reguläre Altersverdrängung wird separat erfasst.

- [Gesicherte Records](measurements/au510m-natural-oscillation-2026-10-07-1832-records.json)
- [Offline-Auswertung](measurements/au510m-natural-oscillation-2026-10-07-1832-analysis.json)
- [v4.24-Abnahme und Rollback](measurements/au510m-stage3-v4.24-validation.json)

SHA-256 der neuen Record-Datei:
`9431e440110582e89ced2064114af0d4f3749f5cabf6f8b8c4f9382fb4ba8d92`.
Die frühere unveränderliche Evidenz bleibt unverändert mit SHA-256
`6f35714df7e0ae2f4a1895664a6bf4a38dea5bcf6720fe36470a8951b23a3dde`.
Die Dateien wurden manuell zur Untersuchung gesichert; ein automatischer
Incident-Datei-Writer, SQLite und eine DIAG-UI sind weiterhin nicht implementiert.

## Aktueller Zustand und Abschlussgrenze

Lesende Prüfung um 18:35:52: Runtime v4.23, RX, Slice 0/A, 7.032 MHz, CW,
frische kanonische RADIO/PA/AGC-T-Daten, unveränderte METER-Projektion mit
RX-Nullstellung. Browserdarstellung ungetestet. TUNE=0 frisch in der aktuellen
Diagnoseprobe. Kein erneutes Senden/TUNE und keine absichtliche Fehlerprovokation.

Old version: v4.23. Zielversion: v4.24, zurückgerollt; aktuell v4.23.
Deployment: v4.24 technisch erfolgreich, Live-Abnahme wegen Slice-Gate fehlgeschlagen;
Rollback erfolgreich. Commit/Push: nicht durchgeführt. Working tree: nicht sauber.
**STOP FOR REVIEW**; keine weitere Runtime-Änderung.

## Prüfung nach dem Rollback

Repository-Validierung: JSON, Function/Vue-Kompatibilität, Exports, Watcher,
Dashboard, METER sowie Stage 1/2 PASS. Der verbliebene v4.24-Testentwurf scheitert
anschließend am erwarteten Incident-Feld des bereits zurückgerollten v4.23-Core
(`undefined !== 0`). Die Gesamtvalidierung ist deshalb aktuell **nicht PASS**.
Die vorherigen 30 PASS gelten für die v4.24-Integration vor dem Rollback.
Der isolierte Offline-Replay des ursprünglichen Vorfalls bleibt PASS; die neue
Aufzeichnung ergibt separat genau einen Incident. Keine Runtime-Anpassung zur
Umgehung dieser gestoppten Abnahme.

## Nachträgliche Benutzerklärung

Der Benutzer bestätigt: „ich habe Aethersdr geschlossen um das schwingen zu stoppen“.
Das Schließen war eine bewusste Maßnahme gegen das schon laufende Schwingen.
Die Client-Abmeldung um 18:32:35 und anschließende Slice-Entfernung sind daher
kein Beleg für dessen Auslöser oder einen selbstständigen Client-Absturz.
Die Ursache des Schwingens bleibt UNKNOWN. Originalaufzeichnungen unverändert.
