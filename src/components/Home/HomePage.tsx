import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Clock, Play, Compass } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import ModpackCard from '../Modpacks/ModpackCard';
import { Modpack } from '../../types/launcher';
import { ModrinthService } from '../../services/modrinthService';
import { useLauncher } from '../../contexts/LauncherContext';

interface HomePageProps {
  onNavigate?: (_section: string, _modpackId?: string) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const { t } = useTranslation();
  const { modpackStates, userSettings } = useLauncher();
  const [comingSoonModpacks, setComingSoonModpacks] = useState<Modpack[]>([]);
  const [featuredModpacks, setFeaturedModpacks] = useState<Modpack[]>([]);
  const [discoverModpacks, setDiscoverModpacks] = useState<Modpack[]>([]);
  const [localModpacksMap, setLocalModpacksMap] = useState<Map<string, Modpack>>(new Map());
  const [_loading, setLoading] = useState(true);

  const displayName = useMemo(() => {
    // 1. Try Discord Global Name (LuminaKraft Profile)
    if (userSettings.discordAccount?.globalName) {
      return userSettings.discordAccount.globalName;
    }
    // 2. Try Discord Username
    if (userSettings.discordAccount?.username) {
      return userSettings.discordAccount.username;
    }
    // 3. Try Microsoft Username
    if (userSettings.microsoftAccount?.username) {
      return userSettings.microsoftAccount.username;
    }
    // 4. Fallback to offline username
    return userSettings.username || 'Player';
  }, [userSettings]);

  useEffect(() => {
    loadHomePageData();
  }, []);

  // Load local modpack metadata when installed modpacks change
  useEffect(() => {
    const loadLocalModpacks = async () => {
      const installedIds = Object.entries(modpackStates)
        .filter(([_, state]) => state.installed)
        .map(([id]) => id);

      const newMap = new Map<string, Modpack>();

      for (const id of installedIds) {
        // Skip if already in server modpacks
        if ([...featuredModpacks, ...comingSoonModpacks, ...discoverModpacks].some(m => m.id === id)) {
          continue;
        }

        try {
          // Get cached modpack data (name, logo, etc.)
          const cachedData = await invoke<string | null>('get_cached_modpack_data', {
            modpackId: id
          });

          // Get instance metadata (minecraft version, modloader, etc.)
          const instanceMetadata = await invoke<string | null>('get_instance_metadata', {
            modpackId: id
          });

          let modpack: Modpack = {
            id,
            name: 'Local Modpack',
            description: '',
            version: '',
            minecraftVersion: '',
            modloader: '',
            modloaderVersion: '',
            isActive: true, // Local modpacks are always active
            isComingSoon: false,
            isNew: false,
            logo: '',
            backgroundImage: '',
          } as Modpack;

          // Merge cached data if available
          if (cachedData) {
            const cached = JSON.parse(cachedData);
            modpack = { ...modpack, ...cached, isActive: true };
          }

          // Merge instance metadata if available
          if (instanceMetadata) {
            const instance = JSON.parse(instanceMetadata);
            modpack = {
              ...modpack,
              name: instance.name || modpack.name,
              version: instance.version || modpack.version,
              minecraftVersion: instance.minecraftVersion || modpack.minecraftVersion,
              modloader: instance.modloader || modpack.modloader,
              modloaderVersion: instance.modloaderVersion || modpack.modloaderVersion,
            };
          }

          newMap.set(id, modpack);
        } catch (error) {
          console.error(`Failed to load local modpack ${id}:`, error);
        }
      }

      setLocalModpacksMap(newMap);
    };

    loadLocalModpacks();
  }, [modpackStates, featuredModpacks, comingSoonModpacks, discoverModpacks]);

  const loadHomePageData = async () => {
    setLoading(true);
    try {
      const service = ModrinthService.getInstance();
      
      // Fetch Featured/Popular (by downloads)
      const popular = await service.searchModpacks('', 10, 0, 'downloads');
      setFeaturedModpacks(popular);

      // Fetch Discover/Newest
      const newest = await service.searchModpacks('', 10, 0, 'newest');
      setDiscoverModpacks(newest);

      // Clear coming soon since Modrinth doesn't have a direct flag
      setComingSoonModpacks([]);
    } catch (error) {
      console.error('Error loading homepage data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Build a map of all available modpacks (server + local)
  const allModpacksMap = useMemo(() => {
    const map = new Map<string, Modpack>();

    // Add server modpacks
    [...featuredModpacks, ...comingSoonModpacks, ...discoverModpacks].forEach(m => {
      map.set(m.id, m);
    });

    // Add local modpacks
    localModpacksMap.forEach((modpack, id) => {
      if (!map.has(id)) {
        map.set(id, modpack);
      }
    });

    return map;
  }, [featuredModpacks, comingSoonModpacks, discoverModpacks, localModpacksMap]);

  // Get recently played instances
  const recentInstances = useMemo(() => {
    const installed = Object.entries(modpackStates)
      .filter(([_, state]) => state.installed)
      .map(([id]) => id)
      .slice(0, 3); // Get top 3

    return installed;
  }, [modpackStates]);

  // No longer blocking the whole page with a spinner. 
  // We want to show "Jump back in" immediately if local modpacks are available.

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Minimal Hero Section - More professional */}
      {/* Premium Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl p-8 border border-dark-700/50 shadow-xl mb-2">
        {/* Ambient background glow dots */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-lumina-500/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>

        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            {t('home.hero.title')}, <span className="bg-gradient-to-r from-lumina-400 to-blue-500 bg-clip-text text-transparent">{displayName}</span>
          </h1>
          <p className="text-dark-300 text-base max-w-lg leading-relaxed">
            Ready to jump back in? Select your recently played modpacks below or Explore new communities live!
          </p>
          
          <div className="flex items-center gap-4 mt-6">
            <button 
              onClick={() => onNavigate?.('my-modpacks')}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
            >
              <Play className="w-4 h-4" />
              <span>Resume Play</span>
            </button>
            <button 
              onClick={() => onNavigate?.('explore')}
              className="flex items-center gap-2 border border-dark-600 hover:border-dark-500 hover:bg-dark-800 px-5 py-2.5 rounded-lg text-white font-medium text-sm transition-all duration-150"
            >
              <Compass className="w-4 h-4 text-dark-400" />
              <span>Explore</span>
            </button>
          </div>
        </div>
      </div>

      {/* Jump back in Section */}
      {recentInstances.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Play className="w-5 h-5" />
              {t('home.jumpBackIn.title')}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentInstances.map((modpackId, index) => {
              const modpack = allModpacksMap.get(modpackId);

              if (!modpack) return null;

              const state = modpackStates[modpack.id] || {
                installed: false,
                downloading: false,
                progress: { percentage: 0 },
                status: 'not_installed' as const
              };

              return (
                <ModpackCard
                  key={modpack.id}
                  modpack={modpack}
                  state={state}
                  onSelect={() => onNavigate?.('my-modpacks', modpack.id)}
                  index={index}
                  isReadOnly={false}
                  onNavigateToMyModpacks={() => onNavigate?.('my-modpacks')}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Coming Soon Section */}
      {comingSoonModpacks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {t('home.comingSoon.title')}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {comingSoonModpacks.slice(0, 4).map((modpack, index) => {
              const state = modpackStates[modpack.id] || {
                installed: false,
                downloading: false,
                progress: { percentage: 0 },
                status: 'not_installed' as const
              };
              return (
                <ModpackCard
                  key={modpack.id}
                  modpack={modpack}
                  state={state}
                  onSelect={() => onNavigate?.('explore', modpack.id)}
                  index={index}
                  isReadOnly={true}
                  onNavigateToMyModpacks={() => onNavigate?.('my-modpacks')}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Featured Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            {t('home.featured.title')}
          </h2>
          <button
            onClick={() => onNavigate?.('explore')}
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium group transition-colors duration-150"
          >
            {t('home.viewAll')}
            <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-1" />
          </button>
        </div>
        {featuredModpacks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featuredModpacks.slice(0, 6).map((modpack, index) => {
              const state = modpackStates[modpack.id] || {
                installed: false,
                downloading: false,
                progress: { percentage: 0 },
                status: 'not_installed' as const
              };
              return (
                <ModpackCard
                  key={modpack.id}
                  modpack={modpack}
                  state={state}
                  onSelect={() => onNavigate?.('explore', modpack.id)}
                  index={index}
                  isReadOnly={true}
                  onNavigateToMyModpacks={() => onNavigate?.('my-modpacks')}
                />
              );
            })}
          </div>
        ) : (
          <div className="bg-dark-800 rounded-lg p-8 border border-dark-700">
            <p className="text-gray-400 text-center">
              {t('home.featured.empty')}
            </p>
          </div>
        )}
      </section>

      {/* Discover Section */}
      {discoverModpacks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">
              {t('home.discover.title')}
            </h2>
            <button
              onClick={() => onNavigate?.('explore')}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium group transition-colors duration-150"
            >
              {t('home.discover.viewAll')}
              <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-1" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {discoverModpacks.map((modpack, index) => {
              const state = modpackStates[modpack.id] || {
                installed: false,
                downloading: false,
                progress: { percentage: 0 },
                status: 'not_installed' as const
              };
              return (
                <ModpackCard
                  key={modpack.id}
                  modpack={modpack}
                  state={state}
                  onSelect={() => onNavigate?.('explore', modpack.id)}
                  index={index}
                  isReadOnly={true}
                  onNavigateToMyModpacks={() => onNavigate?.('my-modpacks')}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default HomePage;
