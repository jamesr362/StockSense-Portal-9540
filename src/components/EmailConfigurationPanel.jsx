import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RiMailLine, RiTestTubeLine, RiCheckLine, RiAlertLine, RiSettings3Line, RiEyeLine, RiEyeOffLine, RiSendPlaneLine } from 'react-icons/ri';
import { 
  getEmailConfig, 
  saveEmailConfig, 
  testEmailConfig, 
  EMAIL_PROVIDERS, 
  EMAIL_TEMPLATES,
  getEmailStats 
} from '../services/email';

export default function EmailConfigurationPanel() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('provider');
  const [showPasswords, setShowPasswords] = useState({});
  const [emailStats, setEmailStats] = useState(null);

  const tabs = [
    { id: 'provider', name: 'Email Provider', icon: RiMailLine },
    { id: 'templates', name: 'Email Templates', icon: RiSettings3Line },
    { id: 'statistics', name: 'Statistics', icon: RiSendPlaneLine }
  ];

  useEffect(() => {
    loadConfiguration();
    loadEmailStats();
  }, []);

  const loadConfiguration = () => {
    try {
      const emailConfig = getEmailConfig();
      setConfig(emailConfig);
      setLoading(false);
    } catch (error) {
      console.error('Error loading email config:', error);
      setError('Failed to load email configuration');
      setLoading(false);
    }
  };

  const loadEmailStats = () => {
    try {
      const stats = getEmailStats();
      setEmailStats(stats);
    } catch (error) {
      console.error('Error loading email stats:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const saved = saveEmailConfig(config);
      if (saved) {
        setSuccess('Email configuration saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to save email configuration');
      }
    } catch (error) {
      setError('Error saving configuration: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      setError('Please enter a test email address');
      return;
    }

    setTesting(true);
    setTestResult(null);
    setError('');

    try {
      const result = await testEmailConfig(config, testEmail);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Test failed: ' + error.message
      });
    } finally {
      setTesting(false);
    }
  };

  const updateConfig = (path, value) => {
    setConfig(prev => {
      const newConfig = { ...prev };
      const keys = path.split('.');
      let current = newConfig;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newConfig;
    });
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-white">Email Integration</h3>
            <p className="text-gray-400 text-sm">Configure email services for notifications and alerts</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${config?.enabled ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className="text-sm text-gray-300">
                {config?.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
          <div>
            <h4 className="text-white font-medium">Email Service</h4>
            <p className="text-gray-400 text-sm">Enable or disable email notifications platform-wide</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config?.enabled || false}
              onChange={(e) => updateConfig('enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-900/50 border border-red-700 rounded-lg p-4"
        >
          <div className="flex items-center">
            <RiAlertLine className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-900/50 border border-green-700 rounded-lg p-4"
        >
          <div className="flex items-center">
            <RiCheckLine className="h-5 w-5 text-green-400 mr-2" />
            <p className="text-green-300 text-sm">{success}</p>
          </div>
        </motion.div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'provider' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Provider Selection */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h4 className="text-white font-medium mb-4">Email Service Provider</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(EMAIL_PROVIDERS).map(([key, value]) => (
                  <label
                    key={value}
                    className={`relative rounded-lg border p-4 cursor-pointer transition-colors ${
                      config?.provider === value
                        ? 'border-primary-500 bg-primary-50/10'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="provider"
                      value={value}
                      checked={config?.provider === value}
                      onChange={(e) => updateConfig('provider', e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                        config?.provider === value
                          ? 'border-primary-500 bg-primary-500'
                          : 'border-gray-400'
                      }`}>
                        {config?.provider === value && (
                          <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                        )}
                      </div>
                      <span className="text-white font-medium capitalize">{key}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Provider Settings */}
            {config?.provider === EMAIL_PROVIDERS.SMTP && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h4 className="text-white font-medium mb-4">SMTP Configuration</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      value={config?.settings?.smtp?.host || ''}
                      onChange={(e) => updateConfig('settings.smtp.host', e.target.value)}
                      placeholder="smtp.gmail.com"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Port
                    </label>
                    <input
                      type="number"
                      value={config?.settings?.smtp?.port || 587}
                      onChange={(e) => updateConfig('settings.smtp.port', parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={config?.settings?.smtp?.auth?.user || ''}
                      onChange={(e) => updateConfig('settings.smtp.auth.user', e.target.value)}
                      placeholder="your-email@gmail.com"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.smtp ? 'text' : 'password'}
                        value={config?.settings?.smtp?.auth?.pass || ''}
                        onChange={(e) => updateConfig('settings.smtp.auth.pass', e.target.value)}
                        placeholder="App password or regular password"
                        className="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('smtp')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                      >
                        {showPasswords.smtp ? <RiEyeOffLine className="h-4 w-4" /> : <RiEyeLine className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config?.settings?.smtp?.secure || false}
                      onChange={(e) => updateConfig('settings.smtp.secure', e.target.checked)}
                      className="rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-300">Use TLS/SSL</span>
                  </label>
                </div>
              </div>
            )}

            {config?.provider === EMAIL_PROVIDERS.SENDGRID && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h4 className="text-white font-medium mb-4">SendGrid Configuration</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.sendgrid ? 'text' : 'password'}
                      value={config?.settings?.sendgrid?.apiKey || ''}
                      onChange={(e) => updateConfig('settings.sendgrid.apiKey', e.target.value)}
                      placeholder="SG.xxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('sendgrid')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                    >
                      {showPasswords.sendgrid ? <RiEyeOffLine className="h-4 w-4" /> : <RiEyeLine className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* From Email Settings */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h4 className="text-white font-medium mb-4">Sender Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    From Email
                  </label>
                  <input
                    type="email"
                    value={config?.fromEmail || ''}
                    onChange={(e) => updateConfig('fromEmail', e.target.value)}
                    placeholder="noreply@trackio.com"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    From Name
                  </label>
                  <input
                    type="text"
                    value={config?.fromName || ''}
                    onChange={(e) => updateConfig('fromName', e.target.value)}
                    placeholder="Trackio"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Reply-To Email
                  </label>
                  <input
                    type="email"
                    value={config?.replyTo || ''}
                    onChange={(e) => updateConfig('replyTo', e.target.value)}
                    placeholder="support@trackio.com"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            {/* Test Email */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h4 className="text-white font-medium mb-4">Test Configuration</h4>
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <button
                  onClick={handleTest}
                  disabled={testing || !config?.enabled}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {testing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <RiTestTubeLine className="h-4 w-4 mr-2" />
                  )}
                  {testing ? 'Testing...' : 'Send Test'}
                </button>
              </div>

              {testResult && (
                <div className={`mt-4 p-3 rounded-lg ${
                  testResult.success 
                    ? 'bg-green-900/50 border border-green-700' 
                    : 'bg-red-900/50 border border-red-700'
                }`}>
                  <div className="flex items-center">
                    {testResult.success ? (
                      <RiCheckLine className="h-5 w-5 text-green-400 mr-2" />
                    ) : (
                      <RiAlertLine className="h-5 w-5 text-red-400 mr-2" />
                    )}
                    <p className={`text-sm ${testResult.success ? 'text-green-300' : 'text-red-300'}`}>
                      {testResult.message}
                    </p>
                  </div>
                  {testResult.details && (
                    <div className="mt-2 text-xs text-gray-400">
                      <p>Provider: {testResult.details.provider}</p>
                      <p>Sent to: {testResult.details.to}</p>
                      <p>Time: {new Date(testResult.details.timestamp).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'templates' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {Object.entries(EMAIL_TEMPLATES).map(([key, templateKey]) => {
              const template = config?.templates?.[templateKey];
              return (
                <div key={templateKey} className="bg-gray-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-white font-medium capitalize">
                      {templateKey.replace(/_/g, ' ')} Email
                    </h4>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={template?.enabled || false}
                        onChange={(e) => updateConfig(`templates.${templateKey}.enabled`, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Subject Line
                      </label>
                      <input
                        type="text"
                        value={template?.subject || ''}
                        onChange={(e) => updateConfig(`templates.${templateKey}.subject`, e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Email Template
                      </label>
                      <textarea
                        value={template?.template || ''}
                        onChange={(e) => updateConfig(`templates.${templateKey}.template`, e.target.value)}
                        rows={8}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Use variables like {{name}}, {{email}}, {{resetLink}} in your template
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {activeTab === 'statistics' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {emailStats && (
              <>
                {/* Email Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-800 rounded-lg p-6">
                    <div className="flex items-center">
                      <RiCheckLine className="h-8 w-8 text-green-400 mr-3" />
                      <div>
                        <div className="text-2xl font-bold text-white">{emailStats.totalSent}</div>
                        <div className="text-gray-400 text-sm">Emails Sent</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-800 rounded-lg p-6">
                    <div className="flex items-center">
                      <RiAlertLine className="h-8 w-8 text-red-400 mr-3" />
                      <div>
                        <div className="text-2xl font-bold text-white">{emailStats.totalFailed}</div>
                        <div className="text-gray-400 text-sm">Failed Attempts</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-800 rounded-lg p-6">
                    <div className="flex items-center">
                      <RiTestTubeLine className="h-8 w-8 text-blue-400 mr-3" />
                      <div>
                        <div className="text-2xl font-bold text-white">{emailStats.totalTests}</div>
                        <div className="text-gray-400 text-sm">Test Emails</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Emails */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h4 className="text-white font-medium mb-4">Recent Email Activity</h4>
                  {emailStats.recentEmails.length === 0 ? (
                    <p className="text-gray-400">No recent email activity</p>
                  ) : (
                    <div className="space-y-3">
                      {emailStats.recentEmails.map((email, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                          <div>
                            <p className="text-white text-sm">{email.to}</p>
                            <p className="text-gray-400 text-xs">{email.template || 'Custom email'}</p>
                          </div>
                          <div className="text-gray-400 text-xs">
                            {new Date(email.timestamp).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <RiCheckLine className="h-4 w-4 mr-2" />
          )}
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </motion.div>
  );
}