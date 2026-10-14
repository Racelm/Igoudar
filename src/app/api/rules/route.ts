import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = (await request.json().catch(() => ({}))) as {
    sender_pattern?: string;
    subject_pattern?: string;
    action?: string;
  };
  const sender = body.sender_pattern?.trim().slice(0, 200) || null;
  const subject = body.subject_pattern?.trim().slice(0, 200) || null;
  if (!sender && !subject) return NextResponse.json({ error: "Absender oder Betreff angeben" }, { status: 400 });
  const action = body.action === "ignore" ? "ignore" : "save";

  const { data, error } = await supabase
    .from("capture_rules")
    .insert({ sender_pattern: sender, subject_pattern: subject, action })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data.id });
}
