export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface UserRole {
  id: string;
  userId: string;
  title: string;
  tag: string;
  description?: string;
  icon?: string;
}

export interface User {
  id: string;
  phoneNumber?: string;
  email: string;
  passwordHash?: string;
  username: string; // handle, e.g. "arivera_dev"
  displayName: string;
  avatarUrl: string;
  bio: string;
  status: UserStatus;
  statusMessage?: string;
  isOnline?: boolean;
  isVerified: boolean;
  isPro: boolean;
  sessionKeystore?: string;
  tags?: string[];
  roles?: UserRole[];
  lastSeenAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  tokenHash: string;
  deviceMeta?: string;
  expiresAt: string;
  createdAt: string;
}

export interface UserSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  ownerId: string;
  memberCount: number;
  onlineCount: number;
  isVerified: boolean;
  tags: string[];
  createdAt: string;
}

export interface CommunityMember {
  id: string;
  communityId: string;
  userId: string;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  joinedAt: string;
}

export type ChannelTypeEnum = 'TEXT' | 'VOICE_LOUNGE' | 'STAGE_ROOM';

export interface Channel {
  id: string;
  communityId?: string;
  name: string;
  topic?: string;
  type: 'text' | 'voice' | 'stage' | ChannelTypeEnum;
  isPrivate: boolean;
  bitrate?: string;
  bitrateKbps?: number;
  krispEnabled?: boolean;
  category?: string;
  createdById?: string;
  createdAt: string;
}

export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

export interface Message {
  id: string;
  channelId?: string;
  dmGroupId?: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderRole?: string;
  content: string;
  replyToId?: string;
  isEdited?: boolean;
  isBot?: boolean;
  reactions?: any;
  createdAt: string;
  updatedAt?: string;
}

export interface DirectConversation {
  id: string;
  isGroup?: boolean;
  participantIds: string[];
  lastMessage?: string;
  updatedAt: string;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  createdAt: string;
}

export interface VoiceRoom {
  id: string;
  channelId: string;
  region: string;
  bitrateKbps: number;
  isActive: boolean;
  participants: VoiceParticipant[];
}

export interface VoiceParticipant {
  id?: string;
  voiceRoomId?: string;
  userId: string;
  channelId?: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role?: string; // 'Host' | 'Speaker' | 'Audience'
  isMuted: boolean;
  isDeafened?: boolean;
  isSpeaking: boolean;
  latencyMs?: number;
  volume: number;
  joinedAt: string;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  feature: string;
  notified: boolean;
  createdAt: string;
}

export interface OtpRecord {
  phoneNumber: string;
  code: string;
  expiresAt: number;
}

export interface Friendship {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  createdAt: string;
  updatedAt: string;
}

export interface ServerBan {
  id: string;
  communityId: string;
  userId: string;
  userName: string;
  reason: string;
  bannedAt: string;
}

export type WsEventType =
  | 'message_new'
  | 'message_edit'
  | 'message_delete'
  | 'message_reaction'
  | 'message_send'
  | 'typing'
  | 'presence_update'
  | 'friend_request'
  | 'friend_accepted'
  | 'friend_declined'
  | 'friend_blocked'
  | 'channel_create'
  | 'channel_update'
  | 'channel_delete'
  | 'server_update'
  | 'voice_join'
  | 'voice_leave'
  | 'voice_speaking'
  | 'voice_mute'
  | 'voice:join'
  | 'voice:offer'
  | 'voice:answer'
  | 'voice:candidate'
  | 'voice:speaking'
  | 'voice:mute_toggle'
  | 'voice:leave';

export interface WsEvent {
  type: WsEventType;
  payload: any;
}
