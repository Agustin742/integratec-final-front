import { describe, expect, it } from 'vitest';
import {
  chatHistoryMessageDtoSchema,
  chatMessageDtoSchema,
  paginatedChatHistorySchema,
} from './chat-schema';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000052';
const AUTHOR_ID = '00000000-0000-4000-8000-000000007001';
const MODERATOR_ID = '00000000-0000-4000-8000-000000000001';
const MENTIONED_ID = '00000000-0000-4000-8000-000000007002';

const sentMessage = {
  id: '00000000-0000-4000-8000-600000000001',
  classroomId: CLASSROOM_ID,
  authorId: AUTHOR_ID,
  body: 'Hola @María, ¿entendiste la consigna?',
  mentionedUserIds: [MENTIONED_ID],
  createdAt: '2026-11-19T03:00:01.000Z',
};

describe('chat-schema', () => {
  it('validates ChatMessageDto responses from ChatController_send', () => {
    expect(chatMessageDtoSchema.safeParse(sentMessage)).toEqual({
      success: true,
      data: sentMessage,
    });

    expect(
      chatMessageDtoSchema.safeParse({ ...sentMessage, body: '' }).success,
    ).toBe(false);
    expect(
      chatMessageDtoSchema.safeParse({ ...sentMessage, mentionedUserIds: 'no' })
        .success,
    ).toBe(false);
    expect(
      chatMessageDtoSchema.safeParse({ ...sentMessage, createdAt: 'hoy' })
        .success,
    ).toBe(false);
    expect(
      chatMessageDtoSchema.safeParse({
        ...sentMessage,
        mentionedUserIds: [MENTIONED_ID, MENTIONED_ID],
      }).success,
    ).toBe(false);
  });

  it('validates ChatHistoryMessageDto including the moderation audit pair', () => {
    const visibleHistoryMessage = {
      ...sentMessage,
      id: '00000000-0000-4000-8000-600000000002',
      hiddenAt: null,
      hiddenById: null,
    };

    expect(
      chatHistoryMessageDtoSchema.safeParse(visibleHistoryMessage),
    ).toEqual({
      success: true,
      data: visibleHistoryMessage,
    });

    const hiddenHistoryMessage = {
      ...sentMessage,
      id: '00000000-0000-4000-8000-600000000003',
      hiddenAt: '2026-11-19T04:00:00.000Z',
      hiddenById: MODERATOR_ID,
    };
    expect(chatHistoryMessageDtoSchema.safeParse(hiddenHistoryMessage)).toEqual(
      {
        success: true,
        data: hiddenHistoryMessage,
      },
    );

    expect(
      chatHistoryMessageDtoSchema.safeParse({
        ...visibleHistoryMessage,
        hiddenAt: 0,
      }).success,
    ).toBe(false);
    expect(
      chatHistoryMessageDtoSchema.safeParse({
        ...visibleHistoryMessage,
        hiddenById: '',
      }).success,
    ).toBe(false);
  });

  it('validates the paginated chat history response of ChatController_list', () => {
    const page = {
      items: [
        {
          ...sentMessage,
          id: '00000000-0000-4000-8000-600000000004',
          hiddenAt: null,
          hiddenById: null,
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    };

    expect(paginatedChatHistorySchema.safeParse(page)).toEqual({
      success: true,
      data: page,
    });

    expect(
      paginatedChatHistorySchema.safeParse({ ...page, page: 0 }).success,
    ).toBe(false);
    expect(
      paginatedChatHistorySchema.safeParse({ ...page, total: -1 }).success,
    ).toBe(false);
    expect(
      paginatedChatHistorySchema.safeParse({ ...page, items: {} }).success,
    ).toBe(false);
  });
});
