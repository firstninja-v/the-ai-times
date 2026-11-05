import type { NewspaperEdition, NewsArticle } from "@/lib/types";

function StoryCard({ article, compact = false }: { article: NewsArticle; compact?: boolean }) {
  return (
    <article className={`edition-card ${compact ? "edition-card-compact" : ""}`}>
      <p className="edition-kicker">
        {article.breaking ? "Breaking · " : ""}
        {article.category}
      </p>
      <h3>
        <a href={article.url} target="_blank" rel="noreferrer">
          {article.title}
        </a>
      </h3>
      <p className="edition-body">{article.summary}</p>
      <p className="edition-source">{article.source}</p>
    </article>
  );
}

export function EditionView({ edition }: { edition: NewspaperEdition }) {
  const bw = edition.colorMode === "bw";

  return (
    <div className={`edition-stack mx-auto w-full max-w-[210mm] ${bw ? "edition-bw" : ""}`}>
      {edition.pages.map((page) => {
        const lead = page.sections.find((s) => s.layout === "lead")?.articles[0];
        const columns = page.sections.filter((s) => s.layout === "column").flatMap((s) => s.articles);
        const briefs = page.sections.filter((s) => s.layout === "brief").flatMap((s) => s.articles);

        return (
          <article key={page.number} className="edition-page paper-sheet">
            <header className="edition-mast">
              <p className="edition-vol">The AI Times · Vol. I</p>
              <h1>{edition.paperTitle}</h1>
              <div className="edition-meta">
                <span>{edition.dateLabel}</span>
                <span>
                  Page {page.number} / {edition.pages.length} · A4
                </span>
                <span>{bw ? "Black & white" : "Color"}</span>
              </div>
            </header>

            {lead ? (
              <div className="edition-lead">
                <div>
                  <p className="edition-kicker">
                    {lead.breaking ? "Breaking · " : ""}
                    {lead.category}
                  </p>
                  <h2>
                    <a href={lead.url} target="_blank" rel="noreferrer">
                      {lead.title}
                    </a>
                  </h2>
                  <p className="edition-body edition-body-lead">{lead.summary}</p>
                  <p className="edition-source">{lead.source}</p>
                </div>
              </div>
            ) : null}

            {columns.length ? (
              <div className="edition-pack">
                {columns.map((article) => (
                  <StoryCard key={article.id} article={article} />
                ))}
              </div>
            ) : null}

            {briefs.length ? (
              <div className="edition-rail">
                {briefs.map((article) => (
                  <StoryCard key={article.id} article={article} compact />
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
