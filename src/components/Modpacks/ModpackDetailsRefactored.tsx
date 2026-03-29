import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Download, Clock, Users, Terminal, Info, Image, History, Loader2, Package, Globe } from 'lucide-react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import LogsSection from './Details/Sections/LogsSection';
import ScreenshotsSection from './Details/Sections/ScreenshotsSection';
import VersionsSection from './Details/Sections/VersionsSection';
import ModsSection from './Details/Sections/ModsSection';
import WorldsSection from './Details/Sections/WorldsSection';
import { listen } from '@tauri-apps/api/event';
import type { Modpack, ModpackState, ProgressInfo } from '../../types/launcher';
import { useLauncher } from '../../contexts/LauncherContext';
import { useAnimation } from '../../contexts/AnimationContext';
import LauncherService from '../../services/launcherService';
import { ModrinthService } from '../../services/modrinthService';
import ReactMarkdown from 'react-markdown';

import ModpackActions from './Details/ModpackActions';
import ModpackInfo from './Details/ModpackInfo';
import ModpackRequirements from './Details/ModpackRequirements';
import ModpackFeatures from './Details/ModpackFeatures';
import ModpackScreenshotGallery from './Details/ModpackScreenshotGallery';
import ProfileOptionsModal from './ProfileOptionsModal';

const markdownComponents = {
  h1: ({ children }: any) => <h1 className="text-3xl font-black text-white mb-6 mt-10 uppercase italic tracking-tighter">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-2xl font-black text-white mb-4 mt-8 uppercase italic tracking-tighter">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-xl font-black text-white mb-3 mt-6 uppercase italic tracking-tighter">{children}</h3>,
  p: ({ children }: any) => <div className="text-dark-300 mb-6 leading-relaxed font-medium">{children}</div>,
  ul: ({ children }: any) => <ul className="list-disc list-inside space-y-2 mb-6 text-dark-300 pl-6 border-l-2 border-nebula-500/20">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal list-inside space-y-2 mb-6 text-dark-300 pl-6 border-l-2 border-nebula-500/20">{children}</ol>,
  li: ({ children }: any) => <li className="pl-2">{children}</li>,
  a: ({ node, ...props }: any) => <a {...props} className="text-nebula-400 hover:text-nebula-300 underline underline-offset-4 decoration-nebula-500/30" target="_blank" rel="noopener noreferrer" />,
  img: ({ node, ...props }: any) => <img {...props} className="rounded-3xl max-w-full my-8 border border-white/5 shadow-2xl" />,
  code: ({ children }: any) => <code className="bg-white/5 px-2 py-1 rounded text-nebula-400 text-xs font-mono border border-white/5">{children}</code>
};

interface ModpackDetailsProps {
  modpack: Modpack;
  state: ModpackState & {
    progress?: ProgressInfo;
  };
  onBack: () => void;
  features?: any[] | null;
  isReadOnly?: boolean; // Read-only mode: hide management actions
  onModpackUpdated?: (_updates: { name?: string; logo?: string; backgroundImage?: string }) => void; // Called when modpack is updated
  onNavigate?: (_section: string, _modpackId?: string) => void;
  isLoadingDetails?: boolean;
}

const ModpackDetailsRefactored: React.FC<ModpackDetailsProps> = ({ modpack, state, onBack, isReadOnly = false, onModpackUpdated, onNavigate, isLoadingDetails = false }) => {
  const { t } = useTranslation();
  const { modpackStates } = useLauncher();
  const { getAnimationClass, getAnimationStyle } = useAnimation();
  const launcherService = LauncherService.getInstance();

  const liveState = modpackStates[modpack.id] || state;

  const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  // Logs state
  const [logs, setLogs] = React.useState<string[]>([]);
  const [localScreenshots, setLocalScreenshots] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'content' | 'logs' | 'screenshots' | 'versions' | 'mods' | 'worlds'>('content');

  // Stats state
  const [stats, setStats] = useState({
    totalDownloads: 0,
    totalPlaytime: 0,
    activePlayers: 0,
    userPlaytime: 0
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Profile Options Modal state
  const [showProfileOptions, setShowProfileOptions] = useState(false);
  const [instanceMetadata, setInstanceMetadata] = useState<any>(null);

  // Load instance metadata when component mounts or modpack changes
  useEffect(() => {
    const loadMetadata = async () => {
      if (liveState.installed) {
        try {
          const metadataJson = await invoke<string | null>('get_instance_metadata', {
            modpackId: modpack.id
          });

          if (metadataJson) {
            setInstanceMetadata(JSON.parse(metadataJson));
          }
        } catch (error) {
          console.error('Failed to load instance metadata:', error);
        }
      }
    };

    loadMetadata();
  }, [liveState.installed, liveState.status, modpack.id]);

  // Load local screenshots when component mounts and is installed
  useEffect(() => {
    const loadScreenshots = async () => {
      if (liveState.installed) {
        try {
          const screenshotsList = await invoke<any[]>('list_instance_screenshots', {
            modpackId: modpack.id
          });
          
          const urls = screenshotsList.map(item => convertFileSrc(item.path));
          setLocalScreenshots(urls);
        } catch (error) {
          console.error('Failed to load local screenshots:', error);
        }
      } else {
        setLocalScreenshots([]);
      }
    };
    loadScreenshots();
  }, [modpack.id, liveState.installed]);

  // Load stats from database
  useEffect(() => {
    const loadStats = async () => {
      setIsLoadingStats(true);
      try {
        const [modpackStats, userStats] = await Promise.all([
          launcherService.getModpackStats(modpack.id),
          launcherService.getUserModpackStats(modpack.id)
        ]);

        let totalDownloads = modpackStats?.totalDownloads || 0;
        let activePlayers = modpackStats?.activePlayers || 0;

        // Fallback to Modrinth stats for non-UUID (imported) modpacks
        if (!modpackStats && !isValidUUID(modpack.id)) {
          try {
            const details = await ModrinthService.getInstance().getModpackDetails(modpack.id);
            if (details) {
              totalDownloads = details.downloads || 0;
            }
          } catch (e) {
            console.error('Failed to load Modrinth fallback stats:', e);
          }
        }

        setStats({
          totalDownloads,
          totalPlaytime: modpackStats?.totalPlaytime || 0,
          activePlayers,
          userPlaytime: userStats?.playtimeHours || 0
        });
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadStats();
  }, [modpack.id]);

  React.useEffect(() => {
    let unlisten: (() => void) | null = null;
    let unlistenStart: (() => void) | null = null;
    const setup = async () => {
      try {
        unlisten = await listen<string>(`minecraft-log-${modpack.id}`, (event) => {
          setLogs((prev) => {
            // keep last 500 lines
            const next = [...prev, event.payload];
            if (next.length > 500) {
              return next.slice(next.length - 500);
            }
            return next;
          });
        });

        // Clear logs when the instance (re)starts
        unlistenStart = await listen(`minecraft-started-${modpack.id}`, () => {
          setLogs([]);
        });
      } catch (err) {
        console.error('Failed to listen logs', err);
      }
    };
    setup();
    return () => {
      if (unlisten) {
        unlisten();
      }
      if (unlistenStart) {
        unlistenStart();
      }
    };
  }, [modpack.id]);

  // Use modpack fields directly (translations/features are now in modpack details)
  // Use modpack.name as source of truth - it's updated immediately when edited
  const displayName = modpack.name;
  const displayDescription = modpack.description;
  // Defensive: always use features from modpack details, fallback to []
  const resolvedFeatures = Array.isArray((modpack as any).features) ? (modpack as any).features : [];

  const reloadInstanceMetadata = async () => {
    try {
      const metadataJson = await invoke<string | null>('get_instance_metadata', {
        modpackId: modpack.id
      });

      if (metadataJson) {
        setInstanceMetadata(JSON.parse(metadataJson));
      }
    } catch (error) {
      console.error('Failed to reload instance metadata:', error);
    }
  };

  // Get server status badge (only New and Coming Soon, not Active/Inactive)
  const getServerStatusBadge = () => {
    // Priority: New > Coming Soon (don't show Active if it's New or Coming Soon)
    if (modpack.isNew) {
      return (
        <span className="inline-flex items-center px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-500/20 text-green-400 border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
          {t('modpacks.status.new')}
        </span>
      );
    }
    if (modpack.isComingSoon) {
      return (
        <span className="inline-flex items-center px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-nebula-500/20 text-nebula-400 border border-nebula-500/30 shadow-[0_0_15px_rgba(139,92,246,0.3)]">
          {t('modpacks.status.coming_soon')}
        </span>
      );
    }
    // Don't show Inactive or Active badges
    return null;
  };

  // Format playtime for display
  const formatPlaytime = (hours: number): string => {
    if (hours === 0) return '0h';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${hours.toFixed(1)}h`;
  };

  // Different stats for read-only vs management mode
  const statsDisplay = isReadOnly
    ? [
      {
        icon: Download,
        value: isLoadingStats ? '...' : stats.totalDownloads.toString(),
        label: t('modpacks.downloads')
      },
      {
        icon: Users,
        value: isLoadingStats ? '...' : stats.activePlayers.toString(),
        label: t('modpacks.activePlayers')
      },
    ]
    : [
      {
        icon: Clock,
        value: isLoadingStats ? '...' : formatPlaytime(stats.userPlaytime),
        label: t('modpacks.playTime')
      },
      {
        icon: Users,
        value: isLoadingStats ? '...' : stats.activePlayers.toString(),
        label: t('modpacks.activePlayers')
      },
    ];

  const renderContentTab = () => (
    <>
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-6 mb-10">
        {statsDisplay.map((stat, index) => (
          <div
            key={index}
            className="bg-white/[0.03] backdrop-blur-xl rounded-[2rem] p-6 border border-white/5 group shadow-2xl hover:border-nebula-500/30 hover:bg-white/[0.05] transition-all duration-300"
            style={getAnimationStyle({
              animation: `fadeInUp 0.15s ease-out ${index * 0.05}s backwards`
            })}
          >
            <stat.icon className="w-6 h-6 text-nebula-400 mb-3 group-hover:scale-110 transition-transform duration-300" />
            <div className="text-3xl font-black text-white italic uppercase tracking-tighter group-hover:text-nebula-300 transition-colors">
              {stat.value}
            </div>
            <div className="text-[10px] font-black text-dark-500 uppercase tracking-widest mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Screenshots - Only show in read-only mode */}
      {isReadOnly && modpack.images && modpack.images.length > 0 && (
        <ModpackScreenshotGallery
          images={modpack.images}
          modpackName={displayName}
        />
      )}

      {/* Features */}
      <ModpackFeatures features={resolvedFeatures} />

      {/* Full Description (External APIs) */}
      {modpack.longDescription && (
        <div className="mt-6 border-t border-dark-800/80 pt-6">
          <div className="text-dark-200 text-sm max-h-[1000px] overflow-y-auto pr-3 custom-scrollbar">
            <ReactMarkdown components={markdownComponents as any}>
              {modpack.longDescription}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="h-full w-full bg-dark-950 flex flex-col relative overflow-hidden">
      {/* Dynamic Blur Backdrop */}
      {modpack.backgroundImage && (
        <div 
          className="absolute inset-x-0 top-0 bottom-0 z-0 overflow-hidden pointer-events-none opacity-40"
          style={{
            backgroundImage: `url(${modpack.backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(70px) brightness(0.5)',
            transform: 'scale(1.1)',
          }}
        />
      )}
      {/* Back button - Fixed position */}
      <button
        onClick={onBack}
        className="absolute top-8 left-8 z-40 flex items-center gap-2 px-5 py-3 bg-dark-900/60 backdrop-blur-xl text-dark-400 hover:text-white rounded-2xl border border-white/5 hover:border-white/10 transition-all font-bold uppercase text-xs tracking-widest shadow-2xl group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>BACK</span>
      </button>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">

        {/* Hero Section with banner or fallback gradient */}
        <div
          className={`relative h-[650px] flex flex-col justify-end p-12 text-white ${!modpack.backgroundImage ? 'bg-gradient-to-br from-indigo-900 via-nebula-900 to-dark-950' : ''
            }`}
        >
          {/* Banner / fallback image */}
          {modpack.backgroundImage && (
            <div
              className="absolute inset-0 bg-center bg-cover"
              style={{
                backgroundImage: `url(${modpack.backgroundImage || modpack.images?.[0] || modpack.logo})`,
                opacity: 0.2
              }}
            />
          )}
          {/* Dark overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/40 to-transparent" />

          {/* Logo and Content */}
          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-end gap-12 max-w-[1600px] mx-auto w-full">
            {/* Logo */}
            <div className="flex-shrink-0">
              <div
                className="w-56 h-56 rounded-[3rem] overflow-hidden flex items-center justify-center bg-dark-900 border-2 border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] group ring-1 ring-white/5"
                style={getAnimationStyle({
                  animation: `fadeInUp 0.15s ease-out 0.02s backwards`
                })}
              >
                {modpack.logo && modpack.logo.length === 1 ? (
                  // Show first letter for local modpacks
                  <div className="text-8xl font-black text-white/10 italic">
                    {modpack.logo}
                  </div>
                ) : modpack.logo ? (
                  // Show logo image
                  <img
                    src={modpack.logo}
                    alt={displayName}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement!.innerHTML = `<div class="text-8xl font-black text-white/10 italic">${displayName.charAt(0).toUpperCase()}</div>`;
                    }}
                  />
                ) : (
                  // Show first letter when no logo
                  <div className="text-8xl font-black text-white/10 italic">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0 text-center md:text-left">
              <div className="space-y-4">
                <div
                  className="flex flex-wrap items-center justify-center md:justify-start gap-3"
                  style={getAnimationStyle({
                    animation: `fadeInUp 0.15s ease-out 0.05s backwards`
                  })}
                >
                  <span className="px-3 py-1 rounded-full bg-nebula-500/20 text-nebula-400 text-[10px] font-black uppercase tracking-widest border border-nebula-500/30">
                    {modpack.category || 'Mission Profile'}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/5 text-dark-300 text-[10px] font-black uppercase tracking-widest border border-white/5">
                    MC {modpack.minecraftVersion}
                  </span>
                </div>

                <h1
                  className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none"
                  style={getAnimationStyle({
                    animation: `fadeInUp 0.15s ease-out 0.1s backwards`
                  })}
                >
                  <div className="flex items-center justify-center md:justify-start gap-4">
                    <span>{displayName}</span>
                    {isLoadingDetails && (
                      <Loader2 className="w-8 h-8 text-nebula-400 animate-spin" />
                    )}
                  </div>
                </h1>
                
                <p
                  className="text-xl text-dark-300 font-medium italic max-w-2xl leading-relaxed"
                  style={getAnimationStyle({
                    animation: `fadeInUp 0.15s ease-out 0.15s backwards`
                  })}
                >
                  {displayDescription}
                </p>
              </div>
            </div>
            
            <div
              className="flex-shrink-0"
              style={getAnimationStyle({
                animation: `fadeInUp 0.15s ease-out 0.2s backwards`
              })}
            >
              {getServerStatusBadge()}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Mobile Actions First */}
            <div
              className={`lg:hidden ${getAnimationClass('transition-all duration-75')}`}
              style={getAnimationStyle({
                animation: `fadeInUp 0.15s ease-out 0.05s backwards`
              })}
            >
              <ModpackActions
                modpack={modpack}
                state={liveState}
                isReadOnly={isReadOnly}
                showProfileOptions={showProfileOptions}
                setShowProfileOptions={setShowProfileOptions}
                onNavigate={onNavigate}
              />
            </div>

            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-8">
              {/* Tab Navigation */}
              <div
                className="flex space-x-1 bg-white/[0.02] backdrop-blur-xl border border-white/5 p-2 rounded-2xl shadow-2xl"
                style={getAnimationStyle({
                  animation: `fadeInUp 0.15s ease-out 0.05s backwards`
                })}
              >
                <button
                  onClick={() => setActiveTab('content')}
                  className={`flex items-center space-x-3 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'content'
                    ? 'bg-nebula-500 text-white shadow-lg shadow-nebula-500/20'
                    : 'text-dark-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <Info className="w-4 h-4" />
                  <span>Overview</span>
                </button>
                {/* Screenshots Tab Button - Only show in read-only mode */}
                {isReadOnly && (
                  <button
                    onClick={() => setActiveTab('screenshots')}
                    className={`flex items-center space-x-3 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'screenshots'
                      ? 'bg-nebula-500 text-white shadow-lg shadow-nebula-500/20'
                      : 'text-dark-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <Image className="w-4 h-4" />
                    <span>Gallery</span>
                    {modpack.images && modpack.images.length > 0 && (
                      <span className="bg-nebula-400 text-dark-900 text-[10px] px-2 py-0.5 rounded-full font-black">
                        {modpack.images.length}
                      </span>
                    )}
                  </button>
                )}
                {/* Logs Tab - Only show when NOT in read-only mode */}
                {!isReadOnly && (
                  <button
                    onClick={() => setActiveTab('logs')}
                    className={`flex items-center space-x-3 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'logs'
                      ? 'bg-nebula-500 text-white shadow-lg shadow-nebula-500/20'
                      : 'text-dark-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <Terminal className="w-4 h-4" />
                    <span>{t('modpacks.logs')}</span>
                    {logs.length > 0 && (
                      <span className="bg-nebula-400 text-dark-900 text-[10px] px-2 py-0.5 rounded-full font-black">
                        {logs.length}
                      </span>
                    )}
                  </button>
                )}

                {!isReadOnly && liveState.installed && (
                  <>
                    <button
                      onClick={() => setActiveTab('mods')}
                      className={`flex items-center space-x-3 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'mods'
                        ? 'bg-nebula-500 text-white shadow-lg shadow-nebula-500/20'
                        : 'text-dark-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      <Package className="w-4 h-4" />
                      <span>{t('modpacks.mods', 'Mods')}</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('worlds')}
                      className={`flex items-center space-x-3 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'worlds'
                        ? 'bg-nebula-500 text-white shadow-lg shadow-nebula-500/20'
                        : 'text-dark-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      <Globe className="w-4 h-4" />
                      <span>{t('modpacks.worlds', 'Worlds')}</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('screenshots')}
                      className={`flex items-center space-x-3 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'screenshots'
                        ? 'bg-nebula-500 text-white shadow-lg shadow-nebula-500/20'
                        : 'text-dark-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      <Image className="w-4 h-4" />
                      <span>{t('modpacks.screenshots.title', 'Screenshots')}</span>
                    </button>
                  </>
                )}
                {/* Versions Tab - Only show in Explore mode (read-only) */}
                {isReadOnly && (
                  <button
                    onClick={() => setActiveTab('versions')}
                    className={`flex items-center space-x-3 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'versions'
                      ? 'bg-nebula-500 text-white shadow-lg shadow-nebula-500/20'
                      : 'text-dark-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <History className="w-4 h-4" />
                    <span>{t('modpacks.versions.title')}</span>
                  </button>
                )}
              </div>

              {/* Tab Content */}
              <div className="min-h-[400px]">
                {activeTab === 'content' && renderContentTab()}
                {activeTab === 'logs' && <LogsSection logs={logs} modpackId={modpack.id} />}
                {activeTab === 'screenshots' && (
                  <ScreenshotsSection 
                    images={localScreenshots.length > 0 ? localScreenshots : modpack.images} 
                    modpackName={modpack.name} 
                  />
                )}
                {activeTab === 'mods' && <ModsSection modpackId={modpack.id} />}
                {activeTab === 'worlds' && <WorldsSection modpackId={modpack.id} />}
                {activeTab === 'versions' && (
                  <VersionsSection
                    modpackId={modpack.id}
                    currentVersion={liveState.installed ? (instanceMetadata?.version || modpack.version) : undefined}
                  />
                )}
              </div>
            </div>

            {/* Right Column - Desktop Actions */}
            <div className="hidden lg:block">
              <div
                className={`space-y-6 ${getAnimationClass('transition-all duration-75')}`}
                style={getAnimationStyle({
                  animation: `fadeInUp 0.15s ease-out 0.1s backwards`
                })}
              >
                <ModpackActions
                  modpack={modpack}
                  state={liveState}
                  isReadOnly={isReadOnly}
                  showProfileOptions={showProfileOptions}
                  setShowProfileOptions={setShowProfileOptions}
                  onNavigate={onNavigate}
                />
                <ModpackInfo modpack={modpack} />
                {/* System Requirements - Only show in read-only mode */}
                {isReadOnly && <ModpackRequirements modpack={modpack} />}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* End of scrollable content */}

      {/* Profile Options Modal - Outside scrollable area */}
      <ProfileOptionsModal
        modpackId={modpack.id}
        modpackName={displayName}
        isOpen={showProfileOptions}
        onClose={() => setShowProfileOptions(false)}
        isLocalModpack={!modpack.urlModpackZip}
        metadata={{
          ...instanceMetadata,
          // Merge protection flags from remote modpack data (takes precedence over local)
          allow_custom_mods: modpack.allowCustomMods,
          allow_custom_resourcepacks: modpack.allowCustomResourcepacks,
          category: modpack.category,
        }}
        onSaveComplete={reloadInstanceMetadata}
        onModpackUpdated={onModpackUpdated}
      />
    </div>
  );
};

export default ModpackDetailsRefactored; 