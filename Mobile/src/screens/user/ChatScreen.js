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
  updateDoc,
  arrayUnion,
  arrayRemove,
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

  // 1. Listen for real-time messages
  useEffect(() => {
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setMessages(msgs);
      flatListRef.current?.scrollToEnd({ animated: true });
    });

    return () => unsubscribe();
  }, []);

  // MAGIC PIECE: 2. Clear unread statuses automatically while active inside this view
  useEffect(() => {
    const chatDocRef = doc(db, "Chats", chatId);
    const unsubscribeChat = onSnapshot(chatDocRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        // If our ID is sitting inside the unread list, clean it out immediately
        if (data.unreadBy && data.unreadBy.includes(userId)) {
          try {
            await updateDoc(chatDocRef, {
              unreadBy: arrayRemove(userId),
            });
          } catch (error) {
            console.error("Error clearing chat unread marker dynamically:", error);
          }
        }
      }
    });

    return () => unsubscribeChat();
  }, [chatId, userId]);

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
      // Sets parent message parameters and marks the message unread for the vendor
      await setDoc(
        doc(db, "Chats", chatId),
        {
          participants: [userId, vendorId],
          lastMessage: msgText,
          lastUpdated: serverTimestamp(),
          unreadBy: arrayUnion(vendorId), 
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

  const sendProductMessage = async () => {
    if (!productPreview || !productPreview.image) {
      alert("Unable to send product - image not available");
      return;
    }

    setSending(true);
    const productTxt = `Interested in: ${productPreview.name}`;

    try {
      // Sets parent product message parameters and marks the message unread for the vendor
      await setDoc(
        doc(db, "Chats", chatId),
        {
          participants: [userId, vendorId],
          lastMessage: productTxt,
          lastUpdated: serverTimestamp(),
          unreadBy: arrayUnion(vendorId), 
        },
        { merge: true }
      );

      await addDoc(messagesRef, {
        senderId: userId,
        text: productTxt,
        timestamp: serverTimestamp(),
        productPreview: {
          productId: productPreview.productId,
          name: productPreview.name,
          price: productPreview.price,
          image: productPreview.image,
        },
        type: "product",
      });

      setText("");
    } catch (err) {
      console.log("Send product error:", err);
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

          {item.type === "product" && item.productPreview ? (
            <View
              style={[
                styles.productMessageBubble,
                isMe ? styles.myProductMessage : styles.theirProductMessage,
              ]}
            >
              {item.productPreview.image && (
                <Image
                  source={{ uri: item.productPreview.image }}
                  style={styles.productMessageImage}
                />
              )}
              <View style={styles.productMessageContent}>
                <Text style={styles.productMessageName} numberOfLines={2}>
                  {item.productPreview.name}
                </Text>
                <Text style={styles.productMessagePrice}>
                  ₱{item.productPreview.price?.toLocaleString()}
                </Text>
                <Text style={isMe ? styles.myTimeText : styles.theirTimeText}>
                  {timeLabel}
                </Text>
              </View>
            </View>
          ) : (
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
          )}

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
              onPress={sendProductMessage}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.productPreviewBtnText}>Send</Text>
              )}
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

// Keeping your original styles structure completely untouched
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 12 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#94A3B8",
    justifyContent: "center",
    alignItems: "center",
  },
  headerAvatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  headerTextWrap: { marginLeft: 10, flex: 1 },
  headerName: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  headerSub: { fontSize: 12, color: "#22C55E", fontWeight: "600", marginTop: 1 },
  archiveIcon: { width: 20, height: 20, resizeMode: "contain" },
  messagesContent: { paddingHorizontal: 16, paddingVertical: 16 },
  messageRow: { flexDirection: "row", marginBottom: 12, alignItems: "flex-end" },
  myMessageRow: { justifyContent: "flex-end" },
  theirMessageRow: { justifyContent: "flex-start" },
  compactTheirRow: { marginLeft: 42 },
  avatar: { width: 32, height: 32, borderRadius: 16, marginHorizontal: 6, marginBottom: 2 },
  messageBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, maxWidth: "75%" },
  myMessage: { backgroundColor: "#1E3A8A", borderBottomRightRadius: 4 },
  theirMessage: { backgroundColor: "#F1F5F9", borderBottomLeftRadius: 4 },
  groupedMyBubble: { borderTopRightRadius: 4 },
  groupedTheirBubble: { borderTopLeftRadius: 4 },
  myMessageText: { color: "#fff", fontSize: 15, lineHeight: 20 },
  theirMessageText: { color: "#0F172A", fontSize: 15, lineHeight: 20 },
  myTimeText: { fontSize: 10, color: "#93C5FD", textAlign: "right", marginTop: 4, fontWeight: "500" },
  theirTimeText: { fontSize: 10, color: "#94A3B8", marginTop: 4, fontWeight: "500" },
  dayChipWrap: { alignItems: "center", marginVertical: 16 },
  dayChipText: { backgroundColor: "#E2E8F0", color: "#64748B", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 11, fontWeight: "600" },
  inputContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#fff" },
  input: { flex: 1, backgroundColor: "#F1F5F9", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: "#0F172A", marginRight: 8, textAlignVertical: "center" },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#1E3A8A", justifyContent: "center", alignItems: "center" },
  sendBtnDisabled: { backgroundColor: "#CBD5E1" },
  productPreviewContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", padding: 12, borderBottomWidth: 1, borderColor: "#E2E8F0" },
  productPreviewImage: { width: 45, height: 45, borderRadius: 8 },
  productPreviewPlaceholder: { width: 45, height: 45, borderRadius: 8, backgroundColor: "#E2E8F0", justifyContent: "center", alignItems: "center" },
  productPreviewInfo: { flex: 1, marginLeft: 12 },
  productPreviewName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  productPreviewPrice: { fontSize: 13, color: "#1E3A8A", fontWeight: "600", marginTop: 2 },
  productPreviewBtn: { backgroundColor: "#1E3A8A", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  productPreviewBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  productMessageBubble: { borderRadius: 16, overflow: "hidden", maxWidth: "75%", backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  myProductMessage: { borderBottomRightRadius: 4 },
  theirProductMessage: { borderBottomLeftRadius: 4 },
  productMessageImage: { width: "100%", height: 130, resizeMode: "cover" },
  productMessageContent: { padding: 12 },
  productMessageName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  productMessagePrice: { fontSize: 13, color: "#1E3A8A", fontWeight: "600", marginTop: 4 },
  emptyWrap: { alignItems: "center", marginTop: 60 },
  emptyText: { color: "#94A3B8", fontSize: 14, fontWeight: "600", marginTop: 8 },
  sileoOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  sileoModal: { backgroundColor: "#fff", width: "100%", maxWith: 340, borderRadius: 24, padding: 24, alignItems: "center" },
  sileoIconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  sileoInfoCircle: { backgroundColor: "#EFF6FF" },
  sileoWarningCircle: { backgroundColor: "#FFFBEB" },
  sileoErrorCircle: { backgroundColor: "#FEF2F2" },
  sileoSuccessCircle: { backgroundColor: "#F0FDF4" },
  sileoIcon: { fontSize: 24, fontWeight: "700" },
  sileoTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A", marginBottom: 8, textAlign: "center" },
  sileoMessage: { fontSize: 14, color: "#475569", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  sileoActions: { flexDirection: "row", width: "100%" },
  sileoCancelButton: { flex: 1, height: 46, justifyContent: "center", alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: "#CBD5E1", marginRight: 12 },
  sileoCancelText: { color: "#475569", fontSize: 15, fontWeight: "600" },
  sileoButton: { flex: 1, height: 46, backgroundColor: "#1E3A8A", justifyContent: "center", alignItems: "center", borderRadius: 12 },
  sileoButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});