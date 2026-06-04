interface QuotePromptCardProps {
  promptText: string;
}

export function QuotePromptCard({ promptText }: QuotePromptCardProps) {
  return (
    <article className="quote-prompt-card glass-card" aria-label="Quote prompt">
      <p className="card-kicker">Who said this quote?</p>
      <blockquote className="quote-prompt-card-text">
        "{promptText}"
      </blockquote>
    </article>
  );
}
