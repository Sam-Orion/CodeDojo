const AUTH_TOKEN_KEY = 'auth_token';
const USER_KEY = 'user';

export const getAuthToken = (): string | null => {
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearAuthToken = (): void => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

export const isAuthTokenValid = (): boolean => {
  const token = getAuthToken();
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;
    return Date.now() < exp;
  } catch {
    return false;
  }
};

export const getTokenExpirationTime = (): Date | null => {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return new Date(payload.exp * 1000);
  } catch {
    return null;
  }
};

export const saveUser = (user: Record<string, any>): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getUser = (): Record<string, any> | null => {
  const user = localStorage.getItem(USER_KEY);
  try {
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

export const clearUser = (): void => {
  localStorage.removeItem(USER_KEY);
};

export const clearAuth = (): void => {
  clearAuthToken();
  clearUser();
};

export const isRefreshTokenExpiringSoon = (expiringThreshold = 5 * 60 * 1000): boolean => {
  const expiration = getTokenExpirationTime();
  if (!expiration) return false;

  const now = Date.now();
  const timeUntilExpiration = expiration.getTime() - now;

  return timeUntilExpiration < expiringThreshold;
};
