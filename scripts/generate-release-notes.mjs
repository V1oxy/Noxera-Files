#!/usr/bin/env node
// Builds the "What's new" release body for a tagged release, straight from
// commit subjects since the previous tag - so cutting a release never
// requires hand-writing a changelog. Runs in CI right before tauri-action
// creates the GitHub Release; its output becomes that release's body, which
// tauri-action also copies into latest.json's "notes" field - the same text
// the in-app updater already downloads during its normal update check. The
// app parses this exact heading structure back out at runtime (see
// src/utils/whatsNew.ts) to show a compact "What's new" popup after update.
//
// Never throws: any failure just yields an empty body, so a bad commit
// message can't break the release build.

import { execFileSync } from "node:child_process";

const SECTION_HEADINGS = {
  added: "Added",
  fixed: "Fixed",
  improved: "Improved",
};

// Matches this repo's actual commit style (plain imperative subjects, not
// strict Conventional Commits) - a leading verb decides the bucket. A
// "type:" prefix is also recognized in case that convention gets adopted
// later; it costs nothing to support both.
const SKIP = /^(ci|chore|docs|test|build|style|merge|revert|release|wip|bump version)\b[:(]?/i;
const ADDED = /^(feat|add|introduce|implement)\b[:(]?/i;
const FIXED = /^fix\b[:(]?/i;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function semverParts(tag) {
  const m = tag.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}

function compareSemver(a, b) {
  const [a1, a2, a3] = semverParts(a);
  const [b1, b2, b3] = semverParts(b);
  return a1 - b1 || a2 - b2 || a3 - b3;
}

function findPreviousTag(currentTag) {
  const tags = git(["tag", "-l", "v*"])
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => t && t !== currentTag)
    .sort(compareSemver);
  const before = tags.filter((t) => compareSemver(t, currentTag) < 0);
  return before.length > 0 ? before[before.length - 1] : null;
}

function cleanSubject(subject) {
  return subject.replace(/^\w+(\([\w-]+\))?!?:\s*/, "").trim();
}

function capitalize(s) {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

function categorize(subject) {
  if (SKIP.test(subject)) return null;
  if (FIXED.test(subject)) return "fixed";
  if (ADDED.test(subject)) return "added";
  return "improved";
}

function buildBody(currentTag) {
  const prevTag = findPreviousTag(currentTag);
  if (!prevTag) return ""; // first-ever release: nothing to diff against

  const range = `${prevTag}..${currentTag}`;
  const log = git(["log", range, "--no-merges", "--pretty=%s"]);
  if (!log) return "";

  const buckets = { added: [], fixed: [], improved: [] };
  for (const subject of log.split("\n").filter(Boolean)) {
    const bucket = categorize(subject);
    if (!bucket) continue;
    buckets[bucket].push(capitalize(cleanSubject(subject)));
  }

  const sections = [];
  for (const key of ["added", "fixed", "improved"]) {
    if (buckets[key].length === 0) continue;
    sections.push(`### ${SECTION_HEADINGS[key]}\n${buckets[key].map((line) => `- ${line}`).join("\n")}`);
  }
  return sections.join("\n\n");
}

function emitGithubOutput(name, value) {
  const delimiter = `WHATS_NEW_${Date.now()}`;
  process.stdout.write(`${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

function main() {
  const currentTag = process.env.GITHUB_REF_NAME ?? "";
  let body = "";
  try {
    if (currentTag) body = buildBody(currentTag);
  } catch (e) {
    console.error("generate-release-notes: falling back to an empty body:", e);
    body = "";
  }
  emitGithubOutput("body", body);
}

main();
