import fs from "fs";
import path from "path";
import os from "os";

// In-memory set for fast local lookups within the same process instance
const memoryNotified = new Set<string>();

// Store fallback in os.tmpdir() (/tmp) which is always writable in serverless/Vercel
const NOTIFIED_FILE = path.join(os.tmpdir(), "omd-notified-sessions.json");

function loadNotifiedSet(): Set<string> {
  if (fs.existsSync(NOTIFIED_FILE)) {
    try {
      const raw = fs.readFileSync(NOTIFIED_FILE, "utf-8");
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const id of arr) {
          if (typeof id === "string") memoryNotified.add(id);
        }
      }
    } catch {
      // Ignore read errors
    }
  }
  return memoryNotified;
}

function saveNotifiedSet(set: Set<string>) {
  try {
    const arr = Array.from(set);
    fs.writeFileSync(NOTIFIED_FILE, JSON.stringify(arr, null, 2), "utf-8");
  } catch {
    // Ignore write errors in serverless
  }
}

export function hasBeenNotified(sessionId: string): boolean {
  if (!sessionId) return false;
  if (memoryNotified.has(sessionId)) return true;
  const set = loadNotifiedSet();
  return set.has(sessionId);
}

export function markAsNotified(sessionId: string): void {
  if (!sessionId) return;
  memoryNotified.add(sessionId);
  saveNotifiedSet(memoryNotified);
}
