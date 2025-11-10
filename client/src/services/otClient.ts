import { Operation } from '../types';

export class OTClient {
  private revision = 0;
  private pendingOperations: Operation[] = [];
  private serverOperations: Operation[] = [];

  constructor(_initialContent: string = '', initialVersion: number = 0) {
    this.revision = initialVersion;
  }

  applyOperation(operation: Operation): Operation {
    operation.version = this.revision;
    this.revision++;
    return operation;
  }

  applyServerOperation(operation: Operation): Operation {
    if (operation.version !== this.revision) {
      operation = this.transformOperation(operation);
    }
    this.serverOperations.push(operation);
    this.revision++;
    return operation;
  }

  getRevision(): number {
    return this.revision;
  }

  getPendingOperations(): Operation[] {
    return [...this.pendingOperations];
  }

  getServerOperations(): Operation[] {
    return [...this.serverOperations];
  }

  private transformOperation(operation: Operation): Operation {
    let transformed = { ...operation };

    for (const pendingOp of this.pendingOperations) {
      transformed = this.transformAgainstOperation(transformed, pendingOp);
    }

    return transformed;
  }

  private transformAgainstOperation(op1: Operation, op2: Operation): Operation {
    const transformed = { ...op1 };

    if (op1.position === op2.position) {
      if (op1.clientId < op2.clientId) {
        return transformed;
      }
      if (op2.type === 'insert') {
        transformed.position += (op2.content || '').length;
      } else if (op2.type === 'delete') {
        transformed.position = Math.max(0, transformed.position - (op2.content || '').length);
      }
      return transformed;
    }

    if (op1.position > op2.position) {
      if (op2.type === 'insert') {
        transformed.position += (op2.content || '').length;
      } else if (op2.type === 'delete') {
        transformed.position = Math.max(
          op2.position,
          transformed.position - (op2.content || '').length
        );
      }
    }

    return transformed;
  }

  clearPendingOperations(): void {
    this.pendingOperations = [];
  }

  clearServerOperations(): void {
    this.serverOperations = [];
  }

  applyContent(content: string, operation: Operation): string {
    const { type, position, content: opContent } = operation;

    if (type === 'insert') {
      return content.slice(0, position) + opContent + content.slice(position);
    } else if (type === 'delete') {
      return content.slice(0, position) + content.slice(position + (opContent || '').length);
    }

    return content;
  }

  inverse(operation: Operation, content: string): Operation {
    if (operation.type === 'insert') {
      return {
        ...operation,
        type: 'delete',
        content: (operation.content || '').substring(
          0,
          operation.position + (operation.content || '').length
        ),
      };
    } else if (operation.type === 'delete') {
      const deleted = content.substring(
        operation.position,
        operation.position + (operation.content || '').length
      );
      return {
        ...operation,
        type: 'insert',
        content: deleted,
      };
    }

    return operation;
  }
}

export const createOTClient = (initialContent: string = '', initialVersion: number = 0) => {
  return new OTClient(initialContent, initialVersion);
};
