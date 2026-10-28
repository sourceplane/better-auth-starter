import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

// The Worker's bindings for the app's server modules, over real engines where
// one exists: D1 over node:sqlite (D1's engine) with packages/db's migrations
// applied, KV and R2 over Maps.
type Row = Record<string, unknown>;
export interface Sqlite {
  exec(sql: string): void;
  prepare(sql: string): { all(...params: unknown[]): Row[]; run(...params: unknown[]): unknown };
}
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (file: string) => Sqlite;
};
const migrationsDir = path.resolve(__dirname, "../../../../packages/db/src/migrations");
export const MIGRATIONS = ["010_auth", "020_app_secrets"];

export function sqlite(names = MIGRATIONS): Sqlite {
  const db = new DatabaseSync(":memory:");
  for (const name of names) db.exec(readFileSync(path.join(migrationsDir, name, "up.sql"), "utf8"));
  return db;
}

/** The D1 binding's shape (prepare → bind → first/all/run) over a SQLite database. */
export function d1(db: Sqlite) {
  const statement = (sql: string, params: unknown[] = []) => ({
    bind: (...values: unknown[]) => statement(sql, values),
    async first<T>() {
      return (db.prepare(sql).all(...params)[0] as T | undefined) ?? null;
    },
    async all<T>() {
      return { results: db.prepare(sql).all(...params).map((r) => ({ ...r })) as T[] };
    },
    async run() {
      db.prepare(sql).run(...params);
      return { success: true };
    },
  });
  return { prepare: (sql: string) => statement(sql) };
}

/** KV's get/put over a Map. */
export function kv() {
  const values = new Map<string, string>();
  const reads: string[] = [];
  return {
    values,
    reads,
    async get(key: string) {
      reads.push(key);
      return values.get(key) ?? null;
    },
    async put(key: string, value: string) {
      values.set(key, value);
    },
  };
}

/** R2's head/get/put over a Map. */
export function r2() {
  const objects = new Map<string, Uint8Array>();
  const heads: string[] = [];
  return {
    objects,
    heads,
    async head(key: string) {
      heads.push(key);
      return objects.has(key) ? { key, size: objects.get(key)!.byteLength } : null;
    },
    async put(key: string, body: ArrayBuffer) {
      objects.set(key, new Uint8Array(body));
    },
  };
}

/** A binding that throws on every call, as one missing from the config does. */
export function broken(what: string) {
  return new Proxy(
    {},
    {
      get: () => () => {
        throw new Error(`${what} is not bound`);
      },
    },
  );
}
