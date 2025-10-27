import { NextRequest } from "next/server";
import { addMessage, getMessages } from "../../../lib/server/chatStore";

export async function GET(req: NextRequest) {
  const authority = req.nextUrl.searchParams.get("authority")?.trim();
  if (!authority) return new Response(JSON.stringify({ error: "authority required" }), { status: 400 });
  const msgs = getMessages(authority);
  // Return full history for reliability (can optimize later)
  return Response.json({ messages: msgs });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({}));
  const { authority, text, user, type } = body;
  if (!authority || !text) return new Response(JSON.stringify({ error: "authority & text required" }), { status: 400 });
  const msg = addMessage({ authority, text: String(text).slice(0,280), user: user?.slice(0,64), type: type === 'system' ? 'system':'user' });
  return Response.json({ ok: true, message: msg });
}
