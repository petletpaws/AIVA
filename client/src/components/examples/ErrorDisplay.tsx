import { useState } from 'react';
import ErrorDisplay from '../ErrorDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ErrorDisplayExample() {
  const [errorType, setErrorType] = useState<'auth' | 'network' | 'api' | 'general'>('auth');
  const [isRetrying, setIsRetrying] = useState(false);
  
  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => setIsRetrying(false), 2000);
  };
  
  const handleSettings = () => {
    console.log('Navigate to settings');
  };
  
  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Error Display Examples</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-6">
            <Button 
              variant={errorType === 'auth' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setErrorType('auth')}
            >
              Auth Error
            </Button>
            <Button 
              variant={errorType === 'network' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setErrorType('network')}
            >
              Network Error
            </Button>
            <Button 
              variant={errorType === 'api' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setErrorType('api')}
            >
              API Error
            </Button>
            <Button 
              variant={errorType === 'general' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setErrorType('general')}
            >
              General Error
            </Button>
          </div>
          
          <ErrorDisplay
            type={errorType}
            onRetry={handleRetry}
            onSettings={handleSettings}
            isRetrying={isRetrying}
          />
        </CardContent>
      </Card>
    </div>
  );
}