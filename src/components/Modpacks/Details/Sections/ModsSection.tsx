import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Loader2, Package } from 'lucide-react';
import { useAnimation } from '../../../../contexts/AnimationContext';
import { invoke } from '@tauri-apps/api/core';
import toast from 'react-hot-toast';

interface ModItem {
  name: string;
  enabled: boolean;
}

interface ModsSectionProps {
  modpackId: string;
}

const ModsSection: React.FC<ModsSectionProps> = ({ modpackId }) => {
  const { t } = useTranslation();
  const { getAnimationClass, getAnimationStyle } = useAnimation();
  const [mods, setMods] = useState<ModItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [togglingMap, setTogglingMap] = useState<Record<string, boolean>>({});

  const fetchMods = async () => {
    try {
      setLoading(true);
      const result = await invoke<ModItem[]>('list_instance_mods', { modpackId });
      setMods(result);
    } catch (err) {
      console.error('Failed to fetch mods:', err);
      toast.error(t('modpacks.failedToLoadMods', { defaultValue: 'Failed to load mods' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMods();
  }, [modpackId]);

  const toggleMod = async (modName: string, currentlyEnabled: boolean) => {
    // Optimistic Update or Spinner per-item
    setTogglingMap(prev => ({ ...prev, [modName]: true }));
    try {
      await invoke('toggle_mod_status', { 
        modpackId, 
        modName, 
        enabled: !currentlyEnabled 
      });
      
      // Update local state directly for speed
      setMods(prev => prev.map(m => 
        m.name === modName ? { ...m, enabled: !currentlyEnabled } : m
      ));
      
      toast.success(t('modpacks.modStatusUpdated', { defaultValue: 'Mod updated' }));
    } catch (err) {
      console.error('Failed to toggle mod:', err);
      toast.error(t('modpacks.failedToUpdateMod', { defaultValue: 'Failed to update mod' }));
    } finally {
      setTogglingMap(prev => {
        const next = { ...prev };
        delete next[modName];
        return next;
      });
    }
  };

  const filteredMods = useMemo(() => {
    return mods.filter(m => 
      m.name.toLowerCase().includes(searchFilter.toLowerCase())
    );
  }, [mods, searchFilter]);

  return (
    <div
      className={`space-y-4 ${getAnimationClass('transition-all duration-200')}`}
      style={getAnimationStyle({
        animation: `fadeInUp 0.3s ease-out 0.1s backwards`
      })}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
          <Package className="w-5 h-5 text-nebula-400" />
          <span>{t('modpacks.mods', { defaultValue: 'Mods' })}</span>
          <span className="text-sm text-dark-400">({mods.length})</span>
        </h3>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder={t('modpacks.searchMods', { defaultValue: 'Search mods...' })}
            className="w-full pl-9 pr-8 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-white text-sm placeholder-dark-400 focus:ring-2 focus:ring-nebula-500 focus:border-transparent"
          />
          {searchFilter && (
            <button
              type="button"
              onClick={() => setSearchFilter('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-dark-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-nebula-500 animate-spin" />
        </div>
      ) : mods.length === 0 ? (
        <div className="text-center py-12 text-dark-400">
          {t('modpacks.noModsFound', { defaultValue: 'No mods found in this instance.' })}
        </div>
      ) : (
        <div className="bg-dark-900 border border-dark-800 rounded-lg divide-y divide-dark-800 max-h-[500px] overflow-y-auto scrollbar-thin">
          {filteredMods.length === 0 ? (
            <div className="p-4 text-center text-dark-400 text-sm">
              {t('modpacks.noMatchingMods', { defaultValue: 'No matching mods.' })}
            </div>
          ) : (
            filteredMods.map((mod) => (
              <div key={mod.name} className="p-3 flex items-center justify-between hover:bg-dark-800/50 transition-colors">
                <div className="flex-1 min-w-0 pr-4">
                  <span className={`text-sm font-mono break-all ${mod.enabled ? 'text-white' : 'text-dark-400 line-through'}`}>
                    {mod.name.replace('.disabled', '')}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {togglingMap[mod.name] ? (
                    <Loader2 className="w-4 h-4 text-nebula-500 animate-spin" />
                  ) : (
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mod.enabled}
                        onChange={() => toggleMod(mod.name, mod.enabled)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-nebula-500"></div>
                    </label>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ModsSection;

