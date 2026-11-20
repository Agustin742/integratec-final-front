import { describe, expect, it } from 'vitest';
import {
  chatInboxItemSchema,
  chatInboxSchema,
  selectTotalUnread,
} from './chat-inbox-schema';

const lastMessage = {
  id: '00000000-0000-4000-8000-600000000001',
  authorId: '00000000-0000-4000-8000-000000007001',
  authorDisplayName: 'Sofía Martínez',
  bodyPreview: 'Hola a todos',
  createdAt: '2026-11-19T03:01:00.000Z',
};

const item = {
  classroomId: '00000000-0000-4000-8000-000000000051',
  classroomName: '3.º Año B',
  lastMessage,
  unreadCount: 2,
};

describe('chat inbox schema (GET /chats)', () => {
  it('accepts the contract shape, including a classroom without messages', () => {
    expect(chatInboxSchema.safeParse({ items: [item] }).success).toBe(true);
    expect(
      chatInboxItemSchema.safeParse({ ...item, lastMessage: null }).success,
    ).toBe(true);
  });

  it('accepts the empty answer parents receive', () => {
    expect(chatInboxSchema.safeParse({ items: [] })).toEqual({
      success: true,
      data: { items: [] },
    });
  });

  it('rejects malformed payloads', () => {
    expect(chatInboxSchema.safeParse({}).success).toBe(false);
    expect(chatInboxSchema.safeParse({ items: {} }).success).toBe(false);
    expect(
      chatInboxItemSchema.safeParse({ ...item, unreadCount: -1 }).success,
    ).toBe(false);
    expect(
      chatInboxItemSchema.safeParse({ ...item, unreadCount: 1.5 }).success,
    ).toBe(false);
    expect(
      chatInboxItemSchema.safeParse({ ...item, classroomId: '' }).success,
    ).toBe(false);
    expect(
      chatInboxItemSchema.safeParse({
        ...item,
        lastMessage: { ...lastMessage, createdAt: 'ayer' },
      }).success,
    ).toBe(false);
    expect(
      chatInboxItemSchema.safeParse({
        ...item,
        lastMessage: { ...lastMessage, bodyPreview: undefined },
      }).success,
    ).toBe(false);
  });

  it('adds the unread counts of every chat', () => {
    expect(selectTotalUnread(undefined)).toBe(0);
    expect(selectTotalUnread({ items: [] })).toBe(0);
    expect(
      selectTotalUnread({
        items: [item, { ...item, classroomId: 'b', unreadCount: 3 }],
      }),
    ).toBe(5);
  });
});
