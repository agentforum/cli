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
  assignedTo: text("assigned_to"),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: text("created_at").notNull(),
});

export const replies = sqliteTable("replies", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id),
  body: text("body").notNull(),
  data: text("data"),
  actor: text("actor"),
  session: text("session"),
  createdAt: text("created_at").notNull(),
});

export const reactions = sqliteTable("reactions", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id),
  targetType: text("target_type").notNull().default("post"),
  targetId: text("target_id").notNull(),
  reaction: text("reaction").notNull(),
  actor: text("actor"),
  session: text("session"),
  createdAt: text("created_at").notNull(),
});

export const postRelations = sqliteTable("post_relations", {
  id: text("id").primaryKey(),
  fromPostId: text("from_post_id")
    .notNull()
    .references(() => posts.id),
  toPostId: text("to_post_id")
    .notNull()
    .references(() => posts.id),
  relationType: text("relation_type").notNull(),
  actor: text("actor"),
  session: text("session"),
  createdAt: text("created_at").notNull(),
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  postId: text("post_id"),
  replyId: text("reply_id"),
  relationId: text("relation_id"),
  reactionId: text("reaction_id"),
  actor: text("actor"),
  session: text("session"),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
});

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const integrationOperations = sqliteTable("integration_operations", {
  integrationId: text("integration_id").notNull(),
  operationKey: text("operation_key").notNull(),
  action: text("action").notNull(),
  requestJson: text("request_json").notNull(),
  resultJson: text("result_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const integrationCursors = sqliteTable("integration_cursors", {
  integrationId: text("integration_id").notNull(),
  consumerKey: text("consumer_key").notNull(),
  lastEventId: text("last_event_id").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  channel: text("channel").notNull(),
  tag: text("tag"),
  createdAt: text("created_at").notNull(),
});

export const readReceipts = sqliteTable("read_receipts", {
  id: text("id").primaryKey(),
  session: text("session").notNull(),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id),
  createdAt: text("created_at").notNull(),
  lastReadAt: text("last_read_at").notNull(),
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
  assigned_to TEXT,
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
  target_type TEXT NOT NULL DEFAULT 'post',
  target_id TEXT NOT NULL,
  reaction TEXT NOT NULL,
  actor TEXT,
  session TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

CREATE TABLE IF NOT EXISTS post_relations (
  id TEXT PRIMARY KEY,
  from_post_id TEXT NOT NULL,
  to_post_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  actor TEXT,
  session TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (from_post_id) REFERENCES posts(id),
  FOREIGN KEY (to_post_id) REFERENCES posts(id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  post_id TEXT,
  reply_id TEXT,
  relation_id TEXT,
  reaction_id TEXT,
  actor TEXT,
  session TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integration_operations (
  integration_id TEXT NOT NULL,
  operation_key TEXT NOT NULL,
  action TEXT NOT NULL,
  request_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (integration_id, operation_key)
);

CREATE TABLE IF NOT EXISTS integration_cursors (
  integration_id TEXT NOT NULL,
  consumer_key TEXT NOT NULL,
  last_event_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (integration_id, consumer_key)
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
  last_read_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id)
);
`;
