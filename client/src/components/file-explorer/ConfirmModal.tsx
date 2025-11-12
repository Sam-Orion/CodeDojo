import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { FileNode } from '../../types';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newName?: string) => Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type: 'delete' | 'rename';
  node?: FileNode;
}

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type,
  node,
}: ConfirmModalProps) => {
  const [newName, setNewName] = useState(node?.name || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    if (type === 'rename' && !newName.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      await onConfirm(type === 'rename' ? newName.trim() : undefined);
      onClose();
    } catch {
      // Error will be handled by the parent component
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleConfirm();
    } else if (event.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>

        {type === 'rename' && (
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter new name"
            onKeyDown={handleKeyDown}
            autoFocus
          />
        )}

        {type === 'delete' && node && (
          <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {node.type === 'directory'
                ? 'This will permanently delete this folder and all its contents.'
                : 'This will permanently delete this file.'}
            </p>
            <p className="mt-1 text-sm text-red-600 dark:text-red-300">{node.name}</p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
          {cancelText}
        </Button>
        <Button
          variant={type === 'delete' ? 'danger' : 'primary'}
          onClick={handleConfirm}
          disabled={isLoading || (type === 'rename' && !newName.trim())}
          isLoading={isLoading}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
