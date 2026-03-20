import type { ReadReceiptRecord } from "@/domain/read-receipt.js";

export interface ReadReceiptRepositoryPort {
  markRead(session: string, postIds: string[], readAt?: string): void;
  allReadReceipts(): ReadReceiptRecord[];
}
