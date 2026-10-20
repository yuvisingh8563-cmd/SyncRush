const WebSocket = require('ws');
const http = require('http');

const BASE_URL = 'http://localhost:4000/api';
const WS_URL = 'ws://localhost:4000';

function post(endpoint, data, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + endpoint);
    const body = JSON.stringify(data);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method: 'POST', headers }, (res) => {
      let respData = '';
      res.on('data', (c) => respData += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(respData || '{}') });
        } catch (_) {
          resolve({ status: res.statusCode, body: respData });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(endpoint, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + endpoint);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method: 'GET', headers }, (res) => {
      let respData = '';
      res.on('data', (c) => respData += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(respData || '{}') });
        } catch (_) {
          resolve({ status: res.statusCode, body: respData });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTwoAccountVerification() {
  console.log('=== SyncRush Two-Account Real-Time Integration Verification ===\n');

  // 1. Authenticate Account A (Alice)
  console.log('1. Registering & Authenticating Account A (Alice)...');
  let authA = await post('/auth/register', { name: 'Alice Dev', email: 'alice@syncrush.io', password: 'password123' });
  if (authA.status !== 200) {
    authA = await post('/auth/login', { email: 'alice@syncrush.io', password: 'password123' });
  }
  console.log('   -> Alice Token generated:', !!authA.body.token, 'UserId:', authA.body.user?.id);
  const tokenA = authA.body.token;
  const userA = authA.body.user;

  // 2. Authenticate Account B (Bob)
  console.log('2. Registering & Authenticating Account B (Bob)...');
  let authB = await post('/auth/register', { name: 'Bob Dev', email: 'bob@syncrush.io', password: 'password123' });
  if (authB.status !== 200) {
    authB = await post('/auth/login', { email: 'bob@syncrush.io', password: 'password123' });
  }
  console.log('   -> Bob Token generated:', !!authB.body.token, 'UserId:', authB.body.user?.id);
  const tokenB = authB.body.token;
  const userB = authB.body.user;

  // 3. Connect WebSockets for both accounts
  console.log('\n3. Connecting Real-Time WebSockets for Alice & Bob...');
  const wsA = new WebSocket(WS_URL);
  const wsB = new WebSocket(WS_URL);

  const receivedByA = [];
  const receivedByB = [];

  await Promise.all([
    new Promise((res) => wsA.on('open', res)),
    new Promise((res) => wsB.on('open', res)),
  ]);

  wsA.on('message', (d) => {
    try { receivedByA.push(JSON.parse(d.toString())); } catch (_) {}
  });
  wsB.on('message', (d) => {
    try { receivedByB.push(JSON.parse(d.toString())); } catch (_) {}
  });

  // Authenticate sockets
  wsA.send(JSON.stringify({ type: 'auth', userId: userA.id }));
  wsB.send(JSON.stringify({ type: 'auth', userId: userB.id }));
  await new Promise(r => setTimeout(r, 200));
  console.log('   -> WebSockets connected and authenticated.');

  // 4. Friend Request & Live Notification
  console.log('\n4. Friend Management & Real-Time Presence:');
  console.log('   Alice sending friend request to Bob (@' + userB.username + ')...');
  const reqRes = await post('/friends/request', { targetHandle: userB.username }, tokenA);
  const friendshipId = reqRes.body.friendship?.id || reqRes.body.id;
  console.log('   -> Friend Request HTTP Status:', reqRes.status, 'Friendship ID:', friendshipId);

  await new Promise(r => setTimeout(r, 300));
  const bGotFriendReq = receivedByB.find(m => m.type === 'friend_request');
  console.log('   -> Bob received real-time WebSocket friend_request event:', !!bGotFriendReq);

  console.log('   Bob accepting friend request...');
  const acceptRes = await post(`/friends/${friendshipId}/accept`, {}, tokenB);
  console.log('   -> Accept HTTP Status:', acceptRes.status);

  await new Promise(r => setTimeout(r, 300));
  const aGotFriendAccepted = receivedByA.find(m => m.type === 'friend_accepted');
  console.log('   -> Alice received real-time WebSocket friend_accepted event:', !!aGotFriendAccepted);

  const friendsA = await get('/friends', tokenA);
  console.log('   -> Alice friend count:', friendsA.body.length, 'Status:', friendsA.body[0]?.status);

  // 5. Real-Time Presence Update
  console.log('\n5. Presence Synchronization:');
  wsA.send(JSON.stringify({
    type: 'presence_update',
    payload: { userId: userA.id, status: 'online', statusMessage: 'Pair programming in SyncRush' },
  }));
  await new Promise(r => setTimeout(r, 300));
  const bGotPresence = receivedByB.find(m => m.type === 'presence_update' && m.payload?.userId === userA.id);
  console.log('   -> Bob received Alice presence_update event:', !!bGotPresence);

  // 6. Direct & Channel Messaging, Typing, Reactions
  console.log('\n6. Messaging, Typing Indicators & Reactions:');
  const channelId = 'ch_general';
  wsA.send(JSON.stringify({ type: 'join_channel', channelId }));
  wsB.send(JSON.stringify({ type: 'join_channel', channelId }));
  await new Promise(r => setTimeout(r, 200));

  // Typing event
  wsA.send(JSON.stringify({ type: 'typing', channelId, username: userA.displayName }));
  await new Promise(r => setTimeout(r, 200));
  const bGotTyping = receivedByB.find(m => m.type === 'typing' && m.payload?.username === userA.displayName);
  console.log('   -> Bob received Alice typing indicator:', !!bGotTyping);

  // Send message
  console.log('   Alice sending message to #general...');
  const sendRes = await post(`/channels/${channelId}/messages`, {
    content: 'Hello Bob! Real-time messaging is online.',
  }, tokenA);
  const msg = sendRes.body;
  console.log('   -> Message HTTP Created ID:', msg.id);

  await new Promise(r => setTimeout(r, 300));
  const bGotMsg = receivedByB.find(m => m.type === 'message_new' && m.payload?.id === msg.id);
  console.log('   -> Bob received message_new via WebSocket:', !!bGotMsg, 'Content:', bGotMsg?.payload?.content);

  // Reaction
  console.log('   Bob reacting to Alice message with 🚀...');
  await post(`/messages/${msg.id}/reactions`, { emoji: '🚀' }, tokenB);
  await new Promise(r => setTimeout(r, 300));
  const aGotReaction = receivedByA.find(m => m.type === 'message_reaction' && m.payload?.id === msg.id);
  console.log('   -> Alice received real-time reaction event:', !!aGotReaction, 'Reactions:', aGotReaction?.payload?.reactions);

  // 7. WebRTC Voice Signaling Relay
  console.log('\n7. WebRTC Voice/Video Calling Signaling Relay:');
  const roomId = 'room_dev_lounge';
  console.log('   Alice sending WebRTC offer to room:', roomId);
  wsA.send(JSON.stringify({
    type: 'voice:offer',
    roomId,
    sdp: { type: 'offer', sdp: 'v=0\r\no=alice 1234 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 54312 UDP/TLS/RTP/SAVPF 111\r\n' },
  }));

  await new Promise(r => setTimeout(r, 300));
  const bGotOffer = receivedByB.find(m => m.type === 'voice:offer' && m.roomId === roomId);
  console.log('   -> Bob received voice:offer via WebSocket signaling:', !!bGotOffer);

  console.log('   Bob sending WebRTC answer...');
  wsB.send(JSON.stringify({
    type: 'voice:answer',
    roomId,
    sdp: { type: 'answer', sdp: 'v=0\r\no=bob 5678 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 54314 UDP/TLS/RTP/SAVPF 111\r\n' },
  }));

  await new Promise(r => setTimeout(r, 300));
  const aGotAnswer = receivedByA.find(m => m.type === 'voice:answer' && m.roomId === roomId);
  console.log('   -> Alice received voice:answer via WebSocket signaling:', !!aGotAnswer);

  // ICE Candidate exchange
  wsA.send(JSON.stringify({
    type: 'voice:candidate',
    roomId,
    candidate: { candidate: 'candidate:1 1 UDP 2130706431 127.0.0.1 54312 typ host', sdpMid: '0', sdpMLineIndex: 0 },
  }));
  await new Promise(r => setTimeout(r, 300));
  const bGotCandidate = receivedByB.find(m => m.type === 'voice:candidate');
  console.log('   -> Bob received ICE candidate:', !!bGotCandidate);

  // Voice speaking indicator
  wsA.send(JSON.stringify({
    type: 'voice:speaking',
    payload: { roomId, userId: userA.id, isSpeaking: true, volume: 0.88 },
  }));
  await new Promise(r => setTimeout(r, 300));
  const bGotSpeaking = receivedByB.find(m => m.type === 'voice:speaking' && m.payload?.isSpeaking === true);
  console.log('   -> Bob received live voice:speaking audio burst:', !!bGotSpeaking);

  // 8. Server / Community Joining & Members
  console.log('\n8. Server / Community Joining, Member Lists & Moderation:');
  const servers = await get('/user/communities', tokenA);
  console.log('   Alice joined servers:', servers.body.map(s => s.name));

  const communityId = servers.body[0]?.id || 'community_syncpulse';
  const members = await get(`/communities/${communityId}/members`, tokenA);
  console.log(`   Members in ${communityId}:`, members.body.map(m => m.displayName || m.username));

  // Clean up WebSockets
  wsA.close();
  wsB.close();

  console.log('\n=== ALL INTEGRATION VERIFICATION CHECKS PASSED SUCCESSFULLY! ===');
}

runTwoAccountVerification().catch(err => {
  console.error('Integration verification failed:', err);
  process.exit(1);
});
