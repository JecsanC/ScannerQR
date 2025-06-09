import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Dimensions,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
// CORRECCIÓN: Agregado CircleAlert a la importación
import { MapPin, QrCode, Zap, Clock, Info, CircleAlert } from 'lucide-react-native';
import { database } from '@/bdConfig/bd';

const { width, height } = Dimensions.get('window');
const SCAN_AREA_SIZE = width * 0.7;

interface ScanResult {
  data: string;
  location: Location.LocationObject | null;
  timestamp: number;
}

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [scanCount, setScanCount] = useState<number>(0);
  const [notificationOpacity] = useState(new Animated.Value(0));
  const [isScanning, setIsScanning] = useState<boolean>(true);

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    if (!isScanning && lastScan) {
      const timer = setTimeout(() => {
        setIsScanning(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isScanning, lastScan]);

  const initializeApp = async () => {
    try {
      await database.init();
      await getLocationPermission();
      await getCurrentLocation();

      const scans = await database.getScans();
      setScanCount(scans.length);
    } catch (error) {
      console.error('Error initializing app:', error);
      Alert.alert('Error de Inicio', 'No se pudo inicializar la aplicación. Intenta reiniciar.');
    }
  };

  const getLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');

      if (status !== 'granted') {
        Alert.alert(
          'Permisos de Ubicación Necesarios',
          'Para registrar la ubicación de tus escaneos, necesitamos acceso a tu ubicación. Puedes activarlo en la configuración de tu dispositivo.',
          [{ text: 'Entendido' }]
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      Alert.alert('Error de Permisos', 'No se pudieron solicitar los permisos de ubicación.');
    }
  };

  const getCurrentLocation = async () => {
    try {
      if (locationPermission) {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          // CORRECCIÓN: Eliminada la propiedad 'timeout' que no es válida aquí.
          // Si necesitas un timeout, impleméntalo fuera de esta función o usa Promise.race.
        });
        setLocation(loc);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const showNotification = (message: string) => {
    Animated.sequence([
      Animated.timing(notificationOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2500),
      Animated.timing(notificationOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const formatDateTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatLocation = (lat: number | null, lng: number | null): string => {
    if (lat && lng) {
      return `Lat: ${lat.toFixed(4)}, Lon: ${lng.toFixed(4)}`;
    }
    return 'Ubicación no disponible';
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (!isScanning) return;

    try {
      setIsScanning(false);
      let currentLocation = null;
      if (locationPermission) {
        try {
          const locPromise = Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            // CORRECCIÓN: Eliminada la propiedad 'timeout' aquí también.
          });

          // Opcional: Implementa un timeout manual si es crítico
          currentLocation = await Promise.race([
            locPromise,
            new Promise<Location.LocationObject>((_, reject) =>
              setTimeout(() => reject(new Error('Location timeout')), 5000) // 5 segundos de timeout
            )
          ]).catch(error => {
            console.warn('Error or timeout getting location during scan:', error);
            return null; // Devuelve null si hay un error o timeout
          });

          setLocation(currentLocation);
        } catch (error) {
          console.error('Error getting current location during scan:', error);
        }
      }

      const scanResult: ScanResult = {
        data,
        location: currentLocation,
        timestamp: Date.now(),
      };

      setLastScan(scanResult);

      await saveScanToDatabase(scanResult);

      const scans = await database.getScans();
      setScanCount(scans.length);

      showNotification('¡Código QR escaneado con éxito!');

    } catch (error) {
      console.error('Error handling scan:', error);
      Alert.alert('Error de Escaneo', 'Hubo un problema al procesar el código QR. Inténtalo de nuevo.');
      setIsScanning(true);
    }
  };

  const saveScanToDatabase = async (scanResult: ScanResult) => {
    try {
      const scanData = {
        qr_data: scanResult.data,
        latitude: scanResult.location?.coords.latitude || null,
        longitude: scanResult.location?.coords.longitude || null,
        altitude: scanResult.location?.coords.altitude || null,
        accuracy: scanResult.location?.coords.accuracy || null,
        timestamp: scanResult.timestamp,
      };

      const id = await database.addScan(scanData);
      console.log('Scan saved successfully with ID:', id);
    } catch (error) {
      console.error('Error saving scan:', error);
      throw error;
    }
  };

  if (!permission) {
    return (
      <View style={newStyles.permissionContainer}>
        <Text style={newStyles.permissionText}>Solicitando permisos de cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={newStyles.permissionContainer}>
        <View style={newStyles.permissionContent}>
          <QrCode size={100} color="#4A90E2" />
          <Text style={newStyles.permissionTitle}>Acceso a la Cámara Necesario</Text>
          <Text style={newStyles.permissionMessage}>
            Esta aplicación necesita permisos de cámara para escanear códigos QR. Por favor, concédelos para continuar.
          </Text>
          <TouchableOpacity style={newStyles.permissionButton} onPress={requestPermission}>
            <Text style={newStyles.permissionButtonText}>Conceder Permisos</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={newStyles.container}>
      <Animated.View style={[newStyles.notification, { opacity: notificationOpacity }]}>
        <Zap size={20} color="white" />
        <Text style={newStyles.notificationText}>¡Código QR escaneado con éxito!</Text>
      </Animated.View>

      {location && (
        <View style={newStyles.gpsInfo}>
          <MapPin size={16} color="#1ABC9C" />
          <Text style={newStyles.gpsText}>
            GPS: {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
          </Text>
        </View>
      )}
      {!location && locationPermission && (
        <View style={newStyles.gpsInfoWarning}>
          <Info size={16} color="#F39C12" />
          <Text style={newStyles.gpsTextWarning}>Obteniendo ubicación...</Text>
        </View>
      )}
      {!locationPermission && (
        <View style={newStyles.gpsInfoError}>
          <CircleAlert size={16} color="white" />
          <Text style={newStyles.gpsTextError}>Ubicación deshabilitada. Actívala para registrarla.</Text>
        </View>
      )}

      <View style={newStyles.cameraContainer}>
        <CameraView
          style={newStyles.camera}
          facing="back"
          onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          <View style={newStyles.overlay}>
            <View style={newStyles.scanArea}>
              {/* Corrected corner styles application */}
              <View style={[newStyles.corner, newStyles.topLeft]} />
              <View style={[newStyles.corner, newStyles.topRight]} />
              <View style={[newStyles.corner, newStyles.bottomLeft]} />
              <View style={[newStyles.corner, newStyles.bottomRight]} />

              {!isScanning && (
                <View style={newStyles.scanningIndicator}>
                  <Text style={newStyles.scanningText}>Procesando escaneo...</Text>
                </View>
              )}
              {isScanning && (
                <Text style={newStyles.scanHintText}>Centra el código QR en el recuadro</Text>
              )}
            </View>
          </View>
        </CameraView>
      </View>

      <View style={newStyles.bottomPanel}>
        <Text style={newStyles.instructionText}>
          Apuntar la cámara hacia un código QR para escanearlo.
        </Text>

        {scanCount > 0 && (
          <View style={newStyles.statsContainer}>
            <Text style={newStyles.statsText}>Escaneos totales: {scanCount}</Text>
          </View>
        )}

        {lastScan ? (
          <View style={newStyles.lastScanContainer}>
            <Text style={newStyles.lastScanTitle}>Último escaneo:</Text>
            <Text style={newStyles.lastScanData} numberOfLines={2}>
              {lastScan.data}
            </Text>

            <View style={newStyles.scanMetaRow}>
              <Clock size={16} color="#7D8A99" />
              <Text style={newStyles.scanMetaText}>
                {formatDateTime(lastScan.timestamp)}
              </Text>
            </View>

            <View style={newStyles.scanMetaRow}>
              <MapPin size={16} color="#4A90E2" />
              <Text style={newStyles.scanLocationText}>
                {formatLocation(
                  lastScan.location?.coords.latitude || null,
                  lastScan.location?.coords.longitude || null
                )}
              </Text>
            </View>
          </View>
        ) : (
          <View style={newStyles.noLastScanContainer}>
            <Text style={newStyles.noLastScanText}>Aún no hay escaneos recientes.</Text>
            <Text style={newStyles.noLastScanSubText}>¡Empieza a escanear ahora!</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const newStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F1F2', // Light blue-grey background
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#E8F1F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContent: {
    alignItems: 'center',
    paddingHorizontal: 35,
  },
  permissionTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#37474F',
    marginTop: 28,
    marginBottom: 15,
    textAlign: 'center',
  },
  permissionMessage: {
    fontSize: 17,
    color: '#7D8A99',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
  },
  permissionButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 35,
    paddingVertical: 18,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  permissionText: {
    fontSize: 17,
    color: '#607D8B',
    fontWeight: '600',
  },
  notification: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1ABC9C', // Teal for success notification
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    zIndex: 1000,
    borderBottomLeftRadius: 15, // Rounded corners for notification
    borderBottomRightRadius: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  notificationText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
  },
  gpsInfo: {
    position: 'absolute',
    top: 25,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 73, 94, 0.9)', // Darker blue-grey for GPS info
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  gpsInfoWarning: {
    position: 'absolute',
    top: 25,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(243, 156, 18, 0.9)', // Warning yellow
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  gpsInfoError: {
    position: 'absolute',
    top: 25,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.9)', // Error red
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  gpsText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 10,
    fontWeight: '600',
  },
  gpsTextWarning: {
    color: '#34495E', // Dark text for warning
    fontSize: 14,
    marginLeft: 10,
    fontWeight: '600',
  },
  gpsTextError: {
    color: 'white',
    fontSize: 14,
    marginLeft: 10,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginTop: 80, // Adjust to leave space for GPS info and notification
    borderRadius: 25, // More rounded camera container
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 12,
    marginBottom: 20,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', // Slightly darker overlay
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Base style for all corners - applied to all four corner views
  corner: {
    position: 'absolute',
    width: 50, // Slightly larger corners
    height: 50,
    borderColor: '#4A90E2', // Primary blue for scan corners
  },
  // Specific styles for each corner - combined with 'corner' base style
  topLeft: {
    borderTopWidth: 6,
    borderLeftWidth: 6,
    borderTopLeftRadius: 10, // More rounded corners
    top: 0,
    left: 0,
  },
  topRight: {
    borderTopWidth: 6,
    borderRightWidth: 6,
    borderTopRightRadius: 10,
    top: 0,
    right: 0,
  },
  bottomLeft: {
    borderBottomWidth: 6,
    borderLeftWidth: 6,
    borderBottomLeftRadius: 10,
    bottom: 0,
    left: 0,
  },
  bottomRight: {
    borderBottomWidth: 6,
    borderRightWidth: 6,
    borderBottomRightRadius: 10,
    bottom: 0,
    right: 0,
  },
  scanningIndicator: {
    backgroundColor: 'rgba(74, 144, 226, 0.9)', // Primary blue with transparency
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 30, // More rounded "pill" shape
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  scanningText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
  },
  scanHintText: {
    color: 'rgba(255,255,255,0.9)', // Slightly more opaque
    fontSize: 17,
    fontWeight: '600',
    position: 'absolute',
    top: SCAN_AREA_SIZE + 25, // Adjusted position below scan area
    textAlign: 'center',
  },
  bottomPanel: {
    backgroundColor: 'white',
    paddingHorizontal: 25,
    paddingVertical: 25,
    marginHorizontal: 20,
    marginBottom: 25,
    borderRadius: 25, // Consistent rounded corners
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  instructionText: {
    fontSize: 18,
    color: '#37474F', // Dark blue-grey
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 20,
  },
  statsContainer: {
    marginTop: 15,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#D0E6FF', // Lighter blue from history header
    borderRadius: 12,
    marginBottom: 20,
  },
  statsText: {
    fontSize: 16,
    color: '#4A90E2', // Primary blue
    fontWeight: '700',
  },
  lastScanContainer: {
    marginTop: 15,
    padding: 20,
    backgroundColor: '#F8F9FA', // Light grey for the card background
    borderRadius: 18, // Consistent rounded corners
    borderLeftWidth: 6, // Thicker left border
    borderLeftColor: '#4A90E2', // Primary blue border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 4,
  },
  lastScanTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#37474F', // Dark blue-grey
    marginBottom: 12,
  },
  lastScanData: {
    fontSize: 16,
    color: '#37474F',
    marginBottom: 15,
    fontWeight: '600',
  },
  scanMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  scanMetaText: {
    fontSize: 14,
    color: '#7D8A99', // Muted grey-blue
    marginLeft: 10,
    fontWeight: '500',
  },
  scanLocationText: {
    fontSize: 14,
    color: '#4A90E2', // Primary blue
    marginLeft: 10,
    fontWeight: '600',
  },
  noLastScanContainer: {
    alignItems: 'center',
    paddingVertical: 25,
    backgroundColor: '#F0F4F7', // Slightly darker than main background
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#CFD8DC', // Border color similar to empty state icon
    marginTop: 15,
  },
  noLastScanText: {
    fontSize: 17,
    color: '#7D8A99',
    fontWeight: '600',
    marginBottom: 8,
  },
  noLastScanSubText: {
    fontSize: 15,
    color: '#90A4AE',
    fontWeight: '500',
  },
});