import type { BackupServicePort } from "./backup.js";
import type { AuditEventPort } from "./events.js";
import type { MetadataRepositoryPort } from "./metadata.js";
import type {
  AuditEventRepositoryPort,
  PostRepositoryPort,
  RelationRepositoryPort,
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
  relations: RelationRepositoryPort;
  readReceipts: ReadReceiptRepositoryPort;
  metadata: MetadataRepositoryPort;
  events: AuditEventPort;
  backups: BackupServicePort;
  clock: ClockPort;
  ids: IdGeneratorPort;
  availableReactions: string[];
  availableRelationTypes: string[];
}
