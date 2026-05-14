import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from "react-native";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, Timestamp, getDocs, query, collection, where } from "firebase/firestore";
import { db, auth } from "../../firebase";
import * as FileSystem from "expo-file-system";

const { width } = Dimensions.get("window");

/* ------------------------- PROGRESS STEPS UI ------------------------- */
const ProgressSteps = ({ currentStep = 5 }) => {
  const steps = ["Verify", "Business Permit", "Information", "Selfie", "Review"];
  return (
    <View style={styles.progressContainer}>
      {steps.map((label, idx) => {
        const step = idx + 1;
        const completed = step < currentStep;
        const active = step === currentStep;
        return (
          <React.Fragment key={idx}>
            <View style={styles.stepWrapper}>
              <View
                style={[
                  styles.circle,
                  completed && styles.completedCircle,
                  active && styles.activeCircle,
                ]}
              >
                {completed ? (
                  <Text style={styles.circleText}>✓</Text>
                ) : (
                  <Text style={[styles.circleText, !active && styles.inactiveText]}>
                    {step}
                  </Text>
                )}
              </View>
              <Text style={[styles.stepLabel, active && styles.activeStepLabel]}>
                {label}
              </Text>
            </View>
            {idx < steps.length - 1 && (
              <View
                style={[styles.line, { backgroundColor: completed ? "#2563EB" : "#E2E8F0" }]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

/* ------------------------- MAIN COMPONENT ------------------------- */
const VendorSignupReview = ({ route, navigation }) => {
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({
    title: "",
    message: "",
    buttonText: "OK",
    type: "info",
    onPress: null,
  });

const formData = route?.params?.formData ?? {};
  /* ------------------------- EXTRACT ALL DATA PROPERLY ------------------------- */
const {
  email,
  password,
  ownerName,
  phone,
  dateOfBirth,
  gender,
  businessName,
  permitNumber,
  businessType,
  marketName,
  govIDFront,
  govIDBack,
  permitImage,
  selfieUri,
  selectedProvince,
  selectedCity,
  selectedBarangay,
  streetName,
} = formData;

  /* ------------------------- OPTIONAL SAFE NORMALIZATION ------------------------- */
  const normalizedEmail = (email || "").trim().toLowerCase();

  const businessNameLower = (businessName || "").toLowerCase();

  /* ------------------------- IMAGE CONVERTER ------------------------- */
  const convertImageToBase64 = async (uri) => {
    if (!uri) return null;
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:image/jpeg;base64,${base64}`;
    } catch (e) {
      console.error("Image conversion failed:", uri, e);
      return null;
    }
  };

  /* ------------------------- SILEO MODAL ------------------------- */
  const showSileo = ({ title, message, buttonText = "OK", type = "info", onPress = null }) => {
    setSileoConfig({ title, message, buttonText, type, onPress });
    setSileoVisible(true);
  };

  const handleSileoClose = () => {
    setSileoVisible(false);
    if (typeof sileoConfig.onPress === "function") {
      sileoConfig.onPress();
    }
  };

  /* ------------------------- SUBMIT ------------------------- */
const handleSubmit = async () => {
  if (!agreed) {
    return showSileo({
      title: "Agreement Required",
      message: "Please agree to the terms before submitting your application.",
      type: "warning",
    });
  }

  if (!email || !password || !businessName || !ownerName) {
    return showSileo({
      title: "Missing Fields",
      message: "Please fill in all required information.",
      type: "warning",
    });
  }

  setLoading(true);

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);

    const [idF, idB, selfie, permit] = await Promise.all([
      convertImageToBase64(govIDFront),
      convertImageToBase64(govIDBack),
      convertImageToBase64(selfieUri),
      convertImageToBase64(permitImage),
    ]);

    const sanitizedEmail = email.toLowerCase().replace(/\./g, "_");

    // MAIN DOC
await setDoc(doc(db, "PendingVendors", sanitizedEmail), {
  businessName: businessName || "",
  email: email.trim().toLowerCase(),
  ownerName: ownerName || "",
  status: "Pending",
  hasFullData: true, // 🔥 ADD THIS
  userId: userCred.user.uid,
  createdAt: Timestamp.now(),
});

    // FULL DATA
    await setDoc(doc(db, "PendingVendors", sanitizedEmail, "fullData", "vendorData"), {
      ...formData,
      email,
      createdAt: Timestamp.now(),
    });

    // IMAGES
    const images = [
      { id: "govIDFront", b64: idF },
      { id: "govIDBack", b64: idB },
      { id: "selfie", b64: selfie },
      { id: "businessPermit", b64: permit },
    ];

    for (const img of images) {
      if (img.b64) {
        await setDoc(
          doc(db, "PendingVendors", sanitizedEmail, "images", img.id),
          { image: img.b64 }
        );
      }
    }

    await signOut(auth);

    showSileo({
      title: "Submitted",
      message: "Your application is now under review.",
      type: "success",
      buttonText: "Continue",
      onPress: () => navigation.navigate("Login"),
    });

  } catch (error) {
    showSileo({
      title: "Error",
      message: error.message || "Something went wrong.",
      type: "warning",
    });
  } finally {
    setLoading(false);
  }
};

  return (
    <View style={styles.mainWrapper}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Review: {businessName}</Text>
          <Text style={styles.headerSubtitle}>Final Verification</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <ProgressSteps currentStep={5} />

        <Text style={styles.pageTitle}>Review your Application</Text>
        <Text style={styles.pageSubtitle}>Please ensure all details match your legal documents.</Text>

        {/* PERSONAL INFO */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderText}>Personal Profile</Text>
          </View>
<ReviewItem label="Full Name" value={ownerName} />
<ReviewItem label="Contact Number" value={phone} />
<ReviewItem label="Email Address" value={email} />
<ReviewItem label="Birthdate" value={dateOfBirth} />
<ReviewItem label="Gender" value={gender} />
<ReviewItem 
  label="Home Address" 
  value={`${streetName}, ${selectedBarangay}, ${selectedCity}, ${selectedProvince}`} 
/>
        </View>

        {/* BUSINESS INFO */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderText}>Business Information</Text>
          </View>
<ReviewItem label="Business Name" value={businessName} />
<ReviewItem label="Market Location" value={marketName} />
<ReviewItem label="Permit Number" value={permitNumber} />
<ReviewItem label="Category" value={businessType} />
        </View>

        {/* DOCUMENTS */}
        <Text style={styles.sectionTitle}>Uploaded Documents</Text>
        <View style={styles.mediaGrid}>
          {[
            { uri: govIDFront, label: "ID Front" },
            { uri: govIDBack, label: "ID Back" },
            { uri: permitImage, label: "Permit" },
          ].map((item, idx) => (
            <View style={styles.mediaBox} key={idx}>
              <Image source={{ uri: item.uri }} style={styles.mediaImage} />
              <Text style={styles.mediaLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* TERMS */}
        <View style={styles.termsBox}>
          <Text style={styles.termsTitle}>Terms & Conditions</Text>
          <TouchableOpacity
            style={styles.checkboxRow}
            activeOpacity={0.85}
            onPress={() => setAgreed(!agreed)}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
              {agreed && <Text style={styles.checkText}>✓</Text>}
            </View>
            <View style={styles.termsTextWrap}>
              <Text style={styles.termsLabel}>
                I confirm that all information provided is true, accurate, and complete.
              </Text>
              <Text style={styles.termsSubLabel}>
                By submitting this application, you agree to our Terms and Conditions.
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.viewTermsBtn}
            onPress={() => navigation.navigate("TermsPolicyScreen")}
          >
            <Text style={styles.viewTermsText}>View full Terms & Conditions</Text>
            <Text style={styles.viewTermsArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* FOOTER */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, (!agreed || loading) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!agreed || loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit Application</Text>}
        </TouchableOpacity>
      </View>

      {sileoVisible && (
        <View style={styles.sileoOverlay}>
          <View style={styles.sileoModal}>
            <View
              style={[
                styles.sileoIconCircle,
                sileoConfig.type === "success"
                  ? styles.sileoSuccessCircle
                  : sileoConfig.type === "warning"
                    ? styles.sileoWarningCircle
                    : styles.sileoInfoCircle,
              ]}
            >
              <Text style={styles.sileoIcon}>
                {sileoConfig.type === "success" ? "✓" : sileoConfig.type === "warning" ? "!" : "i"}
              </Text>
            </View>
            <Text style={styles.sileoTitle}>{sileoConfig.title}</Text>
            <Text style={styles.sileoMessage}>{sileoConfig.message}</Text>
            <TouchableOpacity style={styles.sileoButton} onPress={handleSileoClose}>
              <Text style={styles.sileoButtonText}>{sileoConfig.buttonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

/* ------------------------- REVIEW ITEM ------------------------- */
const ReviewItem = ({ label, value }) => (
  <View style={styles.reviewItem}>
    <Text style={styles.reviewLabel}>{label}</Text>
    <Text style={styles.reviewValue}>{value || "—"}</Text>
  </View>
);

/* ------------------------- STYLES ------------------------- */
const styles = StyleSheet.create({
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
    width: "82%",
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
  sileoSuccessCircle: { backgroundColor: "#10B981" },
  sileoWarningCircle: { backgroundColor: "#F59E0B" },
  sileoInfoCircle: { backgroundColor: "#2563EB" },
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
  sileoButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  sileoButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  mainWrapper: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { backgroundColor: "#fff", paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginRight: 16 },
  backIcon: { fontSize: 20, color: "#1E293B", fontWeight: "bold" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  headerSubtitle: { fontSize: 12, color: "#64748B" },
  container: { padding: 16 },
  pageTitle: { fontSize: 22, fontWeight: "800", color: "#1E293B", marginBottom: 4 },
  pageSubtitle: { fontSize: 14, color: "#64748B", marginBottom: 24 },
  progressContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 30 },
  stepWrapper: { alignItems: "center" },
  circle: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#fff", borderWidth: 2, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  activeCircle: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  completedCircle: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  circleText: { fontSize: 11, fontWeight: "bold", color: "#fff" },
  inactiveText: { color: "#94A3B8" },
  stepLabel: { marginTop: 6, fontSize: 10, color: "#94A3B8", fontWeight: "700" },
  activeStepLabel: { color: "#2563EB" },
  line: { height: 2, flex: 1, marginTop: -16, marginHorizontal: -5 },
  card: { backgroundColor: "#fff", borderRadius: 16, marginBottom: 16, overflow: "hidden", borderWidth: 1, borderColor: "#F1F5F9", elevation: 2, shadowOpacity: 0.05 },
  cardHeader: { backgroundColor: "#F8FAFC", padding: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  cardHeaderText: { fontSize: 12, fontWeight: "800", color: "#64748B", textTransform: "uppercase", letterSpacing: 1 },
  reviewItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F8FAFC" },
  reviewLabel: { fontSize: 11, color: "#94A3B8", fontWeight: "600", textTransform: "uppercase" },
  reviewValue: { fontSize: 14, color: "#1E293B", fontWeight: "700", marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B", marginTop: 10, marginBottom: 12 },
  mediaGrid: { flexDirection: "row", justifyContent: "space-between" },
  mediaBox: { width: (width - 48) / 3, alignItems: "center" },
  mediaImage: { width: "100%", height: 100, borderRadius: 12, backgroundColor: "#E2E8F0", borderWidth: 1, borderColor: "#F1F5F9" },
  mediaLabel: { fontSize: 11, fontWeight: "700", color: "#64748B", marginTop: 6 },
  termsBox: { marginTop: 20, padding: 16, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  termsTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginBottom: 10 },
  checkboxRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 2 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: "#CBD5E1", marginRight: 12, marginTop: 1, justifyContent: "center", alignItems: "center" },
  checkboxActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  checkText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  termsTextWrap: { flex: 1 },
  termsLabel: { fontSize: 13, color: "#334155", lineHeight: 19, fontWeight: "600" },
  termsSubLabel: { marginTop: 3, fontSize: 12, color: "#64748B", lineHeight: 18, fontWeight: "500" },
  viewTermsBtn: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  viewTermsText: { color: "#2563EB", fontWeight: "700", fontSize: 13 },
  viewTermsArrow: { color: "#2563EB", fontSize: 20, lineHeight: 20, fontWeight: "700" },
  footer: { position: "absolute", bottom: 0, width: width, padding: 20, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  btn: { backgroundColor: "#2563EB", padding: 16, borderRadius: 12, alignItems: "center" },
  btnDisabled: { backgroundColor: "#CBD5E1" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});

export default VendorSignupReview;
