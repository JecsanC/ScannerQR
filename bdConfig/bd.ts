import { Platform } from 'react-native';

export interface ScanRecord {
  id: number;
  qr_data: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  accuracy: number | null;
  timestamp: number;
  created_at: string;
}


const API_BASE_URL = 'http://192.168.1.112:3000';

class ApiService {
  private initialized: boolean = false;

  async init(): Promise<void> {

    if (!this.initialized) {
      console.log('API Service initialized.');
      this.initialized = true;
    }
  }

  async getScans(): Promise<ScanRecord[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/scans`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: ScanRecord[] = await response.json();

      return data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (error) {
      console.error('Error fetching scans:', error);
      throw error;
    }
  }

  async addScan(scanData: Omit<ScanRecord, 'id' | 'created_at'>): Promise<number> {
    try {
      const response = await fetch(`${API_BASE_URL}/scans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qr_data: scanData.qr_data,
          latitude: scanData.latitude,
          longitude: scanData.longitude,
          altitude: scanData.altitude,
          accuracy: scanData.accuracy,
          timestamp: scanData.timestamp,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
      }
      const newScan: ScanRecord = await response.json();
      return newScan.id;
    } catch (error) {
      console.error('Error adding scan:', error);
      throw error;
    }
  }

  async deleteScan(id: number): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/scans/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return true;
    } catch (error) {
      console.error('Error deleting scan:', error);
      throw error;
    }
  }

  async getScanById(id: number): Promise<ScanRecord | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/scans/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const scan: ScanRecord = await response.json();
      return scan;
    } catch (error) {
      console.error('Error fetching scan by ID:', error);
      throw error;
    }
  }
}

export const database = new ApiService();