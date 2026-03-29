import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Globe, Archive, Trash2 } from 'lucide-react';
import { useAnimation } from '../../../../contexts/AnimationContext';
import ConfirmDialog from '../../../../components/ConfirmDialog';
import { invoke } from '@tauri-apps/api/core';
import toast from 'react-hot-toast';

interface WorldItem {
  name: string;
  last_played: string;
}

interface WorldsSectionProps {
  modpackId: string;
}

const WorldsSection: React.FC<WorldsSectionProps> = ({ modpackId }) => {
  const { t } = useTranslation();
  const { getAnimationClass, getAnimationStyle } = useAnimation();
  const [worlds, setWorlds] = useState<WorldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [worldToDelete, setWorldToDelete] = useState<string | null>(null);

  const handleBackup = async (worldName: string) => {
    try {
      setBackingUp(worldName);
      const zipPath = await invoke<string>('backup_instance_world', { modpackId, worldName });
      toast.success(`Backup created: ${zipPath}`);
    } catch (err) {
      console.error('Backup failed:', err);
      toast.error('Failed to create backup');
    } finally {
      setBackingUp(null);
    }
  };

  const handleDelete = async () => {
    if (!worldToDelete) return;
    try {
      setDeleting(worldToDelete);
      await invoke('delete_instance_world', { modpackId, worldName: worldToDelete });
      toast.success(`World deleted: ${worldToDelete}`);
      setWorlds(prev => prev.filter(w => w.name !== worldToDelete));
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete world');
    } finally {
      setDeleting(null);
      setWorldToDelete(null);
    }
  };

  const fetchWorlds = async () => {
    try {
      setLoading(true);
      const result = await invoke<WorldItem[]>('list_instance_worlds', { modpackId });
      setWorlds(result);
    } catch (err) {
      console.error('Failed to fetch worlds:', err);
      toast.error(t('modpacks.failedToLoadWorlds', { defaultValue: 'Failed to load worlds' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorlds();
  }, [modpackId]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      className={`space-y-4 ${getAnimationClass('transition-all duration-200')}`}
      style={getAnimationStyle({
        animation: `fadeInUp 0.3s ease-out 0.1s backwards`
      })}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
          <Globe className="w-5 h-5 text-nebula-400" />
          <span>{t('modpacks.worlds', { defaultValue: 'Worlds' })}</span>
          <span className="text-sm text-dark-400">({worlds.length})</span>
        </h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-nebula-500 animate-spin" />
        </div>
      ) : worlds.length === 0 ? (
        <div className="text-center py-12 text-dark-400">
          {t('modpacks.noWorldsFound', { defaultValue: 'No worlds found in this instance.' })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto scrollbar-thin p-1">
          {worlds.map((world) => (
            <div 
              key={world.name} 
              className="p-4 bg-dark-800/50 hover:bg-dark-800 border border-dark-700 hover:border-dark-600 rounded-xl transition-all group flex items-start space-x-3"
            >
              <div className="p-2 bg-dark-700 rounded-lg text-dark-300 group-hover:text-nebula-400 transition-colors">
                <Globe className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-white title truncate">
                  {world.name}
                </h4>
                <p className="text-xs text-dark-400 mt-1">
                  {t('modpacks.lastPlayed', { defaultValue: 'Last Played' })}: {formatDate(world.last_played)}
                </p>
              </div>

              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBackup(world.name);
                  }}
                  disabled={!!backingUp || !!deleting}
                  className="p-1.5 hover:bg-dark-700 bg-dark-800/10 rounded-lg text-dark-300 hover:text-nebula-400 transition-colors disabled:opacity-50"
                  title="Create Backup"
                >
                  {backingUp === world.name ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Archive className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setWorldToDelete(world.name);
                  }}
                  disabled={!!backingUp || !!deleting}
                  className="p-1.5 hover:bg-red-900/20 bg-dark-800/10 rounded-lg text-dark-300 hover:text-red-400 transition-colors disabled:opacity-50"
                  title="Delete World"
                >
                  {deleting === world.name ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {worldToDelete && (
        <ConfirmDialog
          title="Delete World"
          message={`Are you sure you want to delete "${worldToDelete}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleDelete}
          onCancel={() => setWorldToDelete(null)}
          type="danger"
        />
      )}
    </div>
  );
};

export default WorldsSection;

