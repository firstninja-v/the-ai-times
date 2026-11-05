import type { NewspaperEdition } from "@/lib/types";

export function EditionView({ edition }: { edition: NewspaperEdition }) {
  const bw = edition.colorMode === "bw";

  return (
    <div className={`mx-auto flex w-full max-w-5xl flex-col gap-8 ${bw ? "edition-bw" : ""}`}>
      {edition.pages.map((page) => (
        <article
          key={page.number}
          className="edition-page paper-sheet relative overflow-hidden px-6 py-8 sm:px-10 sm:py-12"
        >
          <header className="mb-6 text-center">
            <p className="font-ui text-[11px] uppercase tracking-[0.28em] text-masthead">
              The AI Times · Vol. I
            </p>
            <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-ink sm:text-6xl">
              {edition.paperTitle}
            </h1>
            <div className="ink-rule-thick mx-auto mt-4 w-full origin-center animate-draw" />
            <div className="mt-3 flex items-center justify-between gap-4 font-ui text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
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
                  <h2 className="font-ui mb-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    {section.heading}
                  </h2>
                ) : null}

                {section.layout === "lead" ? (
                  <div className="grid gap-6 border-b border-rule pb-8 md:grid-cols-[1.4fr_1fr]">
                    {section.articles.map((article) => (
                      <div key={article.id} className="md:col-span-2">
                        <p className="font-ui text-[11px] uppercase tracking-[0.18em] text-masthead">
                          {article.breaking ? "Breaking · " : ""}
                          {article.category}
                        </p>
                        <h3 className="font-display mt-2 text-3xl font-semibold leading-tight text-ink sm:text-5xl">
                          <a href={article.url} target="_blank" rel="noreferrer" className="hover:underline">
                            {article.title}
                          </a>
                        </h3>
                        <p className="font-display mt-4 max-w-3xl text-lg leading-relaxed text-ink/80">
                          {article.summary}
                        </p>
                        <p className="font-ui mt-3 text-xs text-muted-foreground">{article.source}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="columns-1 gap-8 sm:columns-2">
                    {section.articles.map((article) => (
                      <div key={article.id} className="mb-6 break-inside-avoid border-t border-rule pt-4">
                        <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {article.category}
                        </p>
                        <h3 className="font-display mt-1 text-xl font-semibold leading-snug text-ink">
                          <a href={article.url} target="_blank" rel="noreferrer" className="hover:underline">
                            {article.title}
                          </a>
                        </h3>
                        <p className="font-display mt-2 text-[15px] leading-relaxed text-ink/75">
                          {article.summary}
                        </p>
                        <p className="font-ui mt-2 text-[11px] text-muted-foreground">{article.source}</p>
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
