#!/usr/bin/env node
// Field-ready check: reads a PR's "Engineering notes" and WARNS when a step is
// missing. It never fails: VV decided (13 Nov 2026) that CI warns, never blocks.
// Source: videovault-hq/engineering/tools. Never edit the copy in an app.
//
//   node docs/engineering/tools/field-check.mjs                      in GitHub Actions (reads the PR event)
//   node docs/engineering/tools/field-check.mjs --body pr.md [--files changed.txt]   locally
//
// Plain node, no dependencies.

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const HERE = dirname(fileURLToPath(import.meta.url));

// Docs-only changes need no engineering notes.
const NO_CODE = [/\.md$/i, /^docs\//, /^VIDEOVAULT CONTEXT\//, /^\.claude\//, /^\.agent\//, /^\.github\//, /^AI WORKING SESSIONS?\//, /^RELEASE_NOTES\//, /\.(png|jpe?g|gif|svg|txt)$/i];

export function checkNotes(body, files, knownIds) {
  const warnings = [];
  const notes = [];
  if (files && files.length && files.every((f) => NO_CODE.some((re) => re.test(f)))) {
    notes.push("Only docs or config changed: no engineering notes needed.");
    return { warnings, notes };
  }
  const text = (body || "").replace(/\r\n/g, "\n");
  const start = text.search(/^##\s+Engineering notes\s*$/im);
  if (start < 0) {
    warnings.push('The PR has no "Engineering notes" section. Copy it from the PR template (docs/engineering/FIELD_READY.md says what goes in it).');
    return { warnings, notes };
  }
  const after = text.slice(start).split("\n").slice(1);
  const endIdx = after.findIndex((l) => /^##\s+\S/.test(l) && !/^###/.test(l));
  const block = (endIdx < 0 ? after : after.slice(0, endIdx)).join("\n");
  const small = /^\s*[-*]\s*\[[xX]\]\s*Small fix/m.test(block);

  const sections = {};
  const re = /^###\s+(\d)\.\s*(.*)$/gm;
  const heads = [...block.matchAll(re)];
  heads.forEach((m, i) => {
    const from = m.index + m[0].length;
    const to = i + 1 < heads.length ? heads[i + 1].index : block.length;
    sections[m[1]] = { title: m[2].trim(), raw: block.slice(from, to) };
  });

  const required = small ? ["2", "6"] : ["1", "2", "3", "4", "5", "6", "7"];
  for (const n of required) {
    const s = sections[n];
    if (!s) {
      warnings.push(`Engineering notes: section ${n} is missing.`);
      continue;
    }
    if (!meaningful(s.raw)) warnings.push(`Engineering notes: section ${n} (${s.title}) is empty. Fill it, or write "n/a: why".`);
  }

  // Section 2: every outside piece needs proof (a link, a file:line, or a log).
  if (sections["2"]) {
    for (const row of tableRows(sections["2"].raw)) {
      const [piece, , proof = ""] = row;
      if (piece && !/(https?:\/\/|\w+\.\w+:\d+|log|man\s|source|docs?)/i.test(proof)) {
        warnings.push(`Engineering notes, section 2: "${piece}" has no proof (docs or source link, or a debug-run log). Without proof it is an open question, not a fact.`);
      }
    }
  }

  // Section 1 names the field conditions that apply; every FC ID cited anywhere must exist.
  if (!small && sections["1"] && meaningful(sections["1"].raw) && !/^\s*n\/a/im.test(strip(sections["1"].raw)) && !/FC-[A-Z]+-\d+/.test(strip(sections["1"].raw))) {
    warnings.push('Engineering notes, section 1: no field condition picked. Name the FIELD_CONDITIONS.md rows that apply (e.g. FC-NET-1), or write "n/a: why".');
  }
  for (const id of new Set(strip(block).match(/FC-[A-Z]+-\d+/g) || [])) {
    if (knownIds.size && !knownIds.has(id)) warnings.push(`Engineering notes: ${id} is not in FIELD_CONDITIONS.md. Add the row in this PR, or fix the ID.`);
  }
  if (small) notes.push("Marked as a small fix: checked sections 2 and 6 only.");
  return { warnings, notes };
}

function strip(s) {
  return s.replace(/<!--[\s\S]*?-->/g, "");
}
function tableRows(s) {
  return strip(s)
    .split("\n")
    .filter((l) => /^\s*\|/.test(l))
    .map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()))
    .filter((cells) => !cells.every((c) => /^:?-*:?$/.test(c)))
    .slice(1); // header row
}
function meaningful(raw) {
  const s = strip(raw);
  const rows = tableRows(raw).filter((cells) => cells.some((c) => c.length));
  const prose = s
    .split("\n")
    .filter((l) => !/^\s*\|/.test(l))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (/^n\/a\s*[:,-]?\s*\S.{3,}/i.test(prose)) return true;
  return rows.length > 0 || prose.length >= 20;
}

function knownFieldIds() {
  for (const p of [join(HERE, "..", "FIELD_CONDITIONS.md")]) {
    if (existsSync(p)) return new Set(readFileSync(p, "utf8").match(/^\|\s*(FC-[A-Z]+-\d+)/gm)?.map((m) => m.replace(/^\|\s*/, "")) || []);
  }
  return new Set();
}

function prFromEvent() {
  const p = process.env.GITHUB_EVENT_PATH;
  if (!p || !existsSync(p)) return null;
  const ev = JSON.parse(readFileSync(p, "utf8"));
  return ev.pull_request || null;
}

function changedFiles(pr) {
  if (opt("--files")) return readFileSync(opt("--files"), "utf8").split("\n").filter(Boolean);
  if (!pr) return null;
  try {
    return execFileSync("git", ["diff", "--name-only", `${pr.base.sha}...${pr.head.sha}`], { encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    return null; // shallow checkout: check the notes anyway
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const pr = prFromEvent();
  const body = opt("--body") ? readFileSync(opt("--body"), "utf8") : pr?.body;
  if (body == null && !pr) {
    console.log("No PR body given (use --body <file>). Nothing to check.");
    process.exit(0);
  }
  const { warnings, notes } = checkNotes(body, changedFiles(pr), knownFieldIds());
  for (const n of notes) console.log(n);
  for (const w of warnings) console.log(process.env.GITHUB_ACTIONS ? `::warning title=Field-ready::${w}` : `WARNING: ${w}`);
  if (!warnings.length) console.log("Engineering notes look complete.");
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = ["## Field-ready check (warns, never blocks)", ""];
    if (warnings.length) lines.push(...warnings.map((w) => `- ${w}`));
    else lines.push("Engineering notes look complete.");
    lines.push("", "How we build: `docs/engineering/FIELD_READY.md`.");
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
  }
  process.exit(0); // never blocks
}
