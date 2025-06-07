import { Platform } from 'react-native';

export interface ScanRecord {
  id: number;
  qr_data: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  accuracy: number | null;
  timestamp: number;
  created_at?: string;
}

let webScans: ScanRecord[] = [];
let nextId = 1;

let db: any = null;

const initMobileDatabase = async () => {
  if (Platform.OS !== 'web' && !db) {
    const SQLite = require('expo-sqlite');
    db = SQLite.openDatabaseSync('qr_scanner.db');
    
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        qr_data TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        altitude REAL,
        accuracy REAL,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
};

export const initDatabase = async (): Promise<void> => {
  if (Platform.OS === 'web') {
    const stored = localStorage.getItem('qr_scans');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        webScans = parsed.scans || [];
        nextId = parsed.nextId || 1;
      } catch (error) {
        console.error('Error loading stored scans:', error);
        webScans = [];
        nextId = 1;
      }
    }
  } else {
    await initMobileDatabase();
  }
};

const saveToLocalStorage = () => {
  if (Platform.OS === 'web') {
    localStorage.setItem('qr_scans', JSON.stringify({
      scans: webScans,
      nextId: nextId
    }));
  }
};

export const getScans = async (): Promise<ScanRecord[]> => {
  await initDatabase();
  
  if (Platform.OS === 'web') {
    return [...webScans].sort((a, b) => b.timestamp - a.timestamp);
  } else {
    if (!db) throw new Error('Database not initialized');
    
    const result = await db.getAllAsync('SELECT * FROM scans ORDER BY timestamp DESC');
    return result as ScanRecord[];
  }
};

export const addScan = async (
  scanData: Omit<ScanRecord, 'id' | 'created_at'>
): Promise<number> => {
  await initDatabase();
  
  if (Platform.OS === 'web') {
    const newScan: ScanRecord = {
      ...scanData,
      id: nextId++,
      created_at: new Date().toISOString()
    };
    webScans.push(newScan);
    saveToLocalStorage();
    return newScan.id;
  } else {
    if (!db) throw new Error('Database not initialized');
    
    const result = await db.runAsync(
      `INSERT INTO scans (qr_data, latitude, longitude, altitude, accuracy, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)`,
      [
        scanData.qr_data,
        scanData.latitude,
        scanData.longitude,
        scanData.altitude,
        scanData.accuracy,
        scanData.timestamp,
      ]
    );
    
    return result.lastInsertRowId;
  }
};

export const deleteScan = async (id: number): Promise<boolean> => {
  await initDatabase();
  
  if (Platform.OS === 'web') {
    const initialLength = webScans.length;
    webScans = webScans.filter(scan => scan.id !== id);
    const deleted = webScans.length < initialLength;
    if (deleted) {
      saveToLocalStorage();
    }
    return deleted;
  } else {
    if (!db) throw new Error('Database not initialized');
    
    const result = await db.runAsync('DELETE FROM scans WHERE id = ?', [id]);
    return result.changes > 0;
  }
};

export const getScanById = async (id: number): Promise<ScanRecord | null> => {
  await initDatabase();
  
  if (Platform.OS === 'web') {
    return webScans.find(scan => scan.id === id) || null;
  } else {
    if (!db) throw new Error('Database not initialized');
    
    const result = await db.getFirstAsync('SELECT * FROM scans WHERE id = ?', [id]);
    return result as ScanRecord || null;
  }
};