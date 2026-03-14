export interface MetadataRepositoryPort {
  setMeta(key: string, value: string): void;
  getMeta(key: string): string | null;
  allMeta(): Record<string, string>;
}
