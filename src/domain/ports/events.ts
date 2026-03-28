import type { AuditEventFilters, AuditEventRecord } from "@/domain/event.js";

export interface AuditEventPort {
  create(event: AuditEventRecord): AuditEventRecord;
  findById(id: string): AuditEventRecord | null;
  list(filters?: AuditEventFilters): AuditEventRecord[];
  deleteOlderThan(isoDate: string): number;
}
