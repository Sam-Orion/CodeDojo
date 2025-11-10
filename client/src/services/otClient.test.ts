import { describe, it, expect } from 'vitest';
import { OTClient } from './otClient';
import { Operation } from '../types';

describe('OTClient', () => {
  describe('initialization', () => {
    it('should initialize with default content and version', () => {
      const client = new OTClient();
      expect(client.getRevision()).toBe(0);
    });

    it('should initialize with provided content and version', () => {
      const client = new OTClient('hello', 5);
      expect(client.getRevision()).toBe(5);
    });
  });

  describe('applyOperation', () => {
    it('should apply operation and increment revision', () => {
      const client = new OTClient();
      const operation: Operation = {
        id: '1',
        type: 'insert',
        position: 0,
        content: 'hello',
        clientId: 'client1',
        timestamp: Date.now(),
      };

      const result = client.applyOperation(operation);
      expect(result.version).toBe(0);
      expect(client.getRevision()).toBe(1);
    });
  });

  describe('applyServerOperation', () => {
    it('should apply server operation with correct version', () => {
      const client = new OTClient();
      const operation: Operation = {
        id: '1',
        type: 'insert',
        position: 0,
        content: 'hello',
        clientId: 'client2',
        timestamp: Date.now(),
        version: 0,
      };

      const result = client.applyServerOperation(operation);
      expect(result.version).toBe(0);
      expect(client.getRevision()).toBe(1);
    });
  });

  describe('applyContent', () => {
    it('should insert content at specified position', () => {
      const client = new OTClient();
      const content = 'world';
      const operation: Operation = {
        id: '1',
        type: 'insert',
        position: 0,
        content: 'hello ',
        clientId: 'client1',
        timestamp: Date.now(),
      };

      const result = client.applyContent(content, operation);
      expect(result).toBe('hello world');
    });

    it('should delete content at specified position', () => {
      const client = new OTClient();
      const content = 'hello world';
      const operation: Operation = {
        id: '1',
        type: 'delete',
        position: 5,
        content: ' ',
        clientId: 'client1',
        timestamp: Date.now(),
      };

      const result = client.applyContent(content, operation);
      expect(result).toBe('helloworld');
    });
  });

  describe('inverse', () => {
    it('should inverse insert operation to delete', () => {
      const client = new OTClient();
      const operation: Operation = {
        id: '1',
        type: 'insert',
        position: 0,
        content: 'hello',
        clientId: 'client1',
        timestamp: Date.now(),
      };

      const inverse = client.inverse(operation, 'hello');
      expect(inverse.type).toBe('delete');
    });

    it('should inverse delete operation to insert', () => {
      const client = new OTClient();
      const operation: Operation = {
        id: '1',
        type: 'delete',
        position: 0,
        content: 'hello',
        clientId: 'client1',
        timestamp: Date.now(),
      };

      const inverse = client.inverse(operation, 'hello');
      expect(inverse.type).toBe('insert');
    });
  });

  describe('pending and server operations', () => {
    it('should track pending operations', () => {
      const client = new OTClient();
      expect(client.getPendingOperations()).toHaveLength(0);
    });

    it('should track server operations', () => {
      const client = new OTClient();
      expect(client.getServerOperations()).toHaveLength(0);

      const operation: Operation = {
        id: '1',
        type: 'insert',
        position: 0,
        content: 'hello',
        clientId: 'client2',
        timestamp: Date.now(),
        version: 0,
      };

      client.applyServerOperation(operation);
      expect(client.getServerOperations()).toHaveLength(1);
    });

    it('should clear pending operations', () => {
      const client = new OTClient();
      client.clearPendingOperations();
      expect(client.getPendingOperations()).toHaveLength(0);
    });

    it('should clear server operations', () => {
      const client = new OTClient();
      const operation: Operation = {
        id: '1',
        type: 'insert',
        position: 0,
        content: 'hello',
        clientId: 'client2',
        timestamp: Date.now(),
        version: 0,
      };
      client.applyServerOperation(operation);
      client.clearServerOperations();
      expect(client.getServerOperations()).toHaveLength(0);
    });
  });
});
