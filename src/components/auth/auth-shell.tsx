import { Brand } from "@/components/layout/brand";

const CHAIN = [
  { title: "Client", note: "who you work for" },
  { title: "Project", note: "what you're delivering" },
  { title: "Invoice", note: "what you're owed" },
  { title: "Payment", note: "what arrives" },
  { title: "Account", note: "where it lands" },
  { title: "Goal", note: "what it's for" },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0f2a26] p-12 text-[#e6f4f0] lg:flex">
        <Brand href="/" />
        <div>
          <h2 className="max-w-md text-4xl font-semibold leading-[1.1] tracking-tight">One ledger for your work and your life.</h2>
          <ol className="mt-10 space-y-0">
            {CHAIN.map((step, i) => (
              <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
                {i < CHAIN.length - 1 && <span aria-hidden className="absolute left-[7px] top-4 h-full w-px bg-[#3cc2a6]/40" />}
                <span aria-hidden className="relative mt-1 size-[15px] shrink-0 rounded-full border-2 border-[#3cc2a6] bg-[#0f2a26]" />
                <p>
                  <span className="font-medium">{step.title}</span>
                  <span className="text-[#9fc9be]"> — {step.note}</span>
                </p>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-sm text-[#9fc9be]">Every record links to the next, so the dashboard is always the whole picture.</p>
      </aside>

      <main className="flex flex-col px-5 py-8 pt-[max(2rem,env(safe-area-inset-top))] sm:px-10">
        <div className="lg:hidden">
          <Brand href="/" />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
