import type { Metadata } from "next";
import { SearchX, StickyNote } from "lucide-react";
import Link from "next/link";
import { NewNoteButton } from "@/components/notes/new-note-button";
import { NoteCard } from "@/components/notes/note-card";
import { NotesSearch } from "@/components/notes/notes-search";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { buildUrl, first, type RawSearchParams } from "@/lib/search-params";
import { listGoals } from "@/modules/goals/service";
import { noteListQuerySchema } from "@/modules/notes/schema";
import { listNotes } from "@/modules/notes/service";
import { listCategoriesOfType } from "@/modules/settings/service";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const clock = await getClock(user.id);
  const query = noteListQuerySchema.parse({ q: first(sp.q), categoryId: first(sp.categoryId), tag: first(sp.tag), page: first(sp.page) });

  const [result, categories, goals] = await Promise.all([listNotes(ctx, query), listCategoriesOfType(ctx, "NOTE"), listGoals(ctx, clock.today)]);
  const goalOptions = goals.map((g) => ({ id: g.id, name: g.name }));
  const filtered = Boolean(query.q || query.categoryId || query.tag);
  const newButton = <NewNoteButton categories={categories} goals={goalOptions} />;

  return (
    <>
      <PageHeader title="Notes" description="Ideas and context, linked to the work they belong to." actions={newButton} />
      <div className="space-y-4">
        <NotesSearch categories={categories} tags={result.allTags} />
        {result.items.length === 0 ? (
          <Card>
            {filtered ? (
              <EmptyState icon={SearchX} title="No notes match your search" description="Try different words, or clear the filters." action={<Link href="/notes" className={buttonVariants({ variant: "outline" })}>Clear filters</Link>} />
            ) : (
              <EmptyState icon={StickyNote} title="No notes yet" description="Capture an idea, a meeting summary, or context for a goal." action={<NewNoteButton categories={categories} goals={goalOptions}>Add your first note</NewNoteButton>} />
            )}
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {result.items.map((n) => (
              <NoteCard key={n.id} note={n} categories={categories} goals={goalOptions} />
            ))}
          </div>
        )}
        <Pagination page={result.page} pageSize={result.pageSize} total={result.total} hrefFor={(p) => buildUrl("/notes", { q: query.q, categoryId: query.categoryId, tag: query.tag, page: p })} />
      </div>
    </>
  );
}
