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

class WebStorage {
  private storageKey = 'qr_scanner_data';
  private scans: ScanRecord[] = [];
  private nextId = 1;

  async init(): Promise<void> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.scans = data.scans || [];
        this.nextId = data.nextId || 1;
      }
    } catch (error) {
      console.error('Error loading web storage:', error);
      this.scans = [];
      this.nextId = 1;
    }
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        scans: this.scans,
        nextId: this.nextId
      }));
    } catch (error) {
      console.error('Error saving to web storage:', error);
    }
  }

  async getScans(): Promise<ScanRecord[]> {
    return [...this.scans].sort((a, b) => b.timestamp - a.timestamp);
  }

  async addScan(scanData: Omit<ScanRecord, 'id' | 'created_at'>): Promise<number> {
    const newScan: ScanRecord = {
      ...scanData,
      id: this.nextId++,
      created_at: new Date().toISOString()
    };
    this.scans.push(newScan);
    this.save();
    return newScan.id;
  }

  async deleteScan(id: number): Promise<boolean> {
    const initialLength = this.scans.length;
    this.scans = this.scans.filter(scan => scan.id !== id);
    const deleted = this.scans.length < initialLength;
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  async getScanById(id: number): Promise<ScanRecord | null> {
    return this.scans.find(scan => scan.id === id) || null;
  }
}

class MobileStorage {
  private db: any = null;

  async init(): Promise<void> {
    if (!this.db) {
      const SQLite = require('expo-sqlite');
      this.db = SQLite.openDatabaseSync('qr_scanner.db');
      
      await this.db.execAsync(`
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
  }

  async getScans(): Promise<ScanRecord[]> {
    if (!this.db) throw new Error('Database not initialized');
    const result = await this.db.getAllAsync('SELECT * FROM scans ORDER BY timestamp DESC');
    return result as ScanRecord[];
  }

  async addScan(scanData: Omit<ScanRecord, 'id' | 'created_at'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.runAsync(
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

  async deleteScan(id: number): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');
    const result = await this.db.runAsync('DELETE FROM scans WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async getScanById(id: number): Promise<ScanRecord | null> {
    if (!this.db) throw new Error('Database not initialized');
    const result = await this.db.getFirstAsync('SELECT * FROM scans WHERE id = ?', [id]);
    return result as ScanRecord || null;
  }
}

class DatabaseManager {
  private storage: WebStorage | MobileStorage;

  constructor() {
    this.storage = Platform.OS === 'web' ? new WebStorage() : new MobileStorage();
  }

  async init(): Promise<void> {
    await this.storage.init();
  }

  async getScans(): Promise<ScanRecord[]> {
    return this.storage.getScans();
  }

  async addScan(scanData: Omit<ScanRecord, 'id' | 'created_at'>): Promise<number> {
    return this.storage.addScan(scanData);
  }

  async deleteScan(id: number): Promise<boolean> {
    return this.storage.deleteScan(id);
  }

  async getScanById(id: number): Promise<ScanRecord | null> {
    return this.storage.getScanById(id);
  }
}

export const database = new DatabaseManager();