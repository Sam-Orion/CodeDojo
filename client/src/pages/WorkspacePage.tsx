import { useParams } from 'react-router-dom';
import Loader from '../components/ui/Loader';

const WorkspacePage = () => {
  const { roomId } = useParams<{ roomId: string }>();

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
};

export default WorkspacePage;
