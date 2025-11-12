import { FileNode } from '../types';

const CACHE_KEY = 'codedojo_file_cache';
const RECENT_FILES_KEY = 'codedojo_recent_files';
const MAX_RECENT_FILES = 20;
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

interface CachedFile {
  path: string;
  name: string;
  content: string;
  timestamp: number;
}

interface RecentFile {
  path: string;
  name: string;
  size?: number;
  lastModified: string;
  timestamp: number;
}

export const offlineCache = {
  // File content caching
  cacheFile: (file: FileNode, content: string) => {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      cache[file.path] = {
        path: file.path,
        name: file.name,
        content,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Failed to cache file:', error);
    }
  },

  getCachedFile: (path: string): CachedFile | null => {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      const cached = cache[path];

      if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
        return cached;
      }

      if (cached) {
        delete cache[path];
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      }

      return null;
    } catch (error) {
      console.error('Failed to retrieve cached file:', error);
      return null;
    }
  },

  clearExpiredCache: () => {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      const now = Date.now();
      let hasChanges = false;

      Object.keys(cache).forEach((key) => {
        if (now - cache[key].timestamp > CACHE_EXPIRY) {
          delete cache[key];
          hasChanges = true;
        }
      });

      if (hasChanges) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      }
    } catch (error) {
      console.error('Failed to clear expired cache:', error);
    }
  },

  // Recent files tracking
  addRecentFile: (file: FileNode) => {
    try {
      let recentFiles: RecentFile[] = JSON.parse(localStorage.getItem(RECENT_FILES_KEY) || '[]');

      // Remove duplicate if it exists
      recentFiles = recentFiles.filter((f) => f.path !== file.path);

      // Add to beginning
      recentFiles.unshift({
        path: file.path,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        timestamp: Date.now(),
      });

      // Keep only recent ones
      recentFiles = recentFiles.slice(0, MAX_RECENT_FILES);

      localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recentFiles));
    } catch (error) {
      console.error('Failed to add recent file:', error);
    }
  },

  getRecentFiles: (): RecentFile[] => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_FILES_KEY) || '[]');
    } catch (error) {
      console.error('Failed to retrieve recent files:', error);
      return [];
    }
  },

  clearCache: () => {
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(RECENT_FILES_KEY);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  },
};
