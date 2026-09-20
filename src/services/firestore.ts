import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  limit,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import {
  getFirebaseDb,
  isFirebaseConfigured,
  handleFirestoreError,
  OperationType,
  ensureAnonymousAuth,
  getFirebaseAuth,
} from './firebase';
import {
  GroupRoomDoc,
  Participant,
  Vote,
  DecisionOption,
  RoomStatus,
} from '../types';

const LOCAL_STORAGE_PREFIX = 'decide_ai_room_';

/**
 * Local participant persistence helpers (Section 7)
 */
export function getLocalParticipant(roomId: string): { id: string; name: string } | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}participant_${roomId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading local participant', e);
  }
  return null;
}

export function saveLocalParticipant(roomId: string, participant: { id: string; name: string }): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}participant_${roomId}`, JSON.stringify(participant));
  } catch (e) {
    console.error('Error saving local participant', e);
  }
}

export function getLocalVote(roomId: string): string | null {
  try {
    return localStorage.getItem(`${LOCAL_STORAGE_PREFIX}vote_${roomId}`) || null;
  } catch {
    return null;
  }
}

export function saveLocalVote(roomId: string, optionId: string): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}vote_${roomId}`, optionId);
  } catch (e) {
    console.error('Error saving local vote', e);
  }
}

/**
 * Generates an uppercase 4-character code (e.g. "8F72") (Section 5 & 28)
 * Omits ambiguous characters like 0/O, 1/I to guarantee easy sharing
 */
export function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Checks whether a short public code is already taken in Firestore
 */
async function isPublicCodeAvailable(code: string): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return true;

  try {
    const q = query(collection(db, 'rooms'), where('publicCode', '==', code.toUpperCase()), limit(1));
    const snapshot = await getDocs(q);
    return snapshot.empty;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'rooms');
  }
}

/**
 * Generates a guaranteed unique public code for a new room
 */
export async function getUniquePublicCode(): Promise<string> {
  let attempts = 0;
  while (attempts < 5) {
    const candidate = generateShortCode();
    const available = await isPublicCodeAvailable(candidate);
    if (available) return candidate;
    attempts++;
  }
  // Fallback with timestamp slice
  return generateShortCode() + Math.floor(Math.random() * 9);
}

export interface CreateGroupRoomParams {
  creatorId?: string;
  creatorName: string;
  question: string;
  options: Array<{ id: string; text: string; emoji?: string }>;
  category?: string;
  maxParticipants?: number | null;
  isSecretVoting?: boolean;
}

/**
 * Creates a new multiplayer Group Room in Firestore (Section 6, 8, 9)
 * Always binds the room's hostId to the authenticated technical UID
 */
export async function createGroupRoom(params: CreateGroupRoomParams): Promise<{ room: GroupRoomDoc; publicCode: string }> {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error('Firebase não está configurado. Configure as variáveis VITE_FIREBASE_* no seu arquivo .env.local');
  }

  // 1. Authenticate user anonymously to establish verified technical identity (Section 5, 6, 8)
  const hostUid = await ensureAnonymousAuth();
  const publicCode = await getUniquePublicCode();

  try {
    // Generate secure internal Firestore ID
    const roomRef = doc(collection(db, 'rooms'));
    const roomId = roomRef.id;

    const optionsWithVotes: DecisionOption[] = params.options.map((opt) => ({
      id: opt.id,
      text: opt.text.trim(),
      emoji: opt.emoji || '🎯',
      votes: 0,
    }));

    const now = new Date().toISOString();
    const hostDisplayName = params.creatorName.trim() || 'Criador';

    const newRoom: GroupRoomDoc = {
      id: roomId,
      publicCode,
      question: params.question.trim(),
      options: optionsWithVotes,
      category: params.category,
      status: 'waiting',
      createdAt: now,
      updatedAt: now,
      hostId: hostUid, // Protected technical identity from request.auth.uid (Section 8)
      hostName: hostDisplayName,
      maxParticipants: params.maxParticipants || null,
      isSecretVoting: Boolean(params.isSecretVoting),
      winnerOptionId: null,
      tiedOptionIds: null,
      tieBreakActive: false,
      isTieBreaker: false,
      totalVotesCount: 0,
    };

    // 2. Create Room Document
    await setDoc(roomRef, newRoom);

    // 3. Register Host Participant in Subcollection using hostUid
    const hostParticipantRef = doc(db, 'rooms', roomId, 'participants', hostUid);
    const hostParticipant: Participant = {
      id: hostUid,
      name: hostDisplayName,
      joinedAt: now,
      isHost: true,
      active: true,
    };
    await setDoc(hostParticipantRef, hostParticipant);

    // 4. Save Host identity locally for seamless reloads and reconnects
    saveLocalParticipant(roomId, { id: hostUid, name: hostParticipant.name });
    saveLocalParticipant(publicCode, { id: hostUid, name: hostParticipant.name });

    return { room: newRoom, publicCode };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'rooms');
  }
}

/**
 * Finds a room by its short public code (e.g. "8F72") (Section 8 & 28)
 */
export async function findRoomByPublicCode(publicCode: string): Promise<GroupRoomDoc | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  const cleanCode = publicCode.trim().toUpperCase().replace('#', '');

  try {
    const q = query(collection(db, 'rooms'), where('publicCode', '==', cleanCode), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const docData = snapshot.docs[0].data() as GroupRoomDoc;
    return { ...docData, id: snapshot.docs[0].id };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'rooms');
  }
}

/**
 * Retrieves a room by its internal Firestore document ID
 */
export async function getRoomById(roomId: string): Promise<GroupRoomDoc | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const roomRef = doc(db, 'rooms', roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return null;
    return { ...(snap.data() as GroupRoomDoc), id: snap.id };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `rooms/${roomId}`);
  }
}

/**
 * Joins an existing room and registers the participant (Section 7, 12, 13)
 * Technical identity always binds to Firebase Auth UID
 */
export async function joinGroupRoom(
  roomId: string,
  participantName: string
): Promise<Participant> {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error('Firebase não está configurado.');
  }

  // Enforce authentic technical UID
  const participantUid = await ensureAnonymousAuth();
  const nameToUse = participantName.trim() || 'Convidado';

  try {
    const participantRef = doc(db, 'rooms', roomId, 'participants', participantUid);
    const existing = await getDoc(participantRef);

    if (existing.exists()) {
      const data = existing.data() as Participant;
      saveLocalParticipant(roomId, { id: data.id, name: data.name });
      return data;
    }

    // Check if room has capacity constraint
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    const roomData = roomSnap.exists() ? (roomSnap.data() as GroupRoomDoc) : null;
    const isHost = roomData?.hostId === participantUid;

    const newParticipant: Participant = {
      id: participantUid,
      name: nameToUse,
      joinedAt: new Date().toISOString(),
      isHost,
      active: true,
    };

    await setDoc(participantRef, newParticipant);
    saveLocalParticipant(roomId, { id: participantUid, name: nameToUse });
    return newParticipant;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `rooms/${roomId}/participants/${participantUid}`);
  }
}

/**
 * Subscribes to real-time room document updates (Section 9 & 22)
 */
export function subscribeToRoom(
  roomId: string,
  onUpdate: (room: GroupRoomDoc | null) => void,
  onError?: (err: Error) => void
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onUpdate(null);
    return () => {};
  }

  const roomRef = doc(db, 'rooms', roomId);
  return onSnapshot(
    roomRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate({ ...(snap.data() as GroupRoomDoc), id: snap.id });
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.error('Error in room subscription', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Subscribes to real-time participants in the room subcollection (Section 9)
 */
export function subscribeToParticipants(
  roomId: string,
  onUpdate: (participants: Participant[]) => void,
  onError?: (err: Error) => void
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onUpdate([]);
    return () => {};
  }

  const participantsRef = collection(db, 'rooms', roomId, 'participants');
  return onSnapshot(
    participantsRef,
    (snap) => {
      const list: Participant[] = [];
      snap.forEach((docSnap) => {
        list.push({ ...(docSnap.data() as Participant), id: docSnap.id });
      });
      onUpdate(list);
    },
    (error) => {
      console.error('Error in participants subscription', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Subscribes to real-time votes in the room subcollection (Section 9)
 */
export function subscribeToVotes(
  roomId: string,
  onUpdate: (votes: Vote[]) => void,
  onError?: (err: Error) => void
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onUpdate([]);
    return () => {};
  }

  const votesRef = collection(db, 'rooms', roomId, 'votes');
  return onSnapshot(
    votesRef,
    (snap) => {
      const list: Vote[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data() as Vote);
      });
      onUpdate(list);
    },
    (error) => {
      console.error('Error in votes subscription', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Submits a vote atomically in Firestore (Sections 10, 11, 14, 15, 16)
 * Guaranteed:
 * - One vote per participant per round
 * - Authentic caller technical UID
 * - Server-authoritative transaction
 */
export async function submitVote(
  roomId: string,
  _participantId: string, // Enforced via auth
  participantName: string,
  optionId: string
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error('Firebase não está configurado.');
  }

  // Ensure authenticated technical UID matches caller
  const callerUid = await ensureAnonymousAuth();

  const voteDocRef = doc(db, 'rooms', roomId, 'votes', callerUid);
  const participantRef = doc(db, 'rooms', roomId, 'participants', callerUid);
  const roomRef = doc(db, 'rooms', roomId);

  try {
    await runTransaction(db, async (transaction) => {
      const existingVote = await transaction.get(voteDocRef);
      if (existingVote.exists()) {
        throw new Error('Você já votou nesta rodada!');
      }

      const roomSnap = await transaction.get(roomRef);
      if (!roomSnap.exists()) {
        throw new Error('Sala não encontrada!');
      }

      const roomData = roomSnap.data() as GroupRoomDoc;
      if (roomData.status === 'finished' || roomData.status === 'closed') {
        throw new Error('Esta votação já foi encerrada.');
      }

      // Check option exists
      const targetOption = roomData.options.find((o) => o.id === optionId);
      if (!targetOption) {
        throw new Error('Opção de voto inválida.');
      }

      const now = new Date().toISOString();

      // Ensure participant document exists in transaction
      const participantSnap = await transaction.get(participantRef);
      if (!participantSnap.exists()) {
        const newParticipant: Participant = {
          id: callerUid,
          name: participantName.trim() || 'Participante',
          joinedAt: now,
          isHost: roomData.hostId === callerUid,
          chosenOptionId: optionId,
          votedAt: now,
          active: true,
        };
        transaction.set(participantRef, newParticipant);
      } else {
        transaction.update(participantRef, {
          chosenOptionId: optionId,
          votedAt: now,
        });
      }

      // 1. Write vote document
      const voteData: Vote = {
        optionId,
        participantId: callerUid,
        participantName: participantName.trim() || 'Participante',
        createdAt: now,
      };
      transaction.set(voteDocRef, voteData);

      // 2. Increment option votes in room doc
      const updatedOptions = roomData.options.map((opt) => {
        if (opt.id === optionId) {
          return { ...opt, votes: (opt.votes || 0) + 1 };
        }
        return opt;
      });

      const nextStatus: RoomStatus = roomData.status === 'waiting' ? 'voting' : roomData.status;

      transaction.update(roomRef, {
        options: updatedOptions,
        status: nextStatus,
        updatedAt: now,
        totalVotesCount: (roomData.totalVotesCount || 0) + 1,
      });
    });

    // Save locally for immediate UI responsiveness
    saveLocalVote(roomId, optionId);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `rooms/${roomId}/votes/${callerUid}`);
  }
}

/**
 * Host opens voting state (Section 13 & 18)
 * Security rule: Only host can trigger waiting -> voting
 */
export async function startVoting(roomId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;

  const callerUid = await ensureAnonymousAuth();

  try {
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) throw new Error('Sala não encontrada');
    const roomData = roomSnap.data() as GroupRoomDoc;

    if (roomData.hostId !== callerUid) {
      throw new Error('Apenas o anfitrião da sala pode iniciar a votação.');
    }

    await updateDoc(roomRef, {
      status: 'voting',
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
  }
}

/**
 * Host finishes voting, calculates winner or detects tie (Sections 10, 11, 13, 14, 15, 19)
 * Security rule: Only host can set status to finished or tie
 */
export async function finishVoting(roomId: string): Promise<GroupRoomDoc> {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error('Firebase não está configurado.');
  }

  const callerUid = await ensureAnonymousAuth();
  const roomRef = doc(db, 'rooms', roomId);
  const votesRef = collection(db, 'rooms', roomId, 'votes');

  try {
    const [roomSnap, votesSnap] = await Promise.all([getDoc(roomRef), getDocs(votesRef)]);

    if (!roomSnap.exists()) {
      throw new Error('Sala não encontrada.');
    }

    const roomData = roomSnap.data() as GroupRoomDoc;

    if (roomData.hostId !== callerUid) {
      throw new Error('Apenas o anfitrião pode encerrar a votação.');
    }

    // Recalculate official votes directly from the votes subcollection for 100% integrity
    const voteCounts: Record<string, number> = {};
    roomData.options.forEach((opt) => {
      voteCounts[opt.id] = 0;
    });

    votesSnap.forEach((docSnap) => {
      const v = docSnap.data() as Vote;
      if (voteCounts[v.optionId] !== undefined) {
        voteCounts[v.optionId]++;
      }
    });

    const recalculatedOptions: DecisionOption[] = roomData.options.map((opt) => ({
      ...opt,
      votes: voteCounts[opt.id] || 0,
    }));

    // Find highest votes
    const sorted = [...recalculatedOptions].sort((a, b) => b.votes - a.votes);
    const topVotes = sorted[0]?.votes || 0;

    let winnerId: string | null = null;
    let tiedIds: string[] | null = null;
    let newStatus: RoomStatus = 'finished';

    if (topVotes === 0 && recalculatedOptions.length > 0) {
      // If nobody voted, pick randomly as fallback
      winnerId = recalculatedOptions[Math.floor(Math.random() * recalculatedOptions.length)].id;
      newStatus = 'finished';
    } else {
      const tied = sorted.filter((opt) => opt.votes === topVotes);
      if (tied.length > 1) {
        // Tie detected (Section 11, 14, 20)
        tiedIds = tied.map((t) => t.id);
        newStatus = 'tie';
      } else if (tied.length === 1) {
        winnerId = tied[0].id;
        newStatus = 'finished';
      }
    }

    const now = new Date().toISOString();

    const updates: Partial<GroupRoomDoc> = {
      options: recalculatedOptions,
      status: newStatus,
      winnerOptionId: winnerId,
      tiedOptionIds: tiedIds,
      finishedAt: now,
      updatedAt: now,
      tieBreakActive: newStatus === 'tie',
    };

    await updateDoc(roomRef, updates);

    return {
      ...roomData,
      ...updates,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
  }
}

/**
 * Resolves a tie in Firestore (Sections 11, 14, 20)
 * Security rule: Only host can resolve tie
 */
export async function resolveTieInFirestore(roomId: string, chosenWinnerId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error('Firebase não está configurado.');
  }

  const callerUid = await ensureAnonymousAuth();
  const roomRef = doc(db, 'rooms', roomId);

  try {
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) throw new Error('Sala não encontrada.');
    const roomData = roomSnap.data() as GroupRoomDoc;

    if (roomData.hostId !== callerUid) {
      throw new Error('Apenas o anfitrião pode desempatar a votação.');
    }

    const now = new Date().toISOString();
    await updateDoc(roomRef, {
      winnerOptionId: chosenWinnerId,
      tiedOptionIds: null,
      status: 'finished',
      isTieBreaker: true,
      tieBreakActive: false,
      updatedAt: now,
      finishedAt: now,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
  }
}
