import { AlertTriangle, RefreshCw, Settings, Wifi } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ErrorDisplayProps {
  type: 'auth' | 'network' | 'api' | 'general';
  message?: string;
  onRetry?: () => void;
  onSettings?: () => void;
  isRetrying?: boolean;
}

export default function ErrorDisplay({ 
  type, 
  message, 
  onRetry, 
  onSettings,
  isRetrying = false 
}: ErrorDisplayProps) {
  const getErrorContent = () => {
    switch (type) {
      case 'auth':
        return {
          icon: <Settings className="h-5 w-5" />,
          title: 'Authentication Failed',
          description: message || 'Invalid API credentials. Please update your settings and try again.',
          actions: (
            <div className="flex gap-2">
              {onSettings && (
                <Button 
                  onClick={onSettings}
                  className="flex items-center gap-2"
                  data-testid="button-go-to-settings"
                >
                  <Settings className="h-4 w-4" />
                  Update Settings
                </Button>
              )}
              {onRetry && (
                <Button 
                  variant="outline"
                  onClick={onRetry}
                  disabled={isRetrying}
                  className="flex items-center gap-2"
                  data-testid="button-retry-auth"
                >
                  <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                  {isRetrying ? 'Retrying...' : 'Retry'}
                </Button>
              )}
            </div>
          )
        };
      
      case 'network':
        return {
          icon: <Wifi className="h-5 w-5" />,
          title: 'Network Error',
          description: message || 'Unable to connect to the Operto API. Please check your internet connection.',
          actions: (
            <div className="flex gap-2">
              {onRetry && (
                <Button 
                  onClick={onRetry}
                  disabled={isRetrying}
                  className="flex items-center gap-2"
                  data-testid="button-retry-network"
                >
                  <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                  {isRetrying ? 'Retrying...' : 'Retry Connection'}
                </Button>
              )}
            </div>
          )
        };
      
      case 'api':
        return {
          icon: <AlertTriangle className="h-5 w-5" />,
          title: 'API Error',
          description: message || 'Error fetching tasks. The API response format may be invalid. Please try again.',
          actions: (
            <div className="flex gap-2">
              {onRetry && (
                <Button 
                  onClick={onRetry}
                  disabled={isRetrying}
                  className="flex items-center gap-2"
                  data-testid="button-retry-api"
                >
                  <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                  {isRetrying ? 'Retrying...' : 'Try Again'}
                </Button>
              )}
              {onSettings && (
                <Button 
                  variant="outline"
                  onClick={onSettings}
                  className="flex items-center gap-2"
                  data-testid="button-check-settings"
                >
                  <Settings className="h-4 w-4" />
                  Check Settings
                </Button>
              )}
            </div>
          )
        };
      
      default:
        return {
          icon: <AlertTriangle className="h-5 w-5" />,
          title: 'Unexpected Error',
          description: message || 'An unexpected error occurred. Please try again.',
          actions: (
            <div className="flex gap-2">
              {onRetry && (
                <Button 
                  onClick={onRetry}
                  disabled={isRetrying}
                  className="flex items-center gap-2"
                  data-testid="button-retry-general"
                >
                  <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                  {isRetrying ? 'Retrying...' : 'Try Again'}
                </Button>
              )}
            </div>
          )
        };
    }
  };

  const errorContent = getErrorContent();

  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="p-6">
        <Alert>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 text-destructive">
              {errorContent.icon}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <AlertTitle className="text-base font-semibold">
                  {errorContent.title}
                </AlertTitle>
                <AlertDescription className="mt-1 text-sm">
                  {errorContent.description}
                </AlertDescription>
              </div>
              {errorContent.actions && (
                <div className="pt-2">
                  {errorContent.actions}
                </div>
              )}
            </div>
          </div>
        </Alert>
      </CardContent>
    </Card>
  );
}