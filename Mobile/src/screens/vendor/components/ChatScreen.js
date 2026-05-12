import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { auth, db } from "../../../firebase";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

export default function ChatScreen({ route, navigation }) {
  const currentUser = auth.currentUser;
  const userId = currentUser?.uid;
  const otherUserId = route.params?.vendorId || route.params?.userId;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [inputHeight, setInputHeight] = useState(42);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [otherProfile, setOtherProfile] = useState({
    businessName: "Unknown User",
    profileImage: null,
  });

  const [currentProfile, setCurrentProfile] = useState({
    profileImage: null,
  });

  const flatListRef = useRef(null);
  const chatId = userId && otherUserId ? (userId < otherUserId ? `${userId}_${otherUserId}` : `${otherUserId}_${userId}`) : null;
  const messagesRef = chatId ? collection(db, "Chats", chatId, "messages") : null;
  const canSend = text.trim().length > 0 && !sending;

  const getDayKey = (timestamp) => {
    if (!timestamp?.toDate) return "";
    const date = timestamp.toDate();
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  const getDayLabel = (timestamp) => {
    if (!timestamp?.toDate) return "";
    const date = timestamp.toDate();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((today - target) / (24 * 60 * 60 * 1000));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  const fetchOtherProfile = async () => {
    if (!otherUserId) return;
    try {
      const userSnap = await getDoc(doc(db, "Users", otherUserId));
      if (userSnap.exists()) {
        const data = userSnap.data();
        setOtherProfile({
          businessName:
            data.businessName ||
            `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
            "Unknown User",
          profileImage: data.profileImage || data.selfieImage || null,
        });
        return;
      }

      const vendorSnap = await getDocs(collection(db, "ApprovedVendors"));
      const vendorDoc = vendorSnap.docs.find((d) => d.data().userId === otherUserId);
      if (vendorDoc) {
        const data = vendorDoc.data();
        setOtherProfile({
          businessName: data.businessName || "Unknown User",
          profileImage: data.profileImage || data.selfie || null,
        });
      }
    } catch (err) {
      console.log("Error fetching other profile:", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchCurrentProfile = async () => {
    if (!userId) return;
    try {
      const userSnap = await getDoc(doc(db, "Users", userId));
      if (userSnap.exists()) {
        const data = userSnap.data();
        setCurrentProfile({
          profileImage: data.profileImage || null,
        });
      }
    } catch (err) {
      console.log("Error fetching current profile:", err);
    }
  };

  useEffect(() => {
    fetchOtherProfile();
    fetchCurrentProfile();
  }, [otherUserId, userId]);

  useEffect(() => {
    if (!messagesRef) return undefined;

    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setMessages(msgs);
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });
    });

    return () => unsubscribe();
  }, [chatId]);

  const sendMessage = async () => {
    if (!canSend || !chatId || !messagesRef || !userId || !otherUserId) return;
    setSending(true);
    const msgText = text.trim();
    setText("");

    try {
      await setDoc(
        doc(db, "Chats", chatId),
        {
          participants: [userId, otherUserId],
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );

      await addDoc(messagesRef, {
        senderId: userId,
        text: msgText,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.log("Send error:", err);
      setText(msgText);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }) => {
    const isMe = item.senderId === userId;
    const prev = messages[index - 1];
    const sameSenderAsPrev = prev?.senderId === item.senderId;
    const showAvatar = !isMe && !sameSenderAsPrev;
    const showDateChip = index === 0 || getDayKey(prev?.timestamp) !== getDayKey(item?.timestamp);
    const timeLabel = item.timestamp?.toDate
      ? item.timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

    return (
      <View>
        {showDateChip && (
          <View style={styles.dayChipWrap}>
            <Text style={styles.dayChipText}>{getDayLabel(item.timestamp)}</Text>
          </View>
        )}
        <View
          style={[
            styles.messageRow,
            isMe ? styles.myMessageRow : styles.theirMessageRow,
            !showAvatar && !isMe && styles.compactTheirRow,
          ]}
        >
          {showAvatar && otherProfile.profileImage && (
            <Image source={{ uri: otherProfile.profileImage }} style={styles.avatar} />
          )}

          <View
            style={[
              styles.messageBubble,
              isMe ? styles.myMessage : styles.theirMessage,
              sameSenderAsPrev && (isMe ? styles.groupedMyBubble : styles.groupedTheirBubble),
            ]}
          >
            <Text style={isMe ? styles.myMessageText : styles.theirMessageText}>{item.text}</Text>
            {!!timeLabel && (
              <Text style={isMe ? styles.myTimeText : styles.theirTimeText}>{timeLabel}</Text>
            )}
          </View>

          {isMe && currentProfile.profileImage && (
            <Image
              source={{
                uri: currentProfile.profileImage.startsWith("http")
                  ? currentProfile.profileImage
                  : `data:image/jpeg;base64,${currentProfile.profileImage}`,
              }}
              style={styles.avatar}
            />
          )}
        </View>
      </View>
    );
  };

  const onInputSizeChange = (event) => {
    const nextHeight = Math.min(110, Math.max(42, event?.nativeEvent?.contentSize?.height || 42));
    setInputHeight(nextHeight);
  };

  if (!userId || !otherUserId) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>Unable to open chat</Text>
          <Text style={styles.errorSub}>Missing participant information.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconCircle}>
            <Ionicons name="arrow-back" size={22} color="#1E3A8A" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            {otherProfile.profileImage ? (
              <Image source={{ uri: otherProfile.profileImage }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Text style={styles.headerAvatarText}>{otherProfile.businessName?.[0] || "U"}</Text>
              </View>
            )}

            <View style={styles.headerTextWrap}>
              <Text style={styles.headerName} numberOfLines={1}>{otherProfile.businessName}</Text>
              <Text style={styles.headerSub}>{loadingProfile ? "Loading profile..." : "Live chat"}</Text>
            </View>
          </View>

          <View style={styles.iconCirclePlaceholder} />
        </View>

        <View style={{ flex: 1 }}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => (
              <View style={styles.emptyWrap}>
                <Ionicons name="chatbubble-ellipses-outline" size={44} color="#CBD5E1" />
                <Text style={styles.emptyText}>No messages yet</Text>
              </View>
            )}
          />

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { height: inputHeight }]}
              placeholder={`Message ${otherProfile.businessName}`}
              placeholderTextColor="#94A3B8"
              value={text}
              onChangeText={setText}
              multiline
              onContentSizeChange={onInputSizeChange}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!canSend}
            >
              {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  errorTitle: { fontSize: 20, fontWeight: "800", color: "#0F172A", marginBottom: 6 },
  errorSub: { fontSize: 14, color: "#64748B", marginBottom: 16 },
  backBtn: { backgroundColor: "#1E3A8A", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  backBtnText: { color: "#fff", fontWeight: "700" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 15,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  iconCirclePlaceholder: {
    width: 40,
    height: 40,
  },
  headerCenter: { flexDirection: "row", alignItems: "center", flex: 1, marginHorizontal: 10 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#94A3B8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  headerAvatarText: { color: "#fff", fontWeight: "800" },
  headerTextWrap: { flex: 1 },
  headerName: { color: "#1E293B", fontWeight: "800", fontSize: 16 },
  headerSub: { color: "#94A3B8", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },

  messagesContent: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 20 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", marginVertical: 4 },
  myMessageRow: { justifyContent: "flex-end" },
  theirMessageRow: { justifyContent: "flex-start" },
  compactTheirRow: { paddingLeft: 42 },
  messageBubble: { maxWidth: "72%", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16 },
  myMessage: { backgroundColor: "#2563EB", borderTopRightRadius: 4 },
  theirMessage: { backgroundColor: "#fff", borderTopLeftRadius: 4, borderWidth: 1, borderColor: "#E2E8F0" },
  groupedMyBubble: { borderTopRightRadius: 14 },
  groupedTheirBubble: { borderTopLeftRadius: 14 },
  myMessageText: { color: "#fff", fontSize: 14 },
  theirMessageText: { color: "#111827", fontSize: 14 },
  myTimeText: { color: "rgba(255,255,255,0.85)", fontSize: 10, marginTop: 4, textAlign: "right" },
  theirTimeText: { color: "#94A3B8", fontSize: 10, marginTop: 4, textAlign: "right" },
  avatar: { width: 36, height: 36, borderRadius: 18, marginHorizontal: 6 },
  dayChipWrap: { alignItems: "center", marginVertical: 10 },
  dayChipText: {
    fontSize: 11,
    color: "#64748B",
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  emptyWrap: { alignItems: "center", marginTop: 60 },
  emptyText: { color: "#94A3B8", fontSize: 14, fontWeight: "600", marginTop: 8 },

  inputContainer: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F8FAFC",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#fff",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    color: "#0F172A",
    maxHeight: 110,
    textAlignVertical: "top",
  },
  sendBtn: {
    backgroundColor: "#3B82F6",
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { opacity: 0.7 },
});
