# PWR-Meter: PA_FAULT-Status v4.25

Old v4.23 / New v4.25. v4.24 war bereits für den zurückgerollten Incident-Entwurf
verwendet; dieses separate Feature überspringt diese Nummer ausdrücklich über
`node scripts/version-agct-watcher.mjs --bump --next=4.25`. Die zentrale Quelle und
alle Exports bleiben synchron; Footer zeigt Old: v4.23 | New: v4.25.

Ein lesender Statusknopf steht direkt unter der Watt-Anzeige im bestehenden SVG
(x=24, y=62, 90×38 innerhalb der unveränderten 640×390-Skala). Er sendet keinen
Radio-/Reset-/Quittierungsbefehl. Unter PA_FAULT: JA/NEIN/-- steht der beobachtete
Interlock-Zustand. Themes und die komplette Skalen-/Nadel-/SWR-Geometrie bleiben gleich.

- PA_FAULT gemeldet + TX_FAULT/TIMEOUT/STUCK_INPUT: rot.
- PA_FAULT gemeldet bei anderem Zustand, insbesondere READY: gelb. Das beweist
  keinen aktuellen Fault; Tooltip nennt Reason und Interlock getrennt.
- Frisches anderes oder ausdrücklich leeres Reason-Feld: NEIN, grün.
- Fehlende/ungültige/veraltete Daten oder Verbindung offline: --, grau.

Der installierte Flex-Decoder bildet ein ausdrücklich leeres `reason=` auf null ab.
Nur ein tatsächlich vorhandenes Reason-Feld mit diesem null gilt als geleert;
ein fehlendes Feld wird nicht als NEIN erfunden. Ein Zustandswechsel ohne Reason
löscht die vorherige Zuordnung. State und Reason haben getrennte Zeitstempel;
State-only-Traffic verlängert die Reason-Frische nicht. 15 Sekunden Frische für
diese beobachteten Interlock-Felder; vorhandene Online-/Radio-/Payload-Gates bleiben
unverändert. Die bestehende Browser-Uhr lässt die Anzeige auch ohne neue Meldungen
ablaufen. Connection-Ereignisse und Function-Lifecycle leeren den RAM-Status.

Ein zusätzlicher **lesender Zweig** des vorhandenen `au510m_live_messages` schreibt
nur einen kompakten Memory-Status `au510mMeterPaFaultStatus`. Die ursprüngliche Leitung
zu `au510m_live_state` bleibt erhalten. Dessen Function, Bridge, Radio-Konfiguration,
Parser, Subscriptions und Meter-Konversionen wurden nicht geändert. Die bestehende
METER-Projektion liest diesen Status zusätzlich, ohne Eingangsobjekte oder live
Watt/SWR-Werte zu verändern. Es gibt keine zweite Radioverbindung oder Subscription.

Der Schutzvertrag wird ausschließlich für die drei ausdrücklich geänderten Nodes
fortgeschrieben: zusätzliche Ausgangsbranch, METER-Projektion und METER-Template.
Ein Vorher/Nachher-Vergleich bestätigt, dass nur diese Nodes plus zentrale Watcher-
Version verändert wurden und exakt ein neuer Display-Status-Function-Node hinzukam.

Prüfung: vollständige Repository-Validierung PASS, einschließlich Vue-Kompatibilität,
Template-Kompilierung, bisherigen METER-/Watcher-/Stage-1/2-Tests und neuer Statusfälle
für READY, Fault, leeres Reason, Partial-Updates, Ablauf, Disconnect/Reconnect und
Eingangsunveränderlichkeit. Die optionale, zurückgerollte Incident-Integration wird
explizit nur bei vorhandenem integriertem Core getestet; sie wird nicht aktiviert.
Die verbliebenen Incident-Entwürfe gehören nicht zu dieser Veröffentlichung.

Standarddeploy PASS, danach 65 Sekunden Runtime-Prüfung: vorhandener aktiver Slice
nach Startphase, Verbindung vorhanden, Diagnosefehler=0. Aktueller Live-Abgleich:
PA_FAULT NEIN, Interlock READY, Slice 1/B, 7.064 MHz/LSB, RX. RADIO/PA kanonische
Payloads, frischer AGC-T-Status und tatsächliche METER-Vue-Projektion geprüft.
Keine Fehlerprovokation, kein TX/TUNE für diese Anzeige erforderlich.
Browserdarstellung konnte auf dem Host nicht visuell geprüft werden; eine optionale
Benutzerprüfung der Platzierung wurde angefragt.

[Deployment- und Live-Prüfbeleg](measurements/meter-pa-fault-v4.25-validation.json).
