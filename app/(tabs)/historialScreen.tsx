import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Linking, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, ExternalLink, Trash2, RefreshCw, QrCode } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { database, ScanRecord } from '@/bdConfig/bd'; // Assuming this path is correct for your project

export default function HistoryScreen() {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadScans();
    }, [])
  );

  const loadScans = async () => {
    try {
      setRefreshing(true);
      await database.init();
      const data = await database.getScans();
      setScans(data);
    } catch (error) {
      console.error('Failed to load scans:', error);
      Alert.alert('Error', 'Failed to load scans. Please try again later.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadScans();
  };

  const handleDeleteScan = (id: number) => {
    Alert.alert(
      'Delete Scan',
      'Are you sure you want to permanently delete this scan record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await database.deleteScan(id);
              if (success) {
                setScans(prev => prev.filter(scan => scan.id !== id));
                Alert.alert('Success', 'Scan record deleted successfully.');
              } else {
                Alert.alert('Error', 'Failed to delete scan record. Please try again.');
              }
            } catch (error) {
              console.error('Error deleting scan:', error);
              Alert.alert('Error', 'There was a problem trying to delete the scan record.');
            }
          },
        },
      ]
    );
  };

  const openURL = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Invalid Link', `Cannot open this link: ${url}`);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      Alert.alert('Error', 'An error occurred while trying to open the link.');
    }
  };

  const isURL = (text: string): boolean => {
    const urlPattern = /^(https?:\/\/|ftp:\/\/|www\.)[^\s/$.?#].[^\s]*$/i;
    return urlPattern.test(text);
  };

  const formatLocation = (lat: number | null, lng: number | null): string => {
    if (lat && lng) {
      return `Lat: ${lat.toFixed(4)}, Lon: ${lng.toFixed(4)}`;
    }
    return 'Location not recorded';
  };

  const renderScanItem = ({ item }: { item: ScanRecord }) => (
    <View style={newStyles.scanCard}>
      <View style={newStyles.scanContent}>
        <Text style={newStyles.scanData} numberOfLines={2}>{item.qr_data}</Text>

        <View style={newStyles.scanMeta}>
          <MapPin size={16} color="#7D8A99" />
          <Text style={newStyles.scanLocationText}>
            {formatLocation(item.latitude, item.longitude)}
          </Text>
        </View>
      </View>

      <View style={newStyles.actionButtons}>
        {isURL(item.qr_data) && (
          <TouchableOpacity style={newStyles.openButton} onPress={() => openURL(item.qr_data)}>
            <ExternalLink size={18} color="white" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={newStyles.deleteButton} onPress={() => handleDeleteScan(item.id)}>
          <Trash2 size={18} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={newStyles.emptyContainer}>
      <QrCode size={100} color="#CFD8DC" />
      <Text style={newStyles.emptyTitle}>Sin escaneos! :c</Text>
      <Text style={newStyles.emptyMessage}>
        Inicia escaneando codigos QR para ver tu historial aquí.
      </Text>
      <TouchableOpacity style={newStyles.refreshButton} onPress={loadScans}>
        <RefreshCw size={20} color="white" />
        <Text style={newStyles.refreshButtonText}> Actualizar Historial</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={newStyles.container}>
        <View style={newStyles.loadingContainer}>
          <QrCode size={80} color="#4A90E2" />
          <Text style={newStyles.loadingText}>Cargando tu historial de escaneos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={newStyles.container}>
      <View style={newStyles.header}>
        <Text style={newStyles.headerTitle}>Escaneos QR</Text>
        <Text style={newStyles.headerSubtitle}>
          Tienes {scans.length}  escaneos guardados{scans.length !== 1 ? 's' : ''}.
        </Text>
      </View>

      <FlatList
        data={scans}
        renderItem={renderScanItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={newStyles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4A90E2"
            colors={['#4A90E2']}
          />
        }
        ListEmptyComponent={renderEmpty}
      />
    </SafeAreaView>
  );
}

const newStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F1F2', // Light blue-grey background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F1F2',
  },
  loadingText: {
    fontSize: 20,
    color: '#607D8B', // Muted blue-grey
    marginTop: 25,
    fontWeight: '700',
  },
  header: {
    backgroundColor: '#4A90E2', // Vibrant blue
    paddingHorizontal: 25,
    paddingTop: 30,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: 'white',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 18,
    color: '#D0E6FF', // Lighter blue for subtitle
    fontWeight: '500',
  },
  listContainer: {
    paddingHorizontal: 18,
    paddingBottom: 25,
    flexGrow: 1,
  },
  scanCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 7,
    elevation: 6,
    flexDirection: 'row', // Horizontal layout
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 0, // Removing the borderLeftWidth
  },
  scanContent: {
    flex: 1,
    marginRight: 15,
  },
  scanData: {
    fontSize: 18,
    fontWeight: '700',
    color: '#37474F', // Dark blue-grey
    marginBottom: 10,
    lineHeight: 26,
  },
  scanMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  scanLocationText: {
    fontSize: 14,
    color: '#7D8A99', // Muted grey-blue
    marginLeft: 8,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row', // Buttons side-by-side
    alignItems: 'center',
  },
  openButton: {
    backgroundColor: '#1ABC9C', // Teal
    padding: 12,
    borderRadius: 50, // Circular button
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#E74C3C', // Red
    padding: 12,
    borderRadius: 50, // Circular button
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#607D8B',
    marginTop: 35,
    marginBottom: 18,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 17,
    color: '#90A4AE',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 45,
  },
  refreshButton: {
    backgroundColor: '#4A90E2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
});