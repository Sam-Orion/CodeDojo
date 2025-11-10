import { useState } from 'react';
import { useAppSelector } from '../store';
import Button from './ui/Button';

interface EditorControlsProps {
  onLanguageChange?: (language: string) => void;
  onThemeChange?: (theme: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
}

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
];

const THEMES = [
  { value: 'vs', label: 'Light' },
  { value: 'vs-dark', label: 'Dark' },
  { value: 'hc-black', label: 'High Contrast' },
];

const EditorControls = ({
  onLanguageChange,
  onThemeChange,
  onUndo,
  onRedo,
  onSave,
}: EditorControlsProps) => {
  const [language, setLanguage] = useState('javascript');
  const [theme, setTheme] = useState('vs-dark');
  const { undoStack, redoStack } = useAppSelector((state) => state.collaboration);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    if (onLanguageChange) {
      onLanguageChange(newLanguage);
    }
  };

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTheme = e.target.value;
    setTheme(newTheme);
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  };

  const handleUndo = () => {
    if (undoStack.length > 0 && onUndo) {
      onUndo();
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0 && onRedo) {
      onRedo();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      {/* Language Selector */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="language-select"
          className="text-xs font-medium text-gray-700 dark:text-gray-300"
        >
          Language:
        </label>
        <select
          id="language-select"
          value={language}
          onChange={handleLanguageChange}
          className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      {/* Theme Selector */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="theme-select"
          className="text-xs font-medium text-gray-700 dark:text-gray-300"
        >
          Theme:
        </label>
        <select
          id="theme-select"
          value={theme}
          onChange={handleThemeChange}
          className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
        >
          {THEMES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Separator */}
      <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />

      {/* Undo/Redo Buttons */}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          title="Undo (Ctrl+Z)"
        >
          ↶ Undo
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          title="Redo (Ctrl+Y)"
        >
          ↷ Redo
        </Button>
      </div>

      {/* Separator */}
      <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />

      {/* Save Button */}
      <Button size="sm" variant="primary" onClick={onSave} title="Save (Ctrl+S)">
        💾 Save
      </Button>
    </div>
  );
};

export default EditorControls;
