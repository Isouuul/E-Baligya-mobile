import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { auth, db } from "../../../firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";

export default function ChatScreenVendor({ route, navigation }) {
  const { chatId, clientId, clientName } = route.params;
  const vendorId = auth.currentUser?.uid;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (!chatId) return;

    const messagesQuery = query(
      collection(db, "Chats", chatId, "Messages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(msgList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [chatId]);

  const handleSend = async () => {
    if (!text.trim()) return;

    const messageText = text.trim();
    setText(""); // Clear out the input immediately for sleek UX

    try {
      // 1. Put message in deep subcollection
      await addDoc(collection(db, "Chats", chatId, "Messages"), {
        text: messageText,
        senderId: vendorId,
        timestamp: serverTimestamp(),
      });

      // 2. Alert parent metadata document so client inbox triggers change
      const chatRef = doc(db, "Chats", chatId);
      await updateDoc(chatRef, {
        lastMessage: messageText,
        lastUpdated: serverTimestamp(),
        unreadBy: [clientId], // Set unread flag for client side
      });
    } catch (error) {
      console.error("Error running vendor sendMessage sequence: ", error);
    }
  };

  const renderMessageItem = ({ item }) => {
    const isMe = item.senderId === vendorId;
    return (
      <View style={[styles.msgContainer, isMe ? styles.msgRight : styles.msgLeft]}>
        <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
          <Text style={[styles.msgText, isMe ? styles.textRight : styles.textLeft]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
        <StatusBar  hidden={false} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {clientName || "Customer"}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {/* Input section tray */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message to customer..."
            placeholderTextColor="#94A3B8"
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", marginTop:35 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A", textAlign: "center", flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  messageList: { paddingHorizontal: 14, paddingVertical: 16 },
  msgContainer: { flexDirection: "row", marginVertical: 4, width: "100%" },
  msgLeft: { justifyContent: "flex-start" },
  msgRight: { justifyContent: "flex-end" },
  bubble: { maxWidth: "75%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  bubbleLeft: { backgroundColor: "#E2E8F0", borderBottomLeftRadius: 4 },
  bubbleRight: { backgroundColor: "#10B981", borderBottomRightRadius: 4 },
  msgText: { fontSize: 15, lineHeight: 20 },
  textLeft: { color: "#1E293B" },
  textRight: { color: "#fff" },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
  },
  input: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 15,
    maxHeight: 100,
    color: "#0F172A",
  },
  sendBtn: {
    backgroundColor: "#10B981",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
});