import { Decision, UserProfile, Achievement, Participant } from '../types';

const STORAGE_KEYS = {
  DECISIONS: 'decide_ai_decisions_v1',
  ACTIVE_ROOMS: 'decide_ai_active_rooms_v1',
  USER_PROFILE: 'decide_ai_user_profile_v1',
  VOTED_ROOMS: 'decide_ai_voted_rooms_v1', // Track local participant votes: { [roomId]: { participantId, optionId, name } }
};

// Create BroadcastChannel for real-time tab synchronization
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('decide_ai_channel');
  }
} catch (e) {
  console.warn('BroadcastChannel not supported', e);
}

export function subscribeToSync(callback: () => void): () => void {
  const onMessage = () => callback();
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith('decide_ai_')) {
      callback();
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', onMessage);
  }
  window.addEventListener('storage', onStorage);

  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', onMessage);
    }
    window.removeEventListener('storage', onStorage);
  };
}

function notifySync() {
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'SYNC_UPDATE', timestamp: Date.now() });
  }
}

// Generate human-friendly short IDs like "8F72"
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Default initial user profile
export function getUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading user profile', e);
  }

  const defaultProfile: UserProfile = {
    id: 'user_' + Math.random().toString(36).substring(2, 9),
    name: 'Visitante',
    isLoggedIn: false,
    plan: 'free',
    streakDays: 3,
    totalDecisions: 6,
    createdAt: new Date().toISOString(),
  };
  saveUserProfile(defaultProfile);
  return defaultProfile;
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    notifySync();
  } catch (e) {
    console.error('Error saving user profile', e);
  }
}

export function updateUserPlan(plan: 'free' | 'premium'): UserProfile {
  const profile = getUserProfile();
  profile.plan = plan;
  saveUserProfile(profile);
  return profile;
}

export function incrementUserDecisions(): UserProfile {
  const profile = getUserProfile();
  profile.totalDecisions += 1;
  saveUserProfile(profile);
  return profile;
}

// Initial demo history to make the app feel alive and validate screen 14 immediately
const INITIAL_DEMO_DECISIONS: Decision[] = [
  {
    id: 'D93A',
    creatorId: 'user_demo',
    creatorName: 'Carlos',
    question: 'Onde vamos jantar hoje?',
    type: 'raffle',
    status: 'finished',
    options: [
      { id: 'opt_1', text: 'Pizza Napolitana', emoji: '🍕', votes: 0 },
      { id: 'opt_2', text: 'Hambúrguer artesanal', emoji: '🍔', votes: 0 },
      { id: 'opt_3', text: 'Sushi & Sashimi', emoji: '🍣', votes: 0 },
    ],
    participants: [],
    isSecretVoting: false,
    winnerOptionId: 'opt_1',
    category: 'Comida',
    createdAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    finishedAt: new Date(Date.now() - 3600 * 1000 * 4 + 15000).toISOString(),
    isFavorite: true,
  },
  {
    id: '8F72',
    creatorId: 'user_demo',
    creatorName: 'Marina',
    question: 'Qual filme assistir no sábado?',
    type: 'group',
    status: 'finished',
    options: [
      { id: 'opt_4', text: 'Interestelar', emoji: '🚀', votes: 4 },
      { id: 'opt_5', text: 'O Poderoso Chefão', emoji: '🎭', votes: 2 },
      { id: 'opt_6', text: 'Superbad', emoji: '😂', votes: 1 },
    ],
    participants: [
      { id: 'p1', name: 'Marina', chosenOptionId: 'opt_4' },
      { id: 'p2', name: 'Lucas', chosenOptionId: 'opt_4' },
      { id: 'p3', name: 'Bia', chosenOptionId: 'opt_4' },
      { id: 'p4', name: 'Felipe', chosenOptionId: 'opt_4' },
      { id: 'p5', name: 'Thiago', chosenOptionId: 'opt_5' },
      { id: 'p6', name: 'Camila', chosenOptionId: 'opt_5' },
      { id: 'p7', name: 'Renato', chosenOptionId: 'opt_6' },
    ],
    isSecretVoting: true,
    winnerOptionId: 'opt_4',
    category: 'Entretenimento',
    createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    finishedAt: new Date(Date.now() - 3600 * 1000 * 23).toISOString(),
    isFavorite: false,
  },
];

export function getDecisions(): Decision[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DECISIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error loading decisions', e);
  }

  // Initialize with starter history
  try {
    localStorage.setItem(STORAGE_KEYS.DECISIONS, JSON.stringify(INITIAL_DEMO_DECISIONS));
  } catch (e) {
    // ignore
  }
  return INITIAL_DEMO_DECISIONS;
}

export function saveDecision(decision: Decision): void {
  const list = getDecisions().filter((d) => d.id !== decision.id);
  list.unshift(decision);
  try {
    localStorage.setItem(STORAGE_KEYS.DECISIONS, JSON.stringify(list));
    // Also save in active rooms store for quick lookup
    saveActiveRoom(decision);
    notifySync();
  } catch (e) {
    console.error('Error saving decision', e);
  }
}

export function toggleFavoriteDecision(decisionId: string): boolean {
  const list = getDecisions();
  let newState = false;
  const updated = list.map((d) => {
    if (d.id === decisionId) {
      newState = !d.isFavorite;
      return { ...d, isFavorite: newState };
    }
    return d;
  });
  try {
    localStorage.setItem(STORAGE_KEYS.DECISIONS, JSON.stringify(updated));
    notifySync();
  } catch (e) {
    console.error('Error toggling favorite', e);
  }
  return newState;
}

export function deleteDecision(decisionId: string): void {
  const list = getDecisions().filter((d) => d.id !== decisionId);
  try {
    localStorage.setItem(STORAGE_KEYS.DECISIONS, JSON.stringify(list));
    notifySync();
  } catch (e) {
    console.error('Error deleting decision', e);
  }
}

// Active Rooms management for group voting
export function getActiveRooms(): Record<string, Decision> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_ROOMS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading active rooms', e);
  }
  return {};
}

export function saveActiveRoom(decision: Decision): void {
  const rooms = getActiveRooms();
  rooms[decision.id] = decision;
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ROOMS, JSON.stringify(rooms));
    notifySync();
  } catch (e) {
    console.error('Error saving active room', e);
  }
}

export function findDecisionById(id: string): Decision | null {
  const cleanId = id.trim().toUpperCase().replace('#', '');
  // First check active rooms
  const rooms = getActiveRooms();
  if (rooms[cleanId]) return rooms[cleanId];
  // Check decisions list
  const list = getDecisions();
  const found = list.find((d) => d.id.toUpperCase() === cleanId);
  return found || null;
}

// Track local user vote per room to prevent duplicate voting
export function getLocalVoteForRoom(roomId: string): { participantId: string; optionId: string; name: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VOTED_ROOMS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed[roomId] || null;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export function recordLocalVote(roomId: string, vote: { participantId: string; optionId: string; name: string }): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VOTED_ROOMS);
    const votes = raw ? JSON.parse(raw) : {};
    votes[roomId] = vote;
    localStorage.setItem(STORAGE_KEYS.VOTED_ROOMS, JSON.stringify(votes));
  } catch (e) {
    // ignore
  }
}

// Cast a vote in a group decision
export function castVoteInRoom(roomId: string, participantName: string, optionId: string): Decision | null {
  const decision = findDecisionById(roomId);
  if (!decision) return null;
  if (decision.status !== 'active') return decision;

  // Check if already voted
  const existingVote = getLocalVoteForRoom(roomId);
  const participantId = existingVote?.participantId || 'p_' + Math.random().toString(36).substring(2, 9);

  // Update participant list
  const participantIndex = decision.participants.findIndex((p) => p.id === participantId);
  if (participantIndex >= 0) {
    // Already voted
    return decision;
  }

  const newParticipant: Participant = {
    id: participantId,
    name: participantName.trim() || 'Participante',
    chosenOptionId: optionId,
    votedAt: new Date().toISOString(),
  };

  const updatedParticipants = [...decision.participants, newParticipant];

  // Recalculate option votes
  const updatedOptions = decision.options.map((opt) => {
    if (opt.id === optionId) {
      return { ...opt, votes: opt.votes + 1 };
    }
    return opt;
  });

  const updatedDecision: Decision = {
    ...decision,
    options: updatedOptions,
    participants: updatedParticipants,
  };

  // Check if reached max participants
  if (updatedDecision.maxParticipants && updatedParticipants.length >= updatedDecision.maxParticipants) {
    return finishGroupDecision(roomId, updatedDecision);
  }

  saveDecision(updatedDecision);
  recordLocalVote(roomId, { participantId, optionId, name: newParticipant.name });
  return updatedDecision;
}

// Finalize group voting and calculate winner / tie
export function finishGroupDecision(roomId: string, currentDecision?: Decision): Decision | null {
  const decision = currentDecision || findDecisionById(roomId);
  if (!decision) return null;

  // Find max votes
  const sorted = [...decision.options].sort((a, b) => b.votes - a.votes);
  const topVotes = sorted[0]?.votes || 0;

  let winnerId: string | undefined = undefined;
  let tiedIds: string[] | undefined = undefined;

  if (topVotes === 0 && decision.options.length > 0) {
    // If no one voted, choose randomly
    winnerId = decision.options[Math.floor(Math.random() * decision.options.length)].id;
  } else {
    const tied = sorted.filter((opt) => opt.votes === topVotes);
    if (tied.length > 1) {
      tiedIds = tied.map((t) => t.id);
    } else if (tied.length === 1) {
      winnerId = tied[0].id;
    }
  }

  const finished: Decision = {
    ...decision,
    status: 'finished',
    winnerOptionId: winnerId,
    tiedOptionIds: tiedIds,
    finishedAt: new Date().toISOString(),
  };

  saveDecision(finished);
  return finished;
}

// Resolve tie between tied options
export function resolveTie(roomId: string, chosenWinnerId: string): Decision | null {
  const decision = findDecisionById(roomId);
  if (!decision) return null;

  const resolved: Decision = {
    ...decision,
    winnerOptionId: chosenWinnerId,
    tiedOptionIds: undefined,
    isTieBreaker: true,
  };

  saveDecision(resolved);
  return resolved;
}

// Emoji auto-suggest helper based on keyword
export function suggestEmoji(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('pizza')) return '🍕';
  if (lower.includes('hambúrguer') || lower.includes('burger')) return '🍔';
  if (lower.includes('sushi') || lower.includes('japonês') || lower.includes('poke')) return '🍣';
  if (lower.includes('filme') || lower.includes('cinema') || lower.includes('pipoca')) return '🍿';
  if (lower.includes('série') || lower.includes('netflix')) return '📺';
  if (lower.includes('jogo') || lower.includes('game')) return '🎮';
  if (lower.includes('praia') || lower.includes('mar')) return '🏖️';
  if (lower.includes('montanha') || lower.includes('serra')) return '🏔️';
  if (lower.includes('cerveja') || lower.includes('bar') || lower.includes('chope')) return '🍺';
  if (lower.includes('café') || lower.includes('cafe')) return '☕';
  if (lower.includes('doce') || lower.includes('chocolate') || lower.includes('sobremesa')) return '🍫';
  if (lower.includes('dinheiro') || lower.includes('comprar') || lower.includes('investir')) return '💰';
  if (lower.includes('date') || lower.includes('amor') || lower.includes('casal')) return '❤️';
  if (lower.includes('carro') || lower.includes('uber') || lower.includes('viagem')) return '🚗';
  if (lower.includes('massa') || lower.includes('macarrão') || lower.includes('italiano')) return '🍝';
  if (lower.includes('tacos') || lower.includes('mexicano')) return '🌮';
  if (lower.includes('casa') || lower.includes('dormir')) return '🛋️';
  if (lower.includes('festa') || lower.includes('balada')) return '🎉';
  if (lower.includes('livro') || lower.includes('estudo')) return '📚';
  return '✨';
}

// Gamification achievements definition
export function getAchievements(totalDecisions: number): Achievement[] {
  return [
    {
      id: 'first_decision',
      title: 'Primeira Escolha',
      description: 'Tomou sua 1ª decisão no DECIDE AÍ',
      icon: '🎯',
      unlocked: totalDecisions >= 1,
      progress: Math.min(totalDecisions, 1),
      maxProgress: 1,
    },
    {
      id: 'decisions_10',
      title: 'Decidido',
      description: 'Tomou 10 decisões sem enrolar',
      icon: '⚡',
      unlocked: totalDecisions >= 10,
      progress: Math.min(totalDecisions, 10),
      maxProgress: 10,
    },
    {
      id: 'group_master',
      title: 'Líder da Turma',
      description: 'Criou ou votou em uma decisão em grupo',
      icon: '👥',
      unlocked: true,
      progress: 1,
      maxProgress: 1,
    },
    {
      id: 'decisions_50',
      title: 'Mestre do Destino',
      description: 'Alcançou a marca de 50 decisões tomadas',
      icon: '🏆',
      unlocked: totalDecisions >= 50,
      progress: Math.min(totalDecisions, 50),
      maxProgress: 50,
    },
  ];
}
