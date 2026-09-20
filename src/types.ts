export type DecisionType = 'raffle' | 'group';

export type DecisionStatus = 'draft' | 'active' | 'finished' | 'cancelled';

export type RoomStatus = 'waiting' | 'voting' | 'finished' | 'tie' | 'closed';

export interface DecisionOption {
  id: string;
  text: string;
  emoji?: string;
  votes: number;
}

export interface Participant {
  id: string;
  name: string;
  joinedAt: string;
  isHost?: boolean;
  chosenOptionId?: string;
  votedAt?: string;
  active?: boolean;
}

export interface Vote {
  optionId: string;
  participantId: string;
  participantName: string;
  createdAt: string;
}

export interface GroupRoomDoc {
  id: string; // Firestore document ID
  publicCode: string; // e.g. "8F72" - short code for URL / sharing
  question: string;
  options: DecisionOption[];
  category?: string;
  status: RoomStatus;
  createdAt: string;
  updatedAt: string;
  hostId: string;
  hostName: string;
  maxParticipants?: number | null; // null or undefined = "Sem número definido"
  isSecretVoting: boolean;
  winnerOptionId?: string | null;
  tiedOptionIds?: string[] | null;
  tieBreakActive?: boolean;
  isTieBreaker?: boolean;
  finishedAt?: string;
  totalVotesCount?: number;
}

export interface GroupResult {
  roomId: string;
  publicCode: string;
  question: string;
  winnerOptionId?: string | null;
  winnerOption?: DecisionOption | null;
  tiedOptionIds?: string[] | null;
  tiedOptions?: DecisionOption[];
  totalVotes: number;
  options: DecisionOption[];
  participantsCount: number;
  isTie: boolean;
  isTieBreaker?: boolean;
  finishedAt: string;
}

export interface Decision {
  id: string; // e.g. "8F72" or Firestore doc ID
  publicCode?: string;
  creatorId: string;
  creatorName: string;
  question: string;
  type: DecisionType;
  status: DecisionStatus | RoomStatus;
  options: DecisionOption[];
  participants: Participant[];
  maxParticipants?: number | null; // null = "Sem número definido"
  isSecretVoting: boolean;
  winnerOptionId?: string;
  tiedOptionIds?: string[];
  isTieBreaker?: boolean;
  category?: string;
  createdAt: string;
  finishedAt?: string;
  isFavorite?: boolean;
}

export interface CategoryTemplate {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryEmoji: string;
  question: string;
  options: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  isLoggedIn: boolean;
  plan: 'free' | 'premium';
  streakDays: number;
  totalDecisions: number;
  totalGroupDecisions?: number;
  createdAt: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
}
