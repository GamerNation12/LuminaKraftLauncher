import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, AlertCircle, Download, Loader2 } from 'lucide-react';
import { useLauncher } from '../../contexts/LauncherContext';
import { useAnimation } from '../../contexts/AnimationContext';
import ModpackCard from './ModpackCard';
import ModrinthListCard from './ModrinthListCard';
import ModpackDetailsRefactored from './ModpackDetailsRefactored';
import LauncherService from '../../services/launcherService';
import { ModrinthService } from '../../services/modrinthService';

import type { Modpack } from '../../types/launcher';

interface ModpacksPageProps {
  initialModpackId?: string;
  onNavigate?: (_section: string, _modpackId?: string) => void;
}

const ModpacksPage: React.FC<ModpacksPageProps> = ({ initialModpackId, onNavigate }) => {
  const { t } = useTranslation();
  const { getAnimationClass, getAnimationStyle, withDelay } = useAnimation();
  const {
    modpacksData,
    modpackStates,
    isLoading,
    error,
    refreshData
  } = useLauncher();

  const [selectedModpack, setSelectedModpack] = useState<Modpack | null>(null);
  const [selectedModpackDetails, setSelectedModpackDetails] = useState<Modpack | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [source, setSource] = useState<'local' | 'modrinth'>('modrinth');
  const [modrinthModpacks, setModrinthModpacks] = useState<Modpack[]>([]);
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [selectedLoader, setSelectedLoader] = useState<string>('');

  const [isRefreshAnimating, setIsRefreshAnimating] = useState(false);
  const [showingDetails, setShowingDetails] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [offset, setOffset] = useState(0);
  const [isRemoteLoadingMore, setIsRemoteLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Handle initial modpack selection from navigation
  React.useEffect(() => {
    if (initialModpackId && modpacksData) {
      const isAlreadySelected = selectedModpack?.id === initialModpackId;
      if (isAlreadySelected) return;

      const modpack = modpacksData.modpacks.find(m => m.id === initialModpackId);
      if (modpack) {
        handleModpackSelect(modpack, true);
      }
    } else if (!initialModpackId && selectedModpack) {
      // Clear local selection if the prop becomes null (from onNavigate)
      setSelectedModpack(null);
      setShowingDetails(false);
    }
  }, [initialModpackId, modpacksData]);

  // Modrinth Live Search Trigger
  React.useEffect(() => {
    if (source !== 'modrinth') return;

    const delayDebounceFn = setTimeout(async () => {
      setIsRemoteLoading(true);
      setOffset(0); // Reset offset on filter change
      setHasMore(true);
      try {
        const results = await ModrinthService.getInstance().searchModpacks(
          searchTerm, 
          20, 
          0,
          'relevance',
          selectedVersion, 
          selectedLoader
        );
        setModrinthModpacks(results);
        if (results.length < 20) {
          setHasMore(false);
        }
      } catch (err) {
        console.error('Remote search error:', err);
      } finally {
        setIsRemoteLoading(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, source, selectedVersion, selectedLoader]);

  const loadMoreModpacks = async () => {
    if (isRemoteLoadingMore || !hasMore) return;
    setIsRemoteLoadingMore(true);
    try {
      const nextOffset = offset + 20;
      const results = await ModrinthService.getInstance().searchModpacks(
        searchTerm,
        20,
        nextOffset,
        'relevance',
        selectedVersion,
        selectedLoader
      );
      setModrinthModpacks(prev => [...prev, ...results]);
      setOffset(nextOffset);
      if (results.length < 20) {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      setIsRemoteLoadingMore(false);
    }
  };

  // Check if any modpack is currently installing/updating
  const hasActiveInstallation = Object.values(modpackStates).some(state =>
    ['installing', 'updating', 'launching'].includes(state.status)
  );

  const filteredModpacks = modpacksData?.modpacks.filter(modpack =>
    modpack.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleModpackSelect = (modpack: Modpack, skipAnimation = false) => {
    // Notify parent to sync state (important for consistent "Back" behavior)
    if (onNavigate) {
      onNavigate('explore', modpack.id);
    }

    const loadDetails = async () => {
      setDetailsLoading(true);
      try {
        if (source === 'modrinth') {
          const details = await ModrinthService.getInstance().getModpackDetails(modpack.id);
          setSelectedModpackDetails(details);
        } else {
          const launcherService = LauncherService.getInstance();
          const details = await launcherService.fetchModpackDetails(modpack.id);
          setSelectedModpackDetails(details);
        }
      } catch {
        setSelectedModpackDetails(null);
      } finally {
        setDetailsLoading(false);
      }
    };

    if (skipAnimation) {
      setSelectedModpack(modpack);
      setShowingDetails(true);
      loadDetails();
      return;
    }

    setIsTransitioning(true);
    withDelay(async () => {
      setSelectedModpack(modpack);
      setShowingDetails(true);
      await loadDetails();
      withDelay(() => {
        setIsTransitioning(false);
      }, 50);
    }, 50);
  };

  const handleBackToList = () => {
    // 1. Clear local state with transition for instant feedback
    setIsTransitioning(true);
    setShowingDetails(false);

    withDelay(() => {
      setSelectedModpack(null);
      setIsTransitioning(false);

      // 2. Notify parent so it can clear its own state (initialModpackId prop)
      // This ensures that subsequent entries work correctly
      if (onNavigate) {
        onNavigate('explore');
      }
    }, 50);
  };

  const handleRefresh = async () => {
    setIsRefreshAnimating(true);
    try {
      // Limpia caché completa antes de refrescar
      const launcherService = LauncherService.getInstance();
      launcherService.clearCache();
      await refreshData();
    } finally {
      withDelay(() => {
        setIsRefreshAnimating(false);
      }, 100);
    }
  };

  // Show overlay loader when loading initial data
  const showLoadingOverlay = isLoading && !modpacksData;

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-white text-xl font-semibold mb-2">{t('modpacks.errorLoading')}</h2>
          <p className="text-dark-300 mb-4">{error}</p>
          <button
            onClick={refreshData}
            className="btn-primary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('modpacks.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (selectedModpack) {
    const modpackState = modpackStates[selectedModpack.id] || {
      installed: false,
      downloading: false,
      progress: { percentage: 0 },
      status: 'not_installed' as const
    };
    return (
      <div className={`h-full w-full ${getAnimationClass('transition-opacity duration-75 ease-out', '')
        } ${showingDetails && !isTransitioning
          ? 'opacity-100'
          : 'opacity-0'
        }`}
        style={getAnimationStyle({})}
      >
        <ModpackDetailsRefactored
          modpack={selectedModpackDetails || selectedModpack}
          state={modpackState}
          onBack={handleBackToList}
          isReadOnly={true}
          onNavigate={(page, id) => {
            if (page === 'my-modpacks') {
              console.log('🔄 onNavigate interceptor: closing details on redirect');
              setSelectedModpack(null);
              setShowingDetails(false);
            }
            if (onNavigate) onNavigate(page, id);
          }}
          isLoadingDetails={detailsLoading}
        />
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${getAnimationClass('transition-opacity duration-75 ease-out', '')
      } ${isTransitioning
        ? 'opacity-0'
        : 'opacity-100'
      }`}
      style={getAnimationStyle({})}
    >
      {/* Header */}
      <div
        className="p-6 border-b border-dark-700"
        style={{
          animation: 'fadeInUp 0.15s ease-out',
          ...getAnimationStyle({})
        }}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-white text-2xl font-bold bg-gradient-to-r from-lumina-400 to-lumina-300 bg-clip-text text-transparent">
              {t('modpacks.title')}
            </h1>
            <p className="text-dark-400 mt-1">
              {t('modpacks.availableCount', { count: filteredModpacks.length })}
            </p>
          </div>

          <div
            className="flex items-center space-x-3"
            style={{
              animation: 'fadeInRight 0.15s ease-out 0.05s backwards',
              ...getAnimationStyle({})
            }}
          >

            <div className="relative group">
              <Search className={`w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400 transition-colors duration-200 ${getAnimationClass('', 'group-focus-within:text-lumina-400')
                }`} />
              <input
                type="text"
                placeholder={t('modpacks.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`input-field pl-10 w-64 transition-all duration-75 ${getAnimationClass('', 'focus:ring-2 focus:ring-lumina-400/50 focus:border-lumina-400')
                  }`}
                style={getAnimationStyle({})}
              />
            </div>

            <button
              onClick={handleRefresh}
              disabled={isLoading || hasActiveInstallation}
              className={`btn-secondary transition-transform duration-75 group ${getAnimationClass('', 'hover:scale-105')
                }`}
              style={getAnimationStyle({})}
              title={hasActiveInstallation ? t('modpacks.refreshDisabledDuringInstall') : t('modpacks.refresh')}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading || isRefreshAnimating ? 'animate-spin' : ''} transition-transform duration-150`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {showLoadingOverlay || isRemoteLoading ? (
          /* Skeleton loading state - inline, not blocking */
          <div className="p-6 space-y-8">
            {[1, 2, 3].map((section) => (
              <div key={section} className="space-y-4">
                {/* Section header skeleton */}
                <div className="flex items-center space-x-2 border-b border-dark-700 pb-2 animate-pulse">
                  <div className="h-6 w-32 bg-dark-700 rounded" />
                  <div className="h-5 w-8 bg-dark-700 rounded-full" />
                </div>
                {/* Grid skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((card) => (
                    <div key={card} className="bg-dark-800 rounded-lg shadow-md overflow-hidden animate-pulse">
                      <div className="h-48 bg-dark-700" />
                      <div className="p-4">
                        <div className="h-5 bg-dark-700 rounded w-3/4 mb-2" />
                        <div className="h-4 bg-dark-700 rounded w-1/2 mb-3" />
                        <div className="h-10 bg-dark-700 rounded-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : source === 'modrinth' ? (
          /* Modrinth List Grid */
          <div className="p-6 flex flex-row-reverse gap-6 items-start">
            {/* Left Sidebar: Filters */}
            <div className="w-64 flex-shrink-0 space-y-6 bg-dark-800/40 p-4 rounded-xl border border-dark-700/60 sticky top-6">
              <div>
                <h3 className="text-xs font-bold text-dark-400 uppercase tracking-wider mb-3">Minecraft Version</h3>
                <select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-700/80 rounded-lg p-2.5 text-white text-sm focus:ring-1 focus:ring-lumina-500 focus:border-lumina-500 outline-none"
                >
                  <option value="">All Versions</option>
                  {['1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.16.5'].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <h3 className="text-xs font-bold text-dark-400 uppercase tracking-wider mb-3">Modloader</h3>
                <div className="space-y-1">
                  {[
                    { id: '', label: 'All Loaders' },
                    { id: 'fabric', label: 'Fabric' },
                    { id: 'forge', label: 'Forge' },
                    { id: 'neoforge', label: 'NeoForge' },
                    { id: 'quilt', label: 'Quilt' }
                  ].map(loader => (
                    <button
                      key={loader.id}
                      onClick={() => setSelectedLoader(loader.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedLoader === loader.id
                        ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 font-medium'
                        : 'text-dark-200 hover:bg-dark-700/60 hover:text-white border border-transparent'
                        }`}
                    >
                      {loader.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Pane: Grid */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center space-x-2 border-b border-dark-700 pb-2">
                <h2 className="text-xl font-bold text-white">Modrinth Modpacks</h2>
                <span className="text-sm text-dark-400 bg-dark-700 px-2 py-0.5 rounded-full">
                  {modrinthModpacks.length}
                </span>
              </div>

            {modrinthModpacks.length === 0 && !isRemoteLoading ? (
              <p className="text-dark-400 text-center py-12">No modpacks found. Try searching for something.</p>
            ) : (
              <div className="flex flex-col space-y-3">
                {modrinthModpacks.map((modpack, index) => {
                  const modpackState = modpackStates[modpack.id] || {
                    status: 'not_installed' as const,
                    installed: false,
                    downloading: false,
                    progress: { percentage: 0 },
                    features: []
                  };

                  return (
                    <ModrinthListCard
                      key={modpack.id}
                      modpack={modpack}
                      state={modpackState}
                      onSelect={() => handleModpackSelect(modpack)}
                      index={index}
                      onNavigateToMyModpacks={() => onNavigate?.('my-modpacks')}
                    />
                  );
                })}

                {/* Load More Button */}
                {hasMore && modrinthModpacks.length >= 20 && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={loadMoreModpacks}
                      disabled={isRemoteLoadingMore}
                      className="flex items-center gap-2 bg-dark-800 hover:bg-dark-700 border border-dark-700/80 hover:border-dark-600 px-6 py-2.5 rounded-lg text-white font-medium text-sm transition-all duration-150 disabled:opacity-50"
                    >
                      {isRemoteLoadingMore ? (
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      ) : (
                        <Download className="w-4 h-4 text-dark-400" />
                      )}
                      <span>Load More</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
        ) : filteredModpacks.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-dark-700 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-dark-400" />
              </div>
              <h2 className="text-white text-xl font-semibold mb-2">
                {searchTerm ? t('modpacks.noResults') : t('modpacks.noModpacks')}
              </h2>
              <p className="text-dark-400">
                {searchTerm
                  ? t('modpacks.tryDifferentSearch')
                  : t('modpacks.checkConnection')
                }
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="btn-primary mt-4"
                >
                  {t('modpacks.clearSearch')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-8">
            {/* Helper function to render a category section */}
            {(['official', 'partner', 'community'] as const).map((category) => {
              const categoryModpacks = filteredModpacks.filter(m => {
                // Default to community if no category is set, or match the category
                if (!m.category) return category === 'community';
                return m.category === category;
              });

              if (categoryModpacks.length === 0) return null;

              return (
                <div key={category} className="space-y-4">
                  <div className="flex items-center space-x-2 border-b border-dark-700 pb-2">
                    <h2 className="text-xl font-bold text-white">
                      {t(`modpacks.category.${category}`)}
                    </h2>
                    <span className="text-sm text-dark-400 bg-dark-700 px-2 py-0.5 rounded-full">
                      {categoryModpacks.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categoryModpacks.map((modpack, index) => {
                      const modpackState = modpackStates[modpack.id] || {
                        status: 'not_installed' as const,
                        installed: false,
                        downloading: false,
                        progress: {
                          percentage: 0,
                          downloaded: 0,
                          total: 0,
                          speed: 0,
                          currentFile: '',
                          downloadSpeed: '',
                          eta: '',
                          phase: ''
                        },
                        features: []
                      };

                      return (
                        <div
                          key={modpack.id}
                          style={{
                            animation: `fadeInUp 0.15s ease-out ${index * 0.02 + 0.1}s backwards`,
                            ...getAnimationStyle({})
                          }}
                        >
                          <ModpackCard
                            modpack={modpack}
                            state={modpackState}
                            onSelect={() => handleModpackSelect(modpack)}
                            index={index}
                            isReadOnly={true}
                            onNavigateToMyModpacks={() => onNavigate?.('my-modpacks')}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModpacksPage; 