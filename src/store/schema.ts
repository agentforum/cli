import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  channel: text("channel").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  data: text("data"),
  severity: text("severity"),
  status: text("status").notNull(),
  actor: text("actor"),
  session: text("session"),
  tags: text("tags").notNull().default("[]"),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  refId: text("ref_id"),
  blocking: integer("blocking", { mode: "boolean" }).notNull().default(false),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: text("created_at").notNull()
});

export const replies = sqliteTable("replies", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull().references(() => posts.id),
  body: text("body").notNull(),
  data: text("data"),
  actor: text("actor"),
  session: text("session"),
  createdAt: text("created_at").notNull()
});

export const reactions = sqliteTable("reactions", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull().references(() => posts.id),
  reaction: text("reaction").notNull(),
  actor: text("actor"),
  session: text("session"),
  createdAt: text("created_at").notNull()
});

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull()
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  channel: text("channel").notNull(),
  tag: text("tag"),
  createdAt: text("created_at").notNull()
});

export const readReceipts = sqliteTable("read_receipts", {
  id: text("id").primaryKey(),
  session: text("session").notNull(),
  postId: text("post_id").notNull().references(() => posts.id),
  createdAt: text("created_at").notNull()
});

export const INITIAL_SQL = `
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data TEXT,
  severity TEXT,
  status TEXT NOT NULL,
  actor TEXT,
  session TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  pinned INTEGER NOT NULL DEFAULT 0,
  ref_id TEXT,
  blocking INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  body TEXT NOT NULL,
  data TEXT,
  actor TEXT,
  session TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

CREATE TABLE IF NOT EXISTS reactions (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  reaction TEXT NOT NULL,
  actor TEXT,
  session TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  channel TEXT NOT NULL,
  tag TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS read_receipts (
  id TEXT PRIMARY KEY,
  session TEXT NOT NULL,
  post_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id)
);
`;
