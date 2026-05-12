import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { db, auth } from "../../../firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

export default function VendorInbox({ navigation }) {
  const userId = auth.currentUser.uid;
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  const formatRelativeTime = (date) => {
    if (!date) return "";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // -----------------------------
  // Centralized fetch for Users/Vendors
  // -----------------------------
  const fetchVendorProfile = async (otherUserId) => {
    try {
      // Try Users collection first
      const userSnap = await getDoc(doc(db, "Users", otherUserId));
      if (userSnap.exists()) {
        const data = userSnap.data();
        return {
          businessName:
            data.businessName ||
            `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
            "Unknown Vendor",
          profileImage: data.profileImage || data.selfieImage || null,
        };
      }

      // Fallback to VendorUsers collection
      const vendorSnap = await getDocs(collection(db, "ApprovedVendors"));
      const vendorDoc = vendorSnap.docs.find((d) => d.data().userId === otherUserId);
      if (vendorDoc) {
        const data = vendorDoc.data();
        return {
          businessName: data.businessName || "Unknown Vendor",
          profileImage: data.profileImage || data.selfie || null,
        };
      }

      return { businessName: "Unknown Vendor", profileImage: null };
    } catch (err) {
      console.log("Error fetching vendor profile:", err);
      return { businessName: "Unknown Vendor", profileImage: null };
    }
  };

  // -----------------------------
  // Fetch chats
  // -----------------------------
  useEffect(() => {
    const chatsCol = collection(db, "Chats");
    const q = query(chatsCol, where("participants", "array-contains", userId));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatData = await Promise.all(
        snapshot.docs.map(async (chatDoc) => {
          const chatId = chatDoc.id;
          const chat = chatDoc.data();

          const otherUserId = chat.participants.find((id) => id !== userId);

          // Get last message & unread count
          const messagesSnap = await getDocs(collection(db, "Chats", chatId, "messages"));
          const msgs = messagesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          msgs.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);
          const lastMsg = msgs[0];
          const unreadCount = msgs.filter(
            (m) => m.senderId === otherUserId && m.status !== "seen"
          ).length;

          // Get vendor/user profile
          const vendorData = await fetchVendorProfile(otherUserId);

          return {
            chatId,
            vendorId: otherUserId,
            businessName: vendorData.businessName,
            profileImage: vendorData.profileImage,
            lastMessage: lastMsg?.text || "",
            lastMessageTime: lastMsg?.timestamp?.toDate() || null,
            unreadCount,
          };
        })
      );

      // Sort chats by last message time
      chatData.sort((a, b) => {
        const t1 = a.lastMessageTime?.getTime() || 0;
        const t2 = b.lastMessageTime?.getTime() || 0;
        return t2 - t1;
      });

      setChats(chatData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chatRow}
      onPress={() => navigation.navigate("ChatScreen", { vendorId: item.vendorId })}
    >
      {item.profileImage ? (
        <Image source={{ uri: item.profileImage }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            {item.businessName?.[0] || "V"}
          </Text>
        </View>
      )}
      <View style={styles.chatInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.businessName} numberOfLines={1}>{item.businessName}</Text>
          <Text style={styles.timeText}>{formatRelativeTime(item.lastMessageTime)}</Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>
      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={{ color: "#fff", fontSize: 12 }}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: "#F6F8FC" }}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inbox</Text>
      </View>

      {/* CHAT LIST */}
      <FlatList
        data={chats}
        renderItem={renderItem}
        keyExtractor={(item) => item.chatId}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={() => (
          <View style={styles.emptyWrap}>
            <Ionicons name="chatbubble-ellipses-outline" size={42} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySub}>Chats with customers will appear here.</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: "#fff",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  backButton: { marginRight: 15 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#000" },

  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#6B7280",
    justifyContent: "center",
    alignItems: "center",
  },
  chatInfo: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  businessName: { fontWeight: "bold", fontSize: 16, color: "#1E293B", flex: 1 },
  timeText: { fontSize: 11, color: "#94A3B8", fontWeight: "700", marginLeft: 8 },
  lastMessage: { color: "#6B7280", fontSize: 14, marginTop: 2 },
  unreadBadge: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyWrap: { alignItems: "center", marginTop: 70, paddingHorizontal: 24 },
  emptyTitle: { marginTop: 10, fontSize: 15, color: "#475569", fontWeight: "800" },
  emptySub: { marginTop: 6, fontSize: 13, color: "#94A3B8", textAlign: "center" },
});
