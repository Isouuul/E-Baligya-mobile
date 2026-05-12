import React, { useEffect, useState, useRef } from "react";
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
  Modal,
} from "react-native";
import { auth, db } from "../../firebase";
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
  deleteDoc,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

export default function ChatScreen({ route, navigation }) {
const { vendorId, productPreview } = route.params;
  const userId = auth.currentUser.uid;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [inputHeight, setInputHeight] = useState(42);

  const [vendorProfile, setVendorProfile] = useState({
    businessName: "Unknown Vendor",
    profileImage: null,
  });

  const [currentUserProfile, setCurrentUserProfile] = useState({
    profileImage: null,
  });
  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({
    title: "",
    message: "",
    type: "info",
    confirmText: "OK",
    cancelText: null,
    onConfirm: null,
  });

  const flatListRef = useRef();
  const chatId = userId < vendorId ? `${userId}_${vendorId}` : `${vendorId}_${userId}`;
  const messagesRef = collection(db, "Chats", chatId, "messages");
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

  const showSileo = ({
    title,
    message,
    type = "info",
    confirmText = "OK",
    cancelText = null,
    onConfirm = null,
  }) => {
    setSileoConfig({ title, message, type, confirmText, cancelText, onConfirm });
    setSileoVisible(true);
  };

  const handleSileoConfirm = async () => {
    const action = sileoConfig.onConfirm;
    setSileoVisible(false);
    if (typeof action === "function") {
      await action();
    }
  };

  const fetchVendorProfile = async () => {
    try {
      const userSnap = await getDoc(doc(db, "Users", vendorId));
      if (userSnap.exists()) {
        const data = userSnap.data();
        setVendorProfile({
          businessName:
            data.businessName ||
            `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
            "Unknown Vendor",
          profileImage: data.profileImage || data.selfieImage || null,
        });
        return;
      }

      const vendorQuery = query(collection(db, "ApprovedVendors"));
      const vendorSnap = await getDocs(vendorQuery);
      const vendorDoc = vendorSnap.docs.find((d) => d.data().userId === vendorId);
      if (vendorDoc) {
        const data = vendorDoc.data();
        setVendorProfile({
          businessName: data.businessName || "Unknown Vendor",
          profileImage: data.profileImage || data.selfie || null,
        });
      }
    } catch (err) {
      console.log("Error fetching vendor profile:", err);
    }
  };

  const fetchCurrentUserProfile = async () => {
    try {
      const userSnap = await getDoc(doc(db, "Users", userId));
      if (userSnap.exists()) {
        const data = userSnap.data();
        setCurrentUserProfile({
          profileImage: data.profileImage || null,
        });
      }
    } catch (err) {
      console.log("Error fetching current user profile:", err);
    }
  };

  useEffect(() => {
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setMessages(msgs);
      flatListRef.current?.scrollToEnd({ animated: true });
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetchVendorProfile();
    fetchCurrentUserProfile();
  }, []);

  const sendMessage = async () => {
    if (!canSend) return;
    setSending(true);
    const msgText = text.trim();
    setText("");

    try {
      await setDoc(
        doc(db, "Chats", chatId),
        {
          participants: [userId, vendorId],
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
    }

    setSending(false);
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
          {showAvatar && vendorProfile.profileImage && (
            <Image source={{ uri: vendorProfile.profileImage }} style={styles.avatar} />
          )}

          <View
            style={[
              styles.messageBubble,
              isMe ? styles.myMessage : styles.theirMessage,
              sameSenderAsPrev && (isMe ? styles.groupedMyBubble : styles.groupedTheirBubble),
            ]}
          >
            <Text style={isMe ? styles.myMessageText : styles.theirMessageText}>
              {item.text}
            </Text>
            {!!timeLabel && (
              <Text style={isMe ? styles.myTimeText : styles.theirTimeText}>{timeLabel}</Text>
            )}
          </View>

          {isMe && currentUserProfile.profileImage && (
            <Image
              source={{
                uri: currentUserProfile.profileImage.startsWith("http")
                  ? currentUserProfile.profileImage
                  : `data:image/jpeg;base64,${currentUserProfile.profileImage}`,
              }}
              style={styles.avatar}
            />
          )}
        </View>
      </View>
    );
  };

  const performArchiveChat = async () => {
    try {
      const msgsSnapshot = await getDocs(messagesRef);
      if (msgsSnapshot.empty) {
        showSileo({
          title: "No Messages",
          message: "This chat has no messages to archive.",
          type: "info",
          confirmText: "OK",
        });
        return;
      }

      const archivedRef = collection(db, "Archived_Chats", chatId, "messages");
      await Promise.all(
        msgsSnapshot.docs.map(async (docSnap) => {
          await setDoc(doc(archivedRef, docSnap.id), docSnap.data());
          await deleteDoc(doc(db, "Chats", chatId, "messages", docSnap.id));
        })
      );

      await deleteDoc(doc(db, "Chats", chatId));

      showSileo({
        title: "Archived",
        message: "Chat archived successfully.",
        type: "success",
        confirmText: "OK",
        onConfirm: () => navigation.goBack(),
      });
    } catch (err) {
      console.log("Archive error:", err);
      showSileo({
        title: "Error",
        message: "Failed to archive chat.",
        type: "error",
        confirmText: "OK",
      });
    }
  };

  const archiveChat = () => {
    showSileo({
      title: "Archive Chat",
      message: "Are you sure you want to archive this chat?",
      type: "warning",
      confirmText: "Archive",
      cancelText: "Cancel",
      onConfirm: performArchiveChat,
    });
  };

  const onInputSizeChange = (event) => {
    const nextHeight = Math.min(110, Math.max(42, event?.nativeEvent?.contentSize?.height || 42));
    setInputHeight(nextHeight);
  };

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
            {vendorProfile.profileImage ? (
              <Image
                source={{ uri: vendorProfile.profileImage }}
                style={styles.headerAvatar}
              />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Text style={styles.headerAvatarText}>
                  {vendorProfile.businessName?.[0] || "V"}
                </Text>
              </View>
            )}

            <View style={styles.headerTextWrap}>
              <Text style={styles.headerName} numberOfLines={1}>{vendorProfile.businessName}</Text>
              <Text style={styles.headerSub}>Active chat</Text>
            </View>
          </View>

          <TouchableOpacity onPress={archiveChat} style={styles.iconCircle}>
            <Image
              source={require("../../../assets/Trash.png")}
              style={styles.archiveIcon}
            />
          </TouchableOpacity>
        </View>
{productPreview && (
  <View style={styles.productPreviewContainer}>
    {productPreview.image ? (
      <Image source={{ uri: productPreview.image }} style={styles.productPreviewImage} />
    ) : (
      <View style={styles.productPreviewPlaceholder}>
        <Ionicons name="image-outline" size={24} color="#94A3B8" />
      </View>
    )}

    <View style={styles.productPreviewInfo}>
      <Text style={styles.productPreviewName} numberOfLines={1}>
        {productPreview.name}
      </Text>
      <Text style={styles.productPreviewPrice}>
        ₱{productPreview.price?.toLocaleString()}
      </Text>
    </View>

    <TouchableOpacity
      style={styles.productPreviewBtn}
      onPress={() => setText(`Hi, I'm interested in "${productPreview.name}"`)}
    >
      <Text style={styles.productPreviewBtnText}>Ask</Text>
    </TouchableOpacity>
  </View>
)}
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
                <Text style={styles.emptyText}>Start the conversation</Text>
              </View>
            )}
          />

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { height: inputHeight }]}
              placeholder={`Message ${vendorProfile.businessName}`}
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
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={sileoVisible} animationType="fade" transparent>
        <View style={styles.sileoOverlay}>
          <View style={styles.sileoModal}>
            <View
              style={[
                styles.sileoIconCircle,
                sileoConfig.type === "warning"
                  ? styles.sileoWarningCircle
                  : sileoConfig.type === "error"
                    ? styles.sileoErrorCircle
                    : sileoConfig.type === "success"
                      ? styles.sileoSuccessCircle
                      : styles.sileoInfoCircle,
              ]}
            >
              <Text style={styles.sileoIcon}>
                {sileoConfig.type === "warning"
                  ? "!"
                  : sileoConfig.type === "error"
                    ? "×"
                    : sileoConfig.type === "success"
                      ? "✓"
                      : "i"}
              </Text>
            </View>

            <Text style={styles.sileoTitle}>{sileoConfig.title}</Text>
            <Text style={styles.sileoMessage}>{sileoConfig.message}</Text>

            <View style={styles.sileoActions}>
              {sileoConfig.cancelText && (
                <TouchableOpacity style={styles.sileoCancelButton} onPress={() => setSileoVisible(false)}>
                  <Text style={styles.sileoCancelText}>{sileoConfig.cancelText}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.sileoButton} onPress={handleSileoConfirm}>
                <Text style={styles.sileoButtonText}>{sileoConfig.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 15,
    marginTop: 35
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
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
  archiveIcon: { width: 20, height: 20, resizeMode: "contain" },

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
  emptyWrap: { alignItems: "center", marginTop: 60 },
  emptyText: { color: "#94A3B8", fontSize: 14, fontWeight: "600", marginTop: 8 },
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
    textAlignVertical: "top",
    maxHeight: 110,
  },
  sendBtn: {
    backgroundColor: "#3B82F6",
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { opacity: 0.55 },

  sileoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(36, 41, 46, 0.32)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  sileoModal: {
    width: "84%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  sileoIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  sileoWarningCircle: { backgroundColor: "#F59E0B" },
  sileoInfoCircle: { backgroundColor: "#2563EB" },
  sileoErrorCircle: { backgroundColor: "#EF4444" },
  sileoSuccessCircle: { backgroundColor: "#16A34A" },
  sileoIcon: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
  },
  sileoTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
    textAlign: "center",
  },
  sileoMessage: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    marginBottom: 20,
    fontWeight: "500",
    lineHeight: 20,
  },
  sileoActions: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  sileoCancelButton: {
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 22,
    alignItems: "center",
  },
  sileoCancelText: {
    color: "#334155",
    fontWeight: "800",
    fontSize: 15,
  },
  sileoButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 22,
    alignItems: "center",
  },
  sileoButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  productPreviewContainer: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#FFFFFF",
  marginHorizontal: 12,
  marginTop: 10,
  padding: 10,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "#E2E8F0",
},

productPreviewImage: {
  width: 50,
  height: 50,
  borderRadius: 10,
},

productPreviewPlaceholder: {
  width: 50,
  height: 50,
  borderRadius: 10,
  backgroundColor: "#F1F5F9",
  justifyContent: "center",
  alignItems: "center",
},

productPreviewInfo: {
  flex: 1,
  marginLeft: 10,
},

productPreviewName: {
  fontSize: 14,
  fontWeight: "700",
  color: "#0F172A",
},

productPreviewPrice: {
  fontSize: 13,
  color: "#475569",
  marginTop: 2,
},

productPreviewBtn: {
  backgroundColor: "#2563EB",
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 10,
},

productPreviewBtnText: {
  color: "#fff",
  fontWeight: "700",
  fontSize: 12,
},
});
