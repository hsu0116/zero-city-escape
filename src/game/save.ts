import type { ScanSlot } from "./p01";

export type GamePhase = "landing" | "intro" | "investigation" | "projection" | "success";

export type SavedGame = {
  phase: GamePhase;
  activeEvidence: "receipts" | "deeds" | "ledger" | "manual";
  viewedEvidence: string[];
  scanSlots: ScanSlot[];
  wordInput: string;
  attempts: number;
  hintsOpened: number;
  updatedAt: number;
};

const DB_NAME = "zero-city-escape";
const STORE_NAME = "game-saves";
const SAVE_KEY = "episode-01-p01-hard-v2";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadGame(): Promise<SavedGame | null> {
  if (!("indexedDB" in window)) return null;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(SAVE_KEY);
    request.onsuccess = () => resolve((request.result as SavedGame | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function saveGame(game: SavedGame): Promise<void> {
  if (!("indexedDB" in window)) return;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(game, SAVE_KEY);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearGame(): Promise<void> {
  if (!("indexedDB" in window)) return;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(SAVE_KEY);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}
