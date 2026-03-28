import { afterEach, describe, expect, it } from "vitest";

import type { AgentForumConfig } from "@/domain/types.js";
import { AgentForumError } from "@/domain/errors.js";
import { AuditEventRepository } from "@/store/repositories/event.repo.js";
import { getSqlite } from "@/store/db.js";
import { cleanupTestConfig, createTestConfig } from "../test-helpers.js";

let config: AgentForumConfig | undefined;

afterEach(() => {
  if (config) {
    cleanupTestConfig(config);
    config = undefined;
  }
});

describe("AuditEventRepository", () => {
  it("accepts valid payloads for all supported event types", () => {
    config = createTestConfig();
    const repo = new AuditEventRepository(config);

    repo.create({
      id: "E-post-created",
      eventType: "post.created",
      postId: "P1",
      replyId: null,
      relationId: null,
      reactionId: null,
      actor: "claude:test",
      session: "run-1",
      payload: {
        channel: "general",
        type: "note",
        status: "open",
        severity: null,
        assignedTo: null,
        title: "title",
        refId: null,
        extra: "ok",
      } as never,
      createdAt: "2026-03-27T12:00:00.000Z",
    });
    repo.create({
      id: "E-post-replied",
      eventType: "post.replied",
      postId: "P1",
      replyId: "R1",
      relationId: null,
      reactionId: null,
      actor: "claude:test",
      session: "run-1",
      payload: { body: "body", status: "answered", extra: true } as never,
      createdAt: "2026-03-27T12:00:01.000Z",
    });
    repo.create({
      id: "E-post-assigned",
      eventType: "post.assigned",
      postId: "P1",
      replyId: null,
      relationId: null,
      reactionId: null,
      actor: "claude:test",
      session: "run-1",
      payload: { assignedTo: "claude:test", previousAssignedTo: null } as never,
      createdAt: "2026-03-27T12:00:02.000Z",
    });
    repo.create({
      id: "E-post-resolved",
      eventType: "post.resolved",
      postId: "P1",
      replyId: null,
      relationId: null,
      reactionId: null,
      actor: "claude:test",
      session: "run-1",
      payload: { status: "stale", reason: "done" },
      createdAt: "2026-03-27T12:00:03.000Z",
    });
    repo.create({
      id: "E-relation-created",
      eventType: "relation.created",
      postId: "P1",
      replyId: null,
      relationId: "RL1",
      reactionId: null,
      actor: "claude:test",
      session: "run-1",
      payload: { toPostId: "P2", relationType: "blocks" },
      createdAt: "2026-03-27T12:00:04.000Z",
    });
    repo.create({
      id: "E-reaction-created",
      eventType: "reaction.created",
      postId: "P1",
      replyId: null,
      relationId: null,
      reactionId: "RX1",
      actor: "claude:test",
      session: "run-1",
      payload: { targetType: "post", targetId: "P1", reaction: "confirmed" },
      createdAt: "2026-03-27T12:00:05.000Z",
    });

    expect(repo.list()).toHaveLength(6);
  });

  it("preserves extra payload fields for forward-compatible event readers", () => {
    config = createTestConfig();
    const repo = new AuditEventRepository(config);

    repo.create({
      id: "E-forward-compatible",
      eventType: "post.assigned",
      postId: "P1",
      replyId: null,
      relationId: null,
      reactionId: null,
      actor: "claude:test",
      session: "run-compat",
      payload: {
        assignedTo: "claude:backend",
        previousAssignedTo: "claude:triage",
        handoffReason: "needs backend ownership",
      } as never,
      createdAt: "2026-03-27T12:10:00.000Z",
    });

    const stored = repo.list()[0];
    expect(stored?.payload).toMatchObject({
      assignedTo: "claude:backend",
      previousAssignedTo: "claude:triage",
      handoffReason: "needs backend ownership",
    });
  });

  it("rejects invalid payloads on create", () => {
    config = createTestConfig();
    const repo = new AuditEventRepository(config);

    expect(() =>
      repo.create({
        id: "E-invalid-create",
        eventType: "post.created",
        postId: "P1",
        replyId: null,
        relationId: null,
        reactionId: null,
        actor: "claude:test",
        session: "run-1",
        payload: { title: "missing required fields" } as never,
        createdAt: "2026-03-27T12:00:00.000Z",
      })
    ).toThrowError(AgentForumError);
  });

  it("rejects invalid payloads already stored in the audit log", () => {
    config = createTestConfig();
    const db = getSqlite(config);
    db.prepare(
      `INSERT INTO audit_events (
        id, event_type, post_id, reply_id, relation_id, reaction_id, actor, session, payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "E-invalid-read",
      "post.replied",
      "P1",
      "R1",
      null,
      null,
      "claude:test",
      "run-1",
      JSON.stringify({ nope: true }),
      "2026-03-27T12:00:00.000Z"
    );

    const repo = new AuditEventRepository(config);
    expect(() => repo.list()).toThrowError(/Invalid payload stored for audit event E-invalid-read/);
  });

  it("lists events after a cursor even when timestamps are identical", () => {
    config = createTestConfig();
    const repo = new AuditEventRepository(config);
    const createdAt = "2026-03-27T12:00:00.000Z";

    repo.create({
      id: "E-001",
      eventType: "post.created",
      postId: "P1",
      replyId: null,
      relationId: null,
      reactionId: null,
      actor: "claude:test",
      session: "run-1",
      payload: {
        channel: "general",
        type: "note",
        status: "open",
        severity: null,
        assignedTo: null,
        title: "first",
        refId: null,
      },
      createdAt,
    });
    repo.create({
      id: "E-002",
      eventType: "post.created",
      postId: "P2",
      replyId: null,
      relationId: null,
      reactionId: null,
      actor: "claude:test",
      session: "run-1",
      payload: {
        channel: "general",
        type: "note",
        status: "open",
        severity: null,
        assignedTo: null,
        title: "second",
        refId: null,
      },
      createdAt,
    });

    const events = repo.list({ afterId: "E-001" });
    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe("E-002");
  });
});
