import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Clock, Play, Compass, Globe } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import ModpackCard from '../Modpacks/ModpackCard';
import { Modpack } from '../../types/launcher';
import { ModrinthService } from '../../services/modrinthService';
import { useLauncher } from '../../contexts/LauncherContext';
import { useAnimation } from '../../contexts/AnimationContext';

interface HomePageProps {
  onNavigate?: (_section: string, _modpackId?: string) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const { t } = useTranslation();
  const { getAnimationStyle } = useAnimation();
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
    <div className="max-w-7xl mx-auto p-10 space-y-12 w-full custom-scrollbar overflow-y-auto h-full">
      {/* Premium Welcome Banner */}
      <div 
        className="relative overflow-hidden bg-white/[0.02] backdrop-blur-3xl rounded-[3rem] p-12 border border-white/5 shadow-2xl transition-all duration-500 hover:border-nebula-500/20 group/hero"
        style={getAnimationStyle({})}
      >
        {/* Animated nebula background bits */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-nebula-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 animate-pulse pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4 pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-nebula-500/[0.02] via-transparent to-transparent opacity-0 group-hover/hero:opacity-100 transition-opacity duration-700"></div>

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-nebula-500/10 border border-nebula-500/20 rounded-full mb-6 mx-auto lg:mx-0">
              <div className="w-1.5 h-1.5 rounded-full bg-nebula-400 animate-pulse"></div>
              <span className="text-[10px] font-black text-nebula-400 uppercase tracking-[0.2em] italic">SYSTEMS_ACTIVE</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter uppercase italic leading-[0.9]">
              {t('home.hero.title')}, <br />
              <span className="bg-gradient-to-r from-nebula-400 via-indigo-400 to-nebula-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-x">{displayName}</span>
            </h1>
            
            <p className="text-dark-400 text-lg max-w-xl leading-relaxed font-black uppercase italic tracking-wider opacity-60 mb-10 mx-auto lg:mx-0">
              Your gateway to the stars. Resume your journey or <span className="text-white">explore new worlds</span> across the Nebula network.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-6 justify-center lg:justify-start">
              <button 
                onClick={() => onNavigate?.('my-modpacks')}
                className="w-full sm:w-auto px-10 py-5 bg-nebula-500 hover:bg-nebula-600 text-white rounded-2xl font-black text-sm uppercase italic tracking-[0.1em] transition-all shadow-xl shadow-nebula-500/30 active:scale-95 flex items-center justify-center gap-4 group/play"
              >
                <Play className="w-5 h-5 fill-current group-hover/play:scale-110 transition-transform" />
                <span>RESUME_JOURNEY</span>
              </button>
              <button 
                onClick={() => onNavigate?.('explore')}
                className="w-full sm:w-auto px-10 py-5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white rounded-2xl font-black text-sm uppercase italic tracking-[0.1em] transition-all flex items-center justify-center gap-4 group/explore active:scale-95"
              >
                <Compass className="w-5 h-5 text-dark-400 group-hover/explore:text-white transition-colors group-hover/explore:rotate-45 transition-transform" />
                <span>EXPLORE_WORLDS</span>
              </button>
            </div>
          </div>

          <div className="flex-shrink-0 w-64 h-64 items-center justify-center relative hidden lg:flex">
            <div className="absolute inset-0 bg-nebula-500/20 blur-[100px] rounded-full animate-pulse"></div>
            <div className="w-48 h-48 rounded-[3.5rem] bg-gradient-to-br from-nebula-500 via-indigo-600 to-nebula-700 flex items-center justify-center shadow-2xl transform rotate-12 group-hover/hero:rotate-[15deg] group-hover/hero:scale-110 transition-all duration-700 border-4 border-white/20">
              <span className="text-white font-black text-8xl select-none italic tracking-tighter shadow-2xl">N</span>
              <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/10 backdrop-blur-3xl rounded-3xl border border-white/10 flex items-center justify-center shadow-2xl">
                <div className="w-10 h-10 border-4 border-nebula-400 rounded-full animate-spin border-t-transparent"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Jump back in Section */}
      {recentInstances.length > 0 && (
        <section style={getAnimationStyle({})}>
          <div className="flex items-center justify-between mb-8 px-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-nebula-500/10 rounded-xl border border-nebula-500/20">
                <Play className="w-5 h-5 text-nebula-400" />
              </div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">
                {t('home.jumpBackIn.title')}
              </h2>
            </div>
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
        <section style={getAnimationStyle({})}>
          <div className="flex items-center justify-between mb-8 px-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-nebula-500/10 rounded-xl border border-nebula-500/20">
                <Clock className="w-5 h-5 text-nebula-400" />
              </div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">
                {t('home.comingSoon.title')}
              </h2>
            </div>
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
      <section style={getAnimationStyle({})}>
        <div className="flex items-center justify-between mb-8 px-4">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-nebula-500/10 rounded-xl border border-nebula-500/20">
              <Compass className="w-5 h-5 text-nebula-400" />
            </div>
            <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">
              {t('home.featured.title')}
            </h2>
          </div>
          <button
            onClick={() => onNavigate?.('explore')}
            className="flex items-center gap-3 text-[10px] font-black text-nebula-400 hover:text-nebula-300 uppercase italic tracking-[0.2em] group transition-all"
          >
            {t('home.viewAll')}
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
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
          <div className="bg-white/[0.02] backdrop-blur-3xl rounded-[2.5rem] p-16 border border-white/5 shadow-inner flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-white/5 opacity-40">
              <Compass className="w-8 h-8 text-dark-500" />
            </div>
            <p className="text-dark-500 font-black text-xs uppercase italic tracking-widest text-center">
              {t('home.featured.empty')}
            </p>
          </div>
        )}
      </section>

      {/* Discover Section */}
      {discoverModpacks.length > 0 && (
        <section style={getAnimationStyle({})}>
          <div className="flex items-center justify-between mb-8 px-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-nebula-500/10 rounded-xl border border-nebula-500/20">
                <Globe className="w-5 h-5 text-nebula-400" />
              </div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">
                {t('home.discover.title')}
              </h2>
            </div>
            <button
              onClick={() => onNavigate?.('explore')}
              className="flex items-center gap-3 text-[10px] font-black text-nebula-400 hover:text-nebula-300 uppercase italic tracking-[0.2em] group transition-all"
            >
              {t('home.discover.viewAll')}
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
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
