import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { User, HardDrive, Save, Wifi, WifiOff, RefreshCw, Trash2, Server, Languages, XCircle, Zap, Shield, Cpu, Terminal, ChevronDown } from 'lucide-react';
import { useLauncher } from '../../contexts/LauncherContext';
import LauncherService from '../../services/launcherService';
import MetaStorageSettings from './MetaStorageSettings';
import toast from 'react-hot-toast';
import { useLuminaCore } from '../../hooks/useLuminaCore';
import { useAnimation } from '../../contexts/AnimationContext';

interface SettingsPageProps {
  onNavigationBlocked?: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigationBlocked }) => {
  const { t } = useTranslation();
  const { userSettings, updateUserSettings, currentLanguage, changeLanguage, hasActiveOperations } = useLauncher();
  const { isConnected, lastMessage, startCore, sendCommand } = useLuminaCore();
  const { getAnimationStyle, withDelay } = useAnimation();

  const [formData, setFormData] = useState(userSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [shakeAttempts, setShakeAttempts] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('LK_lastApiStatus') : null;
    return saved === 'online' || saved === 'offline' ? saved : 'offline';
  });
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('LK_lastApiCheckAt') : null;
    return saved ? Number(saved) : null;
  });
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [systemRam, setSystemRam] = useState<number>(65536); // Default to 64GB in MB, will be updated
  // Java runtime handled internally by Lyceris; no user-facing settings.

  useEffect(() => {
    setFormData(userSettings);
  }, [userSettings]);

  useEffect(() => {
    const isDifferent = JSON.stringify(formData) !== JSON.stringify(userSettings);
    setHasChanges(isDifferent);
  }, [formData, userSettings]);

  // Fetch system RAM on mount (in MB)
  useEffect(() => {
    const fetchSystemRam = async () => {
      try {
        const totalBytes = await invoke<number>('get_system_memory');
        // Convert to MB for RAM settings
        const totalMB = Math.floor(totalBytes / 1024 / 1024);
        setSystemRam(totalMB);
      } catch (error) {
        console.error('Failed to get system RAM:', error);
        // Keep default of 65536 MB (64GB) if fetch fails
      }
    };
    fetchSystemRam();
  }, []);

  const checkAPIStatus = async () => {
    setApiStatus('checking');
    try {
      const isHealthy = await LauncherService.getInstance().checkAPIHealth();
      const status: 'online' | 'offline' = isHealthy ? 'online' : 'offline';
      setApiStatus(status);
      const now = Date.now();
      setLastCheckedAt(now);
      if (typeof window !== 'undefined') {
        localStorage.setItem('LK_lastApiStatus', status);
        localStorage.setItem('LK_lastApiCheckAt', String(now));
      }
    } catch (_error) {
      const status: 'online' | 'offline' = 'offline';
      setApiStatus(status);
      const now = Date.now();
      setLastCheckedAt(now);
      if (typeof window !== 'undefined') {
        localStorage.setItem('LK_lastApiStatus', status);
        localStorage.setItem('LK_lastApiCheckAt', String(now));
      }
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (field === 'username') {
      const trimmed = value.trim();
      if (trimmed === '') {
        setUsernameError(t('settings.usernameRequired'));
      } else if (trimmed.length > 16) {
        setUsernameError(t('settings.usernameTooLong'));
      } else {
        setUsernameError(null);
      }
    }
  };


  const handleSave = () => {
    if (usernameError) {
      toast.error(t('settings.usernameInvalidToast'));
      return;
    }
    updateUserSettings(formData);
    setHasChanges(false);
    toast.success(t('settings.saved'));
  };

  const handleDiscard = () => {
    setFormData(userSettings);
    setHasChanges(false);
    toast(t('settings.changesDiscarded'));
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    await checkAPIStatus();
    setIsTestingConnection(false);
  };

  const handleClearCache = () => {
    LauncherService.getInstance().clearCache();
    toast.success(t('settings.saved'));
  };

  const triggerShake = () => {
    if (isShaking) return; // Prevent multiple simultaneous shakes

    setShakeAttempts(prev => prev + 1);
    setIsShaking(true);

    // Reset shake after animation completes
    setTimeout(() => {
      setIsShaking(false);
    }, 600); // Animation duration

    // Reset attempts after 3 seconds of no attempts
    setTimeout(() => {
      setShakeAttempts(0);
    }, 3000);
  };

  // Expose the navigation blocking function
  React.useEffect(() => {
    if (hasChanges && onNavigationBlocked) {
      (window as any).blockNavigation = () => {
        triggerShake();
        return false; // Block navigation
      };
    } else {
      (window as any).blockNavigation = null;
    }

    return () => {
      (window as any).blockNavigation = null;
    };
  }, [hasChanges, onNavigationBlocked]);

  const MIN_RAM = 512; // 512 MB minimum
  const MAX_RAM = systemRam; // Use system RAM as maximum (in MB)
  const RAM_STEP = 64; // 64 MB steps
  const SNAP_RANGE = 256; // Snap to common values if within this range

  // Generate snap points (powers of 2 starting from 1024: 1GB, 2GB, 4GB, 8GB, 16GB, 32GB...)
  const snapPoints = React.useMemo(() => {
    const points: number[] = [];
    let memory = 1024; // Start at 1 GB
    while (memory <= MAX_RAM) {
      points.push(memory);
      memory *= 2;
    }
    return points;
  }, [MAX_RAM]);

  // Find if value is close to a snap point
  const snapToNearestPoint = (value: number): number => {
    for (const point of snapPoints) {
      if (Math.abs(value - point) <= SNAP_RANGE) {
        return point;
      }
    }
    return value;
  };

  const handleRamSliderChange = (value: number) => {
    // Round to nearest step
    const stepped = Math.round(value / RAM_STEP) * RAM_STEP;
    // Snap to common values if close
    const snapped = snapToNearestPoint(stepped);
    const clampedValue = Math.max(MIN_RAM, Math.min(MAX_RAM, snapped));
    handleInputChange('allocatedRam', clampedValue);
  };

  const handleRamTextChange = (value: string) => {
    // Allow empty string for better UX while typing
    if (value === '') {
      return;
    }

    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      // Round to nearest step and clamp (no snap for manual input)
      const stepped = Math.round(numValue / RAM_STEP) * RAM_STEP;
      const clampedValue = Math.max(MIN_RAM, Math.min(MAX_RAM, stepped));
      handleInputChange('allocatedRam', clampedValue);
    }
  };

  const handleRamTextBlur = (value: string) => {
    // On blur, ensure we have a valid value
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || value === '') {
      // Reset to current value if invalid
      const input = document.querySelector('input[type="number"]') as HTMLInputElement;
      if (input) {
        input.value = formData.allocatedRam.toString();
      }
    }
  };


  const getStatusIcon = () => {
    switch (apiStatus) {
      case 'checking':
        return <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />;
      case 'online':
        return <Wifi className="w-5 h-5 text-green-500" />;
      case 'offline':
        return <WifiOff className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusText = () => {
    let base = '';
    switch (apiStatus) {
      case 'checking':
        base = t('settings.checking');
        break;
      case 'online':
        base = t('settings.connected');
        break;
      case 'offline':
        base = t('settings.disconnected');
        break;
    }
    if (apiStatus !== 'checking' && lastCheckedAt) {
      const time = new Date(lastCheckedAt).toLocaleString();
      return `${base} (${time})`;
    }
    return base;
  };

  const getStatusColor = () => {
    switch (apiStatus) {
      case 'checking':
        return 'text-yellow-400';
      case 'online':
        return 'text-green-400';
      case 'offline':
        return 'text-red-400';
    }
  };

  // Java runtime handled internally by Lyceris; no user-facing settings.

  const isSaveDisabled = !!usernameError;

  const getShakeClass = () => {
    if (!isShaking) return '';
    if (shakeAttempts === 1) return 'shake-light';
    if (shakeAttempts === 2) return 'shake-medium';
    if (shakeAttempts === 3) return 'shake-heavy';
    return 'shake-extreme';
  };

  return (
    <div className={`h-full overflow-auto custom-scrollbar flex flex-col ${getShakeClass()}`}>
      <div className="flex-1 p-10 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="mb-12" style={getAnimationStyle({})}>
          <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-3">{t('settings.title')}</h1>
          <p className="text-dark-500 font-black text-[10px] uppercase tracking-[0.2em] italic px-1 opacity-60">
            {t('settings.settingsDescription')}
          </p>
        </div>

        <div className="space-y-8">

          {/* API Status */}
          <div
            className="bg-white/[0.02] backdrop-blur-xl rounded-[2.5rem] p-10 border border-white/5 shadow-2xl transition-all duration-300 hover:border-nebula-500/10"
            style={getAnimationStyle({})}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-nebula-500/10 rounded-2xl border border-nebula-500/20">
                <Server className="w-6 h-6 text-nebula-400" />
              </div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">{t('settings.api')}</h2>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-8 bg-white/5 border border-white/5 rounded-3xl shadow-inner group">
                <div className="flex items-center gap-6">
                  <div className={`p-4 rounded-2xl transition-all duration-500 ${apiStatus === 'online' ? 'bg-green-500/10 border-green-500/20 text-green-400' : apiStatus === 'offline' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-white/5 border-white/10 text-dark-500'}`}>
                    {getStatusIcon()}
                  </div>
                  <div>
                    <p className={`text-sm font-black uppercase italic tracking-widest mb-1 ${getStatusColor()}`}>
                      {getStatusText()}
                    </p>
                    <p className="text-dark-500 text-[10px] font-black uppercase tracking-tighter italic">
                      NEBULA_DEEP_SPACE_TELEMETRY
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleTestConnection}
                  disabled={isTestingConnection}
                  className="px-6 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-[10px] uppercase italic tracking-widest transition-all border border-white/5 flex items-center gap-3 disabled:opacity-30"
                >
                  <RefreshCw className={`w-4 h-4 ${isTestingConnection ? 'animate-spin' : ''}`} />
                  {t('settings.testConnection')}
                </button>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleClearCache}
                  className="px-6 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl font-black text-[10px] uppercase italic tracking-widest transition-all border border-red-500/10 flex items-center gap-3"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t('settings.clearCache')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* User Settings */}
          <div
            className="bg-white/[0.02] backdrop-blur-xl rounded-[2.5rem] p-10 border border-white/5 shadow-2xl transition-all duration-300 hover:border-nebula-500/10"
            style={getAnimationStyle({})}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-nebula-500/10 rounded-2xl border border-nebula-500/20">
                <User className="w-6 h-6 text-nebula-400" />
              </div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">{t('settings.general')}</h2>
            </div>

            <div className="max-w-md">
              <label className="block text-[10px] font-black text-dark-500 uppercase tracking-widest italic mb-4 px-1">
                {t('settings.username')}
              </label>
              <div className="relative group/input">
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  placeholder={t('settings.usernamePlaceholder')}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-black italic tracking-tighter outline-none focus:border-nebula-500/50 transition-all shadow-inner disabled:opacity-30 disabled:cursor-not-allowed group-hover/input:border-white/20"
                  disabled={formData.authMethod === 'microsoft'}
                  maxLength={16}
                />
              </div>
              <p className="text-dark-500 text-[10px] font-medium italic mt-3 px-1">
                {formData.authMethod === 'microsoft'
                  ? t('auth.usernameFromMicrosoft')
                  : t('settings.usernameDescription')
                }
              </p>
              {usernameError && (
                <div className="mt-4 p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-center gap-3">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <p className="text-red-400 text-[10px] font-black uppercase italic tracking-widest">{usernameError}</p>
                </div>
              )}
            </div>
          </div>

          {/* Performance Settings */}
          <div
            className="bg-white/[0.02] backdrop-blur-xl rounded-[2.5rem] p-10 border border-white/5 shadow-2xl transition-all duration-300 hover:border-nebula-500/10"
            style={getAnimationStyle({})}
          >
            <div className="flex items-center gap-4 mb-10">
              <div className="p-3 bg-nebula-500/10 rounded-2xl border border-nebula-500/20">
                <HardDrive className="w-6 h-6 text-nebula-400" />
              </div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">{t('settings.performance')}</h2>
            </div>

            <div className="space-y-10">
              <div>
                <label className="block text-[10px] font-black text-dark-500 uppercase tracking-widest italic mb-6 px-1">
                  {t('settings.ramAllocationLabel')}
                </label>

                {/* RAM allocation display with inline editing */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min={MIN_RAM}
                      max={MAX_RAM}
                      step={RAM_STEP}
                      value={formData.allocatedRam}
                      onChange={(e) => handleRamTextChange(e.target.value)}
                      onBlur={(e) => handleRamTextBlur(e.target.value)}
                      className="bg-white/5 border border-white/10 text-white font-black italic text-3xl rounded-3xl px-8 py-4 w-40 text-right outline-none focus:border-nebula-500/50 shadow-inner transition-all"
                    />
                    <span className="text-dark-500 font-black italic text-sm uppercase tracking-widest">MEGA_BYTES</span>
                  </div>
                  <div className="p-4 bg-nebula-500/5 border border-nebula-500/10 rounded-2xl">
                    <p className="text-nebula-400 text-[10px] font-black uppercase italic tracking-widest">{t('settings.ramRecommended')}</p>
                  </div>
                </div>

                {/* Slider with snap point markers */}
                <div className="px-1">
                  <div className="relative h-2 mb-6">
                    <div className="absolute inset-0" style={{ marginLeft: '6px', marginRight: '6px' }}>
                      {snapPoints.map((point) => (
                        <div
                          key={point}
                          className={`absolute w-1 h-3 rounded-full transition-all duration-500 ${point <= formData.allocatedRam ? 'bg-nebula-500 shadow-[0_0_8px_rgba(139,92,246,0.6)]' : 'bg-white/10'
                            }`}
                          style={{
                            left: `${((point - MIN_RAM) / (MAX_RAM - MIN_RAM)) * 100}%`,
                            transform: 'translateX(-50%)'
                          }}
                          title={`${point} MB (${(point / 1024).toFixed(0)} GB)`}
                        />
                      ))}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={MIN_RAM}
                    max={MAX_RAM}
                    step={RAM_STEP}
                    value={formData.allocatedRam}
                    onChange={(e) => handleRamSliderChange(parseInt(e.target.value, 10))}
                    className="w-full h-3 bg-white/5 rounded-full appearance-none cursor-pointer accent-nebula-500 border border-white/5 transition-all hover:bg-white/10"
                  />
                  <div className="flex justify-between text-[10px] font-black italic text-dark-500 uppercase tracking-widest mt-6">
                    <span>{MIN_RAM} MB</span>
                    <span className="text-nebula-400 opacity-50 underline decoration-nebula-500/30 underline-offset-4">QUANTUM_LIMIT</span>
                    <span>{MAX_RAM} MB</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Native Engine Connection */}
          <div
            className="bg-white/[0.02] backdrop-blur-xl rounded-[2.5rem] p-10 border border-white/5 shadow-2xl transition-all duration-300 hover:border-nebula-500/10"
            style={getAnimationStyle({})}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-nebula-500/10 rounded-2xl border border-nebula-500/20">
                <Cpu className="w-6 h-6 text-nebula-400" />
              </div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">NEBULA_CORE_V3</h2>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-8 bg-white/5 border border-white/5 rounded-3xl shadow-inner group">
                <div className="flex items-center gap-6">
                  <div className={`p-4 rounded-2xl transition-all duration-500 ${isConnected ? 'bg-nebula-500/10 border-nebula-500/20 text-nebula-400' : 'bg-white/5 border-white/10 text-dark-500'}`}>
                    <Terminal className="w-6 h-6" />
                  </div>
                  <div>
                    <p className={`text-sm font-black uppercase italic tracking-widest mb-1 ${isConnected ? 'text-nebula-400' : 'text-dark-500'}`}>
                      {isConnected ? 'SIGNAL_LOCKED' : 'LINK_OFFLINE'}
                    </p>
                    <p className="text-dark-500 text-[10px] font-black uppercase tracking-tighter italic">
                      {lastMessage ? `LAST_PACKET: ${lastMessage.action || lastMessage.status}` : 'AWAITING_CORE_INITIALIZATION...'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={startCore}
                    disabled={isConnected}
                    className="px-6 py-4 bg-nebula-500 hover:bg-nebula-600 text-white rounded-2xl font-black text-[10px] uppercase italic tracking-widest transition-all shadow-xl shadow-nebula-500/20 flex items-center gap-3 disabled:opacity-30"
                  >
                    <span>INITIALIZE_LINK</span>
                  </button>
                  <button
                    onClick={() => sendCommand('ping')}
                    disabled={!isConnected}
                    className="px-6 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-[10px] uppercase italic tracking-widest transition-all border border-white/5 flex items-center gap-3 disabled:opacity-30"
                  >
                    <span>COMMS_PING</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Resource Management */}
          <div
            className="bg-white/[0.02] backdrop-blur-xl rounded-[2.5rem] p-10 border border-white/5 shadow-2xl transition-all duration-300 hover:border-nebula-500/10"
            style={getAnimationStyle({})}
          >
            <div className="flex items-center gap-4 mb-10">
              <div className="p-3 bg-nebula-500/10 rounded-2xl border border-nebula-500/20">
                <Zap className="w-6 h-6 text-nebula-400" />
              </div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">{t('settings.resourceManagement')}</h2>
            </div>

            <div className="space-y-12">
              {/* Concurrent Downloads */}
              <div>
                <div className="flex justify-between items-end mb-6">
                  <div className="flex-1 pr-6">
                    <label className="block text-[10px] font-black text-white uppercase tracking-widest italic mb-2">
                      {t('settings.maxConcurrentDownloads')}
                    </label>
                    <p className="text-dark-500 text-[10px] font-medium italic leading-relaxed">
                      {t('settings.maxConcurrentDownloadsDesc')}
                    </p>
                  </div>
                  <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl text-nebula-400 font-black italic text-xl min-w-[5rem] text-center shadow-inner">
                    {formData.maxConcurrentDownloads || 10}
                  </div>
                </div>
                <div className="px-1">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={formData.maxConcurrentDownloads || 10}
                    onChange={(e) => handleInputChange('maxConcurrentDownloads', parseInt(e.target.value, 10))}
                    className="w-full h-3 bg-white/5 rounded-full appearance-none cursor-pointer accent-nebula-500 border border-white/5 transition-all hover:bg-white/10"
                  />
                  <div className="flex justify-between text-[10px] font-black italic text-dark-500 uppercase tracking-widest mt-4">
                    <span>MIN_BANDWIDTH</span>
                    <span>BURST_MODE</span>
                  </div>
                </div>
              </div>

              {/* Concurrent Writes */}
              <div>
                <div className="flex justify-between items-end mb-6">
                  <div className="flex-1 pr-6">
                    <label className="block text-[10px] font-black text-white uppercase tracking-widest italic mb-2">
                      {t('settings.maxConcurrentWrites')}
                    </label>
                    <p className="text-dark-500 text-[10px] font-medium italic leading-relaxed">
                      {t('settings.maxConcurrentWritesDesc')}
                    </p>
                  </div>
                  <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl text-nebula-400 font-black italic text-xl min-w-[5rem] text-center shadow-inner">
                    {formData.maxConcurrentWrites || 10}
                  </div>
                </div>
                <div className="px-1">
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={formData.maxConcurrentWrites || 10}
                    onChange={(e) => handleInputChange('maxConcurrentWrites', parseInt(e.target.value, 10))}
                    className="w-full h-3 bg-white/5 rounded-full appearance-none cursor-pointer accent-nebula-500 border border-white/5 transition-all hover:bg-white/10"
                  />
                  <div className="flex justify-between text-[10px] font-black italic text-dark-500 uppercase tracking-widest mt-4">
                    <span>IO_CONSERVATIVE</span>
                    <span>FLASH_SYNC</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Animation Settings */}
          <div
            className="bg-white/[0.02] backdrop-blur-xl rounded-[2.5rem] p-10 border border-white/5 shadow-2xl transition-all duration-300 hover:border-nebula-500/10"
            style={getAnimationStyle({})}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-nebula-500/10 rounded-2xl border border-nebula-500/20">
                <Zap className="w-6 h-6 text-nebula-400" />
              </div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">{t('settings.animations')}</h2>
            </div>

            <div className="flex items-center justify-between p-6 bg-white/5 border border-white/5 rounded-3xl">
              <div className="flex-1">
                <label className="block text-sm font-black text-white uppercase italic tracking-widest mb-1">
                  {t('settings.enableAnimations')}
                </label>
                <p className="text-dark-500 text-[10px] font-medium italic">
                  {t('settings.enableAnimationsDesc')}
                </p>
              </div>
              <div className="flex items-center">
                <label className="relative inline-flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.enableAnimations !== false}
                    onChange={(e) => handleInputChange('enableAnimations', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-8 bg-white/10 rounded-full peer peer-checked:bg-nebula-500 transition-all duration-500 border border-white/5 shadow-inner"></div>
                  <div className="absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-all duration-500 shadow-xl peer-checked:left-7 peer-checked:bg-white"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Meta Storage Settings */}
          <div
            className="bg-white/[0.02] backdrop-blur-xl rounded-[2.5rem] p-10 border border-white/5 shadow-2xl transition-all duration-300 hover:border-nebula-500/10"
            style={getAnimationStyle({})}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-nebula-500/10 rounded-2xl border border-nebula-500/20">
                <HardDrive className="w-6 h-6 text-nebula-400" />
              </div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">{t('metaStorage.title')}</h2>
            </div>

            <MetaStorageSettings />
          </div>

          {/* Prereleases Settings */}
          <div
            className="bg-white/[0.02] backdrop-blur-xl rounded-[2.5rem] p-10 border border-white/5 shadow-2xl transition-all duration-300 hover:border-nebula-500/10"
            style={getAnimationStyle({})}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-nebula-500/10 rounded-2xl border border-nebula-500/20">
                <Shield className="w-6 h-6 text-nebula-400" />
              </div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">{t('settings.prereleases')}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="flex items-start gap-4 p-6 bg-white/5 border border-white/5 rounded-3xl cursor-pointer hover:border-nebula-500/20 transition-all shadow-inner group">
                <div className="mt-1">
                  <input
                    type="checkbox"
                    checked={formData.autoUpdate !== false}
                    onChange={(e) => setFormData(prev => ({ ...prev, autoUpdate: e.target.checked }))}
                    className="w-6 h-6 rounded-lg bg-white/5 border-white/10 text-nebula-500 focus:ring-nebula-500 accent-nebula-500"
                  />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-black text-white uppercase italic tracking-widest mb-2 group-hover:text-nebula-400 transition-colors">{t('settings.autoUpdate')}</div>
                  <div className="text-[10px] text-dark-500 font-medium italic leading-relaxed">{t('settings.autoUpdateDesc')}</div>
                </div>
              </label>

              <label className="flex items-start gap-4 p-6 bg-white/5 border border-white/5 rounded-3xl cursor-pointer hover:border-nebula-500/20 transition-all shadow-inner group">
                <div className="mt-1">
                  <input
                    type="checkbox"
                    checked={formData.enablePrereleases || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, enablePrereleases: e.target.checked }))}
                    className="w-6 h-6 rounded-lg bg-white/5 border-white/10 text-nebula-500 focus:ring-nebula-500 accent-nebula-500"
                  />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-black text-white uppercase italic tracking-widest mb-2 group-hover:text-nebula-400 transition-colors">{t('settings.enablePrereleases')}</div>
                  <div className="text-[10px] text-dark-500 font-medium italic leading-relaxed">{t('settings.enablePrereleasesDesc')}</div>
                </div>
              </label>
            </div>
          </div>

          {/* Save Button */}
          {hasChanges && (
            <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-4xl bg-nebula-950/60 backdrop-blur-2xl border border-white/10 p-6 rounded-[2rem] shadow-[0_0_50px_rgba(139,92,246,0.2)] z-[60] transition-all animate-slideUp`}>
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <p className="text-white font-black text-xs uppercase italic tracking-widest mb-1">
                    {t('settings.unsavedChanges')}
                  </p>
                  <p className="text-dark-500 text-[10px] uppercase font-black italic tracking-tighter opacity-60">TELEMETRY_DATA_PENDING_SYNC</p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={handleDiscard}
                    className="px-6 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-[10px] uppercase italic tracking-widest transition-all border border-white/5"
                  >
                    {t('settings.discardChanges')}
                  </button>
                  <button
                    onClick={handleSave}
                    className={`px-10 py-4 bg-nebula-500 hover:bg-nebula-600 text-white rounded-2xl font-black text-[10px] uppercase italic tracking-widest transition-all shadow-xl shadow-nebula-500/20 flex items-center gap-3 ${isSaveDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                    disabled={isSaveDisabled}
                  >
                    <Save className="w-4 h-4" />
                    <span>{t('settings.saveChanges')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
