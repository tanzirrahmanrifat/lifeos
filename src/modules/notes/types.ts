export interface NoteDTO {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  goalId: string | null;
  goalName: string | null;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteListResult {
  items: NoteDTO[];
  total: number;
  page: number;
  pageSize: number;
  allTags: string[];
}
