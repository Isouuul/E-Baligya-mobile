import OnfidoSdk from '@onfido/react-native-sdk';

export async function startOnfidoFlow(sdkToken) {
  try {
    const result = await OnfidoSdk.start({
      sdkToken,
      flowSteps: {
        welcome: true,
        captureDocument: false, // change to true if you want document capture
        captureFace: true,       // live selfie + liveness
      },
    });
    return result;
  } catch (error) {
    throw error;
  }
}

// Optional helper to fetch SDK token from backend
export async function fetchSdkToken() {
  try {
    const res = await fetch('http://localhost:3000/get-sdk-token'); // replace with your backend URL
    const data = await res.json();
    return data.token;
  } catch (err) {
    console.log('Failed to fetch SDK token:', err);
    throw err;
  }
}
