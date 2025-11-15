import { useParams } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  setConnectionStatus,
  updateParticipant,
  removeParticipant,
  updateCursor,
  updateSelection,
  setDocumentContent,
  updateDocumentVersion,
  addToOperationHistory,
} from '../store/slices/collaborationSlice';
import Loader from '../components/ui/Loader';
import MonacoEditorWrapper from '../components/MonacoEditorWrapper';
import ParticipantsList from '../components/ParticipantsList';
import ConnectionStatus from '../components/ConnectionStatus';
import EditorControls from '../components/EditorControls';
import FileExplorer from '../components/file-explorer/FileExplorer';
import ChatInterface from '../components/chat/ChatInterface';
import { createEditorWebSocketController } from '../services/editorWebSocketController';
import { OTClient } from '../services/otClient';
import { Operation, CursorPosition } from '../types';

const WorkspacePage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const dispatch = useAppDispatch();
  const [language, setLanguage] = useState('javascript');
  const [theme, setTheme] = useState<'vs' | 'vs-dark' | 'hc-black'>('vs-dark');
  const [isLoading, setIsLoading] = useState(true);
  const [otClient, setOTClient] = useState<OTClient | null>(null);
  const [aiChatMessage, setAiChatMessage] = useState<string>('');

  const user = useAppSelector((state) => state.auth.user);
  const { documentContent, currentRoom } = useAppSelector((state) => state.collaboration);

  const clientId = user?.id || '';
  const userId = user?.id || '';

  useEffect(() => {
    if (isLoading && otClient) return;

    const wsController = createEditorWebSocketController({
      roomId: roomId || '',
      clientId,
      userId,
      onJoinRoomAck: (payload) => {
        dispatch(setDocumentContent(payload.content || ''));
        dispatch(updateDocumentVersion(payload.version || 0));
        setOTClient(new OTClient(payload.content || '', payload.version || 0));

        if (payload.participants) {
          payload.participants.forEach((participant: any) => {
            dispatch(updateParticipant(participant));
          });
        }

        setIsLoading(false);
        dispatch(setConnectionStatus('connected'));
      },
      onOperationBroadcast: (payload) => {
        if (payload.operation.clientId !== clientId && otClient) {
          const transformedOp = otClient.applyServerOperation(payload.operation);
          const newContent = otClient.applyContent(documentContent, transformedOp);
          dispatch(setDocumentContent(newContent));
          dispatch(addToOperationHistory(transformedOp));
          dispatch(updateDocumentVersion(payload.version));
        }
      },
      onCursorUpdate: (payload) => {
        if (payload.participantId && payload.participantId !== clientId) {
          if (payload.cursor) {
            dispatch(
              updateCursor({
                participantId: payload.participantId,
                cursor: payload.cursor,
              })
            );
          }
          if (payload.selection) {
            dispatch(
              updateSelection({
                participantId: payload.participantId,
                selection: payload.selection,
              })
            );
          }
        }
      },
      onParticipantJoined: (payload) => {
        if (payload.userInfo && payload.userInfo.id !== clientId) {
          dispatch(
            updateParticipant({
              id: payload.userInfo.id,
              userId: payload.userInfo.id,
              username: payload.userInfo.username,
              avatar: payload.userInfo.avatar,
              isActive: true,
              joinedAt: new Date().toISOString(),
            })
          );
        }
      },
      onParticipantLeft: (payload) => {
        if (payload.clientId && payload.clientId !== clientId) {
          dispatch(removeParticipant(payload.clientId));
        }
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
        dispatch(setConnectionStatus('error'));
      },
    });

    if (!isLoading) return undefined;

    dispatch(setConnectionStatus('connecting'));

    wsController.connect({ id: userId, username: user?.username }).catch((error) => {
      console.error('Failed to connect:', error);
      dispatch(setConnectionStatus('error'));
      setIsLoading(false);
    });

    return () => {
      wsController.leaveRoom();
    };
  }, [roomId, clientId, userId, user, dispatch, isLoading, documentContent, otClient]);

  const handleOperationChange = useCallback(
    (operation: Operation) => {
      if (otClient) {
        const appliedOp = otClient.applyOperation(operation);
        dispatch(addToOperationHistory(appliedOp));
        dispatch(updateDocumentVersion(otClient.getRevision()));
      }
    },
    [otClient, dispatch]
  );

  const handleCursorChange = useCallback((_cursor: CursorPosition) => {
    // Debounce cursor updates to avoid overwhelming the server
    // Implementation would send cursor update via WebSocket
  }, []);

  const handleAIContextRequest = useCallback((code: string, lang: string, prompt: string) => {
    setAiChatMessage(prompt);
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full gap-4 p-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Workspace</h1>
          <p className="text-gray-600 dark:text-gray-400">Room ID: {roomId}</p>
        </div>

        <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-center h-full">
            <Loader message="Loading workspace..." />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {currentRoom?.name || 'Workspace'}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Room ID: {roomId}</p>
      </div>

      {/* Editor Controls */}
      <EditorControls
        onLanguageChange={setLanguage}
        onThemeChange={(newTheme) => setTheme(newTheme as 'vs' | 'vs-dark' | 'hc-black')}
        onSave={() => console.log('Save triggered')}
      />

      {/* Main Content */}
      <div className="flex flex-1 gap-4 overflow-hidden px-4 py-4">
        {/* File Explorer with Preview and Upload */}
        <div className="h-full flex-1 flex-col overflow-hidden">
          <FileExplorer showPreview={true} showUpload={true} layout="horizontal" />
        </div>

        {/* Editor Section */}
        <div className="flex h-full flex-1 flex-col rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
          <MonacoEditorWrapper
            language={language}
            theme={theme}
            onOperationChange={handleOperationChange}
            onCursorChange={handleCursorChange}
            enableAICompletion={true}
            onAIContextRequest={handleAIContextRequest}
          />
        </div>

        {/* Collaboration Sidebar */}
        <div className="h-full w-64 flex-shrink-0 flex-col gap-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 p-3 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex max-h-full flex-col gap-3 overflow-auto">
            <ConnectionStatus />
            <ParticipantsList />
          </div>
        </div>
      </div>

      {/* AI Chat Interface */}
      <div className="mt-4 px-4 pb-6">
        <div className="h-[28rem]">
          <ChatInterface initialMessage={aiChatMessage} />
        </div>
      </div>
    </div>
  );
};

export default WorkspacePage;
