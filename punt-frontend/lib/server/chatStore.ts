export interface ChatMessage { id: string; ts: number; authority: string; user?: string; text: string; type: 'user' | 'system'; }

const MAX_MESSAGES = 300;
const chats = new Map<string, ChatMessage[]>();

function ensure(auth: string) {
  if (!chats.has(auth)) chats.set(auth, []);
  return chats.get(auth)!;
}

export function getMessages(authority: string): ChatMessage[] {
  return ensure(authority);
}

export function addMessage(msg: { authority: string; text: string; user?: string; type?: 'user' | 'system' }): ChatMessage {
  const rec: ChatMessage = { id: crypto.randomUUID(), ts: Date.now(), authority: msg.authority, text: msg.text, user: msg.user, type: msg.type || 'user' };
  const list = ensure(msg.authority);
  list.push(rec);
  if (list.length > MAX_MESSAGES) list.splice(0, list.length - MAX_MESSAGES);
  return rec;
}

// Helper to format system events
export function systemEvent(authority: string, text: string) {
  return addMessage({ authority, text, type: 'system' });
}
