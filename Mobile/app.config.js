export default {
  expo: {
    name: "E-Baligya",
    slug: "your-app-slug",
    version: "1.0.0",
    android: {
      package: "com.shezzowicked15.oseafood",
    },
    icon: "./assets/ebaligya.png",        // <-- Your PNG icon here
    splash: {
      image: "./assets/ebaligya.png",   // <-- Your splash PNG here
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    extra: {
      GOOGLE_VISION_KEY: process.env.GOOGLE_VISION_KEY,
      eas: {
        projectId: "61b3d40d-8612-4bea-8901-1138ae1252a3"
      }
    },
  },
};
