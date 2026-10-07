# AU-510M Diagnostic Blackbox Logger / DIAG — Analyse und Implementierungsplan

Stand: 6. Oktober 2026. Projekt: `/mnt/dietpi_userdata/node-red`.

**Nur Analyse. Keine Runtime-Datei geändert, kein Deploy, keine Installation, keine Datenbank oder Tabelle angelegt, keine Version erhöht, kein Commit und kein Push.** Die dauerhaft gepflegte Fassung liegt unter `docs/au510m-diag-analysis.md`; die ursprüngliche Berichtskopie unter `/tmp/` ist synchronisiert. Die Ergänzung vom 6. Oktober 2026 betrifft ausschließlich Dokumentation und AGENTS.md.

Die Architektur unterstützt einen passiven Logger über die bestehende Verbindung. Die wichtigste Einschränkung: Die vorhandenen Dashboard-Snapshots erscheinen im Sekundentakt; TUNE, vollständige Interlock-Gründe und Bedienkommandos werden derzeit nicht kanonisch gespeichert. Eine schnelle Schwingung kann deshalb mit einem bloßen Mitschreiben der sichtbaren Dashboardwerte nicht kausal aufgelöst werden. Der Logger muss Einzelereignisse vor der Snapshot-Verdichtung beobachten und Unsicherheiten ausdrücklich erhalten.

## 1. Bestehende Architektur

### Bestand und Prüfumfang

`flows.json` und die laufende Admin-API-Konfiguration sind bei der lesenden Prüfung inhaltlich identisch: **84 Nodes, fünf Node-RED-Tabs**. Die ältere Zahl 82 in AGENTS.md ist kein aktueller Laufzeitbefund.

| Node-RED-Tab | ID | Zustand/Zweck |
|---|---|---|
| rfpower-watt | `028df56117740104` | Deaktiviert; FRStack RFPOWER/HTTP |
| Meter list, alte Kopie | `276c40932e135fc4` | Deaktiviert, gesperrt |
| Meter list, aktive Kopie | `06c9342ea26e4611` | Aktiv, ausschließlich manueller Inject |
| 35-meter dashboard | `b8dbc85ea6f35743` | Aktiv; RADIO/PA/TX/RX/EXT/METER |
| Auto AGC-T Watcher | `e57c2d55062d0d1f` | Aktiv; eigener Kern, HTTP-UI und Einstellungen |

Inventar: 114 ungeschützte Text-/Quelldateien gelesen; 41 Flow-Konfigurationen einschließlich Beispielen, Exporten, Archiv und lokalen Backups strukturell erfasst. Zusammen enthalten diese Kopien 465 Function-Nodes und 32 Dashboardtemplates, überwiegend historische Duplikate. Die aktuelle Repository-Prüfung prüfte 17 JSON-Dateien, 45 Function-Bodies und 29 Vue-Vorlagen. Geschützte Credentials und generierte Runtime-/Benutzerkonfigurationen wurden nicht inhaltlich gelesen. Keine Hardwaregesundheit wird aus Dateipräsenz abgeleitet.

Die aktive Kette:

```text
AU-510M
  → gemeinsame FlexRadio-Konfiguration 7fbf2bfc9badc7d3
      → TCP-Status: slice / interlock / weitere API-Statusmeldungen
      → UDP/VITA-49: Meterdaten, bereits vom Paket skaliert

Meter-Nodes → 2702052aa13cacd0 → PA-Snapshot → au510m_live_bridge
                                              ├→ RADIO/PA-Vorlage
                                              └→ au510m_meter_forward_only → METER
                           └→ getrennte TX/RX/EXT-Snapshots/Vorlagen

slice/interlock → au510m_live_state → au510m_live_bridge

slice/pan/interlock/tx/LEVEL/AGC → Watcher-Kern 5c67eccefec66e09
  ├→ Watcherstatus → agctUiStatus → HTTP /agct-watcher/status
  ├→ atomare Einstellungsdatei
  └→ RX-Schreibpermit → AGC-T-Gate → bestehender FlexRadio-Request
```

FlowFuse Dashboard ist tatsächlich 1.30.2; FlexRadio-Paket und `flexradio-js` sind 1.2.5. Node-RED ist 5.0.0; Host-Node ist v26.3.0. `package-lock.json` enthält keine SQLite-Node-Abhängigkeit. Legacy Dashboard und UI-Addons bleiben installiert.

`settings.js`: `flows.json`, Pretty-JSON, Port aus `PORT` oder 1880; Function external modules aktiviert; Kontextspeicher nicht konfiguriert, deshalb RAM. Console-Logging `info`, Metriken und Audit deaktiviert. Ein Console-Log ist kein Radio-Ereignisjournal.

### Dashboard und Nebenbestand

Fünf aktive `ui-template`-Widgets. Die PA-Vorlage `9ee3e94e3758b01f` enthält zugleich RADIO und AGC-T. TX=`961ffe09d3da81ac`, RX=`80108e5a65682ca7`, EXT=`9b1bcb4b21cd24ff`, METER=`au510m_power_swr_static_ui`.

RADIO/PA/TX/RX/EXT/AGC-T/METER sind überwiegend **Browser-Unteransichten auf derselben `/dashboard/au510m`-Seite**, keine sieben unabhängigen FlowFuse-Seiten. Navigation benutzt `aurora-800x480-tab`, SessionStorage und je Vorlage eine Liste erlaubter Tabs. Daneben bestehen fünf FlowFuse-Seiten-Konfigurationen, unter anderem Radio/Slice und Profilseiten; deren Namen allein belegen keine funktionierende Profilpipeline.

Die vorhandene `au510m_display_average` ist nicht angeschlossen: keine eingehende aktive Wire, alle vier Ausgänge leer; ihr Live-Kontext ist leer. `radio-status/average-display.cjs` ist ein historischer Helfer, kein aktueller kanonischer Meterpfad. Die aktive Meterfunktion wandelt jeden einzelnen dBm-Wert in W um, ohne dieses historische Mittelungsmodul zu verwenden. Dessen aktuelle Tests beweisen keine aktive Einbindung. Auch textliche Handover-/Tabbeschreibungen enthalten ältere Angaben; Runtime und aktiver Code haben Vorrang.

FRStack-/Stream-Deck-Plugin: separat, Windows-N1MM UDP 12060 und PowerShell-Tastenfokus; kein aktiver Node-RED UDP-/TCP-Node und kein vorhandener SmartControl-Kommandologger. Pluginquelle 2.0.2, divergente Alt-Kopie 2.0.0. Keine dieser Kopien ist die Quelle des direkten AU-510M-Dashboards.

`flows/` sind deaktivierte Exportkopien; `examples/` Starter beziehungsweise Watcherquelle; `archive/station-dashboard/` ein deaktivierter Prototyp. Keine historischen Imports für DIAG. Die Beispiele enthalten unter anderem den früheren MAINFAN-Abgriff, dieser ist nicht als zusätzlicher aktiver Wildcard-Abgriff vorhanden.

### Bestehendes Logging und Backups

Aktiv: Debug für Meter-/Subscriptionfehler, Status-Subscriptionantworten, Watcherzustände und manuellen Meter-List-Aufruf. Keine aktive DB-, File- oder persistente Ereignislogger-Node. `radio-status/capture.flow.json` ist ein **deaktivierter** Drei-Node-Status/Debug-Export, kein laufendes Blackboxarchiv. Im Archiv existiert ebenfalls ein deaktivierter Raw-Status-Debug.

Eine alte Juni-Flow-Sicherung enthält vier File/File-in-Nodes mit dynamischer Eigenschaft `filename`; das begründet keine aktive AU-510M-Datenbank. In den untersuchten Projektpfaden keine bestehende Health-DB/Incident-Datei gefunden. Kein Anspruch auf vollständige Suche aller Host-Dateisysteme.

Vorhanden: `.flows.json.backup`, fünf Juni-Flowkopien und Watcher-Snapshots unter `backups/agct-watcher/`. `deploy-agct-watcher.mjs` sichert den ersetzten Watcher, der Standard-Deploy hingegen legt keine komplette automatische Sicherung an. Ein allgemeines aktuelles Backup-/Restore-Script wurde nicht gefunden. Historische Patch-/Restore-Helfer sind nicht als genereller Rollback auszuführen.

## 2. Kanonische FlexRadio-Verbindung

**Owner: `7fbf2bfc9badc7d3`, Typ `flexradio-radio`, Name `Name#1`.** Alle aktiven FlexRadio-Meter-, Message- und Request-Nodes referenzieren diese Konfiguration.

`host_mode=automatic`, Host/Port leer, headless. Das installierte Modul startet Discovery und verbindet zur zuerst gefundenen Radio-Descriptor-Adresse. `flexradio-radio.js` erzeugt dafür ein `Radio`-Objekt; `flexradio-js/Radio.js` betreibt TCP für Status/Kommandos und UDP für Echtzeitmeter. Blankes Konfigurationsfeld bedeutet deshalb automatische Discovery, nicht Loopback-FRStack und nicht einen bewiesenen festen Hardwarehost.

Andere Konfiguration `de18e07b81aedd38`, MQTT und FRStack-WebSockets haben keine aktive Referenz; erhalten. DIAG erhält **keine neue `flexradio-radio`-Konfiguration und keinen zweiten TCP-Client**. Ein zusätzlicher passiver `flexradio-message`-Listener auf denselben Owner erzeugt nach installierter Implementierung keine zweite Verbindung und sendet keine Subscription.

## 3. Bestehende Subscriptions

| Eigentümer | Tatsächliche Requests | Zeitverhalten |
|---|---|---|
| `2702052aa13cacd0` → `185977e7709d7d4d` | `meter list`; `sub meter <numeric ID>` für 35 konfigurierte Identitäten | Clock 1 s; Inventory normalerweise 60 s, Fehlerretry 15 s; maximal fünf Meter-Subscriptions je Tick; ACK/Timeout und Connection-Epoch |
| `au510m_live_state` → `au510m_live_request` | `sub slice all`, `sub tx all` | Verbindung/Clock, pro Epoch ACK merken; nicht bestätigte Requests nach 15 s erneut |
| Watcher → Gate/`07c61c6741eb8fad` | `sub client all`, `sub slice all`, `sub tx all`, `sub pan all`, `meter list` | normalerweise alle 60 s |
| Watcher, zusätzlicher Refresh | `sub tx all`, `sub radio all` | alle 5 s |
| Watcher Inventory | `sub meter <ID>` für entdeckte SLC LEVEL und AGC/AGC+ | aus Inventory, dynamische IDs; AGC nur bei passender Post-AGC-Metadatenbeschreibung |
| Watcher-Readback/Restore | `sub slice all` | situationsabhängig |
| aktive manuelle Meterliste | `meter list` | nur Klick, kein periodischer Inject |
| installierte Radio-Library | `meter list` | interne Inventoryinitialisierung |

Die Library-Verbindungsinitialisierung enthält zusätzlich ihre eigenen Client-/UDP-Registrierungsschritte; diese sind keine DIAG-Abonnements. Es gibt bereits Überschneidungen zwischen Watcher und Statuspfad. DIAG darf weder neue identische Subscriptions hinzufügen noch bestehende Refreshlogik nebenbei bereinigen.

Keine aktive explizite ATU-/Profilsubscription gefunden. `sub radio all` wird bereits gesendet, aber `radio` wird von den aktuellen Flow-Statusfiltern nicht weitergegeben.

## 4. Bestehende Parser

### Transport und API

`node_modules/flexradio-js/flex-parser.pegjs` / generiertes `flex-parser.js`: Status `S`, Message `M`, Response `R`, Handle `H`, Version `V`; generische Schlüssel/Wert-Liste plus Sonderformen für Meter, Profile, GPS und Info. TCP-Status wird in `topic`, `client`, `payload` zerlegt; numerische Tokens normalisiert. Profile sind grammatisch unterstützt, jedoch aktiv nicht verarbeitet. Die Bibliothek kann generische tx/radio/atu-Felder dekodieren, ohne dass hierfür ein neuer Textparser nötig wäre.

`flexradio-meter.js` erhält bereits skalierte Meterobjekte und erzeugt pro Meter `topic`, `meter`, `payload`. Wire-Skalierung gehört `Radio._scaleMeterValues/_scaleMeterValue`, nicht DIAG.

### Aktive Verarbeitung

| Bereich | Eingang/Verarbeitung | Verlust/Limit |
|---|---|---|
| Slice | `au510m_live_messages` → `au510m_live_state`; zusätzlich Watcher `d5e6ccb24dea5faa` → Kern | Partial-Updates pro Slice gemerged; aktive Auswahl muss eindeutig sein |
| Interlock | beide Statuslisteners | RADIO speichert nur `payload.state`; Watcher nur abgeleitetes RX/TX plus Zeit, keine vollständigen Gründe |
| Radio | Library kann es dekodieren; `sub radio all` vorhanden | alle aktiven Message-Regex schließen `radio` aus |
| TX | Watcherlistener erlaubt `tx`; Watcher prüft `state ?? interlock ?? tx_state` | normale TX-Felder wie Power oder Tune werden nicht separat gespeichert |
| Meter | `7330e8695476df43` → `2702052aa13cacd0` | exakte Topicidentität/Inventory, Zahlenprüfung, °F→°C, dBm→W; anschließend nur 1-s-Snapshots |
| ATU | generischer Libraryparser | kein aktiver ATU-Consumer/Cache |
| Profile | Library-Sondergrammatik | kein aktiver Profilparser/Cache in den Flows |
| Connection | `8d4f60f2c8914739`, beide Statuslistener, `au510m_live_connection` | Reset/Expiry; Statusnode prüft alle 5 s, kein unabhängiger TX-Sensor |
| AGC-T | `5c67eccefec66e09` | eigene Slice/Pan/Inventory/Messzustände, Schreibpermit und ACK/Readback |

Wiederverwenden: installierten API-/Meterdecoder, kanonische Meterfunktion, RADIO-Normalisierung und Watcherstatus. DIAG ist Ereignisprojektion und Zustandsmaschine, kein zweiter Protokollparser.

## 5. Vorhandene relevante Signale

`AVAILABLE` heißt hier: aktiv kanonisch verarbeitet; wo angegeben zusätzlich frisch im RX-Livekontext beobachtet. Es beweist keine TX-Abnahme. Node-Kontext kann nicht einfach von einer Function in einem anderen Node gelesen werden; Wiederverwendung erfolgt über Nachrichtenzweige beziehungsweise additive Ausgaben, nicht über einen zweiten Cache mit eigener Messlogik.

### State/Control

| Signal | Verfügbarkeit | Quelle / kanonischer Pfad | Einheit/Normalisierung | Takt / Speicher |
|---|---|---|---|---|
| tune | NOT AVAILABLE kanonisch; Diagnose `UNKNOWN` | kein aktiver Feldpfad | keine Ableitung aus TX/Power/Interlock/Button | nicht gespeichert |
| interlock state | AVAILABLE, live READY | `au510m_live_state`: Node `radio.interlock`; Ausgang `__radio_status.payload.fields['TX/RX']` | String; Mapping READY/RECEIVE→RX, TRANSMITTING→TX, sonst unbekannt | Statusereignis; RAM |
| interlock reason | NOT AVAILABLE kanonisch | dekodiertes Interlock-Payload kann `reason` enthalten, wird derzeit verworfen | Rohstring, keine bestätigte Normalisierung | kein Cache |
| TX/RX | AVAILABLE, live RX | `au510m_live_bridge.payload.radioStatus.fields['TX/RX']`; Watcherstatus `rxTx` | vom Interlock abgeleitet, kein unabhängiger RF-/PTT-Sensor | Ereignisse plus 1-s-Ticks; Node-RAM / Watcherflow-RAM |
| active slice ID | AVAILABLE, live `0` | RADIO `radio.slices`, eindeutiges `active=1`; Watcherstatus `activeSlice` | ID-String; mehrfach/fehlend→null | Partial-Status; Node-RAM und Watcherstatus |
| active slice Anzeige | AVAILABLE, live A | RADIO `fields['Active slice']`, echtes `index_letter` | String, nicht aus ID berechnen | wie oben |
| frequency | AVAILABLE, live 14.074 | `radio.slices[id].RF_frequency`; Watcherstatus `frequencyMHz`; RADIO `fields.Frequency` | numerisch MHz / Anzeigestring | Slice-Status; RAM |
| mode | AVAILABLE, live DIGU | `radio.slices[id].mode`; `radioStatus.fields.Mode` | String | Slice-Status; RAM; Watcher `agcMode` ist ausdrücklich AGC-Geschwindigkeit, kein Demodulationsmodus |
| band | AVAILABLE, live `20` | Watcher `s.band` / `agctUiStatus.band`, aus Slice `band` oder `pans[slice.pan].band` | Radio-Bandbezeichner, nicht anhand QRG erfinden | Watcher 2-s-Banddebounce; aktueller Livewert kommt aus Pan, Slice-Band fehlt |
| ATU state | NOT AVAILABLE kanonisch | keine aktive ATU-Pipeline | unbekannt | kein Cache |
| TX power setting | NOT AVAILABLE kanonisch | keine gespeicherte TX-Statusprojektion | API `rfpower` als 0–100 dokumentiert; keine ungeprüfte Umrechnung in AU-510M-Watt | kein Cache |
| tune power setting | NOT AVAILABLE kanonisch | keine gespeicherte TX-Statusprojektion | API `tunepower` als 0–100 dokumentiert | kein Cache |

Die offiziellen FlexRadio-Unterlagen dokumentieren `transmit tune on|off`, `rfpower` und `tunepower`. Das ist **kein Beleg**, dass die konkrete AU-510M-Firmware ein bestimmtes Tune-Statusfeld an diesen Client sendet. Diese Zuordnung muss Stage 1 passiv erfassen. Quelle: [FlexRadio TCPIP transmit](https://github.com/flexradio/smartsdr-api-docs/wiki/TCPIP-transmit).

### Meter

Alle folgenden Werte stammen aus `7330e8695476df43` → **`2702052aa13cacd0`, Node-Kontext `meters.rows[topic]`**. Ausgang 2 enthält PA-Snapshot; `au510m_live_bridge.payload.rows[]` reicht dieselben Werte an RADIO/PA/METER weiter. `raw` ist bereits wire-skaliert, `value` numerisch/gegebenenfalls temperaturkonvertiert, `watts` die einmalige kanonische Leistungskonversion, `seen` lokale letzte Samplezeit.

| Meter | Status | Topic / bevorzugter Wert | Einheit | Kurze RX-Beobachtung |
|---|---|---|---|---|
| FWDPWR | AVAILABLE, frisch | `TX-/1/FWDPWR` → `watts` | W; Original dBm mitführen | bei 250-ms-Polling fortlaufend neue Zeiten |
| REFPWR | AVAILABLE, frisch | `TX-/2/REFPWR` → `watts` | W; Original dBm mitführen | wie FWDPWR |
| SWR | AVAILABLE, frisch | `TX-/3/SWR` → `value` | dimensionslos, radio-skaliert | wie FWDPWR |
| PATEMP | AVAILABLE, frisch | `TX-/4/PATEMP` → `value` | °C | zwei verschiedene Samplezeiten in rund 3 s |
| PAFETQ1TEMP | AVAILABLE, frisch | `RAD/8/PAFETQ1TEMP` → `value` | °C | wie PATEMP |
| PAFETQ2TEMP | AVAILABLE, frisch | `RAD/9/PAFETQ2TEMP` → `value` | °C | wie PATEMP |
| PACURRENT | AVAILABLE, frisch | `RAD/300/PACURRENT` → `value` | A | wie PATEMP |
| PAEFF | AVAILABLE, frisch | `TX-/6/PAEFF` → `value` | % | fortlaufende neue Zeiten beim Polling |
| +13.8A | AVAILABLE, frisch | `RAD/334/+13.8A` → `value` | V | wie PATEMP |
| +13.8B | AVAILABLE, frisch | `RAD/0/+13.8B` → `value` | V | wie PATEMP |
| MAINFAN | AVAILABLE, frisch | `RAD/3/MAINFAN` → `value` | RPM | wie PATEMP |

Alle elf im Node-RAM gespeichert, normalisiert und bei der Prüfung `Subscribed`. Exakte API-Sampleraten nicht festgestellt. Polling liefert lediglich Untergrenzen; langsamere Health-Meter lassen sich durch 10-Hz-Snapshots nicht in 10-Hz-Messungen verwandeln. Die Dashboardausgabe bleibt 1 Hz. Numeric IDs sind dynamisch; nicht aus dem beobachteten Inventory übernehmen.

Live in RX wurden beispielsweise SWR=1 und FWDPWR/REFPWR=0 dBm beziehungsweise 0.001 W im Backend gehalten. Das sind **keine gültigen TX-Messungen**. DIAG speichert Original und Qualitätsflag, verwendet aber denselben RX-/Current-TX-Interval-Gate für sichtbare Leistungen/SWR. Kein RF-basierter TX-Schätzer, keine SWR-Berechnung aus den Nadeln. Unbekannt/ungültig im DIAG-SWR=`--`; vorhandenes METER-Leerfeld bleibt unverändert.

## 6. Fehlende Signale

Für das Diagnoseziel fehlen momentan:

1. Kanonischer bestätigter TUNE-Status einschließlich Änderungsereignissen und Frische/Verbindungsepoch.
2. Vollständiger Interlock-Datensatz: `reason`, `source`, `tx_allowed`, gegebenenfalls `tx_client_handle`, statt nur state.
3. Kanonische TX-/Tune-Leistungseinstellungen und ATU-Status.
4. Sichtbarkeit von SmartControl-/Maestro-Kommandos. Ein Statusclient sieht keine automatisch garantierte Kopie aller `C...`-Kommandos anderer TCP-Clients; lokale AGC-T-ACKs belegen nur eigene Requests.
5. Unabhängige TX-Flanke zusätzlich zum Interlockstatus; aktuell ist TX/RX eine Ableitung desselben Inputs.
6. Eingangssequenz/monotone Zeit, Quellepoch und Einzel-Meterhistorie vor 1-Hz-Verdichtung.
7. Kontrollierte Angaben zum Bedienmodus SmartControl/Maestro und Firmware-/Clientversionen. Bis diese passiv verifiziert sind: manuelle Sitzungsannotation, klar getrennt von Radiomessung.

Interlock `source=SW` bedeutet Software-PTT, nicht nachweislich SmartControl. Ein Clienthandle kann bei Statusupdates helfen, muss aber gegen vorhandene Clientmeldungen geprüft werden; die heutige Watcher-Regex verwirft Clientmeldungen trotz Subscription. Offizielle Felder/Statebedeutungen: [SmartSDR Status Responses](https://github.com/flexradio/smartsdr-api-docs/wiki/SmartSDR-Status-Responses).

## 7. Bestehende Kontext-/State-Stores

| Geltungsbereich / Node | Schlüssel | Inhalt / Wiederverwendung |
|---|---|---|
| Node `2702052aa13cacd0` | `meters` | `epoch, online, inventory, lastList, listPending, listToken, queue, rows`; **kanonische Healthwerte** |
| Node `au510m_live_state` | `radio` | `slices, meters, interlock, connected, heartbeat, epoch, subscriptions`; kanonische RADIO-Slice-/TX-RX-Normalisierung |
| Node `au510m_live_bridge` | `radio`, `meters` | letzte RADIO-Projektion und PA-Snapshot; sofortige UI-Verknüpfung, kein hochauflösendes Journal |
| Node `au510m_display_average` | `display` | historischer Mittelungscache, aktuell unbenutzt; nicht reaktivieren |
| Node `5c67eccefec66e09` | `watcher` | Slices/Pans/Inventory, `active, band, candidate, rx, rxAt, epoch`, Mess-/Restore-/ACKzustände, Einstellungen, Trace |
| Flow Watcher `e57c2d55062d0d1f` | `agctUiStatus` | durch `2944249a43182f2d` geklonter Status; lesender Wiederverwendungsweg für Version/Band/Watcherdiagnose |
| derselbe Flow | `agctWritePermit` | kurzlebiges Single-use-RX-Schreibpermit; **DIAG darf es weder lesen als TX-Beweis noch verändern/verwenden** |
| Node `a2e5d60332cdb49a` | `lastSent` | Schutz vor erneutem AGC-T-Command; kein Diagnosespeicher |
| Node `au510m_meter_forward_only` | `meterActiveRange`, `meterRangeMode`, `meterRangeTxSince` | gemeinsame METER-Range/Hysterese/TX-Interval; unverändert lassen |
| Global | keine Referenz in aktuellen Function-Nodes | `global.rfpowerMainFan` ist ein historischer Vertrag, kein nachgewiesener heutiger Healthwert |
| Browser | `aurora-800x480-tab`, METER-Themen-/Clockzustände | Navigation/Präsentation, keine kanonische Radiospeicherung |

Physisch persistent: `agct-watcher-settings.json` via Function `450b7e9ed2d9e1eb`, feste Datei, atomarer Rename; zentrale Versionsdatei. Kein persistenter Radio-/Meterkontext.

DIAG erzeugt nur diagnostischen Zustand, Verlauf, Ringbuffer und Provenienz. Kein zweiter Meter-/Slicezustand mit unabhängiger Normalisierung. Neue fehlende Signale bekommen eine einzige diagnostische Projektion aus dem bestehenden Decoder. Die Node-RED-Kontext-Admin-API war für diese Analyse lesend nutzbar; dauerhaftes Polling dieser API ist kein sauberer Produktionsdatenpfad und verliert Flanken.

## 8. Vorgeschlagene diagnostische Zustandsmaschine

Zustandsname und unabhängige Flags (`tune`, Interlock, normalisiertes RX/TX, Verbindung, Qualität) parallel speichern. TUNE-Anforderung, Senderzustand und Fehlerklasse dürfen nicht in einem einzelnen Flag verschwinden. Ein Fehleroverlay darf eine weiterhin beobachtete TX-Phase nicht verdecken.

| Zustand | Exakter Eintritt | Austritt | Beobachtung / Confidence |
|---|---|---|---|
| RADIO_RX | frisches normalisiertes RX aus READY/RECEIVE und bestätigte Verbindung | nächstes belegtes Stateereignis oder verlorene Gültigkeit | Interlock direkt; Bezeichnung RX daraus **INFERRED** |
| TUNE_REQUESTED | heute kein belegter Input; später nur erfasster tatsächlicher Tune-on-Request | beobachtetes TRANSMITTING, belegtes Cancel/Block, Disconnect | heute **UNKNOWN**. Tune-Status=true allein heißt gemeldeter Tunemodus, nicht beobachteter Benutzerrequest |
| TX_REQUESTED | dekodierter Interlock `state=PTT_REQUESTED` | TRANSMITTING, READY/RECEIVE, NOT_READY/Fehler, Disconnect | API-State **DIRECT**, falls tatsächlich empfangen; keine PTT-Ursprungsgewissheit |
| TRANSMITTING | dekodierter Interlock `state=TRANSMITTING` | nächster anderer Interlockstate oder Verbindungsverlust | **DIRECT** als Radioselbstauskunft; keine unabhängige Messung tatsächlicher HF |
| UNKEY_REQUESTED | heute kein belegter Input; später nur explizit empfangener, dokumentierter Unkey-Status oder tatsächlich beobachteter Unkeycommand | bestätigtes RX/Fehler/Disconnect | heute **UNKNOWN**. Tune=false und RF-Abfall reichen nicht |
| RETURN_TO_RX | gültiges RX nach vorher direkt beobachtetem TRANSMITTING, ohne Datenlücke | einmaliges Transitionevent, anschließend RADIO_RX | **INFERRED**, kein separater API-State; keine zusätzliche erfundene Verweilzeit |
| INTERLOCK_BLOCKED | explizit `NOT_READY`; oder verifiziertes `tx_allowed=0` mit eigenem Qualitätsflag | expliziter freigebender Status, Fehler, Disconnect | NOT_READY **DIRECT**; heutiger kanonischer Cache verliert Zusatzfelder |
| FAULT | Interlock `TX_FAULT`, `TIMEOUT` oder `STUCK_INPUT` | Radio meldet einen gültigen nicht-fehlerhaften Folge-State | **DIRECT** für Radiofehler. Logger-/DBfehler separat, Watcher ERROR nicht als PAfehler übernehmen |
| UNKNOWN | Start, Disconnect/Epochwechsel, mehrdeutiger aktiver Slice für sliceabhängige Angaben, fehlender/unbekannter TX-Status | erneut belegte gültige Inputs | **INFERRED** aus mangelnder Beobachtbarkeit |

Priorität für Hauptanzeige: Verbindung/State unbekannt → UNKNOWN; belegter Radiofehler → FAULT; NOT_READY → BLOCKED; TRANSMITTING → TRANSMITTING; PTT_REQUESTED → TX_REQUESTED; READY/RECEIVE → RADIO_RX. Tune bleibt Zusatzflag und bis zum Nachweis einer direkten/kanonischen Quelle ausdrücklich `UNKNOWN`. Nicht aus TX, Leistung, TRANSMITTING oder Buttondarstellung ableiten. Requests/RETURN_TO_RX sind Ereignisse beziehungsweise optionale Phasen, nicht künstlich erzeugte Zwischenstufen bei jedem normalen Wechsel.

Diese Zustandsmaschine verändert kein TX-/Interlocksignal und sendet keinerlei Radio-Control-Kommandos.

## 9. Direkte und abgeleitete Zustände

Direkt sind empfangene Radio-States, nicht jede gewünschte Diagnosebezeichnung. `confidence` und `origin_confidence` verwenden ausschließlich DIRECT, CORRELATED, INFERRED, UNKNOWN; Verfügbarkeitsangaben AVAILABLE/NOT AVAILABLE bleiben davon getrennt. Die offiziellen Statusunterlagen nennen RECEIVE, READY, NOT_READY, PTT_REQUESTED, TRANSMITTING, TX_FAULT, TIMEOUT und STUCK_INPUT. `UNKEY_REQUESTED` wird deshalb nicht ohne Firmwarebeleg als sicher verfügbar eingebaut. Quellen: [Statusdefinitionen](https://github.com/flexradio/smartsdr-api-docs/wiki/SmartSDR-Status-Responses), [Interlock-State-Diagramm](https://github.com/flexradio/smartsdr-api-docs/wiki/Interlock-State-Transition-Diagram).

Ableitungen brauchen in jedem Record `confidence`, `source`, `source_seq` und Begründung. Beispiele:

- `RETURN_TO_RX`: Folge TX→RX innerhalb derselben lückenfreien Epoch.
- `tune_remained_active=YES`: nur durch durchgehend gültigen bestätigten Tune-Status ohne Gegenmeldung/Datenlücke gestützt; bedeutet gemeldeten Zustand, nicht beweisbare Bedienabsicht.
- Ohne verifiziertes direktes/canonisches Tune-Signal bleibt `tune=UNKNOWN`. Eine spätere belegte Commandquelle darf höchstens eine ausdrücklich begründete REQUEST-/Intent-Ableitung erlauben; sie ersetzt keine bestätigte Radio-Tune-State-Meldung.
- CW/QSK, schnelles PTT, ATU-Tune, erneute Subscription-Baselines und manuelles Toggling können ähnlich aussehen. Stateflanken allein entscheiden das nicht.

### Permanente generische Command-/Action-Provenienz

Das Modell gilt für **jede relevante technisch beobachtbare Aktion/Anforderung** und ihre Ergebnisse, unabhängig von SmartControl. Erweiterbare Quellbezeichner, keine geschlossene auf SmartControl begrenzte Enum: SmartControl, Maestro, SmartSDR, Stream Deck, FRStack, Node-RED, N1MM+, WSJT-X, scripts/macros, third-party FlexRadio clients, another PC, hardware controls, radio internal logic, interlock/protection logic und UNKNOWN. Neue Quellen dürfen ohne Bedeutungsänderung bestehender Quellen ergänzt werden. Programm, Maschine und Hardwaretrigger sind verschiedene Identitäten.

Jeder relevante Eventrecord trägt folgenden Provenienz-Envelope; nicht beobachtete Herkunft ist `UNKNOWN`, nicht ein aus Zeitnähe erratener Programmname. Nicht beobachtete IDs/technische Felder sind NULL mit Qualitäts-/Verfügbarkeitsangabe:

| Feld | Bedeutung |
|---|---|
| `trigger_origin`, `trigger_name` | tatsächlich beobachteter physischer/Benutzer-/Automationsauslöser und Aktion |
| `intermediary` | geordnete Liste beobachteter Weiterleitungsstationen; beliebig viele Hops, jede mit eigenem Evidenz-/Confidenceeintrag |
| `command_origin`, `command_name` | beobachteter tatsächlicher Sender des Radio-Requests und exakter Name/Parameter |
| `client_handle`, `client_id`, `client_name`, `client_program`, `client_ip` | nur belegte Clientidentifikation; Handle-zu-Client-Zuordnung zeit-/epochabhängig |
| `source_node` | tatsächlicher Beobachtungsnode/Adapter; niemals automatisch der menschliche Trigger |
| `origin_confidence` | DIRECT / CORRELATED / INFERRED / UNKNOWN für die explizit angegebene beobachtete Herkunft |
| `correlation_id` | beobachtete/verknüpfte Ende-zu-Ende- oder Recorder-Korrelations-ID, getrennt von bloß lokal erzeugter Incident-ID |
| `derived_from_seq` | Quellrecordsequenz der Ableitung; nur zusammen mit run_id/epoch eindeutig; zusätzliche Eltern im Evidence-Array |
| `raw_source` | unverändertes relevantes Sourcepayload/Envelope oder unveränderlich referenzierter Record, Sourceart, Receiptzeit/Seq; keine Credentialwerte |

Confidence präzise:

- **DIRECT:** Herkunft/Command/Trigger im tatsächlichen Quellsignal unmittelbar beobachtet und Identifikation belegt. Ein dekodierter Radio-State allein beweist keinen Command-Origin.
- **CORRELATED:** belastbare explizite Korrelation, etwa gemeinsame Request-ID oder belegte Client-/Sequencezuordnung; keine bloße Zeitnähe. Kann einen Sender stützen, beweist aber keinen unbeobachteten physischen Trigger.
- **INFERRED:** konkret dokumentierte Ableitung mit Elternrecords und Alternativerklärungen; keine direkte Beobachtung vortäuschen.
- **UNKNOWN:** fehlende/mehrdeutige Evidenz. Gleichzeitige Ereignisse bleiben UNKNOWN, solange keine belastbare Verbindung besteht.

Confidence pro Herkunftsteil speichern, etwa in `origin_evidence.trigger`, `.command`, `.intermediary[]`, `.client`; jede enthält Confidence, run/seq und Begründung. Das Gesamtfeld `origin_confidence` bezeichnet die belegte identifizierte Herkunft im Record, **nicht** pauschal alle unbekannten Hops. Dadurch kann command DIRECT sein, während trigger UNKNOWN bleibt.

Beispiel **nur falls FRStack als tatsächlicher Command-Sender direkt beobachtbar ist**:

```json
{
  "event_type": "COMMAND",
  "trigger_origin": "UNKNOWN",
  "trigger_name": "UNKNOWN",
  "intermediary": [],
  "command_origin": "FRSTACK",
  "command_name": "TUNE_ON",
  "origin_confidence": "DIRECT",
  "origin_evidence": {
    "trigger": {"confidence": "UNKNOWN"},
    "command": {"confidence": "DIRECT", "evidence_seq": 123}
  }
}
```

`Stream Deck → FRStack → FlexRadio` darf nur als beobachtete Kette gelten, wenn der Stream-Deck-Trigger und die Verknüpfung tatsächlich erfasst sind. Andernfalls **nicht** origin=STREAM_DECK schreiben. Ein Radio-Status `source=SW` beweist weder FRStack noch SmartControl; client_handle allein ohne verifizierte Clientidentität auch nicht. Client-IP ist nur zu speichern, wenn für genau diesen Client tatsächlich beobachtbar; die Radio-IP ist nicht die Client-IP.

### Command/Request und Result strikt getrennt

```text
seq 123  COMMAND       command_origin=FRSTACK command_name=TUNE_ON
seq 124  INTERLOCK     state=TRANSMITTING observation=DIRECT
seq 125  STATE_CHANGE  TX/RX=TX derivation=DERIVED_FROM_INTERLOCK
                     derived_from_seq=124
seq 130  INTERLOCK     state=READY observation=DIRECT
seq 131  STATE_CHANGE  TX/RX=RX derivation=DERIVED_FROM_INTERLOCK
                     derived_from_seq=130
```

Dies ist ein strukturelles Beispiel, kein erfasster Incident. Trigger/Action, Command/Request, ACK/Response, Interlockresult und abgeleiteter Statechange sind **getrennte Records**. Korrelation verknüpft sie, verschmilzt sie niemals. Auch wenn im aktuellen Projekt keine fremden Commands beobachtbar sind, Stateevents schreiben und Command-/Triggerherkunft UNKNOWN belassen. Kein erfundenes Commandrecord nur weil ein Statewechsel stattfindet.

Ein direkt beobachteter Tune-on-Command beweist einen Request, keinen erfolgreichen Tunemodus. Ein ACK beweist Annahme gemäß API, nicht automatisch RF oder dauerhaftes Tune. Radio internal logic oder protection logic ebenfalls nur als bewiesen nennen, wenn explizite Radioevidenz dies stützt; ein empfangenes Radioresult allein beweist den verursachenden internen Mechanismus nicht.

## 10. Ereignisreihenfolge und Zeitstempel

### Was vorhanden ist

TCP-Status: kein Radiotimestamp im dekodierten Statusobjekt. `client` ist kein Zeitstempel und kein globaler Ereigniszähler. Response `sequence_number` korreliert eigene Requests, nicht globale Statusreihenfolge.

UDP: `flex.decode_realtime` reicht `sequence` weiter; die Meter-Node zerlegt das Paket und lässt diese Sequenz und den übrigen Envelope weg. VITA-Zeitfelder werden im aktiven Meterpfad nicht als Messzeit bereitgestellt. `seen`, RADIO `at`, Watcher `rxAt/at`, Snapshot `timestamp` sind lokale `Date.now()`-Zeitpunkte der Verarbeitung. Watcher-`at` und RADIO-Snapshot-`at` können auf Ticks fortgeschrieben werden und sind kein Nachweis einer neuen Interlockmeldung.

TCP erhält Reihenfolge innerhalb einer Verbindung; UDP kann Verlust/Umordnung haben. TCP-Status und UDP-Meter sind asynchron und haben keinen gemeinsamen belegten Quellclock. Mehrere Node-RED-Zweige und spätere UI-/DB-Aufrufe sind ebenfalls kein globaler Hardware-Zeitbeweis.

### Strategie

Am frühesten zulässigen passiven Abgriff jedes Einzelereignisses:

```text
run_id       UUID je Loggerstart
radio_epoch  Verbindungsgeneration
seq          eindeutige fortlaufende Logger-Eingangssequenz
timestamp    UTC Unix-Millisekunden von Date.now()
mono_ns      process.hrtime.bigint(), dezimal als String in JSON
source       Node-ID, topic, type, client, transport
source_seq   falls tatsächlich erhalten; sonst null
clock_anchor Paar aus UTC-Millisekunden und Monotonzeit
```

Function-Libs dürfen built-in `process`/Zeitfunktion explizit bereitstellen; Verfügbarkeit in der Node-RED-Sandbox später offline testen, nicht voraussetzen. Monotonzeit dient Sortierung/Dauer, UTC der Bedienanzeige und Retention. Wallclock-Sprünge als Ereignis festhalten; UTC nie als einzige Ordnung verwenden. DB/Worker behalten Eingangssequenz, timestamp und run_id unverändert. Nanosekunden-Auflösung ist keine zugesicherte Nanosekunden-Messgenauigkeit.

Für unterschiedliche Eingänge source-lokale Ordnung mitführen; eine Collectorsequenz beschreibt Collector-Ankunft. Wenn exakte Decoder-Callback-Reihenfolge erforderlich wird, muss deren Bereitstellung am gemeinsamen Owner separat geprüft werden. Stage 1 soll Verzögerungen/Merging quantifizieren; ein Flow-Abgriff wird nicht als Netzwerk-Hardwaretimestamp ausgegeben.

**Kausalitätslimit A:** Das heutige normalisierte TX ist eine Funktion des Interlock-State. Interlockänderung und daraus erzeugte TX-Flanke gehören daher zum selben Quellereignis. Die UI darf daraus kein „Interlock zuerst, TX fällt später“ konstruieren. Provenienz explizit: Interlock `DIRECT`; TX/RX `derivation=DERIVED_FROM_INTERLOCK`, `derived_from_seq=<Interlockrecord>`, Beobachtungsconfidence `INFERRED`. DERIVED_FROM_INTERLOCK ist ein Ableitungslabel, keine zusätzliche Origin-Confidenceklasse. Mit einem separat empfangenen Tune-Status sind B/C als lokale Beobachtungsfolge analysierbar; mit UDP-FWDPWR wird ein gemessener Leistungsabfall separat zeitlich eingeordnet, einschließlich Transportunsicherheit. Änderungen mehrerer Felder in derselben Meldung haben keine belegte interne Reihenfolge.

## 11. Vorgeschlagener Flow „AU510M Health Logger“

Eigener modularer Node-RED-Tab, zunächst deaktiviert vorbereitet und pro freigegebener Stufe aktiviert. Keine Schreibverbindung zu Radio-Request-Nodes.

```text
kanonische Statusereignisse / passiv dekodierte Ergänzungen
kanonische normalisierte Einzel-Meterereignisse
    → Receipt/Provenienz → Diagnose-Reducer → getrennte Command-/Result-/State-Change-Events
                         ├→ zeitbegrenzter RAM-Ring
                         ├→ Snapshot-Scheduler → Health-Samples
                         ├→ Detektor → Incident-/Pre-/Post-Collection
                         └→ asynchroner Writer → SQLite / JSONL
                                             → Loggerstatus → DIAG
```

### Exakte Abgriffpunkte

- `au510m_live_messages` liefert bereits dekodierte Slice-/Interlock-/Connectionmeldungen. Neuer Nachrichtenzweig über Link-Nodes; existierende Wire zu `au510m_live_state` bleibt bestehen.
- `au510m_live_state` Ausgang 1 (`__radio_status`) zusätzlich als kanonische RX/TX-/Radioanzeigeprojektion nutzen. Keinen eigenen widersprüchlichen RX/TX-Parser aufbauen.
- `d5e6ccb24dea5faa` deckt tx/pan ab, aber nicht radio/atu/client. Für die fehlenden Topics ist ein passiver Listener am **gleichen** Configowner mit gezieltem Filter sinnvoll. Er benutzt denselben Librarydecoder, sendet keine Requests. Bestehende Filter nicht pauschal erweitern: zusätzliche Meldungen würden auch an den Watcher gelangen und könnten bestehende Verarbeitung beeinflussen.
- Vollständige Interlock-Payloads am bestehenden Statuszweig erhalten, bevor der RADIO-Kern `reason/source` verwirft. DIAG führt keinen zweiten Interlock-Textparser ein; fehlende Metadaten werden nur aus schon dekodierten Feldern projiziert. Partial-/optionale Felder nach belegter API-Semantik behandeln: ein fehlender reason in neuem Interlock-State darf nicht blind als alter aktueller Blockgrund weiterleben.
- `au510m_live_bridge` zusätzliche Branch für die vorhandenen PAwerte an Health/DIAG; bestehende RADIO- und METER-Wires bleiben direkt.
- Für hochauflösende kanonische Meter ist der heutige 1-Hz-Ausgang unzureichend. Minimal erforderliche Erweiterung: **rein additiver siebter Diagnoseausgang** an `2702052aa13cacd0`, nach bestehender Sample-Normalisierung, mit unverändert kopiertem `row` und Eingangsprovenienz. Erste sechs Ausgänge, Outputreihenfolge, Subscriberlogik und bisherige Werte bleiben unverändert. Das ist eine explizite, kleine Instrumentierung des kanonischen Owners; vor Implementierung Diff-/Regressionstest und Abnahme. Kein zweites dBm→W-Modul. Falls diese additive Instrumentierung nicht freigegeben wird, bleibt ein snapshotbasierter Logger möglich, aber kein hochauflösendes Blackboxversprechen.
- Watcherstatus-Ausgang/Cache per Nachrichtenbranch lesen für Version/Band/Watcherereignisse; Permit/Gate nicht ändern. Neues Loggerflow kann den anderen Flowkontext nicht direkt über `flow.get` erreichen.

### Event log

Jede relevante Änderung sofort erfassen/queueen: Interlockstate/reason/source/allowed, Tune wenn belegt, normalisiertes RX/TX, aktive Slice/QRG/Mode/Band, ATU/Settings wenn belegt, Connection/Inventory/Qualität, Recorderlücke und Incident. Gleiche Baseline/gleicher State ist kein neuer Statewechsel; bei wiederholten Baselines trotzdem ein Provenienzrecord im Ring, kein falscher Detektortrigger.

### Health samples und Last

Start: RX **1 Hz**, frisches TRANSMITTING beziehungsweise belegter Tune-Modus **5 Hz**. 10 Hz erst nach passiver Lastmessung und TX-Abnahme. Bei Ausfall/UNKNOWN 1 Hz plus unmittelbares Zustandsereignis.

Beobachtet: Node-RED Prozess etwa 33 % CPU als laufzeitgemittelter `ps`-Wert, ca. 264 MiB RSS. Kein aussagefähiger TX-Lastbenchmark; keine Zusicherung, dass 10 Hz gefahrlos sind. Mit SQLite außerhalb des Haupt-Eventloops erscheinen 1/5 Hz als vernünftiger Start, müssen aber gemessen werden.

Snapshots übernehmen letzte kanonische Werte mit eigenem `seen`, Alter, Unit, Gültigkeit und TX-Interval. Identische Werte dürfen wiederholt sampled werden, aber `seen` wird nicht künstlich erneuert. Kein schnelleres Sampling als angebliche neue Hardwaremessung verkaufen. Alle Einzelmeterereignisse bleiben unabhängig davon im 240-s-Ring.

Offline/Livekriterium: Queue wächst nicht dauerhaft; keine verlorenen Stateevents; Lag-p99 möglichst unter 20 ms und keine neue starke Abweichung zur Baseline, keine RADIO/PA/AGC-T-Ausfälle. Dies sind vorgeschlagene Abnahmekriterien, keine gemessenen Eigenschaften. Bei Lastproblemen zuerst Health auf 2 Hz TX beziehungsweise 1 Hz reduzieren; Stateevents weiterhin unverdichtet.

## 12. SQLite-Integration und Pfade

### Festgestellt

| Punkt | Befund |
|---|---|
| Runtimeuser | Prozess und `node-red.service`: `nodered` |
| Eigentümer Userdir | `nodered:nodered`, Modus 0755 |
| Service | `/etc/systemd/system/node-red.service`, WorkingDirectory `/mnt/dietpi_userdata/node-red`, Start `node-red -u /mnt/dietpi_userdata/node-red` |
| node-red-node-sqlite | nicht installiert/aufgelöst, nicht im Lockfile |
| npm sqlite3 | nicht installiert/aufgelöst |
| better-sqlite3 | nicht installiert/aufgelöst |
| System sqlite3 | `/usr/bin/sqlite3`, 3.46.1 |
| built-in node:sqlite | auf Host v26.3.0 ladbar, `DatabaseSync` vorhanden; keine DB geöffnet |
| `/var/lib/node-red` | existiert nicht |
| lokaler freier Platz | ca. 61 GiB am geprüften Dateisystem; zeitabhängiger Messwert |

Empfohlener persistenter Ort in dieser Installation:

```text
/mnt/dietpi_userdata/node-red/diagnostics/au510m-health.db
/mnt/dietpi_userdata/node-red/diagnostics/incidents/
```

Neue Verzeichnisse später `nodered:nodered`, 0700; DB, WAL/SHM und Incidentdateien 0600, umask 0077. Parent muss für den Runtimeuser schreibbar sein. `diagnostics/` einschließlich DB/WAL/SHM/JSONL von Git ausschließen. Die Kandidaten unter `/var/lib/node-red` würden erst neue Provisionierung/Ownership verlangen und sind hier nicht der vorhandene Standarddatenort.

### Empfehlung

**Kleiner asynchron angebundener Writer mit built-in `node:sqlite`, SQLite ausschließlich in einem Worker-Thread.** Dadurch keine neue npm-/Node-RED-Abhängigkeit und kein natives Addon-Build für Node 26. Ein festes Helfermodul mit worker_threads wird über Function-external-modules beziehungsweise einen lokal getesteten Adapter angebunden; Start/Stop/Deploy-Lifecycle, Pfade und Sandboximport zuerst separat prüfen. Worker ist nur Dateiwriter, hat keine Radio-Verbindung und keine Netzwerksteuerung.

`DatabaseSync` arbeitet synchron; direkt in einer häufig aufgerufenen Node-RED-Function wäre das ungünstig. Quelle: [Node.js SQLite API](https://nodejs.org/api/sqlite.html). Nur in v26.3.0 tatsächlich vorhandene Methoden verwenden, keine neueren 26.8/26.10-Funktionen aus aktueller Onlinedokumentation voraussetzen.

Ein Writer, gebundene Parameter/Prepared Statements, kurze Transaktionen. Event sofort in Queue und Writertransaktion; „sofort erfasst“ und „durabel bestätigt“ getrennt zählen. Health für maximal etwa 200 ms/kleine Batch bündeln. `journal_mode=WAL`, `synchronous=FULL` als Start, `busy_timeout=1000`, Queries mit begrenzten Ergebnissen. Reader auf demselben Worker oder kurzlebig read-only; keine offenen langdauernden Snapshotreader. WAL bleibt lokal. SQLite WAL unterstützt parallele Leser, weiterhin nur einen Writer; Checkpoints müssen überwacht werden. Quelle: [SQLite WAL](https://www.sqlite.org/wal.html).

System-CLI ist geeigneter Offline-Wartungsfallback, nicht ein neu gestarteter Prozess für jedes Sample. Ein Node-RED-SQLite-Addon nur dann später erwägen, wenn Workeradapter unpraktikabel ist, nach Kompatibilitätsprüfung und eigener Abnahme; jetzt keine Installation.

## 13. Exaktes vorgeschlagenes Datenbankschema

UTC-Zeit in Unix-Millisekunden; `mono_ns` signed SQLite INTEGER innerhalb eines Runs, in JSON String; Sequence ist Collectorordnung. `frequency` in MHz. Power-Settings vorerst unveränderte dokumentierte API-Level, nicht Watt; Units/Provenienz in details. `tune=NULL` entspricht semantisch UNKNOWN in SQL; JSONL/UI schreiben UNKNOWN. Origin-Confidence ist getrennt von Beobachtungsconfidence und dem Ableitungslabel. SQL ist Vorschlag, nicht ausgeführt.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE state_events (
  id INTEGER PRIMARY KEY,
  run_id TEXT NOT NULL,
  radio_epoch INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  mono_ns INTEGER NOT NULL,
  source TEXT NOT NULL,
  source_topic TEXT,
  source_seq INTEGER,
  trigger_origin TEXT NOT NULL DEFAULT 'UNKNOWN',
  trigger_name TEXT NOT NULL DEFAULT 'UNKNOWN',
  intermediary TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(intermediary)),
  command_origin TEXT NOT NULL DEFAULT 'UNKNOWN',
  command_name TEXT,
  client_handle TEXT,
  client_id TEXT,
  client_name TEXT,
  client_program TEXT,
  client_ip TEXT,
  source_node TEXT,
  origin_confidence TEXT NOT NULL DEFAULT 'UNKNOWN'
    CHECK (origin_confidence IN ('DIRECT','CORRELATED','INFERRED','UNKNOWN')),
  correlation_id TEXT,
  derived_from_seq INTEGER,
  derivation TEXT,
  origin_evidence TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(origin_evidence)),
  raw_source TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(raw_source)),
  confidence TEXT NOT NULL
    CHECK (confidence IN ('DIRECT','CORRELATED','INFERRED','UNKNOWN')),
  event_type TEXT NOT NULL,
  old_state TEXT,
  new_state TEXT,
  tune INTEGER CHECK (tune IS NULL OR tune IN (0,1)),
  tx_state TEXT,
  interlock_state TEXT,
  interlock_reason TEXT,
  frequency REAL,
  mode TEXT,
  active_slice TEXT,
  atu_state TEXT,
  tx_power_setting REAL,
  tune_power_setting REAL,
  details TEXT NOT NULL CHECK (json_valid(details)),
  UNIQUE (run_id, seq)
);

CREATE TABLE health_samples (
  id INTEGER PRIMARY KEY,
  run_id TEXT NOT NULL,
  radio_epoch INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  mono_ns INTEGER NOT NULL,
  state TEXT NOT NULL,
  tune INTEGER CHECK (tune IS NULL OR tune IN (0,1)),
  tx_state TEXT,
  frequency REAL,
  mode TEXT,
  active_slice TEXT,
  fwdpwr REAL,
  refpwr REAL,
  swr REAL,
  patemp REAL,
  pafetq1temp REAL,
  pafetq2temp REAL,
  pacurrent REAL,
  paeff REAL,
  v13_8a REAL,
  v13_8b REAL,
  mainfan REAL,
  atu_state TEXT,
  quality TEXT NOT NULL CHECK (json_valid(quality)),
  UNIQUE (run_id, seq)
);

CREATE TABLE incidents (
  id INTEGER PRIMARY KEY,
  incident_uuid TEXT NOT NULL UNIQUE,
  run_id TEXT NOT NULL,
  radio_epoch INTEGER NOT NULL,
  start_timestamp INTEGER NOT NULL,
  trigger_timestamp INTEGER NOT NULL,
  end_timestamp INTEGER,
  start_mono_ns INTEGER NOT NULL,
  trigger_mono_ns INTEGER NOT NULL,
  end_mono_ns INTEGER,
  incident_type TEXT NOT NULL,
  description TEXT,
  resolved INTEGER NOT NULL DEFAULT 0 CHECK (resolved IN (0,1)),
  cycle_count INTEGER NOT NULL DEFAULT 0 CHECK (cycle_count >= 0),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  first_abnormal_event TEXT,
  tune_remained_active INTEGER
    CHECK (tune_remained_active IS NULL OR tune_remained_active IN (0,1)),
  snapshot_path TEXT,
  snapshot_status TEXT NOT NULL DEFAULT 'PENDING',
  analysis TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(analysis))
);

CREATE INDEX state_events_time ON state_events(timestamp, id);
CREATE INDEX state_events_type_time ON state_events(event_type, timestamp);
CREATE INDEX health_samples_time ON health_samples(timestamp, id);
CREATE INDEX incidents_time ON incidents(start_timestamp);
CREATE INDEX incidents_open ON incidents(resolved, start_timestamp);
PRAGMA user_version = 1;
```

Globale Eingangssequenz je Run; State-/Healthrecords können unterschiedliche Sequenzwerte derselben Sequenzquelle verwenden. Typisierte Werte unbekannt/ungültig=`NULL`, nicht 0 oder 1.00. `quality` enthält je Meter `seen, age_ms, unit, valid, reason, tx_interval` und Sampleprovenienz; `details` enthält Feldold/new, unverändertes dekodiertes Payload, Interlockzusatzfelder, Clockanker, Firmware/Sessionannotation soweit verfügbar und Recorderlücken. Aufbewahrung des Originalwertes erlaubt die Unterscheidung „gesendet, aber nicht TX-gültig“. Das Event-Envelope führt Trigger/Command/Clientfelder typisiert; health_samples.quality und incidents.analysis referenzieren dieselbe Provenienz über run/epoch/seq und behalten dauerhaft benötigte Evidenz eigenständig. JSONL führt diesen Envelope bei jedem relevanten Action-/Command-/State-Record. Keine Trigger-/Commandherkunft aus einer Healthmomentaufnahme ableiten.

Keine Fremdschlüssel von dauerhaften Incidents auf später gelöschte Health-/Eventrows. `first_abnormal_event` ist eine selbstständige JSON-/Textbeschreibung einschließlich Run/Seq/Confidence oder `UNKNOWN`. Incidentanalyse trägt die nötigen Belege selbst; Snapshot macht sie langfristig unabhängig von Retention. Bei Neustart neue run_id; keine Monotonzeit über Neustarts subtrahieren. Migrationen transaktional, Versionsprüfung vor Schreibstart, keine destruktiven automatischen Migrationen.

## 14. Retention / Round Robin

Kein physisches Überschreiben belegter Incidentdaten. Zeitbasierte SQLite-Retention:

| Datenklasse | Aufbewahrung |
|---|---|
| health_samples | 48 Stunden |
| state_events | 30 Tage |
| incidents | unbegrenzt, nur manuelle Bereinigung |
| Incident-JSONL | zunächst unbegrenzt |

Alle 10 Minuten im Writer abgelaufene Daten in kleinen Batches entfernen. Indexierte Kandidatenauswahl, kurze Transaktion, danach Eventqueue wieder priorisieren:

```sql
DELETE FROM health_samples
WHERE id IN (
  SELECT id FROM health_samples
  WHERE timestamp < :cutoff_48h
  ORDER BY timestamp, id LIMIT 2000
);

DELETE FROM state_events
WHERE id IN (
  SELECT id FROM state_events
  WHERE timestamp < :cutoff_30d
  ORDER BY timestamp, id LIMIT 2000
);
```

Batches mit yielding wiederholen. Clock-Sprünge erkennen; bei unzuverlässiger UTC keine aggressive Retention, zuerst Zeitbasis klären. Aktive Incidentfenster sichern, bevor entsprechende Langzeitdaten gelöscht werden. Ein gescheiterter Export wird als solcher erhalten und die betroffenen Records vorläufig nicht freigegeben.

DELETE macht freie DB-Seiten wiederverwendbar, verkleinert Datei normalerweise nicht. **Kein VACUUM nach jedem Cleanup.** `freelist_count`, `page_count`, DB/WAL-Größe überwachen. Monatlich optional in einem nachgewiesen ruhigen Wartungsfenster VACUUM erwägen, bei relevantem freien Seitenanteil und genügend Platz. RX allein garantiert nicht, dass der nächste TX in der Wartung ausgeschlossen ist; Writer-Wartung braucht Queuebudget und sofortiges Abbruch-/Verschiebekonzept. WAL-Checkpoints passiv und überwacht, TRUNCATE nur bei unkritischen Lesern/Writerqueue. Quelle: [SQLite VACUUM](https://www.sqlite.org/lang_vacuum.html).

### Wachstumsschätzung

48 h enthalten bei 1/5/10 Hz durchgängig 172.800 / 864.000 / 1.728.000 Samples. Bei TX-Anteil d und 5 Hz ist die effektive Rate `1 + 4d`.

Planungsannahme pro Healthrow einschließlich Index/Quality-JSON **0.8–1.5 KiB**, später an echter DB messen:

| Betrieb | Samples / 48 h | ungefähr |
|---|---:|---:|
| RX 1 Hz | 172.800 | 135–253 MiB |
| 10 % TX mit 5 Hz | 241.920 | 189–354 MiB |
| dauerhaft 5 Hz | 864.000 | 675–1.266 MiB |
| dauerhaft 10 Hz | 1.728.000 | 1.350–2.531 MiB |

Eventannahme 1–3 KiB/Row: 10.000 Events/Tag × 30 Tage ungefähr 293–879 MiB; bei viel QRG-Tuning oder dauerhaftem Fehler deutlich mehr. Kein kontinuierliches Speichern jeder normalen Meteränderung als Stateevent; dafür Ring und Health. 240-s-JSONL (120 s PRE + Trigger + 120 s POST) bei 200/1.000 kompakten Records/s und 400 B/Record etwa 19.2/96 MB reine Nutzdaten je Incident. Laufzeitrate unbekannt; diese Zahlen sind Budgetbeispiele. Unbegrenzte Incidents/Dateien benötigen Platzanzeige und Disk-Full-Handling, obwohl Retention dort ausgeschaltet bleibt.

## 15. RAM-Ringbuffer — permanente forensische Vorgabe

**RAM-Ring: 240 Sekunden. Incident: 120 Sekunden PRE + Trigger + 120 Sekunden POST.** SQLite bleibt die persistente normale Historie, JSONL das Incidentformat. Dies ersetzt sämtliche früheren 60-s-Ring-/60-s-PRE-/60-s-POST-Vorschläge.

Ein Collector hält nach Monotonzeit die letzten 240 s: dekodierte Statusdeltas, Connection/Quality, kanonische Einzelmeter, getrennte Command-/Action-/Resultrecords, Diagnoseevents und Health-/Loggerstatus. Kompakte Records; keine komplette 35-Meter-/Watcherstruktur je Ereignis. Speicherbegrenzung zwingend durch **Alter und harte maximale Recordanzahl**. Ein zusätzliches Bytebudget ersetzt keine dieser beiden Grenzen.

### Harte Recordgrenze: Berechnung vor Implementierung verpflichtend

**Aktueller Status: noch kein belastbarer direkt gemessener Collector-Ereigniszähler, deshalb noch kein freigegebener Zahlenwert für `max_records`.** Das frühere 250-ms-Polling beobachtete nur wechselnde `seen`-Zeitpunkte: mehrere Ereignisse zwischen Polls verschwinden. Dashboardnachrichten im Sekundentakt sind ebenfalls keine Eingangsrate. Aus diesen Untergrenzen darf keine scheinbar genaue Recordgrenze berechnet werden. Die frühere Beispielgrenze 100.000 Records ist ausdrücklich zurückgezogen.

Vor jeder Logger-/Ring-Implementierung ist eine rein passive Messung vorhandener Eingänge durchzuführen, ohne Flow-/Subscription-/Verbindungsänderung. Geeignet ist ein nachweislich vollständiger read-only Trace der bestehenden Verbindung oder vorhandene vollständige Runtime-Telemetrie. Falls keine solche Beobachtung zugänglich ist, bleibt diese Implementierungsvoraussetzung offen; kein Ratenwert wird erfunden. Eine temporäre Flowinstrumentierung wäre bereits Runtimeänderung und benötigt einen separat ausdrücklich freigegebenen Messauftrag, nicht diese Dokumentationsfreigabe.

Die Messung muss alle geplanten Recordklassen berücksichtigen. Beobachtungsmodus, Dauer, Gerät/Clientmodus und Datenlücken dokumentieren; normalen RX, vom Benutzer betriebene TX/TUNE-Nutzung, Status-/Commandbursts und Reconnect abdecken, soweit verfügbar. Die Messung darf selbst keinen TX/TUNE auslösen. Nur paketweise Counts genügen nicht: Zahl der Meter pro Paket, Statusrecords und geplante Reducer-/Healthrecords einzeln zählen. Bei Traceverlust Messung als unvollständig kennzeichnen und nicht freigeben.

Berechnung je Szenario, bevor implementiert wird:

```text
R_avg = direkt beobachtete relevante Eingangsrecords / Beobachtungsdauer_s
R_peak = max(relevante Eingangsrecords in jedem gleitenden 1-s-Fenster)
R_fanout = max(zusätzliche abgeleitete Records je Eingangsrecord)
R_generated = konfigurierte maximale Health-/Clock-/Loggerrecords pro Sekunde
R_design = R_peak * (1 + R_fanout) + R_generated
safety_factor = 2.0 (explizite technische Reserve, keine gemessene Rate)
max_records = ceil(240 * R_design * safety_factor)
```

Falls der beobachtete Stream bereits sämtliche finalen Collectorrecords enthält, ist `R_fanout=0`; niemals denselben Fanout doppelt zählen. Alle Szenarien auswerten und die größte berechnete Grenze übernehmen. Bei späteren zusätzlichen Quellen/Fanouts neu messen/berechnen. Vor Implementierung hier die **konkrete ganze Zahl**, Messzeitraum, Eingangs-/Recorddefinition, Durchschnitt/Peak, Fanout, generierte Rate, Reserve, Coverage und geschätzten tatsächlichen JS-Speicher dokumentieren. Erst dann ist die Voraussetzung erfüllt. Ein reines RX-Messergebnis darf nicht als TX-/Incident-Spitzenlast ausgegeben werden.

Budgetbeispiele, ausdrücklich keine freigegebenen Limits: 200 Records/s × 240 s × 400 B ≈ 19.2 MB serialisiert; 1.000/s ≈ 96 MB. JS-Objektoverhead und obige Reserve zusätzlich. Rate oder Speicherbedarf zu hoch: Recordformat/Architektur und Messung vor Implementierung überarbeiten, nicht still die zugesicherten Zeitfenster verkürzen.

### Capture und Überlauf

Beim Trigger wird ausschließlich das Incident-PRE-Fenster `[trigger−120s, trigger)` aus dem 240-s-Ring unveränderlich exportiert; Triggerrecord genau einmal; POST `(trigger, trigger+120s]` fortlaufend an den Incidentwriter. Zusätzlich zum PRE enthält der größere Ring 120 s Reserve. Ring läuft unabhängig weiter und sammelt keine unbegrenzten eingefrorenen Kopien im RAM.

Harte Anzahl-/Altersgrenze niemals überschreiten. Bei einem früheren Count-Überlauf die tatsächliche Ringabdeckung, Verlustanzahl/Recordklassen und `prebuffer_truncated` protokollieren. Niemals vollständige 120 s PRE behaupten, wenn nicht vorhanden. State-/Commandevents bei Rückstau priorisieren und jede Verdrängung sichtbar erhalten. Alter/Deadline und Sequenzen beruhen auf Monotonzeit, UTC ist Anzeige/Korrelation.

Erneute Trigger derselben Episode aktualisieren Cycles und verlängern POST bis **letzter Trigger + 120 s**; ursprüngliches PRE-Fenster und Triggeridentitäten bleiben erhalten. Teilstücke bei langen Episoden fortlaufend auf Platte schreiben. Dateien/Writerqueue begrenzen, nicht Postevents unbegrenzt im RAM halten. Neue separate Episoden bekommen eigene IDs; überlappende Records korrelieren über run/seq. Disconnect/Restart/Writerfehler als Lücke/unterbrochener Export kennzeichnen, niemals unbemerkt zusammenhängende Beobachtung vortäuschen.

## 16. Erkennung TUNE_RX_OSCILLATION

„Drei beliebige TX/RX-Transitions in fünf Sekunden“ wäre zu unspezifisch: `RX→TX→RX→TX` erfüllt das bereits bei zwei normalen Tastungen. Vorschlag als Ausgangskonfiguration, noch kein firmwareoptimierter Grenzwert:

1. Nur gültige kanonische TX/RX-Flanken innerhalb derselben verbundenen Epoch verwenden. Subscriptionbaselines, Wiederholungen und UNKNOWN erzeugen keine Flanke.
2. Ein vollständiger Cycle ist bestätigtes `RX→TRANSMITTING→RX`. Interlock-Zwischenstates separat festhalten; READY/RECEIVE nach TX schließt den Cycle. Fehler-/Unkeyphasen können dazwischenliegen, solange kein Daten-/Connectiongap die Flanke unbestimmbar macht.
3. **Drei abgeschlossene Cycles in einem gleitenden 5-s-Fenster** lösen `TX_RX_OSCILLATION_CANDIDATE` aus. Mindestens sechs Flanken bei RX-Start; Start mitten in TX ist ein unvollständiger Anfang und wird nicht als voller Cycle gezählt.
4. `TUNE_RX_OSCILLATION` nur, wenn ein später verifizierter Tune-Status jeden beteiligten TX als Tune unterstützt. Bei durchgehend gemeldetem Tune=true zusätzlich `tune_remained_active=YES` und „TX fällt bei aktiv gemeldetem Tune“. Fehlende Tunequalität ergibt NULL/UNKNOWN und allgemeine TX/RX-Kandidatenklasse.
5. Dokumentierte Tune-on/off-Änderungen zwischen Cycles kennzeichnen `TUNE_TOGGLE_SEQUENCE`; sie beweisen ohne passende Bedienkommandos keine manuelle Ursache. Ein einzelner normaler Tune oder PTT löst keinen Oscillation-Incident aus.
6. NOT_READY/tx_allowed=0 ist Blockereignis; TX_FAULT/TIMEOUT/STUCK_INPUT ein eigenständiges Fehlerereignis. Wiederholtes PTT_REQUESTED ohne TRANSMITTING ist keine TX/RX-Oszillation.
7. CW/QSK oder schnell getastetes PTT bleiben zunächst Kandidaten mit Ambiguität. Für DIGU/anderen Mode passende Annotation hinzufügen; keine unbelegten Anti-CW-Heuristiken als Radiofakten speichern.
8. Incident endet nach 5 s ohne neue passende Cycleflanke und gültigem ruhigem RX; Postcapture läuft trotzdem bis zum letzten Trigger + 120 s weiter. Bei Disconnect Ende unbekannt/unterbrochen, nicht „resolved“. Menschliches `resolved` ist eine gesonderte Bestätigung, nicht bloß RX.

Stage 1 muss echte Übergangsintervalle bei normalem Tune/SmartControl/Maestro zeigen. Erst dann Schwellen neu begründen; eventuelle Konfigurationsänderung versionieren. Ohne Bediencommand-Beobachtung ist manuelles mehrfaches Tune-Toggling nicht sicher vom Fehler unterscheidbar.

## 17. Incidentanalyse und Snapshotdesign

Jede Analyseantwort: `YES / NO / UNKNOWN`, konkrete Run/Seq/Monotonzeit-Belege, Qualität, Beobachtungsfenster und Confidence. „NO“ verlangt ausreichend vollständige gültige Beobachtung, nicht bloß keinen gefundenen Record.

| Frage | Beweisweg / Grenze |
|---|---|
| Interlock zuerst? | State-/reason-/allowed-Event vor separat gemessenem Leistungsabfall ordnen. Interlock versus daraus abgeleitete TX-Flanke = gleicher Input; unabhängige Reihenfolge UNKNOWN |
| Tune=false zuerst? | nur bestätigte Tune-Flanke vor TX-Status-/Powerereignis; derzeit UNKNOWN |
| TX fällt bei Tune=true? | bekannte Tuneprojektion ohne Gap und gültige TX→RX-Flanke; UIstatusfreshness nicht mit neuer Tune-Meldung verwechseln; derzeit UNKNOWN |
| SWR-Spitze vorher? | echte einzelne kanonische SWR-Samples im gültigen TX-Interval; Zeitpunkt/Maximum und Delta zum Unkey melden. Ohne festgelegten Grenzwert zunächst Verlauf/Peak, nicht Schutzabschaltung behaupten |
| FWDPWR kollabiert vorher? | Einzel-Watt-Samples vor Stateflanke, ohne neue Konversion; normale Unkeyrampe und UDP-Reihenfolge berücksichtigen |
| PAcurrent/Temperatur auffällig? | echte Werte mit Quellalter, Änderungen und Baseline; langsame Abtastung kann schnelle Transiente verpassen; ohne Herstellergrenzwert kein erfundener Fault |
| 13.8-V-Sag? | min/Delta/Zeiten beider gemessener Schienen; keine manuell erfundene Undervoltageursache. RX-Werte um 12 V allein diagnostizieren nichts |
| ATU geändert? | erst nach belegtem ATU-Status; derzeit UNKNOWN |
| Slice/QRG/Mode geändert? | kanonische gemergte Sliceauswahl/Statusdelta; RX-Slice und TX-Slice getrennt mitführen, bei SPLIT nicht aktive RX-QRG als sichere TX-QRG ausgeben |

**JSONL empfohlen**, weil verschachtelte API-Payloads, NULL, Qualitätsdaten, gemischte Recordtypen und monotone Sequenzen erhalten bleiben. CSV später als Exportoption, nicht Primärbeweis.

Dateiform:

```text
AU510M_2026-10-06_15-03-21_+0200_<incident-uuid>_TUNE_RX_OSCILLATION.jsonl
```

UTC in Records; lokale Europe/Berlin-Zeit mit Offset im Namen, UUID verhindert Kollisionsprobleme. Beispielzeit ist keine echte Incidentmessung. Erweiterung `.partial` während Aufnahme, abschließend Flush/fsync und atomarer Rename zu `.jsonl`. Dateipfade sind fest aus erlaubten Klassifikationen/UUID gebildet, keine vom Browser freien Pfade.

Erstes Record: schema_version, Incident-ID, Versionspaar, run/epoch, Clockanker, verfügbare Signale, tatsächlich vorhandene Prehistory, Hardware-/Clientannotation soweit bekannt. Danach Original-/Meter-/State-/Healthrecords mit Source/Seq; Schlussrecord: tatsächliche Fenstergrenzen, Cycles, Belege, Verlustzähler, Exportstatus/Checksumme. DBincident bleibt auch bei JSONL-/DBfehler sinnvoll im RAM und wird nach Wiederherstellung nachgetragen. Start/Restart markiert unvollständige `.partial` als interrupted, ohne alten Inhalt zu überschreiben.

### Incident-Debug, ausschließlich Trigger und Abschluss

```text
AU510M INCIDENT
Type: TX_RX_OSCILLATION_CANDIDATE
Frequency: <kanonische MHz oder UNKNOWN>
Mode: <kanonischer Mode oder UNKNOWN>
Cycles: <vollständige Cycles>
Duration: <monoton gemessene Dauer>
First abnormal event: <belegtes Event oder UNKNOWN>
Tune remained active: UNKNOWN
Evidence: <run_id / seq / capture status>
```

Keine regelmäßigen Debugsamples. Schreibfehler nur dedupliziert bei Zustandseintritt und Erholung, damit Ausfälle sichtbar bleiben ohne Spam. Keine aus Beispielwerten erzeugten Incidentanzeigen.

## 18. DIAG-Dashboardlayout 800×480

DIAG nur lesend; keine TUNE-, MOX-, ATU-, Power- oder Radio-Resetcontrols. Logger läuft unabhängig davon, ob ein Browser geöffnet ist. Browserpush begrenzen, etwa 2 Hz; Backend-Stateevents bleiben sofort erfasst.

### Sichere Einbindung

Empfehlung: zunächst eigene FlowFuse-Seite **`/dashboard/diag`**, auf bestehendem `ff_au510m_base` und Theme, eigene Gruppe/Vorlage. Das erlaubt minimalen Stage-A-Start ohne alle bestehenden Templates anzufassen. Link DIAG erst separat an der bisherigen Navigation anbauen und vollständige Seitenabnahme durchführen.

Soll DIAG exakt ein achter Browser-Untertab auf `/au510m` werden, braucht es eine neue Vorlage sowie gezielte Anpassung der Tablisten **aller fünf** bestehenden Templates. Sonst ignorieren alte Widgets den neuen Eventkey und bleiben sichtbar. Das ist eine ausdrücklich erforderliche Navigationserweiterung, keine Radio-/Meterlogikänderung; Regressionrisiko höher. Für dieses konkrete Vorhaben vor Umsetzung festlegen: eigene Page als erste sichere Variante, eingebetteter Untertab nur als separate zusätzliche Stufe. Auch bestehende globale Kiosk-CSS-Selektoren dürfen die neue Page nicht unbeabsichtigt verstecken/überlagern.

### Platzbudget / virtuelle Gruppen in einer kompakten Vorlage

| Bereich | Platz im 800×480-Ziel | Priorität |
|---|---|---|
| Navigation | y=0–44 | bestehende Ansichten, DIAG eindeutig aktiv |
| Status | y=44–114, volle Breite | Diagnose-State, TX/RX, Tune, Interlock, kurzer reason; unbekannte Werte sichtbar |
| Radiozeile | y=114–150 | QRG, Mode, Slice, Band; ATU nur als belegt/UNKNOWN |
| Health links | y=150–346, ca. 55 % Breite | FWD/REF/SWR prominent; PACURRENT, PATEMP, Q1/Q2, beide V-Schienen, FAN, PAEFF kompakt mit Units/Frische |
| Incident rechts | gleiche Höhe, ca. 45 % | Typ, Zeit, Cycles/Dauer, erstes belegtes auffälliges Event oder UNKNOWN; Exportstatus |
| Logger | y=346–434 | DB/WALstatus, Ringabdeckung s, tatsächliche Samples/s, Queue/Loss, Größe DB+WAL, Incidentanzahl |
| Footer | y=434–480 | zentral `Old: vX.Y | New: vX.Y`; Verbindung/Recorderzustand |

Dies ist ein Layoutbudget, kein schon gerendertes Ergebnis. Keine Titel-/Groupabstände zusätzlich zum Budget addieren; FlowFuse-Chrome/Theme-Padding in echter 800×480-Ansicht messen. Ein kompakter Topstatus, zwei Spalten und Loggerzeile sind verständlicher als 20 große Karten. Lange reasons maximal zwei Zeilen; vollständiger Text über Detailsdialog, kein Scrollzwang auf Hauptseite. Kontrast/Touchziele und Footer/Nav müssen im Screenshot vollständig sichtbar sein.

Neue Vorlagelogik ausschließlich innerhalb eines einzigen `export default { ... }`-Statements. Keine top-level const/import/helper. Eigene CSS-Namespace, keine neue globale Kiosksteuerung. Version vom zentralen Status, kein Hardcoding in DIAG oder Tablabel; AGC-T-Visiblelabel bleibt exakt `AGC-T WATCHER · VERSION X.Y`.

## 19. Risiken, Mehrdeutigkeiten und offene Fragen

1. **TUNE-Status ist nicht verifiziert.** Welches Topic/Feld liefert die konkrete Firmware unter SmartControl und Maestro, einschließlich vollständiger Baseline und Zustandsdeltas? Keine Implementierung mit erfundenem `payload.tune`.
2. **Bedienursache ist nicht bewiesen.** Andere Clientkommandos sind hier nicht direkt sichtbar. Clienthandle/source nur mit belegter Semantik interpretieren. Bedienmodus/Firmwareversion zunächst manuell annotieren.
3. **Interlock und TX sind heute nicht unabhängig.** Eine behauptete kausale Reihenfolge aus zwei abgeleiteten Records wäre falsch.
4. **Eventtap versus immutabler Bestand.** Ohne rein additive kanonische Einzel-Meterausgabe reicht zeitliche Auflösung nicht. Die Änderung muss eng begrenzt und auf unveränderte erste sechs Ausgänge getestet werden.
5. **Fehlende ATU-/Powerprojektion.** Passive vorhandene Meldungen zuerst beobachten; wenn tatsächlich keine ATU-Telemetrie vorhanden ist, UNKNOWN belassen. Eine neue, vorher nicht vorhandene Subscription wäre eigener späterer Scope; jetzt nicht als zwingend deklarieren.
6. **Client-/Sliceambiguität und SPLIT.** Aktive RX-Slice ist nicht automatisch sendende Slice oder die SmartControl-betreffende Clientgruppe.
7. **Frische:** periodische Snapshotzeiten beweisen keinen neuen Source-State; optionale reason/source nicht unbegrenzt als aktuell weiterführen. Auf einer verbundenen Delta-Subscription kann ein unveränderter State korrekt sein; Alter und Baseline/Epoch separat ausweisen.
8. **UDP/TCP-Laufzeiten:** lokale Ankunftsfolge liefert Evidenz, keine vollständige Hardwarekausalität; Paketverlust kann unbemerkt bleiben, weil Meter-Node Sequenz verwirft.
9. **Langsame Healthmeter:** Versorgungseinbruch vor Unkey kann zwischen Samples liegen. Ohne Sample vor dem Event: UNKNOWN, nicht „kein Sag“.
10. **DB-/File-Rückstau und Speicher:** Worker, bounded Queues, Loss-Records, unvollständige Captures; Logger darf RADIO-/Watcherloop nicht blockieren. Dauerhafte Incidents sind nicht platzbegrenzt.
11. **Worker-Lifecycle:** Deploy darf keine alten Writer oder mehrere DBwriter übriglassen. ACK nach durable Commit; Shutdown mit Timeout und Verluststatus.
12. **Bestehende RADIO/AGC-T-Initialization-Problematik:** separat; nicht nebenbei reparieren. Ein neuer DIAG-Templatefehler ist eine Regression und löst Rollback aus.
13. **Abnahmegrenzen:** Dashboard-HTTP 200 und frischer Watcherstatus sind hier bestätigt, aber kein gerenderter Browser-/TX-/Maestrovergleich. Sicht- und RF-Abnahme bleiben für spätere freigegebene Stufen.

## 20. Implementierungsstufen

**Vor Stage 1 beziehungsweise jeder Logger-/Ring-Implementierung:** vollständige passive Ereignisratenmessung und konkretes berechnetes `max_records` gemäß Abschnitt 15 dokumentieren. Derzeit offen; keine Implementierungsfreigabe aus einer angenäherten Pollingrate ableiten.

Vor jeder Runtime-Stufe: aktuellen sauberen Gitstand und aktuelles `origin/main` verifizieren, Known-good-SHA und live Flow-Revision notieren; einmal zentrale Version bumpen; Exports aktualisieren; statische Checks einschließlich Vue-AST, Watcher-/Dashboard-/Meterchecks und spezifischer Tests. Standarddeploy erst nach bestandenem Check. Nach jeder Stufe RADIO, PA, TX/RX/EXT, AGC-T, METER und echte AU-510M-Livedaten prüfen. Erst nach erfolgreicher Runtimeabnahme Commit/Push, HEAD==origin/main und sauberer Baum. Keine nächste Stufe bei fehlender Abnahme.

| Stufe | Änderung | Unverändert | Validierung | Rollbackpunkt |
|---|---|---|---|---|
| 1: passiver Eventtap | eigener Flow/gezielte vorhandene Statusbranches, Receipt/Provenienz; additive kanonische Einzelmeterausgabe für den Ring vorbereiten/abnehmen | Verbindung, Subscriptions, erste sechs Meterausgänge, Radio-/Watchersteuerung, alle UIs | Originalpfade vorher/nachher identisch; keine neue Config/Requests; echte empfangene tx/radio/interlock-Felder inventarisieren, Zeit-/Verlustraten messen | heutiger Known-good-Stand beziehungsweise aktueller Stage-0-Stand |
| 2: State machine | rein passiver Reducer/Changes/Confidence; TUNE/Unkey nur wenn belegt | Meter-/Radioverarbeitung, kein DB-/UIfeature | offline Replay von Partial-Updates, UNKNOWN, Block, Fault, normalen Cycles, Baseline/Disconnect; echte Statesequenz lesen | abgenommener Stage-1-Commit |
| 3: Ringbuffer | 240-s-Zeitfenster, harte gemessene Recordgrenze, bounded Memory, Lossstatus | DB, Incidentdetektor, UIs | 240-s-Abdeckung bei gemessener Last und dokumentierter Recordlimit-Berechnung, Overflow/Restart/immutability, Speicherprofil | Stage 2 |
| 4: SQLite events | Verzeichnis/Worker/Schema, nur Eventlog und Loggerstatus | keine neuen Radioabos, noch keine Healthwrites | temporäre Test-DB später außerhalb Runtime; ACK/Restart/Diskfull/Busy/Shutdown, eindeutige seq, Hauptloop-Lag; echte Eventwrites | Stage 3, Writer entfernen/deaktivieren; aufgezeichnete Dateien erhalten |
| 5: Health sampling | 1 Hz RX/5 Hz TX, Quality und Retention | Eventcapture und kanonische Werte/Gates | tatsächlicher Sampletakt, source-age, TX-cycle, keine doppelte Konversion; Last/Festplattenvolumen; 10 Hz nur nach Abnahme | Stage 4 |
| 6: Detektor | vollständige Cycles/5-s-Fenster, Incidentmetadaten | kein automatisches Radioeingreifen | Replay normaler Tune/PTT/CW, manuelle Toggles, Block ohne TX, UNKNOWN, echte/synthetisch klar getrennte Fehlerfolgen | Stage 5 |
| 7: Pre/Postsnapshot | JSONL partial/final, 120 s PRE / Trigger / 120 s POST, Retrigger/Recovery | UIs und Radio | exakte Fenster/Sequenzen; overlapping triggers, Crash, Exportfehler; DBhinweise persistent | Stage 6, Captures erhalten |
| 8: DIAG | separate Dashboardkomponente, in Unterstufen A–E | bestehende Livepipelines/Verbindung/Abos | Browser800×480, kein Clip/Scroll; Navigation/Footer; jedes vorhandene Dashboard live, Vue-only-export | jeweils unmittelbar vorheriger abgenommener UI-Commit |
| 9: reale TUNE-Abnahme | aufgezeichnete SmartControl- versus Maestro-Sitzungen während vom Benutzer tatsächlich betriebenem Tune | keine künstliche TX-/Tune-Automation und keine neue Diagnoseheuristik ohne Evidenz | Normalfall/Fehler vergleichen; verifizierte Tunequelle, Zeitfolge/Confidence/UNKNOWN, Samples und Snapshot | Stage 8; Logdaten erhalten; Logikkorrektur neue eigene Stufe |

Stufe 1 kann in Receipt-Statusabgriff und additive Meterinstrumentierung als zwei eigene reversible Changesets geteilt werden, wenn Runtimeabnahme oder Scope dies erfordert. Jede deployte Verhaltensänderung bekommt ihren eigenen einmaligen Bump; Versionsnummern späterer Stufen nicht vorab vergeben.

### Verbindliche Dashboard-Unterstufen in Stage 8

- A: minimale `/diag`-Page/Gruppe/Vorlage, ohne Livewerte; Routing und bestehende Seiten prüfen.
- B: ausschließlich statisches kompaktes Layout, Null/UNKNOWN-Platzhalter.
- C: ausdrücklich TEST/SIMULATION markierte synthetische Anzeige; keine Fake-Livewerte.
- D: genau ein echter Wert, z. B. kanonisches normalisiertes TX/RX; TEST für verbleibende Testdaten erhalten.
- E: restliche bereits validierte Logger-/Healthwerte nacheinander, in abgenommenen Changesets; fehlende Signale bleiben UNKNOWN.

Nach **jeder** Unterstufe Validate→Deploy→alle bestehenden Seiten und AU-510M-Livedaten→Commit→Push. Ein HTTP200 reicht nicht. Navigation DIAG separat nur nach erfolgreicher minimaler Page ergänzen; eingebetteter achter Browser-Untertab wäre zusätzliche Navigationstufe mit Regressionstests aller fünf Templates.

Stage 9 verlangt passende Hardware/Benutzerbetrieb; keine automatischen Tuneversuche oder schreibenden Radio-Tests ohne gesonderten konkreten Auftrag.

## 21. Backup und Rollback

Bekannter Ausgangs-SHA dieser Analyse: **`8e5d50e93a712ff8d3ead318b3b847963f9a3633`**. HEAD und lokales `origin/main` identisch, Arbeitsbaum sauber. Es wurde kein Fetch/Push ausgeführt; diese Gleichheit ist keine frisch nachgewiesene Remoteaktualität. Vor späterer Implementierung fetch/recheck und neuen tatsächlich aktuellen SHA erfassen.

Vor erstem Runtimeeingriff später sichern:

1. live `GET /flows` v2 einschließlich Revision und lokale `flows.json`, Hash und Node-/Configinventar;
2. zentrale Version, Standalone-Export, UI-/Functionquellen, `settings.js`, package/lock und geplante Writerkonfiguration;
3. Backup außerhalb Git, 0700/0600, kein Credentialinhalt im Bericht/Git. Verschlüsseltes/generiertes Material bleibt Node-RED-owned; keine Handedits oder Inhaltsanalyse. Falls ein vollständiges Systembackup benötigt wird, vorhandene administrative sichere Backupstrategie nutzen;
4. nach DB-Einführung konsistente SQLite-Backupmethode im Worker verwenden. Laufende WAL-DB nicht als einzelne Datei blind kopieren; Snapshots/Incidents zusätzlich sichern.

Rollback nur eigene Featureänderungen gegenüber dem letzten abgenommenen Stufencommit invertieren: neue Logger/DIAG-Nodes und neue Branches entfernen, additive Meterausgabe zurücknehmen, zentrale Versionspaar-/Exportkonsistenz herstellen. Unrelated uncommitted/editor work erhalten; kein `git reset --hard`, kein altes Ganzbackup über aktuelle Livekonfiguration kippen. Falls seit dem Backup nichts anderes geändert wurde, revisionierter Rückdeploy des verifizierten vollständigen vorherigen aktuellen Flows möglich; sonst gezielt mit neuer Livekonfiguration zusammenführen.

Sofort stoppen und vor Weiterentwicklung zurückdeployen, wenn eine bestehende Seite ausfällt. Danach alle bestehenden Pages/Livewerte erneut prüfen. Incidentdateien/DB bleiben Beweismaterial. Standard-Mechanismus für freigegebene Runtimeänderungen: `bash scripts/deploy-all-flows.sh`, vollständige aktuelle Konfiguration mit Revision und Deployment-Type `flows`. Configowner nicht ändern, um Reconnects möglichst zu vermeiden; auch Instrumentierung kann den betroffenen Tab neu starten, deshalb Verbindung/Werte/Watcherstatus anschließend prüfen.

Version bei Rollback transparent dokumentieren: alte geprüfte Runtimeversion wiederhergestellt, fehlgeschlagene Releaseversion nicht verschweigen; der nächste erfolgreiche neue Changeset braucht eine neue konsistente Version. Keine historische Version still für neue Logik wiederverwenden.

## 22. Runtimeversion, Prüfergebnis und nächste Version

Zentrale Datei `agct-watcher-version.json`: **OLD_VERSION=4.20, NEW_VERSION=4.21**. Identische Werte in aktivem Watcher-Tab und live `GET /agct-watcher/status`. Aktuell deployt ist **v4.21**.

Für eine später ausdrücklich freigegebene **Stage 1** empfohlen: **Old v4.21 → New v4.22**, einmal `node scripts/version-agct-watcher.mjs --bump`, danach Exports/Validation und Runtimeabnahme. Jetzt nicht ausgeführt. Eine reine weitere Plan-/Dokumentationsänderung verlangt keinen Runtimebump.

Lesend bestätigt: Node-RED `/flows` HTTP200, 84 Nodes und Gleichheit zu Datei; `/agct-watcher/status` HTTP200, frisches RX, Slice 0, QRG14.074 MHz/Band20; Dashboard-Route HTTP200. Alle angefragten elf Healthmeter frisch im kanonischen Kontext. Keine echte TUNE-/TX-/Maestroabnahme und keine gerenderte Browsersicht in dieser Analyse.

`bash scripts/validate-repository.sh` vollständig bestanden: JSON/JS/Shell, Function/Vue-AST-Regel, Referenzen, deaktivierte Exports, Watcher-/Dashboard-/Cross-needle-/Range-/Live-meter-/Clock-/RADIO-/Archivtests. Offlineprüfungen sendeten keine Radiorequests.

| Abschlussfeld | Ergebnis |
|---|---|
| Old version | v4.20, vorhandenes zentrales OLD_VERSION, unverändert |
| New version | v4.21, derzeit deploytes NEW_VERSION, unverändert |
| Deployment | keines; nur lesender Runtimeabgleich |
| Commit | kein neuer; HEAD `8e5d50e93a712ff8d3ead318b3b847963f9a3633` |
| Push | keiner; HEAD identisch mit lokalem origin/main |

## Kompakte Bestands-/Planungstabelle

| Kategorie | Konkreter Inhalt |
|---|---|
| **BESTEHEND** | gemeinsame Verbindung; installierter TCP-/UDP-/Meterdecoder; gemergte Slicezustände; Interlockstate und abgeleitetes TX/RX; QRG/Mode/aktive Slice; Watcherband/status/version; elf kanonische Healthmeter; bestehende Debug-/Backup-/Validate-/Deploymechanismen |
| **FEHLT** | bestätigter Tune-Status/Request; gespeicherte Interlockreason/source/allowed; TX-/Tune-Powersettings; ATUzustand; fremde Clientkommandos; unabhängige TX-Flanke; hochauflösender Ereignisverlauf, Sourceprovenienz und persistente Incidents |
| **WIEDERVERWENDEN** | `7fbf2bfc9badc7d3`; `au510m_live_messages`→`au510m_live_state`; `7330e8695476df43`→`2702052aa13cacd0`; `au510m_live_bridge.payload.rows/radioStatus`; Watcher `5c67eccefec66e09`→`2944249a43182f2d`/agctUiStatus; zentrale Version; bestehende Base/Theme; `validate-repository.sh` und revisionierter Standarddeploy |
| **NEU** | modularer Health-Logger-Tab/Linkbranches, passiver Listener für tatsächlich fehlende Topic-Weitergabe, additive kanonische Meter-Einzelereignisausgabe, Receipt/Provenienz, Diagnose-Reducer, Ring, Worker-SQLitewriter, drei Tabellen/Retention, Incidentdetektor/JSONL-Pre-/Postcapture, lesende DIAG-Page und gestufte Navigationserweiterung |

### Dokumentationsergänzung — 6. Oktober 2026

| Anforderung | Status |
|---|---|
| Ring buffer | 240 s, Alter plus harte Recordanzahl |
| Incident PRE / POST | 120 s / 120 s, Trigger separat |
| Generic provenance model documented | YES |
| Trigger vs command origin separated | YES |
| Origin confidence model | YES — DIRECT / CORRELATED / INFERRED / UNKNOWN |
| TX/RX marked derived from Interlock | YES — DERIVED_FROM_INTERLOCK |
| TUNE remains UNKNOWN | YES |
| konkrete max_records-Berechnung | vor Implementierung zwingend; vollständige Ereignisratenmessung fehlt noch |
| Runtime changed | NO |
| Deployment | NONE |
| Version changed | NO; bestehend Old v4.20 / New v4.21 |

**STOP: Nur Dokumentation ergänzt; Implementierung erst nach ausdrücklicher Freigabe und erfüllter Raten-/Recordlimit-Voraussetzung.**
