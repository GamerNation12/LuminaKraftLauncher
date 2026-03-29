import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { useLauncher } from '../../contexts/LauncherContext';
import { useAnimation } from '../../contexts/AnimationContext';
import ModpackCard from './ModpackCard';
import ModrinthListCard from './ModrinthListCard';
import ModpackDetailsRefactored from './ModpackDetailsRefactored';
import LauncherService from '../../services/launcherService';
import { ModrinthService } from '../../services/modrinthService';
import { CurseForgeService } from '../../services/curseforgeService';

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
  const [source, setSource] = useState<'modrinth' | 'curseforge'>('modrinth');
  const [modrinthModpacks, setModrinthModpacks] = useState<Modpack[]>([]);
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [selectedLoader, setSelectedLoader] = useState<string>('');
  const [sortIndex, setSortIndex] = useState<'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'>('relevance');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [isRefreshAnimating, setIsRefreshAnimating] = useState(false);
  const [showingDetails, setShowingDetails] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [offset, setOffset] = useState(0);
  const [isRemoteLoadingMore, setIsRemoteLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastModpackElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isRemoteLoading || isRemoteLoadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        // We use a timeout to avoid dispatching changes while React is rendering
        setTimeout(() => loadMoreModpacks(), 0);
      }
    });
    if (node) observer.current.observe(node);
  }, [isRemoteLoading, isRemoteLoadingMore, hasMore]);

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

  // Live Search Trigger
  React.useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      setIsRemoteLoading(true);
      setOffset(0); // Reset offset on filter change
      setHasMore(true);
      try {
        let results = [];
        if (source === 'modrinth') {
          results = await ModrinthService.getInstance().searchModpacks(
            searchTerm, 
            20, 
            0,
            sortIndex,
            selectedVersion, 
            selectedLoader,
            selectedCategories
          );
        } else {
          // Curseforge sort indices: 2 = Popularity, 1 = Featured, 5 = Last Updated
          const cfSort = sortIndex === 'downloads' ? 2 : sortIndex === 'newest' ? 5 : 2;
          results = await CurseForgeService.getInstance().searchModpacks(
            searchTerm,
            20,
            0,
            cfSort,
            selectedVersion,
            selectedLoader
          );
        }
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
  }, [searchTerm, selectedVersion, selectedLoader, sortIndex, selectedCategories, source]);

  const loadMoreModpacks = async () => {
    if (isRemoteLoadingMore || !hasMore) return;
    setIsRemoteLoadingMore(true);
    try {
      const nextOffset = offset + 20;
      let results = [];
      
      if (source === 'modrinth') {
        results = await ModrinthService.getInstance().searchModpacks(
          searchTerm,
          20,
          nextOffset,
          sortIndex,
          selectedVersion,
          selectedLoader,
          selectedCategories
        );
      } else {
        const cfSort = sortIndex === 'downloads' ? 2 : sortIndex === 'newest' ? 5 : 2;
        results = await CurseForgeService.getInstance().searchModpacks(
          searchTerm,
          20,
          nextOffset,
          cfSort,
          selectedVersion,
          selectedLoader
        );
      }

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
    <div className={`h-full flex flex-col bg-transparent ${isTransitioning ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500 custom-scrollbar overflow-y-auto`}>
      {/* Header */}
      <div className="p-10 border-b border-white/5 bg-white/[0.01] backdrop-blur-3xl sticky top-0 z-30">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8 max-w-[1600px] mx-auto">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-nebula-500 animate-pulse" />
              <span className="text-[10px] font-black text-nebula-400 uppercase tracking-[0.3em] italic">DEEP_SPACE_EXPLORATION</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic leading-[0.9]">
              {t('modpacks.explore', 'Explore Nebula')}
            </h1>
            <p className="text-dark-400 font-black uppercase italic tracking-[0.1em] opacity-40 text-sm">
              {t('modpacks.availableCount', { count: filteredModpacks.length + modrinthModpacks.length })} DISCOVERIES_UNLOCKED
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 w-full xl:w-auto">
            <div className="relative group flex-1 xl:flex-none">
              <Search className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-dark-500 group-focus-within:text-nebula-400 transition-all duration-300 group-focus-within:scale-110" />
              <input
                type="text"
                placeholder={t('modpacks.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full xl:w-96 bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-5 text-white placeholder:text-dark-600 focus:outline-none focus:ring-4 focus:ring-nebula-500/20 transition-all font-black italic uppercase tracking-wider text-sm shadow-inner"
              />
            </div>

            <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 shadow-inner">
              <button
                onClick={() => setSource('modrinth')}
                className={`px-8 py-3.5 rounded-xl text-xs font-black uppercase italic tracking-[0.1em] transition-all relative overflow-hidden group/btn ${source === 'modrinth' ? 'bg-nebula-500 text-white shadow-lg shadow-nebula-500/30' : 'text-dark-500 hover:text-white'}`}
              >
                MODRINTH
                {source === 'modrinth' && <div className="absolute inset-0 bg-white/10 animate-pulse" />}
              </button>
              <button
                onClick={() => setSource('curseforge')}
                className={`px-8 py-3.5 rounded-xl text-xs font-black uppercase italic tracking-[0.1em] transition-all relative overflow-hidden group/btn ${source === 'curseforge' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'text-dark-500 hover:text-white'}`}
              >
                CURSEFORGE
                {source === 'curseforge' && <div className="absolute inset-0 bg-white/10 animate-pulse" />}
              </button>
            </div>

            <select
              value={sortIndex}
              onChange={(e) => setSortIndex(e.target.value as any)}
              className="bg-white/5 border border-white/10 rounded-2xl px-8 py-5 text-white text-[10px] font-black focus:outline-none focus:ring-4 focus:ring-nebula-500/20 outline-none appearance-none min-w-[180px] text-center uppercase tracking-[0.2em] italic cursor-pointer transition-all shadow-inner"
            >
              <option value="relevance">RELEVANCE</option>
              <option value="downloads">DOWNLOADS</option>
              <option value="follows">FOLLOWERS</option>
              <option value="newest">NEWEST</option>
              <option value="updated">UPDATED</option>
            </select>

            <button
              onClick={handleRefresh}
              disabled={isLoading || hasActiveInstallation}
              className="p-5 rounded-2xl bg-white/5 border border-white/10 text-dark-400 hover:text-nebula-400 hover:bg-white/10 hover:border-nebula-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed group/refresh shadow-inner"
              title={t('modpacks.refresh')}
            >
              <RefreshCw className={`w-6 h-6 ${isLoading || isRefreshAnimating ? 'animate-spin' : ''} transition-transform duration-500 group-hover/refresh:rotate-180`} />
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
          <div className="p-10 flex flex-col lg:flex-row gap-12 items-start max-w-[1600px] mx-auto">
            {/* Left Sidebar: Filters */}
            <div className="w-full lg:w-80 flex-shrink-0 space-y-10 bg-white/[0.02] p-8 rounded-[3rem] border border-white/5 sticky top-40 backdrop-blur-3xl shadow-2xl">
              <div>
                <h3 className="text-[10px] font-black text-dark-500 uppercase tracking-[0.3em] italic mb-6 flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-nebula-500" />
                  MINECRAFT_VERSION
                </h3>
                <select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-xs font-black uppercase italic tracking-widest focus:ring-4 focus:ring-nebula-500/20 outline-none appearance-none cursor-pointer transition-all"
                >
                  <option value="">ALL_VERSIONS</option>
                  {['1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.16.5'].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <h3 className="text-[10px] font-black text-dark-500 uppercase tracking-[0.3em] italic mb-6 flex items-center gap-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-nebula-500" />
                   MOD_LOADER
                </h3>
                <div className="space-y-3">
                  {[
                    { id: '', label: 'ALL_LOADERS' },
                    { id: 'fabric', label: 'FABRIC' },
                    { id: 'forge', label: 'FORGE' },
                    { id: 'neoforge', label: 'NEO_FORGE' },
                    { id: 'quilt', label: 'QUILT' }
                  ].map(loader => (
                    <button
                      key={loader.id}
                      onClick={() => setSelectedLoader(loader.id)}
                      className={`w-full text-left px-5 py-4 rounded-xl text-[10px] transition-all font-black uppercase tracking-[0.1em] italic border ${selectedLoader === loader.id
                        ? 'bg-nebula-500/10 text-nebula-400 border-nebula-500/30 shadow-lg shadow-nebula-500/10 translate-x-1'
                        : 'text-dark-500 hover:bg-white/5 hover:text-dark-300 border-transparent'
                        }`}
                    >
                      {loader.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-black text-dark-500 uppercase tracking-[0.3em] italic mb-6 flex items-center gap-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-nebula-500" />
                   CATEGORIES
                </h3>
                <div className="flex flex-wrap gap-2.5">
                  {[
                    'Adventure', 'Magic', 'Tech', 'Exploration', 'Quest', 
                    'Optimization', 'Multiplayer', 'Vanilla+'
                  ].map(cat => (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategories(prev => 
                          prev.includes(cat) 
                            ? prev.filter(c => c !== cat) 
                            : [...prev, cat]
                        );
                      }}
                      className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.1em] italic transition-all border ${selectedCategories.includes(cat)
                        ? 'bg-nebula-500 text-white border-white/20 shadow-lg shadow-nebula-500/30'
                        : 'bg-white/5 text-dark-500 border-white/5 hover:bg-white/10 hover:text-dark-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Pane: Grid */}
            <div className="flex-1 space-y-8">
              <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter transition-all duration-500 group-hover:translate-x-1">RESULTS</h2>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-nebula-500 animate-pulse" />
                  <span className="text-[10px] font-black text-nebula-400 bg-nebula-500/10 px-4 py-1.5 rounded-full border border-nebula-500/20 tracking-[0.2em] italic">
                    {modrinthModpacks.length} DISCOVERED
                  </span>
                </div>
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

                {/* Intersection Observer Target */}
                {hasMore && modrinthModpacks.length >= 20 && (
                  <div ref={lastModpackElementRef} className="col-span-1 md:col-span-2 lg:col-span-3 flex justify-center items-center py-6">
                    {isRemoteLoadingMore ? (
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                    ) : (
                      <div className="w-8 h-8 opacity-0" />
                    )}
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