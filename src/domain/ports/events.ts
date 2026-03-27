import type { AuditEventFilters, AuditEventRecord } from "@/domain/event.js";

export interface AuditEventPort {
  create(event: AuditEventRecord): AuditEventRecord;
  list(filters?: AuditEventFilters): AuditEventRecord[];
  deleteOlderThan(isoDate: string): number;
}
