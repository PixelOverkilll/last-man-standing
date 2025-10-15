// Discord Bot für Voice-State-Tracking
// Installiere zuerst: npm install discord.js express cors dotenv

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const cors = require('cors');

// Bot Configuration - Token kommt jetzt aus Environment Variables
const BOT_TOKEN = process.env.DISCORD_TOKEN || 'YOUR_TOKEN_HERE'; // ✅ Sicher!
const GAMENIGHT_CHANNEL_ID = process.env.GAMENIGHT_CHANNEL_ID || '1427990096250011668';
const PORT = process.env.PORT || 3000;

// Discord Client mit notwendigen Intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

// Express Server für API
const app = express();

// CORS Configuration - Erlaube Zugriff von GitHub Pages und localhost
const corsOptions = {
  origin: [
    'https://pixeloverkilll.github.io',
    'http://localhost',
    'http://127.0.0.1'
  ],
  methods: ['GET', 'POST'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Store voice states
const voiceStates = new Map(); // userId -> { inVoice: bool, channelId: string, speaking: bool }

// Bot Ready Event
client.once('ready', async () => {
  console.log(`✅ Bot eingeloggt als ${client.user.tag}`);
  console.log(`🎤 Voice-State-Tracking aktiv für Channel: ${GAMENIGHT_CHANNEL_ID}`);
  console.log(`🌐 API läuft auf http://localhost:${PORT}`);

  // Load all users already in the gamenight channel
  try {
    const guilds = client.guilds.cache;
    for (const [guildId, guild] of guilds) {
      const channel = guild.channels.cache.get(GAMENIGHT_CHANNEL_ID);
      if (channel && channel.isVoiceBased()) {
        console.log(`📡 Lade User aus Channel: ${channel.name}`);
        for (const [memberId, member] of channel.members) {
          const voiceState = member.voice;
          const isSpeaking = !voiceState.selfMute && !voiceState.serverMute;

          voiceStates.set(memberId, {
            inVoice: true,
            channelId: channel.id,
            channelName: channel.name,
            username: member.user.username,
            discriminator: member.user.discriminator,
            avatar: member.user.avatar,
            speaking: isSpeaking,
            muted: voiceState.selfMute || voiceState.serverMute
          });

          console.log(`✅ User geladen: ${member.user.tag} (speaking: ${isSpeaking})`);
        }
        console.log(`✅ ${channel.members.size} User im Voice-Channel geladen`);
      }
    }
  } catch (error) {
    console.error('❌ Fehler beim Laden der Voice-Channel User:', error);
  }
});

// Voice State Update Event
client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.id;
  const member = newState.member;

  // User joined gamenight voice channel
  if (!oldState.channelId && newState.channelId === GAMENIGHT_CHANNEL_ID) {
    console.log(`🟢 ${member.user.tag} ist Gamenight Voice beigetreten`);
    const isSpeaking = !newState.selfMute && !newState.serverMute;
    voiceStates.set(userId, {
      inVoice: true,
      channelId: newState.channelId,
      channelName: newState.channel.name,
      username: member.user.username,
      discriminator: member.user.discriminator,
      avatar: member.user.avatar,
      speaking: isSpeaking,
      muted: newState.selfMute || newState.serverMute
    });
  }

  // User left gamenight voice channel
  if (oldState.channelId === GAMENIGHT_CHANNEL_ID && newState.channelId !== GAMENIGHT_CHANNEL_ID) {
    console.log(`🔴 ${member.user.tag} hat Gamenight Voice verlassen`);
    voiceStates.delete(userId);
  }

  // User switched to gamenight channel
  if (oldState.channelId !== GAMENIGHT_CHANNEL_ID && newState.channelId === GAMENIGHT_CHANNEL_ID) {
    console.log(`🔄 ${member.user.tag} ist zu Gamenight gewechselt`);
    const isSpeaking = !newState.selfMute && !newState.serverMute;
    voiceStates.set(userId, {
      inVoice: true,
      channelId: newState.channelId,
      channelName: newState.channel.name,
      username: member.user.username,
      discriminator: member.user.discriminator,
      avatar: member.user.avatar,
      speaking: isSpeaking,
      muted: newState.selfMute || newState.serverMute
    });
  }

  // User switched from gamenight to another channel
  if (oldState.channelId === GAMENIGHT_CHANNEL_ID && newState.channelId && newState.channelId !== GAMENIGHT_CHANNEL_ID) {
    console.log(`🔄 ${member.user.tag} hat Gamenight verlassen (zu anderem Channel)`);
    voiceStates.delete(userId);
  }

  // Mute/Unmute detection (only for users in gamenight)
  if (newState.channelId === GAMENIGHT_CHANNEL_ID) {
    const state = voiceStates.get(userId);
    if (state) {
      const wasMuted = oldState.selfMute || oldState.serverMute;
      const isMuted = newState.selfMute || newState.serverMute;

      if (wasMuted !== isMuted) {
        console.log(`🔇 ${member.user.tag} ist ${isMuted ? 'gemutet' : 'nicht mehr gemutet'}`);
        state.speaking = !isMuted;
        state.muted = isMuted;
      }
    }
  }
});

// API Endpoints

// Get all users in voice
app.get('/api/voice-states', (req, res) => {
  const states = Array.from(voiceStates.entries()).map(([userId, state]) => ({
    userId,
    ...state
  }));
  res.json(states);
});

// Get specific user's voice state
app.get('/api/voice-state/:userId', (req, res) => {
  const userId = req.params.userId;
  const state = voiceStates.get(userId);

  if (state) {
    res.json({ userId, ...state });
  } else {
    res.json({ userId, inVoice: false });
  }
});

// Get users in specific channel
app.get('/api/voice-channel/:channelId', (req, res) => {
  const channelId = req.params.channelId;
  const usersInChannel = Array.from(voiceStates.entries())
    .filter(([_, state]) => state.channelId === channelId)
    .map(([userId, state]) => ({ userId, ...state }));

  res.json(usersInChannel);
});

// Check if user is speaking
app.get('/api/speaking/:userId', (req, res) => {
  const userId = req.params.userId;
  const state = voiceStates.get(userId);

  res.json({
    userId,
    speaking: state ? state.speaking : false
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    botOnline: client.user ? true : false,
    usersInVoice: voiceStates.size
  });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`📡 API Server läuft auf Port ${PORT}`);
});

// Login Bot
client.login(BOT_TOKEN).catch(err => {
  console.error('❌ Bot-Login fehlgeschlagen:', err);
  process.exit(1);
});

// Error handling
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});
