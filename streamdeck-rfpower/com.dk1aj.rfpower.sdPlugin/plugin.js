const WebSocket = require("ws");
const dgram = require("dgram");
const { execFile } = require("child_process");

const BASE_URL = "http://dietpi.fritz.box:1880";
const RFPOWER_ACTION = "com.dk1aj.rfpower.step";
const UDP_ACTION = "com.dk1aj.rfpower.udp-key";
const METER_ACTION = "com.dk1aj.rfpower.meter";
const UDP_HOST = "127.0.0.1";
const UDP_PORT = 12060;
const METER_URL = "ws://dietpi.fritz.box:5025/ws/meters";
let n1mmFocusEntry = 0;
let n1mmEntryWindow = 0;

const args = process.argv.slice(2);
const argument = name => args[args.indexOf(name) + 1];
const port = argument("-port");
const pluginUUID = argument("-pluginUUID");
const registerEvent = argument("-registerEvent");

const websocket = new WebSocket(`ws://127.0.0.1:${port}`);
const visibleKeys = new Set();
const refreshing = new Set();
const meterKeys = new Map();
let latestMeters = { MAINFAN: "--" };
let meterSocket;

function send(event, context, payload = {}) {
    if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ event, context, payload }));
    }
}

function meterTitle(settings, value) {
    const unit = settings.unit || (settings.meterName === "MAINFAN" ? " RPM" : "");
    const title = String(settings.title || "").trim();
    const reading = `${value ?? "--"}${unit}`;
    return title ? `${title}\n${reading}` : reading;
}

function updateMeterKey(context) {
    const settings = meterKeys.get(context) || {};
    const value = settings.meterName ? latestMeters[settings.meterName] : undefined;
    send("setTitle", context, { title: meterTitle(settings, value), target: 0 });
}

function sendMeterCatalog(context) {
    if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
            action: METER_ACTION,
            event: "sendToPropertyInspector",
            context,
            payload: { meters: Object.keys(latestMeters).sort() }
        }));
    }
}

function connectMeters() {
    meterSocket = new WebSocket(METER_URL);
    meterSocket.on("message", raw => {
        try {
            const packet = JSON.parse(raw.toString());
            if (!packet.meters || typeof packet.meters !== "object") return;
            latestMeters = { ...packet.meters, MAINFAN: latestMeters.MAINFAN ?? "--" };
            for (const context of meterKeys.keys()) updateMeterKey(context);
        } catch {}
    });
    meterSocket.on("close", () => setTimeout(connectMeters, 2000));
    meterSocket.on("error", () => {});
}

connectMeters();

async function updateMainFan() {
    try {
        const response = await fetch(`${BASE_URL}/rfpower-mainfan?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        latestMeters.MAINFAN = (await response.text()).trim();
        for (const context of meterKeys.keys()) {
            if (meterKeys.get(context)?.meterName === "MAINFAN") updateMeterKey(context);
        }
    } catch {}
}

setInterval(updateMainFan, 1000);
updateMainFan();

async function refreshImage(context) {
    if (refreshing.has(context)) return;
    refreshing.add(context);
    try {
        const response = await fetch(`${BASE_URL}/rfpower-icon?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const type = response.headers.get("content-type") || "image/png";
        const data = Buffer.from(await response.arrayBuffer()).toString("base64");
        send("setImage", context, { image: `data:${type};base64,${data}`, target: 0 });
    } catch {
        send("showAlert", context);
    } finally {
        refreshing.delete(context);
    }
}

async function stepPower(context) {
    try {
        await fetch(`${BASE_URL}/rfpower-step?param=1&t=${Date.now()}`, { cache: "no-store" });
        setTimeout(() => refreshImage(context), 250);
    } catch {
        send("showAlert", context);
    }
}

function xmlValue(xml, tag) {
    const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
    return match ? match[1].trim() : "";
}

const udpListener = dgram.createSocket({ type: "udp4", reuseAddr: true });
udpListener.on("message", data => {
    const xml = data.toString("utf8");
    if (!/<RadioInfo>/i.test(xml)) return;
    const radio = Number(xmlValue(xml, "RadioNr"));
    const focusRadio = Number(xmlValue(xml, "FocusRadioNr"));
    if (radio && focusRadio && radio !== focusRadio) return;
    n1mmFocusEntry = Number(xmlValue(xml, "FocusEntry")) || n1mmFocusEntry;
    n1mmEntryWindow = Number(xmlValue(xml, "EntryWindowHwnd")) || n1mmEntryWindow;
});
udpListener.on("error", () => {});
udpListener.bind(UDP_PORT, UDP_HOST);

function sendN1mmKey(context, value) {
    const configured = String(value ?? "").trim();
    const hwnd = n1mmEntryWindow || n1mmFocusEntry;
    const focusHwnd = n1mmFocusEntry || hwnd;
    if (!configured || !hwnd) {
        send("showAlert", context);
        return;
    }

    const named = /^(F(?:[1-9]|1[0-9]|2[0-4])|ENTER|ESC|ESCAPE|TAB|SPACE|BACKSPACE|DELETE|DEL|HOME|END|UP|DOWN|LEFT|RIGHT)$/i;
    let key = configured;
    if (named.test(configured)) {
        key = `{${configured.toUpperCase().replace("ESCAPE", "ESC").replace("DEL", "DELETE")}}`;
    }

    let virtualKey = 0;
    const functionKey = configured.match(/^F([1-9]|1[0-9]|2[0-4])$/i);
    if (functionKey) virtualKey = 0x70 + Number(functionKey[1]) - 1;
    const namedVirtualKeys = {
        ENTER: 0x0D, ESC: 0x1B, ESCAPE: 0x1B, TAB: 0x09, SPACE: 0x20,
        BACKSPACE: 0x08, DELETE: 0x2E, DEL: 0x2E, HOME: 0x24, END: 0x23,
        UP: 0x26, DOWN: 0x28, LEFT: 0x25, RIGHT: 0x27
    };
    virtualKey ||= namedVirtualKeys[configured.toUpperCase()] || 0;

    const key64 = Buffer.from(key, "utf8").toString("base64");
    const script = `
Add-Type @\"
using System;
using System.Runtime.InteropServices;
public static class Dk1ajWin32 {
  [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();
  [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr processId);
  [DllImport(\"kernel32.dll\")] public static extern uint GetCurrentThreadId();
  [DllImport(\"user32.dll\")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool attach);
  [DllImport(\"user32.dll\")] public static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport(\"user32.dll\")] public static extern IntPtr SetActiveWindow(IntPtr hWnd);
  [DllImport(\"user32.dll\")] public static extern IntPtr SetFocus(IntPtr hWnd);
  [DllImport(\"user32.dll\")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
\"@
Add-Type -AssemblyName System.Windows.Forms
$h = [IntPtr]::new(${hwnd})
$focus = [IntPtr]::new(${focusHwnd})
$foreground = [Dk1ajWin32]::GetForegroundWindow()
$currentThread = [Dk1ajWin32]::GetCurrentThreadId()
$targetThread = [Dk1ajWin32]::GetWindowThreadProcessId($h, [IntPtr]::Zero)
$foregroundThread = [Dk1ajWin32]::GetWindowThreadProcessId($foreground, [IntPtr]::Zero)
[Dk1ajWin32]::AttachThreadInput($currentThread, $targetThread, $true) | Out-Null
[Dk1ajWin32]::AttachThreadInput($foregroundThread, $targetThread, $true) | Out-Null
[Dk1ajWin32]::ShowWindow($h, 9) | Out-Null
[Dk1ajWin32]::BringWindowToTop($h) | Out-Null
[Dk1ajWin32]::SetForegroundWindow($h) | Out-Null
[Dk1ajWin32]::SetActiveWindow($h) | Out-Null
[Dk1ajWin32]::SetFocus($focus) | Out-Null
Start-Sleep -Milliseconds 250
$key = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${key64}'))
if (${virtualKey} -gt 0) {
  [Dk1ajWin32]::keybd_event([byte]${virtualKey}, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [Dk1ajWin32]::keybd_event([byte]${virtualKey}, 0, 2, [UIntPtr]::Zero)
} else {
  [System.Windows.Forms.SendKeys]::SendWait($key)
}
[Dk1ajWin32]::AttachThreadInput($foregroundThread, $targetThread, $false) | Out-Null
[Dk1ajWin32]::AttachThreadInput($currentThread, $targetThread, $false) | Out-Null
`;
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-EncodedCommand", encoded], { timeout: 5000 }, error => {
        send(error ? "showAlert" : "showOk", context);
    });
}

websocket.on("open", () => {
    websocket.send(JSON.stringify({ event: registerEvent, uuid: pluginUUID }));
});

websocket.on("message", raw => {
    const message = JSON.parse(raw.toString());
    if (message.action === RFPOWER_ACTION) {
        if (message.event === "willAppear") {
            visibleKeys.add(message.context);
            refreshImage(message.context);
        } else if (message.event === "willDisappear") {
            visibleKeys.delete(message.context);
        } else if (message.event === "keyUp") {
            stepPower(message.context);
        }
    } else if (message.action === UDP_ACTION && message.event === "keyUp") {
        sendN1mmKey(message.context, message.payload?.settings?.keyboardValue);
    } else if (message.action === METER_ACTION) {
        if (message.event === "willAppear" || message.event === "didReceiveSettings") {
            meterKeys.set(message.context, message.payload?.settings || {});
            updateMeterKey(message.context);
        } else if (message.event === "willDisappear") {
            meterKeys.delete(message.context);
        } else if (message.event === "sendToPlugin") {
            sendMeterCatalog(message.context);
        }
    }
});

setInterval(() => {
    for (const context of visibleKeys) refreshImage(context);
}, 1000);
