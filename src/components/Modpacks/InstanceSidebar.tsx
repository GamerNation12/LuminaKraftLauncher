import React, { memo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Play,
  FolderOpen,
  Settings as SettingsIcon,
  Terminal, 
  Layers, 
  StopCircle,
  Loader2,
  AlertTriangle,
  Info,
  Calendar,
  ChevronLeft,
  Search,
  RefreshCw,
  Cpu,
  Hash
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import toast from 'react-hot-toast';
import type { Modpack, ModpackState } from '../../types/launcher';
import { useLauncher } from '../../contexts/LauncherContext';
import LauncherService from '../../services/launcherService';

interface InstanceSidebarProps {
  modpack: Modpack;
  state: ModpackState;
  onClose: () => void;
  onOpenSettings: () => void;
  onModpackUpdated?: (updates: { name?: string; logo?: string; backgroundImage?: string }) => void;
}

const InstanceSidebar: React.FC<InstanceSidebarProps> = memo(({ 
  modpack, 
  state, 
  onClose,
  onOpenSettings: _onOpenSettings,
  onModpackUpdated: _onModpackUpdated
}) => {
  const { t } = useTranslation();
  const { launchModpack, stopInstance, userSettings, updateUserSettings } = useLauncher();
  const [activeTab, setActiveTab] = useState<'overview' | 'mods' | 'logs' | 'settings'>('overview');
  
  // Tab-specific state
  const [mods, setMods] = useState<{name: string, enabled: boolean}[]>([]);
  const [logs, setLogs] = useState<string>('');
  const [modFilter, setModFilter] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isLoading = ['installing', 'updating', 'repairing', 'reinstalling', 'launching', 'stopping'].includes(state.status);
  const isRunning = state.status === 'running';

  // Load Mods
  const loadMods = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const fileNames = await invoke<string[]>('list_mods_in_instance', { modpackId: modpack.id });
      const processed = fileNames.map(f => ({
        name: f.replace('.jar.disabled', '').replace('.jar', ''),
        enabled: !f.endsWith('.jar.disabled')
      })).sort((a, b) => a.name.localeCompare(b.name));
      setMods(processed);
    } catch (e) {
      console.error('Failed to load mods:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [modpack.id]);

  // Load Logs
  const loadLogs = useCallback(async () => {
    try {
      const content = await invoke<string>('read_instance_log', { modpackId: modpack.id });
      setLogs(content);
    } catch (e) {
      setLogs('No logs available yet. Start the game to see logs here.');
    }
  }, [modpack.id]);

  useEffect(() => {
    if (activeTab === 'mods') loadMods();
    if (activeTab === 'logs') loadLogs();
  }, [activeTab, loadMods, loadLogs]);

  const handleLaunch = () => {
    if (isRunning) {
      stopInstance(modpack.id);
    } else {
      launchModpack(modpack.id);
    }
  };

  const handleOpenFolder = () => LauncherService.getInstance().openInstanceFolder(modpack.id);

  // Filtered mods
  const filteredMods = mods.filter((m: {name: string, enabled: boolean}) => m.name.toLowerCase().includes(modFilter.toLowerCase()));

  return (
    <div className="h-full flex flex-col bg-dark-900/20 backdrop-blur-xl animate-fadeInUp overflow-hidden">
      {/* Top Header/Action Bar */}
      <div className="p-8 border-b border-white/5 flex flex-col md:flex-row items-center gap-8 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 left-4 p-2 rounded-xl hover:bg-white/5 group transition-all"
        >
          <ChevronLeft className="w-6 h-6 text-dark-400 group-hover:text-white" />
        </button>

        <div className="w-32 h-32 rounded-3xl overflow-hidden glass-border shadow-2xl relative group shrink-0 ring-1 ring-white/10">
          {modpack.logo ? (
            <img src={modpack.logo} alt={modpack.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-dark-800 text-5xl font-black text-white/10 uppercase">
              {modpack.name.charAt(0)}
            </div>
          )}
          {isRunning && (
             <div className="absolute inset-x-0 bottom-0 h-2 bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.8)]" />
          )}
        </div>

        <div className="flex-1 text-center md:text-left">
          <h2 className="text-4xl font-black text-white tracking-tight uppercase italic mb-1">
            {modpack.name}
          </h2>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2">
            <span className="px-3 py-1 rounded-full bg-nebula-500/20 text-nebula-400 text-xs font-black uppercase tracking-widest border border-nebula-500/30">
              {modpack.category || 'Local Instance'}
            </span>
            <span className="px-3 py-1 rounded-full bg-white/5 text-dark-300 text-xs font-bold ring-1 ring-white/5 uppercase">
              MC {modpack.minecraftVersion}
            </span>
            <span className="px-3 py-1 rounded-full bg-white/5 text-dark-300 text-xs font-bold ring-1 ring-white/5 uppercase">
              {modpack.modloader}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <button
            onClick={handleLaunch}
            disabled={isLoading && state.status !== 'launching'}
            className={`min-w-[180px] py-4 rounded-2xl flex items-center justify-center space-x-3 transition-all duration-300 transform hover:scale-[1.05] active:scale-95 shadow-2xl ${
              isRunning 
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30' 
                : 'bg-nebula-600/90 text-white hover:bg-nebula-600 shadow-nebula-900/40 hover:shadow-nebula-500/30 border border-nebula-400/30'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin text-white" />
            ) : isRunning ? (
              <StopCircle className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current" />
            )}
            <span className="text-xl font-black tracking-tighter uppercase italic">
              {isRunning ? 'STOP' : isLoading ? 'WAIT' : 'PLAY'}
            </span>
          </button>
          
          <button 
            onClick={handleOpenFolder}
            className="p-4 rounded-2xl glass hover:bg-white/10 text-dark-300 hover:text-white transition-all border border-white/5 shadow-xl"
            title="Open Folder"
          >
            <FolderOpen className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="px-8 border-b border-white/5 flex items-center gap-2">
         {[
           { id: 'overview', icon: Info, label: t('instance.tabs.overview', 'Overview') },
           { id: 'mods', icon: Layers, label: t('instance.tabs.mods', 'Mods') },
           { id: 'logs', icon: Terminal, label: t('instance.tabs.logs', 'Logs') },
           { id: 'settings', icon: SettingsIcon, label: t('instance.tabs.settings', 'Settings') }
         ].map(tab => (
           <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-4 flex items-center gap-3 transition-all relative font-bold text-sm tracking-tight ${
              activeTab === tab.id ? 'text-nebula-400' : 'text-dark-400 hover:text-white'
            }`}
           >
             <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'opacity-100' : 'opacity-50'}`} />
             {tab.label}
             {activeTab === tab.id && (
               <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-nebula-400 shadow-[0_0_10px_rgba(139,92,246,0.8)]" />
             )}
           </button>
         ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl">
            <div className="md:col-span-2 space-y-8">
               <div className="space-y-4">
                  <h3 className="text-xl font-black text-white uppercase italic tracking-tight flex items-center gap-2">
                    <Info className="w-5 h-5 text-nebula-400" />
                    Description
                  </h3>
                  <div className="p-6 rounded-3xl bg-white/5 border border-white/5 leading-relaxed text-dark-300 font-medium">
                    {modpack.description || 'This instance has no description yet. It is ready for takeoff though!'}
                  </div>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 group hover:border-nebula-500/30 transition-all">
                    <Cpu className="w-6 h-6 text-nebula-400 mb-2" />
                    <p className="text-[10px] text-dark-400 uppercase font-black tracking-widest">Architecture</p>
                    <p className="text-lg text-white font-black">{modpack.modloader} {modpack.modloaderVersion}</p>
                  </div>
                  <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 group hover:border-green-500/30 transition-all">
                    <Calendar className="w-6 h-6 text-green-400 mb-2" />
                    <p className="text-[10px] text-dark-400 uppercase font-black tracking-widest">Status</p>
                    <p className="text-lg text-white font-black">{isRunning ? 'MISSION ACTIVE' : 'DOCKED'}</p>
                  </div>
               </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Technical Info</h3>
              <div className="p-6 rounded-3xl bg-dark-900/60 border border-white/5 space-y-6">
                 <div>
                   <p className="text-[10px] text-dark-400 uppercase font-black tracking-widest mb-1">Minecraft ID</p>
                   <p className="text-white font-mono text-sm break-all bg-black/40 p-2 rounded-lg">{modpack.id}</p>
                 </div>
                 <div>
                   <p className="text-[10px] text-dark-400 uppercase font-black tracking-widest mb-1">Target Version</p>
                   <p className="text-white font-black">{modpack.minecraftVersion}</p>
                 </div>
                 {state.status === 'error' && (
                    <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                      <p className="text-xs font-black text-red-400 uppercase mb-1 flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3" />
                        System Fault
                      </p>
                      <p className="text-xs text-red-200/80 leading-tight">{state.error}</p>
                    </div>
                 )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'mods' && (
          <div className="space-y-6 max-w-6xl">
            <div className="flex items-center justify-between gap-4">
               <div className="relative flex-1 max-w-md">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                 <input 
                  type="text" 
                  placeholder="Seach internal modules..."
                  value={modFilter}
                  onChange={e => setModFilter(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-white placeholder:text-dark-500 focus:outline-none focus:ring-1 focus:ring-nebula-500/50 transition-all"
                 />
               </div>
               <button 
                onClick={loadMods}
                className={`p-3 rounded-2xl glass hover:bg-white/10 transition-all ${isRefreshing ? 'animate-spin text-nebula-400' : 'text-dark-300'}`}
               >
                 <RefreshCw className="w-5 h-5" />
               </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredMods.length > 0 ? (
                filteredMods.map((mod: {name: string, enabled: boolean}, i: number) => (
                  <div key={i} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between group hover:border-white/10 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${mod.enabled ? 'bg-nebula-400 shadow-[0_0_8px_rgba(139,92,246,0.6)]' : 'bg-dark-600'}`}></div>
                      <span className={`text-sm font-bold truncate max-w-[180px] ${mod.enabled ? 'text-white' : 'text-dark-500'}`}>{mod.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-dark-500 uppercase tracking-widest">{mod.enabled ? 'ENABLED' : 'DISABLED'}</span>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center text-dark-500 font-bold uppercase tracking-widest opacity-50">
                  No modules detected in sector.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="h-[500px] flex flex-col space-y-4">
             <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Mission Logs</h3>
                <button onClick={loadLogs} className="text-nebula-400 text-sm font-bold hover:text-nebula-300">Refresh Feed</button>
             </div>
             <div className="flex-1 bg-black/40 rounded-3xl border border-white/5 p-6 font-mono text-xs overflow-y-auto scrollbar-hide">
               {logs.split('\n').map((line: string, i: number) => (
                 <div key={i} className="py-0.5 border-l-2 border-transparent hover:border-nebula-500/40 hover:bg-white/[0.02] pl-3">
                   <span className="text-dark-500 mr-2">[{i.toString().padStart(4, '0')}]</span>
                   <span className={line.includes('ERROR') ? 'text-red-400' : line.includes('WARN') ? 'text-yellow-400' : 'text-dark-300'}>
                     {line}
                   </span>
                 </div>
               ))}
             </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-10">
            <div className="space-y-6">
               <h3 className="text-xl font-black text-white uppercase italic tracking-tight flex items-center gap-2">
                 <Cpu className="w-5 h-5 text-nebula-400" />
                 Resource Allocation
               </h3>
               
               <div className="space-y-4">
                  <div className="p-6 rounded-3xl bg-white/5 border border-white/5">
                    <div className="flex justify-between mb-4">
                       <span className="text-sm font-bold text-white uppercase tracking-tight">System RAM Allocation</span>
                       <span className="text-nebula-400 font-black">{Math.round((userSettings.allocatedRam || 4096) / 1024)}GB</span>
                    </div>
                    <input 
                      type="range"
                      min={1024}
                      max={16384}
                      step={1024}
                      value={userSettings.allocatedRam || 4096}
                      onChange={(e) => updateUserSettings({ allocatedRam: parseInt(e.target.value) })}
                      className="w-full accent-nebula-500"
                    />
                    <div className="flex justify-between mt-2 text-[10px] text-dark-500 font-bold uppercase">
                       <span>1GB</span>
                       <span>16GB</span>
                    </div>
                  </div>
               </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-black text-white uppercase italic tracking-tight flex items-center gap-2">
                <Hash className="w-5 h-5 text-nebula-400" />
                Advanced Launch Configuration
              </h3>
              <div className="space-y-4">
                 <div className="flex flex-col gap-2">
                    <label className="text-[10px] text-dark-400 uppercase font-black tracking-widest ml-2">JVM Arguments</label>
                    <textarea 
                      value={userSettings.jvmArgs || ''}
                      onChange={(e) => updateUserSettings({ jvmArgs: e.target.value })}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-xs font-mono text-dark-300 min-h-[100px] focus:outline-none focus:ring-1 focus:ring-nebula-500/50"
                      placeholder="-Xmx4G -XX:+UseG1GC..."
                    />
                 </div>
              </div>
            </div>
            
            <button 
              onClick={() => toast.success('Launch configurations synced with core.')}
              className="bg-nebula-500/10 border border-nebula-500/30 text-nebula-400 px-8 py-3 rounded-2xl font-black uppercase italic tracking-tighter hover:bg-nebula-500 hover:text-white transition-all duration-300"
            >
              Sync Changes
            </button>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="p-6 border-t border-white/5 bg-white/[0.02] flex justify-between items-center select-none">
        <div className="flex items-center gap-2 opacity-30 group">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Nebula Protocol v0.9.2</span>
          <div className="w-1.5 h-1.5 rounded-full bg-nebula-500 animate-pulse" />
        </div>
        <div className="text-[10px] font-black text-dark-600 uppercase tracking-widest italic group-hover:text-dark-400 transition-colors">
          STAY SAFE OUT THERE, COMMANDER.
        </div>
      </div>
    </div>
  );
});

InstanceSidebar.displayName = 'InstanceSidebar';

export default InstanceSidebar;
