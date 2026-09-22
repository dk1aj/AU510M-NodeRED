#!/usr/bin/env bash
set -euo pipefail

NODE_RED_BASE="${NODE_RED_BASE:-http://127.0.0.1:1880}"
FLOW_FILE="${FLOW_FILE:-/mnt/dietpi_userdata/node-red/flows.json}"

if [[ ! -r "$FLOW_FILE" ]]; then
  echo "Flow-Datei nicht lesbar: $FLOW_FILE" >&2
  exit 1
fi

FLOW_FILE="$FLOW_FILE" NODE_RED_BASE="$NODE_RED_BASE" node --input-type=module <<'NODE'
import fs from 'node:fs';
const base = process.env.NODE_RED_BASE;
const file = process.env.FLOW_FILE;
const headers = {'Node-RED-API-Version':'v2'};
const get = await fetch(`${base}/flows`, {headers});
if (!get.ok) throw new Error(`GET /flows ${get.status}: ${await get.text()}`);
const current = await get.json();
const flows = JSON.parse(fs.readFileSync(file, 'utf8'));
const post = await fetch(`${base}/flows`, {
  method: 'POST',
  headers: {...headers, 'content-type':'application/json', 'Node-RED-Deployment-Type':'flows'},
  body: JSON.stringify({flows, rev: current.rev})
});
if (!post.ok) throw new Error(`POST /flows ${post.status}: ${await post.text()}`);
const result = await post.json();
console.log(`Deploy erfolgreich: ${flows.length} Nodes, Revision ${result.rev || 'unbekannt'}`);
NODE
