import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import { auth, db } from "../../firebase"; // Adjust path to match your structure
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  getDoc,
  getDocs, 
  updateDoc,
  arrayRemove,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

export default function InboxScreenUser({ navigation }) {
  const userId = auth.currentUser?.uid;
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const chatsQuery = query(
      collection(db, "Chats"),
      where("participants", "array-contains", userId),
      orderBy("lastUpdated", "desc")
    );

    const unsubscribe = onSnapshot(
      chatsQuery,
      async (snapshot) => {
        const chatList = [];

        for (const changeDoc of snapshot.docs) {
          const chatData = changeDoc.data();
          const chatId = changeDoc.id;

          const vendorId = chatData.participants.find((id) => id !== userId);

          if (vendorId) {
            const vendorProfile = await fetchVendorProfile(vendorId);
            const isUnread = chatData.unreadBy?.includes(userId) || false;

            chatList.push({
              id: chatId,
              vendorId,
              lastMessage: chatData.lastMessage || "No messages yet",
              timestamp: chatData.lastUpdated,
              isUnread: isUnread,
              ...vendorProfile,
            });
          }
        }

        setChats(chatList);
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to chats: ", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const fetchVendorProfile = async (vendorId) => {
    let profile = {
      businessName: "Unknown Vendor",
      profileImage: null,
    };

    try {
      const userSnap = await getDoc(doc(db, "Users", vendorId));
      if (userSnap.exists()) {
        const data = userSnap.data();
        profile.businessName =
          data.businessName ||
          `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
          "Unknown Vendor";
        profile.profileImage = data.profileImage || data.selfieImage || null;
        return profile;
      }

      const vendorQuery = query(collection(db, "ApprovedVendors"));
      const vendorSnap = await getDocs(vendorQuery);
      const vendorDoc = vendorSnap.docs.find((d) => d.data().userId === vendorId);
      
      if (vendorDoc) {
        const data = vendorDoc.data();
        profile.businessName = data.businessName || "Unknown Vendor";
        profile.profileImage = data.profileImage || data.selfie || null;
      }
    } catch (err) {
      console.log("Error resolving vendor profile data matches: ", err);
    }
    return profile;
  };

  const handleChatPress = async (item) => {
    navigation.navigate("ChatScreen", {
      vendorId: item.vendorId,
      productPreview: null,
    });

    if (item.isUnread) {
      try {
        const chatRef = doc(db, "Chats", item.id);
        await updateDoc(chatRef, {
          unreadBy: arrayRemove(userId),
        });
      } catch (error) {
        console.error("Error marking chat as read: ", error);
      }
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return "";
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderChatItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={[styles.chatCard, item.isUnread && styles.unreadCard]}
        onPress={() => handleChatPress(item)}
      >
        {item.profileImage ? (
          <Image source={{ uri: item.profileImage }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{item.businessName?.[0] || "V"}</Text>
          </View>
        )}

        <View style={styles.chatInfo}>
          <View style={styles.rowHeader}>
            <Text
              style={[styles.businessName, item.isUnread && styles.unreadText]}
              numberOfLines={1}
            >
              {item.businessName}
            </Text>
            <Text style={styles.timeText}>{formatTime(item.timestamp)}</Text>
          </View>

          <View style={styles.rowFooter}>
            <Text
              style={[styles.lastMessage, item.isUnread && styles.unreadMessageText]}
              numberOfLines={1}
            >
              {item.lastMessage}
            </Text>
            {item.isUnread && <View style={styles.unreadDot} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* HEADER WITH BACK BUTTON */}
      <View style={styles.header}>
        {navigation.canGoBack() && (
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyWrap}>
              <Ionicons name="chatbubbles-outline" size={54} color="#CBD5E1" />
              <Text style={styles.emptyText}>No conversations yet</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: Platform.OS === "android" ? 25 : 0,
    flexDirection: "row", // Added to lay button and title side-by-side
    alignItems: "center", // Center items vertically
  },
  backButton: {
    marginRight: 12,
    padding: 4, // Increases touch target size
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1E293B",
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { paddingVertical: 8 },
  chatCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  unreadCard: {
    backgroundColor: "#F0F5FF",
    borderColor: "#BFDBFE",
  },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#94A3B8",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  chatInfo: { flex: 1, marginLeft: 14 },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  rowFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  businessName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
    marginRight: 10,
  },
  unreadText: {
    color: "#1E3A8A",
  },
  timeText: { fontSize: 12, color: "#94A3B8", fontWeight: "500" },
  lastMessage: { fontSize: 14, color: "#64748B", fontWeight: "400", flex: 1, marginRight: 8 },
  unreadMessageText: {
    fontWeight: "600",
    color: "#1E293B",
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2563EB",
  },
  emptyWrap: { alignItems: "center", marginTop: 100 },
  emptyText: { color: "#94A3B8", fontSize: 16, fontWeight: "600", marginTop: 12 },
});