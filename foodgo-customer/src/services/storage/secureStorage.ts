import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'foodgo_access_token';
const REFRESH_TOKEN_KEY = 'foodgo_refresh_token';
const USER_DATA_KEY = 'foodgo_user_data';

export class SecureStorage {
  static async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
        }
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (error) {
      console.error(`SecureStorage setItem error for key ${key}:`, error);
    }
  }

  static async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(key);
        }
        return null;
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`SecureStorage getItem error for key ${key}:`, error);
      return null;
    }
  }

  static async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        }
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (error) {
      console.error(`SecureStorage removeItem error for key ${key}:`, error);
    }
  }

  static async getAccessToken(): Promise<string | null> {
    return this.getItem(ACCESS_TOKEN_KEY);
  }

  static async setAccessToken(token: string): Promise<void> {
    await this.setItem(ACCESS_TOKEN_KEY, token);
  }

  static async getRefreshToken(): Promise<string | null> {
    return this.getItem(REFRESH_TOKEN_KEY);
  }

  static async setRefreshToken(token: string): Promise<void> {
    await this.setItem(REFRESH_TOKEN_KEY, token);
  }

  static async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      this.setAccessToken(accessToken),
      this.setRefreshToken(refreshToken),
    ]);
  }

  static async clearTokens(): Promise<void> {
    await Promise.all([
      this.removeItem(ACCESS_TOKEN_KEY),
      this.removeItem(REFRESH_TOKEN_KEY),
      this.removeItem(USER_DATA_KEY),
    ]);
  }
}

export default SecureStorage;
