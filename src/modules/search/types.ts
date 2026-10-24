export type SearchKind = "task" | "client" | "project" | "invoice" | "transaction" | "goal" | "financial-goal" | "habit" | "note";

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

export interface SearchGroup {
  kind: SearchKind;
  label: string;
  results: SearchResult[];
}
