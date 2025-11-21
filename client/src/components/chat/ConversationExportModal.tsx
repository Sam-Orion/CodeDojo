import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import type { ConversationExportFormat } from '../../utils/conversationExport';

interface ConversationExportModalProps {
  isOpen: boolean;
  isExporting: boolean;
  onClose: () => void;
  onConfirm: (format: ConversationExportFormat) => Promise<void> | void;
}

const formatOptions: Array<{
  value: ConversationExportFormat;
  label: string;
  description: string;
}> = [
  {
    value: 'json',
    label: 'JSON (structured data)',
    description: 'Includes every message, metadata, and timestamps in a machine-readable format.',
  },
  {
    value: 'markdown',
    label: 'Markdown (readable transcript)',
    description:
      'Provides a human-friendly transcript with quotes for prompts and formatted AI replies.',
  },
];

const ConversationExportModal = ({
  isOpen,
  isExporting,
  onClose,
  onConfirm,
}: ConversationExportModalProps) => {
  const [selectedFormat, setSelectedFormat] = useState<ConversationExportFormat>('json');

  const footer = (
    <div className="flex justify-end gap-3">
      <Button variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      <Button onClick={() => onConfirm(selectedFormat)} isLoading={isExporting}>
        Download
      </Button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export conversation" footer={footer} size="md">
      <div className="space-y-5 text-sm text-gray-600 dark:text-gray-300">
        <p>Select the format you would like to use for this export.</p>

        <div className="space-y-3">
          {formatOptions.map((option) => {
            const isSelected = selectedFormat === option.value;
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition focus-within:ring-2 focus-within:ring-primary-500 ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50/70 text-primary-900 dark:border-primary-400 dark:bg-primary-500/10'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="conversation-export-format"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => setSelectedFormat(option.value)}
                  className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {option.label}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {option.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        <div className="rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          Exports include metadata, timestamps, and are processed asynchronously so large
          conversations do not freeze your browser.
        </div>
      </div>
    </Modal>
  );
};

export default ConversationExportModal;
