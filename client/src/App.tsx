import { useState, useEffect } from 'react';
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from '@/components/Header';
import TaskTable, { Task } from '@/components/TaskTable';
import SettingsPanel, { ApiSettings, QueryParams } from '@/components/SettingsPanel';
import ErrorDisplay from '@/components/ErrorDisplay';

// todo: remove mock functionality
const mockTasks: Task[] = [
  {
    TaskID: "TSK-001",
    TaskName: "Room Cleaning - Premium Suite",
    TaskDescription: "Complete deep cleaning of premium suite including bathroom sanitization and amenity restocking",
    CompleteConfirmedDate: "2024-01-15T10:30:00Z",
    Property: {
      PropertyAbbreviation: "HTL-NYC"
    },
    Staff: [{ Name: "Sarah Johnson" }]
  },
  {
    TaskID: "TSK-002",
    TaskName: "Maintenance Check - HVAC System",
    TaskDescription: "Routine inspection and maintenance of HVAC system in lobby area",
    CompleteConfirmedDate: null,
    Property: {
      PropertyAbbreviation: "HTL-NYC"
    },
    Staff: [{ Name: "Mike Rodriguez" }]
  },
  {
    TaskID: "TSK-003",
    TaskName: "Guest Service - Concierge Request",
    TaskDescription: "Assist guest with restaurant reservations and transportation booking",
    CompleteConfirmedDate: "2024-01-15T14:45:00Z",
    Property: {
      PropertyAbbreviation: "HTL-LA"
    },
    Staff: [{ Name: "Emily Chen" }]
  },
  {
    TaskID: "TSK-004",
    TaskName: "Security Patrol - Night Shift",
    TaskDescription: "Complete security rounds of all floors and common areas",
    CompleteConfirmedDate: null,
    Property: {
      PropertyAbbreviation: "HTL-LA"
    },
    Staff: [{ Name: "Mike Rodriguez" }]
  },
  {
    TaskID: "TSK-005",
    TaskName: "Inventory Management - Housekeeping",
    TaskDescription: "Check and restock housekeeping supplies for all floors",
    CompleteConfirmedDate: null,
    Property: {
      PropertyAbbreviation: "HTL-SF"
    },
    Staff: [{ Name: "Sarah Johnson" }, { Name: "Emily Chen" }]
  },
  {
    TaskID: "TSK-006",
    TaskName: "Equipment Repair - Laundry",
    TaskDescription: "Fix malfunctioning washing machine in laundry facility",
    CompleteConfirmedDate: "2024-01-14T16:20:00Z",
    Property: {
      PropertyAbbreviation: "HTL-SF"
    },
    Staff: [{ Name: "Mike Rodriguez" }]
  },
  {
    TaskID: "TSK-007",
    TaskName: "Kitchen Preparation - Breakfast",
    TaskDescription: "Prepare ingredients and setup for breakfast service",
    CompleteConfirmedDate: null,
    Property: {
      PropertyAbbreviation: "HTL-NYC"
    },
    Staff: [{ Name: "Emily Chen" }]
  },
  {
    TaskID: "TSK-008",
    TaskName: "Event Setup - Conference Room",
    TaskDescription: "Setup conference room for corporate meeting with 50 attendees",
    CompleteConfirmedDate: "2024-01-15T08:00:00Z",
    Property: {
      PropertyAbbreviation: "HTL-LA"
    },
    Staff: [{ Name: "Sarah Johnson" }, { Name: "Mike Rodriguez" }]
  }
];

type ConnectionStatus = 'connected' | 'disconnected' | 'error';
type ViewType = 'tasks' | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('tasks');
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

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Simulate loading tasks when settings are valid
  useEffect(() => {
    if (apiSettings.apiKey && apiSettings.apiValue && connectionStatus === 'connected') {
      // todo: replace with real API call
      setTasks(mockTasks);
    } else {
      setTasks([]);
    }
  }, [apiSettings.apiKey, apiSettings.apiValue, connectionStatus]);

  const handleSaveSettings = (settings: ApiSettings) => {
    console.log('Saving API settings:', settings);
    setApiSettings(settings);
    setError(null);
    
    // Simulate connection validation
    if (settings.apiKey.trim() && settings.apiValue.trim()) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('disconnected');
    }
  };

  const handleSaveQueryParams = (params: QueryParams) => {
    console.log('Saving query parameters:', params);
    setQueryParams(params);
  };

  const handleTestConnection = async () => {
    console.log('Testing connection with settings:', apiSettings);
    setIsTestingConnection(true);
    setError(null);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (apiSettings.apiKey.trim() && apiSettings.apiValue.trim()) {
        setConnectionStatus('connected');
        console.log('Connection test successful');
      } else {
        setConnectionStatus('error');
        setError({ type: 'auth', message: 'Invalid API credentials. Please update settings.' });
      }
    } catch (err) {
      setConnectionStatus('error');
      setError({ type: 'network', message: 'Unable to connect to the Operto API.' });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleLoadTasks = async () => {
    console.log('Loading tasks...');
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (connectionStatus === 'connected') {
        // todo: replace with real API call
        setTasks(mockTasks);
        console.log('Tasks loaded successfully');
      } else {
        setError({ type: 'auth', message: 'Please configure your API settings first.' });
      }
    } catch (err) {
      setError({ type: 'api', message: 'Error fetching tasks. Please try again.' });
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
          {connectionStatus === 'disconnected' && (
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
          
          {connectionStatus === 'connected' && (
            <TaskTable 
              tasks={tasks} 
              isLoading={isLoading}
            />
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
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
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
