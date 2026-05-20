import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function UserAddressMapView() {
  const navigation = useNavigation();
  const route = useRoute();

  // Grab initial coordinates from route params (defaulting to Bacolod City)
  const initialLat = route.params?.latitude || 10.6689;
  const initialLng = route.params?.longitude || 122.9497;
  
  // Grab the cached form text fields so we can send them back smoothly
  const existingFormState = route.params?.savedFormState || null;

  const [markerCoords, setMarkerCoords] = useState({
    latitude: initialLat,
    longitude: initialLng,
  });

  const [mapRegion] = useState({
    latitude: initialLat,
    longitude: initialLng,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  });

  const handleConfirmLocation = () => {
    // Send coordinates back AND preserve the text form state values
    navigation.navigate({
      name: 'AddAddress',
      params: { 
        selectedLatitude: markerCoords.latitude, 
        selectedLongitude: markerCoords.longitude,
        hasSelectedLocation: true,
        savedFormState: existingFormState // Passes back form state seamlessly
      },
      merge: true,
    });
  };

  // --- NEW: Handle map clicks ---
  const handleMapPress = (e) => {
    setMarkerCoords(e.nativeEvent.coordinate);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Floating Back Button */}
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={24} color="#1E3A8A" />
      </TouchableOpacity>

      {/* Full Screen Map */}
      <MapView
        style={styles.map}
        initialRegion={mapRegion}
        onPress={handleMapPress} // <-- CRITICAL: Listen for map clicks here
      >
        <Marker
          coordinate={markerCoords} // Removed 'draggable' and 'onDragEnd'
          title="Delivery Spot"
          description="Your selected delivery point"
        />
      </MapView>

      {/* Bottom Floating Action Panel */}
      <View style={styles.footerPanel}>
        <Text style={styles.panelTitle}>Pin Delivery Location</Text>
        <Text style={styles.panelSubtitle}>
          Tap anywhere on the map to instantly drop your delivery pin.
        </Text>
        
        <View style={styles.coordsBadge}>
          <Text style={styles.coordsText}>
            Lat: {markerCoords.latitude.toFixed(5)} | Lng: {markerCoords.longitude.toFixed(5)}
          </Text>
        </View>

        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmLocation}>
          <Text style={styles.confirmButtonText}>Confirm Location</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { ...StyleSheet.absoluteFillObject },
  
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
  },

  footerPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 34,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  panelTitle: { fontSize: 18, fontWeight: '900', color: '#1E3A8A', marginBottom: 4 },
  panelSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '500', lineHeight: 18, marginBottom: 16 },
  
  coordsBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  coordsText: { fontSize: 12, color: '#475569', fontWeight: '700', fontFamily: 'monospace' },
  
  confirmButton: {
    backgroundColor: '#1E3A8A',
    borderRadius: 15,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#1E3A8A',
    shadowOpacity: 0.3,
  },
  confirmButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});