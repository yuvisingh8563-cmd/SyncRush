import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import {
  User,
  UserRole,
  WaitlistEntry,
  Community,
  CommunityMember,
  Channel,
  Message,
  DirectConversation,
  DirectMessage,
  VoiceParticipant,
  Friendship,
  ServerBan,
} from './types';

interface DatabaseSchema {
  users: User[];
  communities: Community[];
  communityMembers: CommunityMember[];
  channels: Channel[];
  messages: Message[];
  conversations: DirectConversation[];
  directMessages: DirectMessage[];
  friendships: Friendship[];
  serverBans: ServerBan[];
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'syncpulse.json');

export class Database {
  private data: DatabaseSchema;
  private voiceRooms: Map<string, VoiceParticipant[]> = new Map();
  private pgPool: Pool | null = null;
  private isCloudReady: boolean = false;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.data = this.load();
    this.initCloudDatabase();
  }

  public isCloud(): boolean {
    return this.isCloudReady;
  }

  private async initCloudDatabase() {
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
    if (!dbUrl) {
      console.log('📦 [Database] Operating in local file mode (data/syncpulse.json).');
      console.log('💡 [Database] Tip: Provide DATABASE_URL (Supabase/Neon/Render PostgreSQL) for permanent cloud persistence across server restarts.');
      return;
    }

    try {
      console.log('☁️ [Database] Connecting to Cloud PostgreSQL database...');
      this.pgPool = new Pool({
        connectionString: dbUrl,
        ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      });

      // Ensure key-value document store table exists
      await this.pgPool.query(`
        CREATE TABLE IF NOT EXISTS syncpulse_app_state (
          id VARCHAR(32) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Attempt to load existing cloud state
      const res = await this.pgPool.query('SELECT data FROM syncpulse_app_state WHERE id = $1', ['main']);
      if (res.rows && res.rows.length > 0 && res.rows[0].data) {
        console.log('✅ [Database] Successfully restored persistent state from Cloud Database!');
        const cloudData = res.rows[0].data;
        if (!cloudData.users) cloudData.users = [];
        if (!cloudData.communities) cloudData.communities = [];
        if (!cloudData.communityMembers) cloudData.communityMembers = [];
        if (!cloudData.channels) cloudData.channels = [];
        if (!cloudData.messages) cloudData.messages = [];
        if (!cloudData.conversations) cloudData.conversations = [];
        if (!cloudData.directMessages) cloudData.directMessages = [];
        if (!cloudData.friendships) cloudData.friendships = [];
        if (!cloudData.serverBans) cloudData.serverBans = [];
        this.data = cloudData;
        this.saveLocal();
      } else {
        console.log('⚡ [Database] Connected to fresh Cloud Database. Saving initial seed state...');
        await this.pgPool.query(
          `INSERT INTO syncpulse_app_state (id, data, updated_at) VALUES ($1, $2, NOW())
           ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
          ['main', JSON.stringify(this.data)]
        );
      }
      this.isCloudReady = true;
    } catch (err) {
      console.error('⚠️ [Database] Failed to connect to Cloud Database:', err);
      console.log('Continuing with local file persistence.');
    }
  }

  private load(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed.friendships) parsed.friendships = [];
        if (!parsed.serverBans) parsed.serverBans = [];
        return parsed;
      } catch (err) {
        console.error('Failed to parse database file, reinitializing', err);
      }
    }
    const initial = this.seed();
    this.saveLocal(initial);
    return initial;
  }

  private saveLocal(dataToSave?: DatabaseSchema) {
    try {
      const payload = dataToSave || this.data;
      const tmp = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf-8');
      fs.renameSync(tmp, DB_FILE);
    } catch (err) {
      console.error('[Database] Failed to write local cache file:', err);
    }
  }

  private save(dataToSave?: DatabaseSchema) {
    this.saveLocal(dataToSave);

    if (this.pgPool) {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(async () => {
        try {
          await this.pgPool!.query(
            `INSERT INTO syncpulse_app_state (id, data, updated_at)
             VALUES ('main', $1, NOW())
             ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
            [JSON.stringify(this.data)]
          );
        } catch (err) {
          console.error('[Database] Error syncing to Cloud Database:', err);
        }
      }, 150);
    }
  }

  private seed(): DatabaseSchema {
    const defaultUser: User = {
      id: 'usr_alex_rivers',
      email: 'dev@syncpulse.io',
      passwordHash: '$2a$10$wTf7gX6zN9eH8YxN4cO7u.JgL2zLhM9xO0aW7aK3l3p2r1s0t', // syncpulse2026
      username: 'arivers',
      displayName: 'Alex Rivers',
      avatarUrl:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDPiXnxMM1-47dZ1-1kgAq0XA790SWKkMuD0xk6-vbAWwhTfF9rY5krbG76sUgYRrtgkxLATUKWL_SIA0met9jo2XzHK2Y6wrukbUPSHRCKA0PVA236i_cOqE1r0q8lHnOUbnwPzz7KDaWgnRD5IPba2FgESGXOGR_WsgTwGfoNuKYgYidAheBHyIZjtgwy5Rvhr0nCwt-wi3XZSs1n2ESbOMS_Ze4DmGQ17EEW8pU5T3NJ44b3rlR3cw',
      bio: 'Systems Architect & WebRTC Engineer • Building Sync Pulse',
      status: 'online',
      isVerified: true,
      isPro: true,
      createdAt: new Date().toISOString(),
    };

    const sarahUser: User = {
      id: 'usr_sarah_chen',
      email: 'sarah@syncpulse.io',
      passwordHash: '',
      username: 'schen',
      displayName: 'Sarah Chen',
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      bio: 'Staff Audio DSP Engineer',
      status: 'online',
      isVerified: true,
      isPro: true,
      createdAt: new Date().toISOString(),
    };

    const marcusUser: User = {
      id: 'usr_marcus_vance',
      email: 'marcus@syncpulse.io',
      passwordHash: '',
      username: 'mvance',
      displayName: 'Marcus Vance',
      avatarUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      bio: 'Core Infrastructure Lead',
      status: 'idle',
      isVerified: false,
      isPro: false,
      createdAt: new Date().toISOString(),
    };

    const defaultGuild: Community = {
      id: 'guild_sync_hq',
      name: 'Sync Pulse HQ',
      description: 'The epicenter of low-latency developer conversations',
      iconUrl: '',
      ownerId: defaultUser.id,
      memberCount: 3,
      onlineCount: 2,
      isVerified: true,
      tags: ['#React & Next.js', '#Rust & Systems', '#AI & LLMs'],
      createdAt: new Date().toISOString(),
    };

    const members: CommunityMember[] = [
      {
        id: 'mem_1',
        communityId: defaultGuild.id,
        userId: defaultUser.id,
        role: 'owner',
        joinedAt: new Date().toISOString(),
      },
      {
        id: 'mem_2',
        communityId: defaultGuild.id,
        userId: sarahUser.id,
        role: 'admin',
        joinedAt: new Date().toISOString(),
      },
      {
        id: 'mem_3',
        communityId: defaultGuild.id,
        userId: marcusUser.id,
        role: 'member',
        joinedAt: new Date().toISOString(),
      },
    ];

    const channels: Channel[] = [
      {
        id: 'ch_general_dev',
        communityId: defaultGuild.id,
        name: 'general-dev',
        topic: 'General developer discussion, announcements and daily standups',
        type: 'text',
        isPrivate: false,
        category: 'ENGINEERING',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ch_systems_arch',
        communityId: defaultGuild.id,
        name: 'systems-architecture',
        topic: 'Distributed mesh protocols, WebSockets & low-latency codecs',
        type: 'text',
        isPrivate: false,
        category: 'ENGINEERING',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ch_code_reviews',
        communityId: defaultGuild.id,
        name: 'code-reviews',
        topic: 'Share PRs, diffs, and receive engineering critique',
        type: 'text',
        isPrivate: false,
        category: 'ENGINEERING',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ch_dev_lounge',
        communityId: defaultGuild.id,
        name: 'dev-lounge',
        topic: 'Live collaborative audio lounge with 48kHz Opus & Krisp AI',
        type: 'voice',
        isPrivate: false,
        bitrate: '96 kbps',
        krispEnabled: true,
        category: 'ENGINEERING',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ch_design_critique',
        communityId: defaultGuild.id,
        name: 'design-critique',
        topic: 'Component specs, dark mode palettes, and typography tokens',
        type: 'text',
        isPrivate: false,
        category: 'PRODUCT & DESIGN',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ch_stage_broadcast',
        communityId: defaultGuild.id,
        name: 'tech-all-hands',
        topic: 'Weekly engineering town hall & soundboard demos',
        type: 'stage',
        isPrivate: false,
        category: 'PRODUCT & DESIGN',
        createdAt: new Date().toISOString(),
      },
    ];

    const messages: Message[] = [
      {
        id: 'msg_1',
        channelId: 'ch_general_dev',
        senderId: sarahUser.id,
        senderName: sarahUser.displayName,
        senderAvatar: sarahUser.avatarUrl,
        senderRole: 'Staff Audio DSP',
        content:
          'Welcome to the new Sync Pulse real-time mesh engine! RTT latency is holding steady at ~14ms on local clusters.',
        isEdited: false,
        reactions: [{ emoji: '⚡', userIds: [defaultUser.id] }],
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'msg_2',
        channelId: 'ch_general_dev',
        senderId: marcusUser.id,
        senderName: marcusUser.displayName,
        senderAvatar: marcusUser.avatarUrl,
        senderRole: 'Core Infra',
        content:
          'Krisp AI noise reduction gate and WebRTC jitter buffer have been tuned for 48kHz fullband stream.',
        isEdited: false,
        reactions: [{ emoji: '🔥', userIds: [defaultUser.id, sarahUser.id] }],
        createdAt: new Date(Date.now() - 1800000).toISOString(),
      },
    ];

    return {
      users: [defaultUser, sarahUser, marcusUser],
      communities: [defaultGuild],
      communityMembers: members,
      channels,
      messages,
      conversations: [],
      directMessages: [],
      friendships: [],
      serverBans: [],
    };
  }

  // --- Users ---
  getUserByEmail(email: string): User | undefined {
    return this.data.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase().trim()
    );
  }

  getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  createUser(user: User): User {
    this.data.users.push(user);
    this.save();
    return user;
  }

  updateUser(id: string, updates: Partial<User>): User | undefined {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    this.data.users[idx] = { ...this.data.users[idx], ...updates };
    this.save();
    return this.data.users[idx];
  }

  getAllUsers(): User[] {
    return this.data.users;
  }

  // --- Communities / Servers ---
  getCommunities(): Community[] {
    return this.data.communities;
  }

  getCommunityById(id: string): Community | undefined {
    return this.data.communities.find((c) => c.id === id);
  }

  createCommunity(comm: Community): Community {
    this.data.communities.push(comm);
    this.data.communityMembers.push({
      id: `mem_${Date.now()}`,
      communityId: comm.id,
      userId: comm.ownerId,
      role: 'owner',
      joinedAt: new Date().toISOString(),
    });
    this.save();
    return comm;
  }

  updateCommunity(
    id: string,
    updates: Partial<Community>
  ): Community | undefined {
    const idx = this.data.communities.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    this.data.communities[idx] = { ...this.data.communities[idx], ...updates };
    this.save();
    return this.data.communities[idx];
  }

  deleteCommunity(id: string): boolean {
    const initialLen = this.data.communities.length;
    this.data.communities = this.data.communities.filter((c) => c.id !== id);
    this.data.channels = this.data.channels.filter((ch) => ch.communityId !== id);
    this.save();
    return this.data.communities.length < initialLen;
  }

  joinCommunity(communityId: string, userId: string): boolean {
    const comm = this.data.communities.find((c) => c.id === communityId);
    if (!comm) return false;

    const alreadyJoined = this.data.communityMembers.some(
      (m) => m.communityId === communityId && m.userId === userId
    );

    if (!alreadyJoined) {
      this.data.communityMembers.push({
        id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        communityId,
        userId,
        role: 'member',
        joinedAt: new Date().toISOString(),
      });
      comm.memberCount = (comm.memberCount || 1) + 1;
      this.save();
    }
    return true;
  }

  leaveCommunity(communityId: string, userId: string): boolean {
    const comm = this.data.communities.find((c) => c.id === communityId);
    if (!comm) return false;

    const idx = this.data.communityMembers.findIndex(
      (m) => m.communityId === communityId && m.userId === userId
    );

    if (idx > -1) {
      this.data.communityMembers.splice(idx, 1);
      comm.memberCount = Math.max(1, (comm.memberCount || 1) - 1);
      this.save();
      return true;
    }
    return false;
  }

  isUserInCommunity(communityId: string, userId: string): boolean {
    return this.data.communityMembers.some(
      (m) => m.communityId === communityId && m.userId === userId
    );
  }

  getUserCommunities(userId: string): Community[] {
    const userCommunityIds = this.data.communityMembers
      .filter((m) => m.userId === userId)
      .map((m) => m.communityId);

    return this.data.communities.filter(
      (c) => c.ownerId === userId || userCommunityIds.includes(c.id)
    );
  }

  // --- Channels ---
  getChannels(communityId?: string): Channel[] {
    if (communityId) {
      return this.data.channels.filter((c) => c.communityId === communityId);
    }
    return this.data.channels;
  }

  getChannelById(id: string): Channel | undefined {
    return this.data.channels.find((c) => c.id === id);
  }

  createChannel(channel: Channel): Channel {
    this.data.channels.push(channel);
    this.save();
    return channel;
  }

  updateChannel(id: string, updates: Partial<Channel>): Channel | undefined {
    const idx = this.data.channels.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    this.data.channels[idx] = { ...this.data.channels[idx], ...updates };
    this.save();
    return this.data.channels[idx];
  }

  deleteChannel(id: string): boolean {
    const init = this.data.channels.length;
    this.data.channels = this.data.channels.filter((c) => c.id !== id);
    this.data.messages = this.data.messages.filter((m) => m.channelId !== id);
    this.save();
    return this.data.channels.length < init;
  }

  // --- Messages ---
  getMessages(channelId: string): Message[] {
    return this.data.messages.filter((m) => m.channelId === channelId);
  }

  getMessageById(id: string): Message | undefined {
    return this.data.messages.find((m) => m.id === id);
  }

  createMessage(msg: Message): Message {
    this.data.messages.push(msg);
    this.save();
    return msg;
  }

  editMessage(id: string, content: string): Message | undefined {
    const msg = this.data.messages.find((m) => m.id === id);
    if (!msg) return undefined;
    msg.content = content;
    msg.isEdited = true;
    msg.updatedAt = new Date().toISOString();
    this.save();
    return msg;
  }

  deleteMessage(id: string): boolean {
    const init = this.data.messages.length;
    this.data.messages = this.data.messages.filter((m) => m.id !== id);
    this.save();
    return this.data.messages.length < init;
  }

  toggleReaction(
    messageId: string,
    emoji: string,
    userId: string
  ): Message | undefined {
    const msg = this.data.messages.find((m) => m.id === messageId);
    if (!msg) return undefined;

    if (!Array.isArray(msg.reactions)) {
      msg.reactions = [];
    }

    let rx = (msg.reactions as any[]).find((r: any) => r.emoji === emoji);
    if (!rx) {
      rx = { emoji, userIds: [] };
      (msg.reactions as any[]).push(rx);
    }

    const uIdx = rx.userIds.indexOf(userId);
    if (uIdx > -1) {
      rx.userIds.splice(uIdx, 1);
      if (rx.userIds.length === 0) {
        msg.reactions = (msg.reactions as any[]).filter((r: any) => r.emoji !== emoji);
      }
    } else {
      rx.userIds.push(userId);
    }

    this.save();
    return msg;
  }

  // --- Direct Conversations & Messages ---
  getConversations(userId: string): DirectConversation[] {
    return this.data.conversations.filter((c) =>
      c.participantIds.includes(userId)
    );
  }

  getOrCreateConversation(user1: string, user2: string): DirectConversation {
    let conv = this.data.conversations.find(
      (c) =>
        c.participantIds.includes(user1) && c.participantIds.includes(user2)
    );
    if (!conv) {
      conv = {
        id: `dm_${Date.now()}`,
        participantIds: [user1, user2],
        updatedAt: new Date().toISOString(),
      };
      this.data.conversations.push(conv);
      this.save();
    }
    return conv;
  }

  getDirectMessages(conversationId: string): DirectMessage[] {
    return this.data.directMessages.filter(
      (m) => m.conversationId === conversationId
    );
  }

  createDirectMessage(dm: DirectMessage): DirectMessage {
    this.data.directMessages.push(dm);
    const conv = this.data.conversations.find(
      (c) => c.id === dm.conversationId
    );
    if (conv) {
      conv.lastMessage = dm.content;
      conv.updatedAt = dm.createdAt;
    }
    this.save();
    return dm;
  }

  // --- Real-Time Voice Sessions ---
  getVoiceParticipants(channelId: string): VoiceParticipant[] {
    return this.voiceRooms.get(channelId) || [];
  }

  joinVoice(participant: VoiceParticipant): VoiceParticipant[] {
    const channelId = participant.channelId || 'ch_dev_lounge';
    const room = this.voiceRooms.get(channelId) || [];
    const existing = room.findIndex((p) => p.userId === participant.userId);
    if (existing > -1) {
      room[existing] = participant;
    } else {
      room.push(participant);
    }
    this.voiceRooms.set(channelId, room);
    return room;
  }

  getUsers(): User[] {
    return this.data.users;
  }

  getDirectConversations(userId: string): DirectConversation[] {
    return this.getConversations(userId);
  }

  getOrCreateDirectConversation(userId1: string, userId2: string): DirectConversation {
    return this.getOrCreateConversation(userId1, userId2);
  }


  leaveVoice(channelId: string, userId: string): VoiceParticipant[] {
    const room = this.voiceRooms.get(channelId) || [];
    const updated = room.filter((p) => p.userId !== userId);
    this.voiceRooms.set(channelId, updated);
    return updated;
  }

  updateVoiceState(
    channelId: string,
    userId: string,
    state: Partial<VoiceParticipant>
  ): VoiceParticipant[] {
    const room = this.voiceRooms.get(channelId) || [];
    const p = room.find((x) => x.userId === userId);
    if (p) {
      Object.assign(p, state);
    }
    return room;
  }

  // --- OTP & Mobile Verification ---
  private otpMap: Map<string, { code: string; expiresAt: number }> = new Map();
  private waitlist: WaitlistEntry[] = [];
  private userRoles: UserRole[] = [
    {
      id: 'role_rust_lead',
      userId: 'usr_alex_rivers',
      title: 'Rust Guild Lead',
      tag: 'ADMIN',
      description: 'Lead of low-latency WebRTC and audio routing protocol',
      icon: 'shield_bolt',
    },
    {
      id: 'role_early_node',
      userId: 'usr_alex_rivers',
      title: 'Early Node Contributor',
      tag: 'GENESIS',
      description: 'Participant in Sync Pulse mesh genesis block',
      icon: 'verified',
    },
  ];

  sendOtp(phoneNumber: string): string {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.otpMap.set(phoneNumber, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return code;
  }

  verifyOtp(phoneNumber: string, code: string): boolean {
    const record = this.otpMap.get(phoneNumber);
    if (!record) return false;
    if (Date.now() > record.expiresAt) {
      this.otpMap.delete(phoneNumber);
      return false;
    }
    if (record.code === code.trim()) {
      this.otpMap.delete(phoneNumber);
      return true;
    }
    return false;
  }

  getUserByPhone(phoneNumber: string): User | undefined {
    return this.data.users.find((u) => u.phoneNumber === phoneNumber);
  }

  getUserRoles(userId: string): UserRole[] {
    return this.userRoles.filter((r) => r.userId === userId);
  }

  addUserRole(role: UserRole): UserRole {
    this.userRoles.push(role);
    return role;
  }

  addWaitlistEntry(email: string, feature: string): WaitlistEntry {
    const entry: WaitlistEntry = {
      id: 'wl_' + Date.now(),
      email,
      feature,
      notified: false,
      createdAt: new Date().toISOString(),
    };
    this.waitlist.push(entry);
    return entry;
  }

  // --- Friendships & Relationships ---
  getFriendships(userId: string): Friendship[] {
    return this.data.friendships.filter(
      (f) => f.senderId === userId || f.receiverId === userId
    );
  }

  getFriends(userId: string): { friend: User; status: string; id: string; isIncoming: boolean }[] {
    const list = this.getFriendships(userId);
    const results: { friend: User; status: string; id: string; isIncoming: boolean }[] = [];
    for (const f of list) {
      const otherId = f.senderId === userId ? f.receiverId : f.senderId;
      const u = this.getUserById(otherId);
      if (u) {
        results.push({
          friend: u,
          status: f.status,
          id: f.id,
          isIncoming: f.receiverId === userId,
        });
      }
    }
    return results;
  }

  sendFriendRequest(senderId: string, receiverId: string): Friendship {
    const existing = this.data.friendships.find(
      (f) =>
        (f.senderId === senderId && f.receiverId === receiverId) ||
        (f.senderId === receiverId && f.receiverId === senderId)
    );
    if (existing) {
      existing.status = 'pending';
      existing.senderId = senderId;
      existing.receiverId = receiverId;
      existing.updatedAt = new Date().toISOString();
      this.save();
      return existing;
    }
    const f: Friendship = {
      id: 'fr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      senderId,
      receiverId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.friendships.push(f);
    this.save();
    return f;
  }

  acceptFriendship(id: string, userId: string): Friendship | null {
    const f = this.data.friendships.find((item) => item.id === id);
    if (!f) return null;
    if (f.receiverId !== userId && f.senderId !== userId) return null;
    f.status = 'accepted';
    f.updatedAt = new Date().toISOString();
    this.save();
    return f;
  }

  declineFriendship(id: string, userId: string): boolean {
    const idx = this.data.friendships.findIndex((item) => item.id === id);
    if (idx === -1) return false;
    this.data.friendships.splice(idx, 1);
    this.save();
    return true;
  }

  blockUser(userId: string, targetId: string): Friendship {
    let f = this.data.friendships.find(
      (item) =>
        (item.senderId === userId && item.receiverId === targetId) ||
        (item.senderId === targetId && item.receiverId === userId)
    );
    if (!f) {
      f = {
        id: 'fr_' + Date.now(),
        senderId: userId,
        receiverId: targetId,
        status: 'blocked',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.data.friendships.push(f);
    } else {
      f.status = 'blocked';
      f.senderId = userId;
      f.receiverId = targetId;
      f.updatedAt = new Date().toISOString();
    }
    this.save();
    return f;
  }

  unblockUser(userId: string, targetId: string): boolean {
    const idx = this.data.friendships.findIndex(
      (item) =>
        item.status === 'blocked' &&
        item.senderId === userId &&
        item.receiverId === targetId
    );
    if (idx !== -1) {
      this.data.friendships.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // --- Server Bans ---
  getServerBans(communityId: string): ServerBan[] {
    return this.data.serverBans.filter((b) => b.communityId === communityId);
  }

  banMember(communityId: string, userId: string, userName: string, reason: string): ServerBan {
    this.leaveCommunity(communityId, userId);
    const ban: ServerBan = {
      id: 'ban_' + Date.now(),
      communityId,
      userId,
      userName,
      reason,
      bannedAt: new Date().toISOString(),
    };
    this.data.serverBans.push(ban);
    this.save();
    return ban;
  }

  unbanMember(communityId: string, userId: string): boolean {
    const idx = this.data.serverBans.findIndex(
      (b) => b.communityId === communityId && b.userId === userId
    );
    if (idx !== -1) {
      this.data.serverBans.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  getCommunityMembersDetails(communityId: string): { user: User; role: string }[] {
    const members = this.data.communityMembers.filter((m) => m.communityId === communityId);
    const results: { user: User; role: string }[] = [];
    for (const m of members) {
      const u = this.getUserById(m.userId);
      if (u) {
        results.push({ user: u, role: m.role });
      }
    }
    return results;
  }
}


export const db = new Database();

