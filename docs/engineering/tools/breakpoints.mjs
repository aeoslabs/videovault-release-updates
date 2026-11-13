#!/usr/bin/env node
// Breakpoints for agents: attach to a running Node or Electron process (started
// with --inspect), stop at the lines you name, print the values you ask for,
// optionally change state there (fault injection), and resume. One short line
// per hit, so a whole debug session costs a few hundred tokens, not a test suite.
//
//   node docs/engineering/tools/breakpoints.mjs plan.json [--port 9229] [--seconds 120]
//
// plan.json is a list of breakpoints:
//   [
//     { "at": "rcCall\\(drive, 'vfs/stats'", "script": "main", "print": ["drive.rcPort", "Date.now() - started"], "hits": 3 },
//     { "at": "const free = freeBytes\\(", "print": ["free"], "do": "free = 1024", "hits": 1 },
//     { "at": "function onUpdateDownloaded", "pauseMs": 90000, "hits": 1 }
//   ]
//
//   at       regex matched against the source of each loaded script; the first
//            matching line gets the breakpoint (works on bundled dev builds:
//            identifiers survive, so no source maps are needed)
//   script   only scripts whose URL contains this text (default: any script
//            outside node_modules and node: internals)
//   print    expressions evaluated in the paused frame
//   do       an expression run in the paused frame before resuming, e.g. set a
//            variable to the value the field would give (disk full, empty reply)
//   pauseMs  hold the process paused this long (the process looks frozen,
//            like a hang), then resume
//   hits     stop watching this breakpoint after this many hits (default 1)
//
// A breakpoint that is never hit is reported at the end: that path never ran.
// Plain node 22, no dependencies. Source: videovault-hq/engineering/tools.

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const planFile = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!planFile) {
  console.error("Usage: node breakpoints.mjs plan.json [--port 9229] [--seconds 120]");
  process.exit(2);
}
const plan = JSON.parse(readFileSync(planFile, "utf8")).map((b, i) => ({ ...b, n: i + 1, re: new RegExp(b.at), hits: b.hits ?? 1, seen: 0, ids: [] }));
const port = Number(opt("--port", 9229));
const seconds = Number(opt("--seconds", 120));

const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).catch(() => null);
if (!targets?.length) {
  console.error(`Nothing is listening for a debugger on port ${port}. Start the process with --inspect=${port}.`);
  process.exit(2);
}
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = () => bad(new Error("Could not attach to the debugger")); });

let nextId = 1;
const waiting = new Map();
const send = (method, params = {}) =>
  new Promise((ok) => {
    const id = nextId++;
    waiting.set(id, ok);
    ws.send(JSON.stringify({ id, method, params }));
  });

const scripts = [];
const short = (v) => {
  const s = typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v) ?? String(v);
  return s.length > 160 ? s.slice(0, 157) + "..." : s;
};

async function place(script) {
  if (!script.url || script.url.startsWith("node:") || /node_modules/.test(script.url)) return;
  for (const b of plan) {
    if (b.script && !script.url.includes(b.script)) continue;
    if (b.ids.length && !b.script) continue; // first match wins unless scoped to a script
    if (!script.source) script.source = (await send("Debugger.getScriptSource", { scriptId: script.scriptId })).result?.scriptSource ?? "";
    const line = script.source.split("\n").findIndex((l) => b.re.test(l));
    if (line < 0) continue;
    const r = await send("Debugger.setBreakpoint", { location: { scriptId: script.scriptId, lineNumber: line } });
    if (r.result?.breakpointId) {
      b.ids.push(r.result.breakpointId);
      console.log(`#${b.n} set at ${script.url.split("/").slice(-2).join("/")}:${line + 1}`);
    }
  }
}

async function onPaused(p) {
  const b = plan.find((x) => x.ids.some((id) => p.hitBreakpoints?.includes(id)));
  const frame = p.callFrames[0];
  if (b && b.seen < b.hits) {
    b.seen++;
    const values = [];
    for (const expr of b.print ?? []) {
      const r = await send("Debugger.evaluateOnCallFrame", { callFrameId: frame.callFrameId, expression: expr, returnByValue: true });
      const res = r.result;
      values.push(`${expr}=${res?.exceptionDetails ? "<error>" : short(res?.result?.value ?? res?.result?.description)}`);
    }
    if (b.do) {
      const r = await send("Debugger.evaluateOnCallFrame", { callFrameId: frame.callFrameId, expression: b.do });
      values.push(`did ${b.do}${r.result?.exceptionDetails ? " <failed>" : ""}`);
    }
    console.log(`#${b.n} hit ${b.seen}/${b.hits} in ${frame.functionName || "(anonymous)"}: ${values.join(", ")}`);
    if (b.pauseMs) {
      console.log(`#${b.n} holding the process paused for ${b.pauseMs} ms`);
      await new Promise((r) => setTimeout(r, b.pauseMs));
    }
    if (b.seen >= b.hits) for (const id of b.ids) await send("Debugger.removeBreakpoint", { breakpointId: id });
  }
  await send("Debugger.resume");
  if (plan.every((x) => x.seen >= x.hits)) finish();
}

let finished = false;
function finish() {
  if (finished) return;
  finished = true;
  const missed = plan.filter((x) => x.seen === 0);
  for (const b of plan.filter((x) => !x.ids.length)) console.log(`#${b.n} NOT SET: no loaded script has a line matching /${b.at}/`);
  for (const b of missed.filter((x) => x.ids.length)) console.log(`#${b.n} NEVER HIT: that line did not run in ${seconds} s`);
  console.log(`Done: ${plan.length - missed.length} of ${plan.length} breakpoints hit.`);
  ws.close(); // closing the session resumes the process and drops our breakpoints
  setTimeout(() => process.exit(0), 100);
}

ws.onmessage = async (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && waiting.has(msg.id)) {
    waiting.get(msg.id)(msg);
    waiting.delete(msg.id);
  } else if (msg.method === "Debugger.scriptParsed") {
    const s = { scriptId: msg.params.scriptId, url: msg.params.url };
    scripts.push(s);
    if (ready) await place(s);
  } else if (msg.method === "Debugger.paused") {
    await onPaused(msg.params);
  }
};
ws.onclose = () => finish();

let ready = false;
await send("Debugger.enable");
await send("Runtime.runIfWaitingForDebugger");
ready = true;
for (const s of [...scripts]) await place(s);
setTimeout(finish, seconds * 1000);
