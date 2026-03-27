import type { RelationCatalogEntry } from "./relation.js";

export interface TypeTemplateRecord {
  type: string;
  template: string;
}

export interface PresetRecord {
  id: string;
  title: string;
  description: string;
  typeOrder: string[];
  typeTemplates: Record<string, string>;
  reactions?: string[];
  relationTypes?: RelationCatalogEntry[];
}
