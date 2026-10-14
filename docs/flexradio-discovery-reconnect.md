# FlexRadio discovery reconnect repair

Upstream packages remain `node-red-contrib-flexradio 1.2.5` and `flexradio-js 1.2.5`.
Local patch identity: **au510m-reconnect-r1**. Application release: **v4.32 → v4.33**,
as required by AGENTS.md for infrastructure/runtime changes. No dashboard component,
radio consumer, parser, subscription specification or diagnostic pipeline was changed.
The existing config node's editor name is `Name#1`; discovered nickname/callsign is
DK1AJ. Its id, `7fbf2bfc9badc7d3`, remains the authoritative owner.

## Exact upstream defects

* `connectAutomatic` and `connectNickname` remove their discovery handler immediately
  after the first result. Their `disconnected` guard also rejects discoveries during
  a pending connection. Later announcements cannot update the selected descriptor.
* The reconnect timer closes over the old Radio object and calls `radio.connect()`
  with the original host rather than the latest matching discovery address.
* Config-node `disconnect()` only delegates when state is `connected`, despite the
  transport being able to destroy a pending TCP socket. Public `connect()` ignores
  requests unless state is `disconnected`. A `connecting` attempt cannot be redirected.
* Replacing `_connect` only detaches forwarders; it does not close the old transport.
  Close has no null-descriptor protection, retry timers are not retired on shutdown,
  and transport callbacks/handshake promises have no attempt-generation guards.
* The shared discovery cache's expiry filter is reversed: it retains entries older
  than 60 seconds and discards recent ones. This predicate is corrected separately
  within the same patch set. Connection selection consumes fresh announcements,
  rather than trusting cached entries.

## Lifecycle and identity

`flexradio-identities.json` maps the existing owner id to the station serial. An
optional `FLEXRADIO_IDENTITY_FILE` selects a different configuration file; an explicit
config `serial` takes precedence. Automatic/nickname modes fail closed without a
serial. Nickname, when configured, is an additional filter. Multiple radios never
cause selection by arrival order or IP. No address is persisted or hard-coded.

At startup the existing singleton UDP discovery listener remains attached. No custom
UDP socket, active discovery probes, second FlexRadio session or extra subscriptions
are introduced. The owner starts DISCOVERING, then CONNECTING and CONNECTED. The
public connection-state API retains upstream's lower-case three-state vocabulary.
Discovery status is available as config-node context `radioDiscovery`, with
`radio_discovery_status`, `radio_discovered_ip`, `radio_identity`,
`last_discovery_ts` and `last_discovery_error`.

Same serial/IP/port announcements update discovery freshness without reconnecting.
A changed endpoint is logged as `RADIO_ADDRESS_CHANGED`. During CONNECTING it cancels
the obsolete attempt immediately and starts the replacement using the **same Radio
object**. An already CONNECTED socket is retained until actual TCP/UDP failure;
its next retry uses the latest matching endpoint. Wrong serials and invalid endpoints
are ignored. Retry delay and connect/setup timeout use the existing timeout setting
(default 15 seconds). Duplicate discovery packets cannot bypass the retry delay.

Config cleanup invalidates its generation, clears the single retry timer, removes
its transport forwarders and cancels the transport. Transport cleanup invalidates
its own generation, clears setup timeout, destroys TCP, closes UDP, removes socket
listeners, pending requests, partial input, handles and meter/stream caches. A
short-lived no-op error listener absorbs already queued errors until socket close;
it is removed on close. Repeated cleanup is safe. Old socket, setup-promise, meter-list
and retry callbacks cannot mutate newer attempts. Public disconnect also cancels
CONNECTING, suspends automatic retries and emits DISCONNECTED; a subsequent explicit
connect is accepted. Shutdown removes the owner's discovery handler without stopping
the shared discovery singleton.

The upstream connection handshake (`meter list`, UDP-port and client transport setup)
is retained. No TX, TUNE, slice/profile/PA control requests were added. Existing
consumers continue to restore their own subscriptions on connection events.

## Reproducible installation

`patches/flexradio-reconnect/manifest.json` records upstream versions and exact
original/patched SHA-256 digests for three source files. Unified diffs are beside it.
The direct contrib dependency is pinned to 1.2.5; the existing lockfile pins its
transport. No dependency was installed, upgraded or removed for this repair.

`package.json` postinstall runs:

```sh
node scripts/apply-flexradio-reconnect-patch.mjs
```

Normal `npm install` with this lockfile reapplies the patch. The installer preflights
all source hashes and versions before writing, accepts already patched files and
refuses unknown/upgraded sources. It requires Debian's `patch` utility. Installs
with lifecycle scripts disabled must run this command explicitly. A Node-RED
restart loads installed modules; flow redeploy alone cannot reload cached packages.
Restart/redeploy preserve the files and serial binding. No automatic restart is
performed by postinstall.

```sh
node scripts/apply-flexradio-reconnect-patch.mjs --check
node scripts/test-flexradio-reconnect.mjs
bash scripts/validate-repository.sh
```

`--check` is read-only. For rollback, stop Node-RED, run the installer with
`--restore`, then start Node-RED. This restores exact upstream package bytes; it
does not alter flows or unrelated work. Restoring upstream also restores its known
address-change defect. Do not run an unnecessary dependency reinstall.

## Validation

Deterministic offline tests execute the installed config and transport code using
fake TCP/UDP sockets and time, without opening network sessions. Cases A–J cover
initial serial selection, duplicate packets, `.30 → .31` migration during CONNECTING,
old socket/error/close/data callbacks, old retry/setup timers, public cancellation
and reconnect, wrong serial, multiple radios and idempotent resource cleanup.
Additional cases cover port changes, invalid endpoints, close before discovery,
healthy established connection retention, post-handshake UDP failure, late setup/
meter callbacks and correct discovery-cache expiry. Tests assert Radio-object reuse.
Patch restore/reapply/idempotence were also verified before deployment.

On 2026-10-14 the validated flows were deployed using `scripts/deploy-all-flows.sh`,
then `node-red.service` was restarted to load the patch. The existing owner discovered
DK1AJ/AU-510M at **192.168.178.31:4992**, connected successfully, and returned fresh
canonical slice/LEVEL/AGC and PA health measurements. One Node-RED TCP connection to
the radio was observed. DIAG reported RADIO_RX, SQLite READY and zero logger errors.
No router/DHCP changes or radio-control tests were performed. RX power/SWR validity
continues to follow the existing gates; no TX validation is claimed.

Repository validation includes Vue template compatibility, canonical-contract,
watcher, METER, DIAG and persistence checks. The PA-health test's previous fixed
release assertion was changed to accept the centrally maintained advancing pair;
classification logic and its existing tests were otherwise preserved.

Live Dashboard polling (the same Socket.IO delivery path used by browsers) received
fresh RADIO/PA payloads, METER normalized RX state and both DIAG LIVE and TREND
messages with current temperature/supply series. All **34 advertised canonical
project meters** were Subscribed and fresh; the optional external FreeDV_SNR meter
was not advertised and remained unavailable. AGC-T status was also fresh. No visual
kiosk rendering or TX/TUNE operation was exercised by this connectivity repair.
No connection retries or runtime errors occurred during restoration observation.

Pre-existing uncommitted DIAG/PA work was present before this repair. It was neither
reverted nor included in the connectivity commit; shared files are staged using
only the connectivity/version changes. The working tree consequently retains that
pre-existing work after the commit.
