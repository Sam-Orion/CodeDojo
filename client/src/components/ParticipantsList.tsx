import { useAppSelector } from '../store';

const ParticipantsList = () => {
  const { participants, connectionStatus } = useAppSelector((state) => state.collaboration);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
          Participants ({participants.length})
        </h3>
        <div
          className={`h-2 w-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
      </div>

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className="flex items-center gap-2 px-3 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: participant.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                {participant.username}
              </p>
              {participant.cursor && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Line {participant.cursor.line + 1}, Col {participant.cursor.column + 1}
                </p>
              )}
            </div>
            {participant.isActive && (
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ParticipantsList;
