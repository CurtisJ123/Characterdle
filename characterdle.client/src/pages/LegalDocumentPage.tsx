import { getLegalDocument } from '../data/legalDocuments';
import type { NavigateToPage, Page } from '../types/routes';

interface LegalDocumentPageProps {
  onNavigate: NavigateToPage;
  page: Extract<Page, 'privacyPolicy' | 'termsOfService'>;
}

export function LegalDocumentPage({ onNavigate, page }: LegalDocumentPageProps) {
  const document = getLegalDocument(page);

  return (
    <main className="page legal-page">
      <section className="glass-card legal-hero-card">
        <div className="legal-hero">
          <div className="legal-hero-copy">
            <p className="eyebrow">Legal</p>
            <h1>{document.title}</h1>
            <p className="muted-copy">{document.description}</p>
            <dl className="legal-meta">
              <div>
                <dt>Effective Date</dt>
                <dd>{document.effectiveOn}</dd>
              </div>
              <div>
                <dt>Last Updated</dt>
                <dd>{document.updatedOn}</dd>
              </div>
            </dl>
          </div>

          <div className="legal-hero-actions">
            <button
              className="secondary-button legal-action-button"
              type="button"
              onClick={() => onNavigate('support')}
            >
              Contact support
            </button>
            <button
              className="secondary-button legal-action-button"
              type="button"
              onClick={() => onNavigate('launcher')}
            >
              Back home
            </button>
          </div>
        </div>
      </section>

      <section className="glass-card legal-document-card" aria-label={`${document.title} document`}>
        <div className="legal-sections" aria-label={`${document.title} sections`}>
          {document.sections.map((section) => (
            <article key={section.title} className="legal-section">
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="muted-copy">{paragraph}</p>
              ))}
              {section.bullets && (
                <ul className="legal-list">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
