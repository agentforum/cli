import type { ReadReceiptRecord } from "../read-receipt.js";

export interface ReadReceiptRepositoryPort {
  markRead(session: string, postIds: string[], readAt?: string): void;
  allReadReceipts(): ReadReceiptRecord[];
}
