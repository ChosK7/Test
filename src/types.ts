export type DecisionType = 'raffle' | 'group';

export type DecisionStatus = 'draft' | 'active' | 'finished' | 'cancelled';

export interface DecisionOption {
  id: string;
  text: string;
  emoji?: string;
  votes: number;
}

export interface Participant {
  id: string;
  name: string;
  chosenOptionId?: string;
  votedAt?: string;
}

export interface Decision {
  id: string; // e.g. "8F72"
  creatorId: string;
  creatorName: string;
  question: string;
  type: DecisionType;
  status: DecisionStatus;
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
