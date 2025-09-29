import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Save, TestTube } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ApiSettings {
  apiKey: string;
  apiValue: string;
  baseUrl: string;
}

interface QueryParams {
  completed?: boolean;
  taskStartDate?: string;
  taskEndDate?: string;
  perPage: number;
}

interface SettingsPanelProps {
  settings?: ApiSettings;
  queryParams?: QueryParams;
  onSaveSettings?: (settings: ApiSettings) => void;
  onSaveQueryParams?: (params: QueryParams) => void;
  onTestConnection?: () => void;
  isTestingConnection?: boolean;
  connectionStatus?: 'success' | 'error' | 'idle';
}

export default function SettingsPanel({
  settings = { apiKey: '', apiValue: '', baseUrl: 'https://teams-api.operto.com/api/v1' },
  queryParams = { perPage: 100 },
  onSaveSettings,
  onSaveQueryParams,
  onTestConnection,
  isTestingConnection = false,
  connectionStatus = 'idle'
}: SettingsPanelProps) {
  const [apiSettings, setApiSettings] = useState<ApiSettings>(settings);
  const [params, setParams] = useState<QueryParams>(queryParams);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiValue, setShowApiValue] = useState(false);

  const handleSaveSettings = () => {
    console.log('Saving API settings:', apiSettings);
    onSaveSettings?.(apiSettings);
  };

  const handleSaveQueryParams = () => {
    console.log('Saving query parameters:', params);
    onSaveQueryParams?.(params);
  };

  const handleTestConnection = () => {
    console.log('Testing connection with settings:', apiSettings);
    onTestConnection?.();
  };

  const isValidSettings = apiSettings.apiKey.trim() && apiSettings.apiValue.trim();

  return (
    <div className="space-y-6 max-w-2xl">
      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            API Configuration
            {connectionStatus === 'success' && (
              <Badge variant="default" className="text-xs">Connected</Badge>
            )}
            {connectionStatus === 'error' && (
              <Badge variant="destructive" className="text-xs">Failed</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Configure your Operto API credentials to connect to the service.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connectionStatus === 'error' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Invalid API credentials. Please update settings and try again.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showApiKey ? 'text' : 'password'}
                placeholder="Enter your API key"
                value={apiSettings.apiKey}
                onChange={(e) => setApiSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                data-testid="input-api-key"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-auto px-2"
                onClick={() => setShowApiKey(!showApiKey)}
                data-testid="button-toggle-api-key"
              >
                {showApiKey ? 'Hide' : 'Show'}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="api-value">API Value</Label>
            <div className="relative">
              <Input
                id="api-value"
                type={showApiValue ? 'text' : 'password'}
                placeholder="Enter your API value"
                value={apiSettings.apiValue}
                onChange={(e) => setApiSettings(prev => ({ ...prev, apiValue: e.target.value }))}
                data-testid="input-api-value"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-auto px-2"
                onClick={() => setShowApiValue(!showApiValue)}
                data-testid="button-toggle-api-value"
              >
                {showApiValue ? 'Hide' : 'Show'}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="base-url">Base URL</Label>
            <Input
              id="base-url"
              placeholder="API base URL"
              value={apiSettings.baseUrl}
              onChange={(e) => setApiSettings(prev => ({ ...prev, baseUrl: e.target.value }))}
              data-testid="input-base-url"
            />
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button 
              onClick={handleSaveSettings}
              disabled={!isValidSettings}
              className="flex items-center gap-2"
              data-testid="button-save-settings"
            >
              <Save className="h-4 w-4" />
              Save Settings
            </Button>
            <Button 
              variant="outline"
              onClick={handleTestConnection}
              disabled={!isValidSettings || isTestingConnection}
              className="flex items-center gap-2"
              data-testid="button-test-connection"
            >
              <TestTube className="h-4 w-4" />
              {isTestingConnection ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Query Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Query Parameters</CardTitle>
          <CardDescription>
            Configure default parameters for fetching tasks from the API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="completed-filter">Completion Status</Label>
              <Select 
                value={params.completed === undefined ? 'all' : params.completed ? 'true' : 'false'}
                onValueChange={(value) => {
                  setParams(prev => ({
                    ...prev,
                    completed: value === 'all' ? undefined : value === 'true'
                  }));
                }}
              >
                <SelectTrigger data-testid="select-completed-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tasks</SelectItem>
                  <SelectItem value="true">Completed Only</SelectItem>
                  <SelectItem value="false">Incomplete Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="per-page">Results Per Page</Label>
              <Select 
                value={params.perPage.toString()}
                onValueChange={(value) => setParams(prev => ({ ...prev, perPage: parseInt(value) }))}
              >
                <SelectTrigger data-testid="select-per-page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Task Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={params.taskStartDate || ''}
                onChange={(e) => setParams(prev => ({ ...prev, taskStartDate: e.target.value || undefined }))}
                data-testid="input-start-date"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="end-date">Task End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={params.taskEndDate || ''}
                onChange={(e) => setParams(prev => ({ ...prev, taskEndDate: e.target.value || undefined }))}
                data-testid="input-end-date"
              />
            </div>
          </div>
          
          <div className="pt-2">
            <Button 
              onClick={handleSaveQueryParams}
              className="flex items-center gap-2"
              data-testid="button-save-query-params"
            >
              <Save className="h-4 w-4" />
              Save Query Parameters
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export type { ApiSettings, QueryParams };