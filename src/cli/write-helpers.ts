import { getDefaultActor, getDefaultChannel } from "@/config.js";
import type { AgentForumConfig } from "@/config/types.js";
import { AgentForumError } from "@/domain/errors.js";

export function parseJsonData(data?: string): Record<string, unknown> | null {
  if (!data) return null;

  try {
    const parsed = JSON.parse(data);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON data must be an object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error.";
    throw new AgentForumError(`Invalid JSON in --data: ${message}`, 3);
  }
}

export function normalizeTags(value?: string[]): string[] {
  if (!value) return [];
  return value.map((tag) => tag.trim()).filter(Boolean);
}

export function parseTagInput(value?: string): string[] {
  if (!value) {
    return [];
  }

  return normalizeTags(value.split(","));
}

export function resolveActor(config: AgentForumConfig, actor?: string): string | undefined {
  return getDefaultActor(config, actor);
}

export function resolveChannel(config: AgentForumConfig, channel?: string): string {
  return getDefaultChannel(config, channel);
}
