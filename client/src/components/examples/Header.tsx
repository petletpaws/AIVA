import { useState } from 'react';
import Header from '../Header';

export default function HeaderExample() {
  const [currentView, setCurrentView] = useState<'tasks' | 'settings'>('tasks');
  
  return (
    <div className="min-h-screen bg-background">
      <Header 
        currentView={currentView}
        onNavigate={setCurrentView}
        connectionStatus="connected"
        taskCount={12}
      />
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Current View: {currentView}</h2>
          <p className="text-muted-foreground">
            Click the navigation buttons in the header to switch between views.
          </p>
        </div>
      </div>
    </div>
  );
}