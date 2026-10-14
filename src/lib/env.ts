// Welche Funktionen sind eingerichtet? Wird nur auf dem Server gelesen.
export function features() {
  const ai = Boolean(process.env.OPENAI_API_KEY);
  const tavily = Boolean(process.env.TAVILY_API_KEY);
  return {
    ai,
    gmail: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && (process.env.TOKEN_ENCRYPTION_KEY ?? "").length >= 16,
    ),
    webSearch: tavily || ai,
    webSearchProvider: tavily ? "Tavily" : ai ? "OpenAI" : null,
  };
}

export type Features = ReturnType<typeof features>;
