export default {
  expo: {
    owner: "shezzowicked15",
    name: "E-BALIGYA",
    slug: "e-baligya",
    version: "18.0.0",
    newArchEnabled: false,
    
    icon: "./assets/ebaligya-logo.png",
    
    android: {
      icon: "./assets/ebaligya-logo.png",
      adaptiveIcon: {
        foregroundImage: "./assets/ebaligya-logo.png",
        backgroundColor: "#ffffff"
      },
      package: "com.ebaligya.app"
    },
    
    ios: {
      icon: "./assets/ebaligya-logo.png",
      bundleIdentifier: "com.ebaligya.app"
    },

    extra: {
      eas: {
        projectId: "a2aa7eb2-5620-401d-9ad1-61376d5fed56"
      }
    }
  }
};