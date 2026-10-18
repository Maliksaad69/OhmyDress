import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const NOTIFIED_FILE = path.join(DATA_DIR, "notified-sessions.json");

function ensureDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {
      // Ignore if exists
    }
  }
}

function loadNotifiedSet(): Set<string> {
  ensureDirectoryExists();
  if (!fs.existsSync(NOTIFIED_FILE)) {
    return new Set<string>();
  }
  try {
    const raw = fs.readFileSync(NOTIFIED_FILE, "utf-8");
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set<string>();
  }
}

function saveNotifiedSet(set: Set<string>) {
  ensureDirectoryExists();
  try {
    const arr = Array.from(set);
    fs.writeFileSync(NOTIFIED_FILE, JSON.stringify(arr, null, 2), "utf-8");
  } catch (err) {
    console.error("Impossible de sauvegarder notified-sessions.json:", err);
  }
}

export function hasBeenNotified(sessionId: string): boolean {
  if (!sessionId) return false;
  const set = loadNotifiedSet();
  return set.has(sessionId);
}

export function markAsNotified(sessionId: string): void {
  if (!sessionId) return;
  const set = loadNotifiedSet();
  set.add(sessionId);
  saveNotifiedSet(set);
}
