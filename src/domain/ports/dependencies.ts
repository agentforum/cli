import type { BackupServicePort } from "./backup.js";
import type { MetadataRepositoryPort } from "./metadata.js";
import type {
  PostRepositoryPort,
  ReactionRepositoryPort,
  ReplyRepositoryPort,
  SubscriptionRepositoryPort,
} from "./repositories.js";
import type { ReadReceiptRepositoryPort } from "./read-receipts.js";
import type { ClockPort, IdGeneratorPort } from "./system.js";

export interface DomainDependencies {
  posts: PostRepositoryPort;
  replies: ReplyRepositoryPort;
  reactions: ReactionRepositoryPort;
  subscriptions: SubscriptionRepositoryPort;
  readReceipts: ReadReceiptRepositoryPort;
  metadata: MetadataRepositoryPort;
  backups: BackupServicePort;
  clock: ClockPort;
  ids: IdGeneratorPort;
}
