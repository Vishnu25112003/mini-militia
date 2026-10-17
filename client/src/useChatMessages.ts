import { useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';

export interface ChatMessage {
  name: string;
  color: string;
  text: string;
}

/** Subscribes to the room's `chat` broadcasts — shared by the lobby's chat popup and the in-match one. */
export function useChatMessages(room: Room): ChatMessage[] {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const handleChat = (msg: ChatMessage) => setMessages((prev) => [...prev, msg]);
    const unsubscribe = room.onMessage('chat', handleChat);
    return unsubscribe;
  }, [room]);

  return messages;
}
