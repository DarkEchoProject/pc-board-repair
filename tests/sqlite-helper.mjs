import { DatabaseSync } from "node:sqlite";

export function makeStorage() {
  const db = new DatabaseSync(":memory:"), kv = new Map();
  const ctx = { storage: {
    sql: { exec(query, ...args) {
      const stmt = db.prepare(query), values = args.map(v => v instanceof ArrayBuffer ? new Uint8Array(v) : v);
      const rows = stmt.columns().length ? stmt.all(...values) : (stmt.run(...values), []);
      return { toArray: () => rows, one: () => rows[0], [Symbol.iterator]: () => rows[Symbol.iterator]() };
    } },
    transactionSync(fn) { db.exec("BEGIN"); try { const result = fn(); db.exec("COMMIT"); return result; } catch (error) { db.exec("ROLLBACK"); throw error; } },
    get: async key => kv.get(key), put: async (key, value) => { kv.set(key, value); },
  } };
  return { db, ctx };
}
