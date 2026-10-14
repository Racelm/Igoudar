import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { revokeToken } from "@/lib/gmail";

// Postfach trennen: Zugriff bei Google widerrufen, Verbindung löschen.
// Bereits importierte Dokumente bleiben erhalten.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: secret } = await supabase
    .from("email_account_secrets")
    .select("refresh_token_enc")
    .eq("email_account_id", id)
    .maybeSingle();
  if (secret?.refresh_token_enc) {
    try {
      await revokeToken(decrypt(secret.refresh_token_enc));
    } catch {
      // Widerruf ist best effort
    }
  }

  const { error } = await supabase.from("email_accounts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
