// Entscheidet, ob PDFs aus einer Mail übernommen werden.
// - "ignore"-Regeln schließen immer aus.
// - Gibt es mindestens eine "save"-Regel, werden NUR Mails übernommen, die eine davon treffen.
// - Ohne Regeln wird jede Mail mit PDF übernommen.

export type CaptureRule = {
  sender_pattern: string | null;
  subject_pattern: string | null;
  action: "save" | "ignore";
  is_active: boolean;
};

function matches(rule: CaptureRule, from: string, subject: string) {
  const s = rule.sender_pattern?.trim().toLowerCase();
  const t = rule.subject_pattern?.trim().toLowerCase();
  if (!s && !t) return false;
  if (s && !from.toLowerCase().includes(s)) return false;
  if (t && !subject.toLowerCase().includes(t)) return false;
  return true;
}

export function shouldImport(rules: CaptureRule[], from: string, subject: string) {
  const active = rules.filter((r) => r.is_active);
  if (active.some((r) => r.action === "ignore" && matches(r, from, subject))) return false;
  const saves = active.filter((r) => r.action === "save");
  if (saves.length === 0) return true;
  return saves.some((r) => matches(r, from, subject));
}
