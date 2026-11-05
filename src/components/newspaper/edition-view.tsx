import type { NewspaperEdition } from "@/lib/types";

export function EditionView({ edition }: { edition: NewspaperEdition }) {
  const bw = edition.colorMode === "bw";

  return (
    <div className={`mx-auto flex w-full max-w-5xl flex-col gap-8 ${bw ? "edition-bw" : ""}`}>
      {edition.pages.map((page) => (
        <article
          key={page.number}
          className="edition-page paper-sheet relative overflow-hidden rounded-[4px] px-6 py-8 sm:px-11 sm:py-12"
        >
          <header className="mb-7 text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[hsl(var(--masthead))]">
              The AI Times · Vol. I
            </p>
            <h1 className="font-display mt-2 text-[clamp(2.2rem,6vw,3.6rem)] font-semibold tracking-[-0.03em] text-[hsl(var(--ink))]">
              {edition.paperTitle}
            </h1>
            <div className="ink-rule-thick mx-auto mt-4 w-full" />
            <div className="mt-3 flex items-center justify-between gap-4 text-[11px] font-medium uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
              <span>{edition.dateLabel}</span>
              <span>
                Page {page.number} of {edition.pages.length}
              </span>
              <span>{bw ? "Black & white" : "Color"}</span>
            </div>
            <div className="ink-rule mt-3 w-full" />
          </header>

          <div className="space-y-8">
            {page.sections.map((section, sectionIndex) => (
              <section key={`${page.number}-${sectionIndex}`}>
                {section.heading ? (
                  <h2 className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
                    {section.heading}
                  </h2>
                ) : null}

                {section.layout === "lead" ? (
                  <div className="border-b border-[hsl(var(--rule))] pb-8">
                    {section.articles.map((article) => (
                      <div key={article.id}>
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--masthead))]">
                          {article.breaking ? "Breaking · " : ""}
                          {article.category}
                        </p>
                        <h3 className="font-display mt-2 text-[clamp(1.8rem,4vw,2.8rem)] font-semibold leading-[1.08] tracking-[-0.025em] text-[hsl(var(--ink))]">
                          <a href={article.url} target="_blank" rel="noreferrer" className="hover:underline">
                            {article.title}
                          </a>
                        </h3>
                        <p className="font-display mt-4 max-w-3xl text-[18px] leading-relaxed text-[hsl(var(--ink))]/80">
                          {article.summary}
                        </p>
                        <p className="mt-3 text-[12px] text-[hsl(var(--muted-foreground))]">{article.source}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="columns-1 gap-8 sm:columns-2">
                    {section.articles.map((article) => (
                      <div
                        key={article.id}
                        className="mb-6 break-inside-avoid border-t border-[hsl(var(--rule))] pt-4"
                      >
                        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                          {article.category}
                        </p>
                        <h3 className="font-display mt-1 text-[1.25rem] font-semibold leading-snug tracking-[-0.02em] text-[hsl(var(--ink))]">
                          <a href={article.url} target="_blank" rel="noreferrer" className="hover:underline">
                            {article.title}
                          </a>
                        </h3>
                        <p className="font-display mt-2 text-[15px] leading-relaxed text-[hsl(var(--ink))]/75">
                          {article.summary}
                        </p>
                        <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">{article.source}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
