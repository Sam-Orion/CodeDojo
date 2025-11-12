import React, { useState, useCallback } from 'react';
import { useAppDispatch } from '../../store';
import { createTerminalSession, updateSessionName } from '../../store/slices/terminalSlice';
import { addToast } from '../../store/slices/toastSlice';
import './terminal.css';

interface SessionCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'local' | 'cloud' | 'auto';
  supportedLanguages?: string[];
}

interface EnvVariable {
  key: string;
  value: string;
}

const SessionCreateModal: React.FC<SessionCreateModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'auto',
  supportedLanguages = ['bash', 'python', 'javascript', 'typescript', 'java', 'go', 'rust', 'ruby'],
}) => {
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    language: 'bash',
    mode: defaultMode as 'local' | 'cloud' | 'auto',
    envVars: [] as EnvVariable[],
  });

  const handleInputChange = useCallback((field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleAddEnvVar = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      envVars: [...prev.envVars, { key: '', value: '' }],
    }));
  }, []);

  const handleRemoveEnvVar = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      envVars: prev.envVars.filter((_, i) => i !== index),
    }));
  }, []);

  const handleEnvVarChange = useCallback(
    (index: number, field: keyof EnvVariable, value: string) => {
      setFormData((prev) => ({
        ...prev,
        envVars: prev.envVars.map((env, i) => (i === index ? { ...env, [field]: value } : env)),
      }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!formData.name.trim()) {
        dispatch(
          addToast({
            message: 'Session name is required',
            type: 'error',
          })
        );
        return;
      }

      setIsLoading(true);

      try {
        // Convert env vars array to object
        const envObject = formData.envVars.reduce(
          (acc, env) => {
            if (env.key.trim()) {
              acc[env.key.trim()] = env.value.trim();
            }
            return acc;
          },
          {} as Record<string, string>
        );

        const sessionData = {
          language: formData.language,
          mode: formData.mode,
          env: Object.keys(envObject).length > 0 ? envObject : undefined,
        };

        const session = await dispatch(createTerminalSession(sessionData)).unwrap();

        // Update session name after creation
        if (session && formData.name.trim()) {
          dispatch(updateSessionName({ sessionId: session.id, name: formData.name.trim() }));
        }

        dispatch(
          addToast({
            message: `Terminal session "${formData.name}" created successfully`,
            type: 'success',
          })
        );

        // Reset form and close modal
        setFormData({
          name: '',
          language: 'bash',
          mode: defaultMode,
          envVars: [],
        });
        onClose();
      } catch (error) {
        dispatch(
          addToast({
            message: `Failed to create terminal session: ${error}`,
            type: 'error',
          })
        );
      } finally {
        setIsLoading(false);
      }
    },
    [formData, dispatch, onClose, defaultMode]
  );

  const handleCancel = useCallback(() => {
    setFormData({
      name: '',
      language: 'bash',
      mode: defaultMode,
      envVars: [],
    });
    onClose();
  }, [onClose, defaultMode]);

  if (!isOpen) return null;

  return (
    <div className="session-create-modal-overlay">
      <div className="session-create-modal">
        <div className="session-create-modal-header">
          <h3>Create New Terminal Session</h3>
          <button
            type="button"
            className="session-create-modal-close"
            onClick={handleCancel}
            disabled={isLoading}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="session-create-modal-form">
          {/* Session Name */}
          <div className="form-group">
            <label htmlFor="session-name">Session Name *</label>
            <input
              id="session-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter a name for this session"
              disabled={isLoading}
              required
            />
          </div>

          {/* Language */}
          <div className="form-group">
            <label htmlFor="session-language">Language/Environment *</label>
            <select
              id="session-language"
              value={formData.language}
              onChange={(e) => handleInputChange('language', e.target.value)}
              disabled={isLoading}
              required
            >
              {supportedLanguages.map((language) => (
                <option key={language} value={language}>
                  {language.charAt(0).toUpperCase() + language.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Execution Mode */}
          <div className="form-group">
            <label htmlFor="session-mode">Execution Mode</label>
            <select
              id="session-mode"
              value={formData.mode}
              onChange={(e) =>
                handleInputChange('mode', e.target.value as 'local' | 'cloud' | 'auto')
              }
              disabled={isLoading}
            >
              <option value="auto">Auto (Recommended)</option>
              <option value="local">Local</option>
              <option value="cloud">Cloud</option>
            </select>
          </div>

          {/* Environment Variables */}
          <div className="form-group">
            <label>Environment Variables</label>
            <div className="env-vars-container">
              {formData.envVars.map((envVar, index) => (
                <div key={index} className="env-var-row">
                  <input
                    type="text"
                    placeholder="Key"
                    value={envVar.key}
                    onChange={(e) => handleEnvVarChange(index, 'key', e.target.value)}
                    disabled={isLoading}
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={envVar.value}
                    onChange={(e) => handleEnvVarChange(index, 'value', e.target.value)}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="env-var-remove"
                    onClick={() => handleRemoveEnvVar(index)}
                    disabled={isLoading}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="env-var-add"
                onClick={handleAddEnvVar}
                disabled={isLoading}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Environment Variable
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="session-create-modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading || !formData.name.trim()}
            >
              {isLoading ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SessionCreateModal;
