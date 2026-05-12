import axios from 'axios';

const CLIENT_ID = 'cwvbnsadggx7bvjbei7y5om49t43gf58';
const CLIENT_SECRET = 'wakd2mj0uxdm1gd4p7xtmynoaq2tn6w1bpb0b69sz747bz3sf0d9hblymw3bkqcn';

// utils/nyckel.js
export const getAccessToken = async () => {
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);

    const response = await axios.post(
      'https://www.nyckel.com/connect/token',
      params,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    console.log('✅ Nyckel Access Token:', response.data.access_token); // <-- log token
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Error getting access token:', error);
    return null;
  }
};


export const classifyFish = async (imageBase64) => {
  const token = await getAccessToken();
  if (!token) return;

  try {
    const response = await axios.post(
      'https://www.nyckel.com/v1/functions/if-fish-is-rotten/invoke',
      { data: imageBase64 }, // ✅ Nyckel requires "data"
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Headers:', error.response.headers);
      console.log('Data:', error.response.data); 
    } else {
      console.log('Error Message:', error.message);
    }
    throw error;
  }
};

