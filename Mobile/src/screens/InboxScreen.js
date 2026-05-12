import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

export default function InboxScreen({ navigation }) {
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
      activeOpacity={0.85}
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
          {item.lastMessage || "No messages yet"}
        </Text>
      </View>
      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* HEADER */}
      <View style={styles.customHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconCircle}
        >
          <Ionicons name="arrow-back" size={22} color="#1E3A8A" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Inbox</Text>
          <Text style={styles.headerSubTitle}>Messages</Text>
        </View>
        <View style={styles.iconCircle}>
          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#1E3A8A" />
        </View>
      </View>

      {/* CHAT LIST */}
      <FlatList
        data={chats}
        renderItem={renderItem}
        keyExtractor={(item) => item.chatId}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.emptyWrap}>
            <Ionicons name="chatbubble-ellipses-outline" size={42} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySub}>Your chats with vendors will appear here.</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: "#fff",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleWrap: { alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
  headerSubTitle: { fontSize: 11, color: "#94A3B8", fontWeight: "700", textTransform: "uppercase" },
  listContent: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 20 },

  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
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
  businessName: { fontWeight: "800", fontSize: 15, color: "#1E293B" },
  timeText: { fontSize: 11, color: "#94A3B8", fontWeight: "700", marginLeft: 8 },
  lastMessage: { color: "#64748B", fontSize: 13, marginTop: 2 },
  unreadBadge: {
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  emptyWrap: { alignItems: "center", marginTop: 70, paddingHorizontal: 24 },
  emptyTitle: { marginTop: 10, fontSize: 15, color: "#475569", fontWeight: "800" },
  emptySub: { marginTop: 6, fontSize: 13, color: "#94A3B8", textAlign: "center" },
});
