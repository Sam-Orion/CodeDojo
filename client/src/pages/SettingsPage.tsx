import { useState } from 'react';
import { useAppSelector } from '../store';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card, { CardHeader, CardBody, CardFooter } from '../components/ui/Card';

const SettingsPage = () => {
  const { user } = useAppSelector((state) => state.auth);
  const [isDirty, setIsDirty] = useState(false);
  const [settings, setSettings] = useState({
    username: user?.username || '',
    email: user?.email || '',
    theme: 'light',
    notifications: true,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setSettings((prev) => ({
      ...prev,
      [name]: newValue,
    }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    console.log('Saving settings:', settings);
    setIsDirty(false);
  };

  return (
    <div className="flex flex-col gap-8 p-8 max-w-4xl">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your account and preferences</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Account Settings
            </h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input
              type="text"
              name="username"
              label="Username"
              value={settings.username}
              onChange={handleChange}
            />
            <Input
              type="email"
              name="email"
              label="Email Address"
              value={settings.email}
              onChange={handleChange}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Preferences</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <label htmlFor="theme" className="label mb-1">
                Theme
              </label>
              <select
                id="theme"
                name="theme"
                value={settings.theme}
                onChange={handleChange}
                className="input-field"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="notifications"
                name="notifications"
                checked={settings.notifications}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
              />
              <label htmlFor="notifications" className="text-sm text-gray-700 dark:text-gray-300">
                Enable notifications
              </label>
            </div>
          </CardBody>
          <CardFooter className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsDirty(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={!isDirty}>
              Save Changes
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Danger Zone</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              These actions cannot be undone. Please be careful.
            </p>
          </CardBody>
          <CardFooter>
            <Button variant="danger">Delete Account</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
