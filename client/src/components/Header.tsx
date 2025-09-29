import { Moon, Sun, Settings, Database, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';

interface HeaderProps {
  onNavigate?: (view: 'tasks' | 'settings') => void;
  currentView?: 'tasks' | 'settings';
  connectionStatus?: 'connected' | 'disconnected' | 'error';
  taskCount?: number;
}

export default function Header({ 
  onNavigate, 
  currentView = 'tasks',
  connectionStatus = 'disconnected',
  taskCount = 0
}: HeaderProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check if dark mode is already enabled
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const toggleDarkMode = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    
    console.log('Theme toggled to:', newIsDark ? 'dark' : 'light');
  };

  const handleNavigation = (view: 'tasks' | 'settings') => {
    console.log('Navigating to:', view);
    onNavigate?.(view);
  };

  const getConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <Database className="h-3 w-3" />
            Connected
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Database className="h-3 w-3" />
            Disconnected
          </Badge>
        );
    }
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Logo and Navigation */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">Operto Task Manager</h1>
            </div>
            
            <nav className="flex gap-2">
              <Button
                variant={currentView === 'tasks' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleNavigation('tasks')}
                className="flex items-center gap-2"
                data-testid="button-nav-tasks"
              >
                <Database className="h-4 w-4" />
                Tasks
                {taskCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {taskCount}
                  </Badge>
                )}
              </Button>
              <Button
                variant={currentView === 'settings' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleNavigation('settings')}
                className="flex items-center gap-2"
                data-testid="button-nav-settings"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </nav>
          </div>

          {/* Right side - Status and Controls */}
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {getConnectionStatusBadge()}
            </div>
            
            {/* Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              className="h-9 w-9"
              data-testid="button-theme-toggle"
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}