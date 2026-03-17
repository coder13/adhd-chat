import type { TimelineMessage } from '../../lib/matrix/chatCatalog';
import {
  createMentionCandidate,
  createMentionToken,
} from '../../lib/chat/mentions';
import type { EmojiSuggestion } from '../../lib/chat/emojis';

const alexMention = createMentionToken('Alex', '@alex:matrix.org');

export const storyMentionTargets = [
  {
    userId: '@alex:matrix.org',
    displayName: 'Alex',
  },
  {
    userId: '@sam:matrix.org',
    displayName: 'Sam',
  },
];

export const storyMentionCandidates = storyMentionTargets.map((target) =>
  createMentionCandidate(target.userId, target.displayName)
);

const inlinePhotoSvg = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
    <defs>
      <linearGradient id="sky" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#dbeafe" />
        <stop offset="100%" stop-color="#bfdbfe" />
      </linearGradient>
    </defs>
    <rect width="480" height="320" fill="url(#sky)" />
    <circle cx="390" cy="72" r="36" fill="#fef3c7" />
    <path d="M0 250l110-110 64 62 88-112 96 104 58-42 64 98H0z" fill="#60a5fa" />
    <path d="M0 268l96-84 58 50 78-64 82 74 58-36 108 60H0z" fill="#2563eb" opacity="0.85" />
  </svg>`
);

export const inlinePhotoUrl = `data:image/svg+xml;charset=UTF-8,${inlinePhotoSvg}`;
export const inlineFileUrl =
  'data:text/plain;charset=UTF-8,Weekend%20check-in%20notes%0A-%20groceries%0A-%20walk%0A-%20movie';

export const chatTimelineStoryMessages: TimelineMessage[] = [
  {
    id: 'message-1',
    senderId: '@alex:matrix.org',
    senderName: 'Alex',
    body: `Made it back from errands. ${alexMention} says hi to future Storybook reviewers.`,
    timestamp: Date.UTC(2026, 2, 16, 18, 4),
    isOwn: false,
    msgtype: 'm.text',
    reactions: [
      {
        key: '🫶',
        count: 2,
        isOwn: false,
        senderNames: ['Alex', 'Sam'],
      },
    ],
  },
  {
    id: 'message-2',
    senderId: '@me:matrix.org',
    senderName: 'You',
    body: 'Perfect. I dropped the park photos here too: https://example.com/check-in',
    timestamp: Date.UTC(2026, 2, 16, 18, 6),
    isOwn: true,
    msgtype: 'm.text',
    readByNames: ['Alex', 'Jordan'],
  },
  {
    id: 'message-3',
    senderId: '@alex:matrix.org',
    senderName: 'Alex',
    body: 'Sunset on the trail',
    timestamp: Date.UTC(2026, 2, 16, 18, 8),
    isOwn: false,
    msgtype: 'm.image',
    mediaUrl: inlinePhotoUrl,
    mimeType: 'image/svg+xml',
    imageWidth: 480,
    imageHeight: 320,
  },
  {
    id: 'message-4',
    senderId: '@alex:matrix.org',
    senderName: 'Alex',
    body: 'Weekend-checkin.txt',
    timestamp: Date.UTC(2026, 2, 16, 18, 10),
    isOwn: false,
    msgtype: 'm.file',
    mediaUrl: inlineFileUrl,
    mimeType: 'text/plain',
    fileSize: 1024,
  },
  {
    id: 'message-5',
    senderId: '@me:matrix.org',
    senderName: 'You',
    body: 'Replying here so we keep all the plans in one thread.',
    timestamp: Date.UTC(2026, 2, 16, 18, 11),
    isOwn: true,
    msgtype: 'm.text',
    replyTo: {
      messageId: 'message-4',
      senderName: 'Alex',
      body: 'Weekend-checkin.txt',
      isDeleted: false,
    },
    reactions: [
      {
        key: '👍',
        count: 1,
        isOwn: true,
        senderNames: ['You'],
      },
    ],
    readByNames: ['Alex'],
  },
  {
    id: 'message-6',
    senderId: '@alex:matrix.org',
    senderName: 'Alex',
    body: 'is dramatically stretching before movie night',
    timestamp: Date.UTC(2026, 2, 16, 18, 14),
    isOwn: false,
    msgtype: 'm.emote',
  },
  {
    id: 'message-7',
    senderId: '@system:matrix.org',
    senderName: 'Tandem',
    body: 'Alex turned on quiet hours until 7:00 PM.',
    timestamp: Date.UTC(2026, 2, 16, 18, 16),
    isOwn: false,
    msgtype: 'm.notice',
  },
  {
    id: 'message-8',
    senderId: '@me:matrix.org',
    senderName: 'You',
    body: 'Sending the grocery list now…',
    timestamp: Date.UTC(2026, 2, 16, 18, 18),
    isOwn: true,
    msgtype: 'm.text',
    deliveryStatus: 'failed',
    errorText: 'Network timeout',
  },
];

export const sampleIncomingTextMessage = chatTimelineStoryMessages[0];
export const sampleOwnTextMessage = chatTimelineStoryMessages[1];
export const sampleImageMessage = chatTimelineStoryMessages[2];
export const sampleFileMessage = chatTimelineStoryMessages[3];
export const sampleReplyMessage = chatTimelineStoryMessages[4];
export const sampleEmoteMessage = chatTimelineStoryMessages[5];
export const sampleNoticeMessage = chatTimelineStoryMessages[6];
export const sampleFailedMessage = chatTimelineStoryMessages[7];

export const storyEmojiSuggestions: EmojiSuggestion[] = [
  {
    shortcode: 'sparkling_heart',
    emoji: '💖',
    name: 'Sparkling Heart',
    keywords: ['heart', 'sparkle', 'love'],
    score: 0,
  },
  {
    shortcode: 'sob',
    emoji: '😭',
    name: 'Loudly Crying Face',
    keywords: ['cry', 'tears'],
    score: 1,
  },
  {
    shortcode: 'fire',
    emoji: '🔥',
    name: 'Fire',
    keywords: ['lit', 'burn'],
    score: 2,
  },
];

export function cloneStoryMessage(message: TimelineMessage): TimelineMessage {
  return {
    ...message,
    replyTo: message.replyTo ? { ...message.replyTo } : null,
    reactions: message.reactions?.map((reaction) => ({
      ...reaction,
      senderNames: [...reaction.senderNames],
    })),
    readByNames: message.readByNames ? [...message.readByNames] : null,
    mentionedUserIds: message.mentionedUserIds ? [...message.mentionedUserIds] : null,
  };
}
