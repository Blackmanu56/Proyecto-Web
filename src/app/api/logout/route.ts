import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth.server";

export async function POST() {
  const cookieStore = await cookies();

  try {
    const session = await getSession();
    if (session) {
      cookieStore.delete("session");
    }
  } catch {
    // Token invalid/expired — clean it up anyway
    cookieStore.delete("session");
  }

  return NextResponse.json({ ok: true });
}