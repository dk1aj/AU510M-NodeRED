# AU-510M Stage 1 — kontrollierte Zwei-Pfade-Messung, 7. Oktober 2026

**Messauftrag abgeschlossen; keine permanente Runtimeänderung.** Echte, vom
Benutzer zugesagte Bedienpause, normale TX-Sequenz und sicherer TUNE-Vorgang wurden
passiv beobachtet. Beide temporären Abschnitte sind entfernt; Runtime und lokale
Flowdatei entsprechen exakt dem ursprünglichen v4.21-Stand mit 84 Nodes.
Kein Ring, SQLite, Incidentdetektor, JSONL-Incidentwriter, DIAG-UI oder permanente
Diagnosezustandsmaschine wurde implementiert.

Designcheckpoint: `1d1a890b2bd0bcf6b09ec60a2858fbca49822aa2`, gepusht und vor
Messbeginn sauber sowie HEAD == origin/main bestätigt. Er korrigiert ausschließlich
AGENTS.md, architecture.md und den kanonischen DIAG-Plan. Runtimeausgangscode bleibt
`8e5d50e`. Old v4.20 / New v4.21 unverändert; kein v4.22 und kein Runtimecommit.

## Quellen, Filter und Durchführung

Zwei abgeschlossene Messabschnitte: zuerst kontrollierte Idle-Baseline, danach
normaler TX und TUNE. Zwischen den Abschnitten wurde exakt zurückdeployed.
Alle 84 ursprünglichen Nodes, Functions, Wires und Radio-Konfigurationen blieben
bei jedem temporären Deploy identisch. Hinzu kamen nur ein temporärer Tab, eine
Messfunction und vier manuelle Inject-Nodes zur Wahl der **Messphase**. Diese
Injects waren ausschließlich mit dem Messzähler verbunden, niemals mit Radio-
Request-Nodes. Deploy über `scripts/deploy-all-flows.sh` mit geprüftem `FLOW_FILE`.

Abgriff:

- Rohmeter zählen am Eingang von `2702052aa13cacd0`; relevant sind die elf
  vereinbarten Topics. Zusätzlich separat alle Meter-Inputs zählen.
- HEALTH liest die letzten bereits kanonisch konvertierten Werte direkt aus dem
  vorhandenen Owner-Kontext, nicht aus dem 1-Hz-Dashboard-Snapshot. Keine neue
  dBm-Konversion, kein zweiter Parser. RX 1 Hz, kanonisches TX 5 Hz. TUNE bleibt
  während der Messung kanonisch UNKNOWN; die beobachtete TX-Phase liefert 5 Hz.
- EVENT erhält tatsächliche Änderungen aus der vorhandenen kanonischen
  Radio-Projektion und bereits dekodierten Interlock-/Radio-/Client-/Slicefeldern.
  Identische periodische Statuswerte werden nicht erneut als Änderung gezählt.
  Erster unbekannter Clientstatus ist einmalige Baseline-/Availability-Evidenz;
  identische spätere Wiederholungen erzeugen keinen neuen Sessionwechsel.
- Jede tatsächlich beobachtete lokale Request-Invocation und ihr ACK bleiben
  separate Records, auch bei identischem Befehlsinhalt. Korrelation nur über
  denselben Request-Node und unveränderte `_msgid`. ACK-Records tragen Status,
  nicht die vollständige große Meter-Inventoryantwort.
- Interlock DIRECT; kanonisches TX/RX wird ausschließlich kopiert, mit
  `DERIVED_FROM_INTERLOCK` und Quellsequenz verknüpft. Kein RF-basierter TX-Schätzer.
- `transmit.tune` wird unabhängig als begrenzte direkte Feldevidenz erfasst,
  einschließlich aller empfangenen Tune-Feldmeldungen; noch kein kanonischer
  TUNE-Event im produktiven Pfad. Sein späterer Event-Fanout wird separat budgetiert.

Einzelne Meterupdates aktualisieren nur den vorhandenen kanonischen Latest-Cache
und die temporären Zähler. **Sie gehen nicht als Records in den geplanten Ring.**
Die temporäre Instrumentierung führte ebenfalls keinen 240-s-Ring: feste Bins,
begrenzte gleitende Zählfenster, kleine Beispielmengen und begrenzte Tune-/Client-
Evidenz. Konsistente tiefe Summarykopien verhindern die skalaren Zwischenstands-
Inkonsistenzen des früheren Pilotlaufs. Lokale monotone Zeit für Dauern,
UTC-Millisekunden und ISO-Zeit für Records; Sequenz ist nur Collector-Ankunftsordnung,
kein Beweis radiointerner Kausalität.

100-ms-Watchdog und unmittelbare Prüfung des kanonischen Radiooutputs stoppen
bei leerem Sliceinventar oder Verlust der vorher eindeutigen aktiven Slice.
Der Messclient restauriert anschließend automatisch. Automatischer Gesamtzeit-
Timeout und Function-Finalizer räumen ebenfalls auf. **Slice disappearance: NO.**
Keine neue Verbindung, keine neue Subscription, kein vom Messabgriff erzeugtes
Radio-Kommando. Bestehende periodische Radio-Requests liefen unverändert weiter.

## Kontrollierte IDLE-RX-Baseline

Benutzer bestätigte vorab mindestens 60 Sekunden ohne bewusste Bedienung; Beginn
wurde ausdrücklich gemeldet, TX erst danach angefordert. Die Slice blieb A, RX.
Periodische vorhandene Requests und Clientstatus sind normale Hintergrundaktivität.

| Messwert | Ergebnis |
|---|---:|
| Dauer | 60.003465 s |
| Relevante rohe Eingangsereignisse | 3776 |
| Raw avg / gleitende 1-s-Spitze | 62.93/s / 89 |
| Raw 100-ms-Burst | 24 |
| EVENT-LANE-Records | 65 |
| EVENT avg / gleitende 1-s-Spitze | 1.0833/s / 17 |
| EVENT 100-ms-Burst | 13 |
| Elf relevante rohe Meter | 3647 = 60.78/s |
| Alle Meterinputs, separat | 9043 = 150.71/s |
| HEALTH bei 1 Hz | 60 Snapshots |
| Gefilterte Records gesamt | 125 = 2.0832/s |

Raw = elf relevante Meter + dekodierte relevante Statusmeldungen + tatsächliche
lokale Requests + ACKs. Die separat ausgewiesenen anderen Meterinputs werden
nicht still zur alten 58-Hz-Meterdefinition hinzugezählt. EVENT-Anteile: 32 Requests,
32 ACKs, eine erstmalige Client-Availability-Evidenz. Kein periodischer
Interlock-/TX/RX-Baselinerecord. Timerjitter kann in einem gleitenden 1-s-Fenster
zwei nominale 1-Hz-Snapshots ergeben; daraus wird keine neue Default-Rate abgeleitet.

## NORMAL TX

Kanonische Flanken: TX bei `1791361275116` ms; Verlassen von TX bei
`1791361283555` ms. Monotone Dauer **8.439352 s**. Die kurzfristigen kanonischen
Zwischenzustände `--` an Key/Unkey wurden unverändert erhalten, nicht zu RX oder
TUNE umgedeutet. Diese Dauer ist Interlock-abgeleitet, keine unabhängige RF-Dauer.

| Messwert | Ergebnis |
|---|---:|
| Kanonische TX-Dauer | 8.439352 s |
| Raw während kanonischem TX | 512 |
| Raw avg während TX | 60.67/s |
| Raw gleitende 1-s-Spitze während TX | 76 |
| Raw 100-ms-Burst während TX | 15 |
| Vorgeschlagene 5-Hz-Healthrecords | floor(8.439352 × 5) = 42 |

Das markierte NORMAL_TX-Messfenster dauerte insgesamt **102.079297 s**, einschließlich
Warte-/RX-Zeit vor und nach der Bediensequenz. Darin EVENT **112** Records,
EVENT-Spitze **16/s**, EVENT-Burst **10/100 ms**; HEALTH **134**, zusammen **246**.
Diese Fenster-Eventzahl ist **nicht** die exakt isolierte Eventzahl innerhalb der
8.44 s TX. Die begrenzten allgemeinen Beispiele speichern keinen vollständigen
Eventstream; für die Rate-/Sizingprüfung sind vollständige Zähler/Bins vorhanden.
Die tatsächlichen TX-Flanken sind unabhängig von der Beispielbegrenzung erhalten.

## Aktives TUNE und direkter Statuskandidat

**TUNE tested: YES. `transmit.payload.tune`: YES. 0→1: YES. 1→0: YES.**

Direkter Status 0→1, `1791361389861` ms,
`2026-10-07T08:23:09.861Z`:

```json
{"type":"status","client":"0x4AD50C9E","topic":"transmit","payload":{"tune":1,"tune_mode":"single_tone","tx_rf_power_changes_allowed":1,"max_power_level":100}}
```

Direkter Status 1→0, `1791361392825` ms,
`2026-10-07T08:23:12.825Z`:

```json
{"type":"status","client":"0x4AD50C9E","topic":"transmit","payload":{"tune":0,"tune_mode":"single_tone","tx_rf_power_changes_allowed":1,"max_power_level":100}}
```

Das sind exakte dekodierte Source-Envelopes, **keine mitgeschnittenen originalen
TCP-Zeilen**. Pfad: vorhandenes `flexradio-js/Radio.js` `_receiveData` →
`_receiveMessage` → bestehendes `flex.decode`/Flexparser → `status`-Emission →
`node-red-contrib-flexradio/flexradio-radio.js`/Owner `7fbf2bfc9badc7d3` → passiver
`status`-Listener. Kein neuer Textparser. Typ `status` ist der Radio-Statuspfad,
getrennt von Request-/Responsecallbacks; die Messung sendete keinen Tune-Request.
Das beweist nicht, welches andere Programm einen fremden Befehl sendete.

Beobachtete Tune-Felddauer: **2.964311 s**. Kanonischer TX-Anteil desselben
Vorgangs: **2.928230 s**, 183 Rawrecords, etwa 62.50/s, gleitende Spitze 67/s,
Burst 14/100 ms. Vorgeschlagene 5-Hz-Healthsamples: 14 über den kanonischen
TX-Anteil, ebenfalls 14 über das beobachtete Tune-Feldintervall.

`tune=1` wurde dreimal empfangen: 08:23:09.861, .877 und .878 UTC.
Danach kein widersprechendes Tune-Feld bis zum abschließenden 0. Die drei 1er
liegen am Anfang, **nicht verteilt über die ganzen drei Sekunden**. Stabilität
ist daher die unveränderte beobachtete Delta-Statusfolge, keine kontinuierliche
unabhängige Hardwaremessung. Sämtliche während dieses Abschnitts empfangenen
Tune-Feldmeldungen sind in der maschinenlesbaren Evidenz enthalten; keine gemeldete
Collector-Lücke und kein Disconnect/Sliceverlust.

**Canonical TUNE candidate: CONFIRMED für diesen beobachteten echten Bedienzyklus.**
Damit kann dieser Statuspfad für eine spätere kanonische Implementierung vorgeschlagen
werden. Die Runtime wurde nicht geändert: **kanonisches TUNE bleibt UNKNOWN**.
Reconnect-/Epoch-/Frische- und Firmwarevarianten sind damit noch nicht abgenommen.
Keine Inferenz aus TX, Leistung, SWR oder Buttondarstellung.

Das markierte TUNE-Fenster inklusive RX-/Wartezeit dauerte **75.270794 s**:
EVENT 88, HEALTH 86, zusammen 174; EVENT-Spitze 16/s, Burst 12/100 ms.
Die zwei Tune-Feldwechsel wurden separat gezählt und noch nicht als produktive
EVENT-LANE-TUNE-Records ausgegeben.

## Clientidentität und Kommandoprovenienz

In der kontrollierten Messung direkt empfangen:

```json
{"topic":"client/0x4AD50C9E/connected","client":"0x6ED902E8","payload":{"local_ptt":1,"client_id":"7661C601-4964-4F02-B36E-C72C054BA082","program":"SmartSDR-Win","station":"DESKTOP-S7JCL8S"}}
```

Gleiche Clientmetadaten in Idle, NORMAL_TX und TUNE beobachtet. IP nicht vorhanden:
null/UNKNOWN; kein Ersatz durch Radio-IP. Headerhandle und Topic-/Sessionhandle
getrennt erhalten. Die Tune-Statusmeldungen tragen `client=0x4AD50C9E`; das ist
beobachtete Metadatenübereinstimmung, **kein Beweis eines SmartSDR-Win-Tune-Kommandos**.

`AetherSDR` war im früheren Messlauf beobachtet worden und bleibt dort exakt
archiviert. Es wurde in diesem kontrollierten Lauf nicht neu beobachtet und wird
nicht als aktueller Client oder Befehlsursprung eingesetzt.

**Command origins proven: NODE_RED**, ausschließlich die bereits vorhandenen
lokalen Requests. Physischer Trigger und Ursprünge fremder Radioaktionen UNKNOWN.
Client anwesend, Clientstatus zeitlich benachbart und tatsächlich beobachteter
Kommandosender sind getrennte Aussagen. Keine fremden Rohkommandos erfunden.

## Konkrete gefilterte 240-s-Recordgrenze

Höchste gemessene EVENT-LANE-Spitze: **17 Records in gleitender 1 s**.
Zusätzlich für später validiertes Tune: **1 Record/s** als unabhängig addierte
Reserve aus der beobachteten Tune-Übergangsspitze. Maximale Default-Healthrate:
**5/s**. Fanout ist bereits in EVENT gezählt; kein doppeltes Addieren.

```text
R_event_design = 17 + 1 = 18/s
R_health_worst = 5/s
R_combined_design = 23/s
expected_normal = ceil(240 × (65/60.003465 + 1)) = 500 Records
expected_worst = 240 × 23 = 5520 Records
safety_factor = 2.0
minimum_with_reserve = 240 × 23 × 2 = 11040 Records
recommended_hard_limit = 12000 Records
```

**Empfohlene harte Grenze: 12000 Records**, weiterhin zusätzlich 240-s-Altersgrenze.
Größter EVENT-Burst: 13/100 ms, bereits innerhalb der gemessenen 1-s-Hülle von 17.
Er wird nicht zu dauerhaft 130/s hochgerechnet. 2× Reserve, zusätzliche Tune-
Spitzenreserve und Aufrundung decken die beobachteten Bursts/Timergrenzen
konservativ ab. Dies ist eine begründete Auslegung für das gemessene kompakte
Recordmodell, kein universeller Stressgrenzbeweis für beliebige Dauerbedienung.
Neue Quellen/Fanouts, spätere Diagnose-State-Machine, 10 Hz, anderes Schema oder
hohe beobachtete Bedienlast verlangen Neumessung/Neuberechnung. Overflow und
tatsächliche Prehistory müssen später weiterhin offen ausgewiesen werden.

Die früheren 154 Rawrecords/s und 221760 Records sind **keine aktuelle Sizingbasis**.
Es wurden keine individuellen Meterupdates zur Retentionsrate addiert.

## Tatsächliche JavaScript-Objekte und RAM

Separater Node-26-Prozess mit `--expose-gc`, jeweils 30000 `structuredClone`-Kopien
der tatsächlich erzeugten Beispielschemaobjekte, HeapUsed-Differenz nach GC;
keine JSON-Längen und keine Pretty-JSON-Strings als Speichermodell. Gemessen:

| Form | Heapbytes/Objekt | konservativ 2× |
|---|---:|---:|
| Kompakter ereignisspezifischer Event | 583.49 | 1167 B |
| Vollständiger 11-Meter-Healthsnapshot | 1808.20 | 3617 B |

Eventrecords enthalten keine elf Healthwerte. Healthrecords enthalten Werte,
Seen-Zeiten, Units und Qualitätsflags; RX-/Stale-/Current-TX-Interval-Qualität wird
aus kanonischen Werten/Status gekennzeichnet. Echte Werte werden nicht umgerechnet
oder durch synthetische Werte ersetzt. JSONL-Normalisierung bleibt spätere Exportarbeit.

Bei maximal 12000 Records, 1201 Health-Snapshots als konservativer 240-s-5-Hz-Anteil
und 10799 Events ergibt das inklusive weiterer 20 % Containerreserve ungefähr
**19.4 MiB**, also rund **20 MiB**. Als zusätzliche grobe Schemareserve: alle
12000 Records mit der größeren gemessenen Healthform plus 20 % etwa **49.7 MiB**.
Ein vorsichtiges Budget ist somit **50 MiB**, kein zugesicherter Produktionsheapdeckel.
Dies ist eine Stichproben-Heapmessung; atypisch große Felder, Allocator/GC, spätere
Queues/Writer und weitere Strukturen müssen vor Ringimplementierung geprüft werden.

## Validierung, Restore und Abschluss

Offlineprüfungen bestanden: Rohmeter werden gefiltert; kanonische Wattwerte kopiert;
Summarykopien unveränderlich; Health RX 1 Hz/TX 5 Hz; RX-Qualität; Interlock-/TX-
Sequenzlink; Tune-Evidenz ohne Promotion; getrennte Requests/ACKs; Sliceverlust
stoppt sofort; sämtliche Hooks/Timer/Listener werden entfernt.

Beide Messungen: errors=0, gemeldeter loss=0; alle Typ-/Sekunden-/Burstzähler und
EVENT+HEALTH=FILTERED unabhängig geprüft. TCP-/UDP-Verluste vor dem Abgriff werden
hierdurch nicht ausgeschlossen. Generische Beispiele sind absichtlich begrenzt;
die Rate zählt dennoch alle beobachteten passenden Eingänge. Keine vollständige
per-Record-Historie und kein produktiver Ring implementiert.

Listener am Radioowner vorher/nachher jeweils 3. Beide Rückdeploys endeten mit
Revision `667c20d7cc65c65f37c8afe9ee9861df082d3a0d4628a5d3ca35ff656d1e8f98`, 84 Nodes,
exakter semantischer Gleichheit und ursprünglichen Flowdatei-Bytes. Keine temporären
Nodes, Hooks, aktive Mess-Timer oder Moduleinbindung verbleiben in Produktion.
Temporäre Messartefakte unter `/tmp/` sind keine autoloadenden Runtimekomponenten.

Nach Restore: Slice A, 14.074 MHz DIGU, RX; Watcher v4.21 frisch. Echte aktuelle
Payloads mit unveränderter METER-Projektion/Vue-Logik geprüft: beide Nadeln 0,
SWR-Feld leer, kanonische Watts/SWR unverändert kopiert. RADIO-/PA-/METER-/Watcher-
Backend und Widget-Livenachrichten geprüft; gerenderter Browser weiterhin
NOT VERIFIED. Vollständige Repository-/Watcher-/Dashboard-/Meter-/Vue-Checks bestanden.

Runtime before/after **v4.21/v4.21**; Old version **v4.20**, New version **v4.21**,
unverändert. Deployment **PASS**, temporäre Messung und exakter Restore.
Permanent runtime changes **NONE**; Runtime commit **NONE**. Designcheckpoint
`1d1a890` Push **PASS**. Abschließender Ergebnis-Commit/Push im Arbeitsbericht.

Maschinenlesbare [Messung, Flanken, Quellen und Heapwerte](measurements/au510m-stage1-two-lanes-2026-10-07.json).
**STOP nach Bericht. Keine weitere Implementierungsstufe freigegeben oder begonnen.**
