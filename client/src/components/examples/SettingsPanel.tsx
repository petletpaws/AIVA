import SettingsPanel from '../SettingsPanel';

export default function SettingsPanelExample() {
  return (
    <div className="p-6">
      <SettingsPanel 
        connectionStatus="idle"
        onSaveSettings={(settings) => console.log('Settings saved:', settings)}
        onSaveQueryParams={(params) => console.log('Query params saved:', params)}
        onTestConnection={() => console.log('Testing connection...')}
      />
    </div>
  );
}