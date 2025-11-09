import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatFileSize,
  formatDuration,
  truncateString,
  capitalizeFirst,
  slugify,
} from '@utils/formatters';

describe('Formatter Utilities', () => {
  describe('formatDate', () => {
    it('formats date string correctly', () => {
      const result = formatDate('2024-01-15');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
    });

    it('formats Date object correctly', () => {
      const date = new Date('2024-01-15');
      const result = formatDate(date);
      expect(result).toContain('Jan');
    });
  });

  describe('formatFileSize', () => {
    it('formats 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('formats bytes', () => {
      expect(formatFileSize(512)).toContain('Bytes');
    });

    it('formats kilobytes', () => {
      expect(formatFileSize(1024)).toContain('KB');
    });

    it('formats megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toContain('MB');
    });
  });

  describe('formatDuration', () => {
    it('formats seconds', () => {
      expect(formatDuration(30)).toBe('30s');
    });

    it('formats minutes and seconds', () => {
      expect(formatDuration(90)).toContain('1m');
    });

    it('formats hours, minutes, and seconds', () => {
      expect(formatDuration(3661)).toContain('1h');
    });
  });

  describe('truncateString', () => {
    it('does not truncate if string is shorter than max length', () => {
      expect(truncateString('hello', 10)).toBe('hello');
    });

    it('truncates and adds ellipsis', () => {
      expect(truncateString('hello world', 8)).toBe('hello...');
    });
  });

  describe('capitalizeFirst', () => {
    it('capitalizes first letter', () => {
      expect(capitalizeFirst('hello')).toBe('Hello');
    });

    it('handles empty string', () => {
      expect(capitalizeFirst('')).toBe('');
    });
  });

  describe('slugify', () => {
    it('converts to lowercase slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('removes special characters', () => {
      expect(slugify('Hello! @World#')).toBe('hello-world');
    });
  });
});
