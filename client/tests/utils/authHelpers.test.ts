import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  saveUser,
  getUser,
  clearUser,
  clearAuth,
} from '@utils/authHelpers';

describe('Auth Helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Token Management', () => {
    it('stores and retrieves auth token', () => {
      const token = 'test-token-123';
      setAuthToken(token);
      expect(getAuthToken()).toBe(token);
    });

    it('clears auth token', () => {
      setAuthToken('test-token');
      clearAuthToken();
      expect(getAuthToken()).toBeNull();
    });
  });

  describe('User Management', () => {
    it('stores and retrieves user', () => {
      const user = { id: '1', username: 'testuser' };
      saveUser(user);
      expect(getUser()).toEqual(user);
    });

    it('clears user', () => {
      saveUser({ id: '1', username: 'testuser' });
      clearUser();
      expect(getUser()).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      localStorage.setItem('user', 'invalid json');
      expect(getUser()).toBeNull();
    });
  });

  describe('Auth Cleanup', () => {
    it('clears both token and user', () => {
      setAuthToken('token');
      saveUser({ id: '1' });

      clearAuth();

      expect(getAuthToken()).toBeNull();
      expect(getUser()).toBeNull();
    });
  });
});
