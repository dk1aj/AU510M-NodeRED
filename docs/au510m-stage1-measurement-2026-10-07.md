# AU-510M Stage 1 — passive Messung, 7. Oktober 2026

Ergebnis: **Teilbeobachtung, kein permanenter Stage-1-Tap**. Die exakte vorherige
v4.21-Konfiguration mit 84 Nodes ist wiederhergestellt. SQLite, Ringbuffer,
Incidentlogik, JSONL-Incidents und DIAG-UI wurden nicht implementiert. Kein
Radio-Steuerkommando wurde zum Testen erzeugt. Keine neue Verbindung,
Subscription, Parserinstanz oder Leistungskonversion.

Dokumentationscheckpoint: `0cc0ac9ab94115ce2cd82619038c85b372345bd0`, separat
committed, nach origin/main gepusht, anschließend fetch und sauberer Arbeitsbaum
sowie HEAD == origin/main bestätigt. Runtimeausgangspunkt bleibt `8e5d50e`.
Old version v4.20 / New version v4.21 bleiben unverändert; v4.22 wurde nicht
angelegt. Messung-only mit vollständiger Entfernung war ausdrücklich autorisiert.

## Verfahren und Grenzen

Zwei temporäre Nodes auf einem eigenen Tab, keine Änderung eines ursprünglichen
Nodes oder einer ursprünglichen Wire. Eine Function lud über das bereits vorhandene
Node.js-Builtin `module` ein temporäres Messmodul unter `/tmp/au510m-stage1-20261007/`.
Keine Dependencyinstallation. Deployment jeweils mit dem Standardwerkzeug und
`FLOW_FILE` auf die geprüfte temporäre vollständige Flowkonfiguration.

Abgriff über lokal installierte Node-RED-Lifecyclehooks: Receipt einzelner Events
an `2702052aa13cacd0` und kanonischem `au510m_live_state`; nach Abschluss Kopie der
bereits kanonisch konvertierten Meterwerte aus dem Owner-Kontext. Die bestehende
Verarbeitung, ihre sechs Ausgänge und Interlock-/Sliceauswahl wurden nicht geändert.
Kanonische Frequency/Mode/Active-slice-Felder wurden aus dem bestehenden
`__radio_status`-Output kopiert. Bereits dekodierte zusätzliche Statusmeldungen
wurden nur lesend am vorhandenen Radioowner `7fbf2bfc9badc7d3` beobachtet. Die
Listener sendeten nichts. Keine zweite Verbindung und keine neue Subscription.

Der zweite Lauf beobachtete zusätzlich Requests an allen bestehenden
FlexRadio-Request-Nodes und deren Outputs: COMMAND_REQUEST und ACK_RESPONSE sind
getrennt, über denselben Request-Node und unveränderte `_msgid` korreliert, niemals
über Zeitnähe. Der Pilotlauf enthielt diese Erweiterung noch nicht; sein
Power-`old_value` war zudem nicht einheitlich zur neuen Watteinheit. Er ist keine
vollständige Record-/Provenienzabnahme. Die Offlineprüfung der korrigierten Fassung
prüft unveränderten Input, kopierte Watts, getrennte Requests/ACKs, die Korrelation,
UNKNOWN-Trigger, eindeutige Sequenzen, Zähler und das Entfernen aller Hooks/Listener.

Interlock hat DIRECT-Beobachtung; der separate TX/RX-Record kopiert die vorhandene
kanonische Normalisierung und trägt `DERIVED_FROM_INTERLOCK` samt Quellsequenz.
Das sind keine unabhängigen Kausalbeweise. Walltime in ISO-UTC und Millisekunden;
lokale aufsteigende Receipt-Sequenz. **Nur lokale Node-RED-Ankunftsreihenfolge,
keine radiointerne Kausalreihenfolge.** Beobachtet wird nach dem Librarydecoder;
UDP-Verluste vor diesem Abgriff sind damit nicht quantifiziert.

Es wurde kein 240-s-Ring aufgebaut. Gezählt wurden temporär feste 1-s- und
100-ms-Bins, Typen und serialisierte Bytes; nur wenige begrenzte Records dienten
als Beispiele. Keine Debugflut und kein persistenter Laufzeitlogger. Die einmalig
vom Messclient gesicherten Auswertungsdateien sind keine Incidentaufzeichnung.

## Messwerte

Im zweiten Lauf wurden exakt die **120 vollständig abgeschlossenen Sekundenbins
0–119** ausgewertet. Der vorsorgliche Abbruch erfolgte danach, bei rund 127 s.
Der Live-Zwischenstand publizierte Duration/Seq alle fünf Sekunden, seine
Zählerobjekte blieben dagegen live referenziert. Deshalb dürfen diese
Zwischenstand-Skalare nicht als Enddauer/Endsequenz verwendet werden. Vollständige
Bins geben hier ein exakt begrenztes Auswertungsfenster. Zählerprüfungen für
Sekundenbins, Burstbins und Typen bestanden; Abgriff-Fehler=0,
fehlende kanonische Meterzuordnungen=0. Eine vollständige per-Record-Sequenzauditierung
ist ohne gespeicherten Gesamtstream nicht möglich.

| Beobachtung | Dauer | Records | Mittel/s | Spitze/fester 1 s | Spitze/feste 100 ms |
|---|---:|---:|---:|---:|---:|
| RX-Basisfenster mit realer Status-/Clientaktivität | 60 s | 3736 | 62.27 | 120 | 52 |
| Folgendes Statusaktivitätsfenster | 60 s | 3770 | 62.83 | 154 | 80 |
| Gesamt, überwiegend RX | 120 s | 7506 | 62.55 | 154 | 80 |
| Elf relevante Einzelmeter, Teilmenge | 120 s | 6931 | 57.76 | 63 | 14 |

Das erste Fenster ist **keine nachgewiesene störungsfreie RX-Idle-Baseline**:
Client-/Sliceaktivität trat auf. Ein sauber isolierter Idle-Test bleibt offen.
Die 100-ms-Spitze 80 entspricht 800 Records/s, **nur auf die Burstdauer
hochgerechnet**, nicht einer beobachteten dauerhaft anliegenden 800-Hz-Rate.
Feste Bins sind keine gleitenden Fenster; die Startphasen beeinflussen Maxima.

Weitere 120-s-Anteile: STATUS 224, INTERLOCK 109, DERIVED_TX_RX 109,
CANONICAL_FIELD 9, COMMAND_REQUEST 62 und ACK_RESPONSE 62. Die Summe einschließlich
METER ist 7506. Zwei Records hatten kanonisches TX/RX `--`; sie werden nicht als
RX/TX umgedeutet. Record-Fanout: Meter 1; Interlock 1 plus 1 abgeleitetes TX/RX;
Slice-Status plus nur tatsächlich geänderte kanonische Anzeigefelder; Request 1
und ACK 1 getrennt. Ein später anderes Recordmodell verlangt eine neue Ratenprüfung.

**Normaler TX-Test: NOT TESTED.** Im Pilotlauf gab es beiläufig 39 Records mit
kanonischem TX-Zustand in den Sekundenbins 54/55: maximal 27/festem Sekundenbin,
9/festem 100-ms-Bin. Echte TX-Dauer, mittlere TX-Rate und Betriebsart dieses kurzen
Ablaufs sind nicht bestätigt; diese Zahlen sind keine vollständige TX-Rate.
Die 10-s-Watcherabfrage allein hatte diese kurze Aktivität nicht erfasst.

**Aktiver TUNE-Test: NOT TESTED.** Keine technische Antennen-/Lastfreigabe oder
bestätigte Bediensequenz lag vor. Keine automatischen TX-/TUNEversuche.

## Recordlimit und RAM — nur beobachtete Teilrechnung

Höchste vollständig ausgewertete Sekundenbinrate: **154 Records/s**.
Burst: **80 Records/100 ms = 800/s äquivalent**.
Konservativer, vorläufiger Faktor für diese Teilrechnung:
`max(2, ceil(800/154)) = 6`.

`ceil(154 × 240 × 6) = 221760 Records`.

**Das ist ausschließlich die Rechnung für die beobachtete Teilmenge, keine
freigegebene empfohlene Hardgrenze.** Vollständige RX-Idle-/Normal-TX-/TUNE-Abdeckung
und eine abgenommene permanente Recordprojektion fehlen. `recommended_hard_limit`
bleibt deshalb NULL/PENDING. Kein Ringbuffer implementiert.

Mittlere temporäre normalisierte Recordgröße etwa **912.73 Byte JSON**,
inklusive Rohquelle und Provenienz; hierfür wurde der gesamte verfügbare
127.x-s-Zählerstand genutzt. Obige Teilrechnung ergibt etwa **193.03 MiB**
serialisierte Daten. Ein ausdrücklich grober, nicht gemessener 4×-Heapaufschlag
würde etwa **772.12 MiB** ergeben. Das ist keine Heapmessung und keine
Speicherfreigabe; JavaScriptobjekte, Strings, Indizes und Queues benötigen eine
spätere echte Speicherprüfung. Die endgültige RAM-Anforderung bleibt PENDING.

## TUNE und Herkunft

**Statusquellen-Kandidat gefunden: YES; kanonisch freigegeben: NO.** Exakte vom
vorhandenen Parser dekodierte Meldung, keine originale TCP-Zeile:

```json
{"type":"status","client":"0x6ED902E8","topic":"transmit","payload":{"tx_rf_power_changes_allowed":1,"tune":0,"tune_mode":"single_tone","mon_available":1,"max_power_level":100}}
```

Pfad: bestehendes `flexradio-js` TCP-Statusdecoding → bestehender
`flexradio-radio`-Owner → dessen vorhandenes `status`-Event → passiver Listener.
Dies ist **RADIO STATUS**, kein COMMAND. `tune:0` ist als direkt empfangenes
Feld DIRECT; TUNE-Ein/Aus-Verlauf, Epoch-/Frischeverhalten und Semantik als
zukünftiger kanonischer Zustand sind nicht abgenommen. **Projekt-TUNE bleibt
UNKNOWN.** Die begrenzten Kandidatenbeispiele beweisen nicht, dass später niemals
ein anderes Tune-Feld eintraf. `tunepower` ist eine Einstellung und kein Tunezustand.

Clientstatus zeigte `program=AetherSDR`, teilweise `station=AetherSDR`, Client-ID
und wechselnde Clienthandles. Diese Metadaten sind direkt empfangene
Clientstatus-Evidenz, keine Attribution einer bestimmten Radioaktion.
Das Handle im Statusheader und das Handle im Topic sind separat erhalten;
ein Statusheader ist kein Beweis für einen Kommandosender. Client-IP wurde nicht
beobachtet und bleibt null. Kein Radio-IP-Ersatz.

Die beobachteten lokalen Requests sind mit command_origin=NODE_RED / DIRECT
belegt, ihr physischer Trigger bleibt UNKNOWN. Keine beobachteten Rohkommandos
anderer Clients; insbesondere keine automatische Zuordnung zu SmartControl,
Maestro, FRStack oder Stream Deck. Das generische Modell bleibt unverändert.

## Schutzreaktion und Runtimeabnahme

Während des zweiten Laufs meldete der vorhandene kanonische State `slices={}` bei
weiter bestehender Verbindung. Watcher: `WAITING FOR UNAMBIGUOUS ACTIVE SLICE`,
QRG null. Client-Disconnect-/Connect-Status wurde ebenfalls beobachtet; die
zeitliche Nähe allein beweist keine Ursache. Die Messung wurde vorsorglich beendet,
der ursprüngliche vollständige Flowstand zurückdeployed. Keine weitere
Featureentwicklung nach diesem Befund. Ursache nicht abschließend geklärt.

Nach Wiederherstellung: 84 Nodes und vollständige semantische Gleichheit zum
Ausgangsstand. Revision erneut
`667c20d7cc65c65f37c8afe9ee9861df082d3a0d4628a5d3ca35ff656d1e8f98`.
Die ursprünglichen Flowdatei-Bytes wurden wiederhergestellt; keine Runtime-Datei
bleibt im Gitdiff. Keine temporären Nodes/Listener verbleiben über den
Function-Finalizer. Der Pilot-Endstand hatte die unveränderten Listenerzahlen
explizit bestätigt; nach dem frühen Abbruch existiert kein vollständiger finaler
Listenerzähler-Snapshot. Die Offline-Cleanupprüfung bestand.

Spätere lesende Abnahme 09:46 Europe/Berlin: Slice 0 / A, 7.014 MHz, CW,
Interlock READY, RX; Watcher v4.21 frisch (437 ms). Alle elf Healthmeter frisch.
Echte aktuelle Payloads wurden mit der unveränderten METER-Projektion/Vue-Logik
geprüft: kanonische Watts und Radio-SWR unverändert kopiert, in RX beide Nadeln 0,
SWR-Feld leer. RADIO/PA/METER und alle fünf Widgets hatten während der Messung
Livenachrichten erhalten. Vollständige Repository-/Watcher-/Dashboard-/Meter-/Vue-
Validierung nach Wiederherstellung bestanden.

| Abnahmefeld | Ergebnis |
|---|---|
| RADIO | PASS für Backend-/Livewerte nach Restore; Browsersicht NOT VERIFIED |
| PA | PASS für frische kanonische Meter; Browsersicht NOT VERIFIED |
| AGC-T | PASS für frischen RX-Status und aktive Slice nach Restore; Browsersicht NOT VERIFIED |
| METER | PASS für kanonische Werte und echte Vue-RX-Auswertung; Browsersicht NOT VERIFIED |
| Neue FlexRadio-Verbindung | NO |
| Neue/duplizierte Subscriptions | NO |
| Permanente Stage-1-Komponente | NO |
| Runtime before / after | v4.21 / v4.21 |
| Old version / New version | v4.20 / v4.21, unverändert |
| Deployment | PASS: temporärer Deploy und exakter Rückdeploy; keine neue Releaseversion |
| Runtime commit | NONE |
| Dokumentationspush Checkpoint | PASS, `0cc0ac9` |

Gerenderte Browserprüfung, repräsentativer TX und aktives TUNE bleiben offen.
Gesamt-Stage-1-Abnahme daher **INCOMPLETE**. Keine Ring-/SQLite-/Incident-/UI-Fortsetzung.

Maschinenlesbare Auswertung: [Messdaten](measurements/au510m-stage1-2026-10-07.json)
und [Liveabnahme](measurements/au510m-stage1-live-validation-2026-10-07.json).
Die Messdaten enthalten Fixed-bin-Zähler und Quellenmetadaten; die Hashes referenzieren
die temporären vollständigen Messartefakte, nicht einen persistenten Eventlogger.
Der abschließende Commit/Push dieser Ergebnisdokumentation wird im Arbeitsbericht
angegeben; es gibt keinen Runtimecommit.
