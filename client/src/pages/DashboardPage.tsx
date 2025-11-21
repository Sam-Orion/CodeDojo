import { useState } from 'react';
import { useAppSelector } from '../store';
import Button from '../components/ui/Button';
import Card, { CardHeader, CardBody, CardFooter } from '../components/ui/Card';
import ConversationAnalyticsDashboard from '../components/chat/ConversationAnalyticsDashboard';

const DashboardPage = () => {
  const { user } = useAppSelector((state) => state.auth);
  const [projects] = useState([
    { id: 1, name: 'My First Project', language: 'JavaScript', lastEdited: '2 hours ago' },
    { id: 2, name: 'Python Tutorial', language: 'Python', lastEdited: 'yesterday' },
    { id: 3, name: 'React Components', language: 'TypeScript', lastEdited: '3 days ago' },
  ]);

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Dashboard</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">Welcome back, {user?.username}!</p>
      </div>

      {/* Conversation Analytics Dashboard */}
      <ConversationAnalyticsDashboard />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <div className="text-center">
            <div className="text-4xl font-bold text-primary-600 mb-2">{projects.length}</div>
            <p className="text-gray-600 dark:text-gray-400">Active Projects</p>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">12</div>
            <p className="text-gray-600 dark:text-gray-400">Collaborators</p>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">28</div>
            <p className="text-gray-600 dark:text-gray-400">Lines of Code</p>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Recent Projects</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} isHoverable>
                <CardHeader>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {project.name}
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Language:</span> {project.language}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Last edited:</span> {project.lastEdited}
                    </p>
                  </div>
                </CardBody>
                <CardFooter className="space-x-2">
                  <Button size="sm" variant="primary">
                    Open
                  </Button>
                  <Button size="sm" variant="ghost">
                    Edit
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Create New Project</Button>
            <Button variant="secondary">Join Room</Button>
            <Button variant="secondary">Browse Templates</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
