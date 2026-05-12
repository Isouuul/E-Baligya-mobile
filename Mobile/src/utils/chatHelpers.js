import { db } from '../firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export const getOrCreateChat = async (otherUserId) => {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (!currentUser) return null;

  // Use deterministic chatId so both parties reference the same chat doc
  const chatId = [currentUser.uid, otherUserId].sort().join('_');
  const chatRef = doc(db, 'chats', chatId);

  const chatSnap = await getDoc(chatRef);
  if (chatSnap.exists()) return chatId;

  // Create chat document (no messages array stored on root; messages are subcollection)
  await setDoc(chatRef, {
    participants: [currentUser.uid, otherUserId],
    createdAt: Timestamp.now(),
  });

  return chatId;
};
