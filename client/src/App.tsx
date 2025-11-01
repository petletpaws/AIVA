import { useState, useEffect } from 'react';
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import Header from '@/components/Header';
import TaskTable, { Task } from '@/components/TaskTable';
import SettingsPanel, { ApiSettings, QueryParams } from '@/components/SettingsPanel';
import ErrorDisplay from '@/components/ErrorDisplay';

type ConnectionStatus = 'connected' | 'disconnected' | 'error';
type ViewType = 'tasks' | 'settings';

function AppContent() {
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<ViewType>('settings');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [apiSettings, setApiSettings] = useState<ApiSettings>({
    apiKey: '',
    apiValue: '',
    baseUrl: 'https://teams-api.operto.com/api/v1'
  });
  const [queryParams, setQueryParams] = useState<QueryParams>({
    perPage: 100
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ type: 'auth' | 'network' | 'api' | 'general'; message?: string } | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    }

    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const settings = await response.json();
        setApiSettings({
          apiKey: settings.apiKey,
          apiValue: settings.apiValue,
          baseUrl: 'https://teams-api.operto.com/api/v1'
        });
        setQueryParams({
          completed: settings.completed,
          taskStartDate: settings.taskStartDate,
          taskEndDate: settings.taskEndDate,
          perPage: settings.perPage || 100
        });
        setCurrentView('tasks');
      }
    } catch (err) {
      console.log('No saved settings found');
    }
  };

  const handleSaveSettings = async (settings: ApiSettings) => {
    try {
      const payload = {
        apiKey: settings.apiKey,
        apiValue: settings.apiValue,
        ...queryParams
      };

      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      setApiSettings(settings);
      setError(null);
      setConnectionStatus('disconnected');
      
      toast({
        title: "Settings Saved",
        description: "Your API configuration has been saved successfully."
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save settings",
        variant: "destructive"
      });
    }
  };

  const handleSaveQueryParams = async (params: QueryParams) => {
    try {
      const payload = {
        apiKey: apiSettings.apiKey,
        apiValue: apiSettings.apiValue,
        ...params
      };

      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save query parameters');
      }

      setQueryParams(params);
      
      toast({
        title: "Query Parameters Updated",
        description: "Your task filters have been saved."
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save query parameters",
        variant: "destructive"
      });
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setError(null);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok) {
        setConnectionStatus('connected');
        toast({
          title: "Connection Successful",
          description: "Successfully authenticated with Operto API."
        });
        setCurrentView('tasks');
        await handleLoadTasks();
      } else {
        setConnectionStatus('error');
        setError({ 
          type: 'auth', 
          message: data.error || 'Invalid API credentials. Please update settings.' 
        });
        toast({
          title: "Connection Failed",
          description: data.error || "Authentication failed",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setError({ 
        type: 'network', 
        message: 'Unable to connect to the Operto API.' 
      });
      toast({
        title: "Network Error",
        description: "Unable to connect to the server",
        variant: "destructive"
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleLoadTasks = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/tasks');
      const data = await response.json();

      if (response.ok) {
        setTasks(data.tasks || []);
        setConnectionStatus('connected');
        toast({
          title: "Tasks Loaded",
          description: `Successfully loaded ${data.total || 0} tasks.`
        });
      } else {
        if (response.status === 401) {
          setConnectionStatus('disconnected');
          setError({ 
            type: 'auth', 
            message: data.error || 'Invalid API credentials. Please update settings.' 
          });
        } else {
          setError({ 
            type: 'api', 
            message: data.error || 'Error fetching tasks. Please try again.' 
          });
        }
        toast({
          title: "Failed to Load Tasks",
          description: data.error || "Unable to fetch tasks",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      setError({ 
        type: 'api', 
        message: 'Error fetching tasks. Please try again.' 
      });
      toast({
        title: "Error",
        description: "Failed to load tasks",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryError = () => {
    if (error?.type === 'auth') {
      handleTestConnection();
    } else {
      handleLoadTasks();
    }
  };

  const handleGoToSettings = () => {
    setCurrentView('settings');
  };

  const renderContent = () => {
    if (currentView === 'settings') {
      return (
        <SettingsPanel
          settings={apiSettings}
          queryParams={queryParams}
          onSaveSettings={handleSaveSettings}
          onSaveQueryParams={handleSaveQueryParams}
          onTestConnection={handleTestConnection}
          isTestingConnection={isTestingConnection}
          connectionStatus={connectionStatus === 'connected' ? 'success' : connectionStatus === 'error' ? 'error' : 'idle'}
        />
      );
    }

    if (error && currentView === 'tasks') {
      return (
        <ErrorDisplay
          type={error.type}
          message={error.message}
          onRetry={handleRetryError}
          onSettings={handleGoToSettings}
          isRetrying={isLoading || isTestingConnection}
        />
      );
    }

    if (currentView === 'tasks') {
      return (
        <div className="space-y-6">
          {connectionStatus === 'disconnected' && !isLoading && tasks.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Configure your API settings to start loading tasks.
              </p>
              <button
                onClick={handleGoToSettings}
                className="text-primary hover:underline"
                data-testid="link-configure-settings"
              >
                Go to Settings
              </button>
            </div>
          )}
          
          {(connectionStatus === 'connected' || tasks.length > 0) && (
            <TaskTable 
              tasks={tasks} 
              isLoading={isLoading}
              onRefresh={handleLoadTasks}
            />
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        currentView={currentView}
        onNavigate={setCurrentView}
        connectionStatus={connectionStatus}
        taskCount={tasks.length}
      />
      
      <main className="container mx-auto px-4 py-6">
        {renderContent()}
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
