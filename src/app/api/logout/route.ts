import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth.server";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  try {
    const session = await getSession();
    if (session) {
      response.cookies.delete("session");
    }
  } catch {
    // Token invalid/expired — clean it up anyway
    response.cookies.delete("session");
  }

  return response;
}