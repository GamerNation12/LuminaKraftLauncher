import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Wrench, Loader2 } from 'lucide-react';
import type { Modpack, ModpackState, ProgressInfo } from '../../types/launcher';
import { useLauncher } from '../../contexts/LauncherContext';
import { useAnimation } from '../../contexts/AnimationContext';

interface ModrinthListCardProps {
  modpack: Modpack;
  state: ModpackState & {
    progress?: ProgressInfo;
  };
  onSelect: () => void;
  index?: number;
  onNavigateToMyModpacks?: () => void;
}

const ModrinthListCard: React.FC<ModrinthListCardProps> = memo(({ modpack, state, onSelect, index = 0, onNavigateToMyModpacks }) => {
  const { t } = useTranslation();
  const { getAnimationStyle } = useAnimation();
  const { installModpack, repairModpack } = useLauncher();

  const handleInstall = async () => {
    try {
      localStorage.setItem(`installing_modpack_${modpack.id}`, JSON.stringify(modpack));
    } catch (error) {
      console.error('Failed to save modpack to localStorage:', error);
    }
    const started = await installModpack(modpack.id);
    if (started && onNavigateToMyModpacks) {
      onNavigateToMyModpacks();
    }
  };

  const getButtonConfig = () => {
    if (['installing', 'updating', 'reinstalling'].includes(state.status)) {
      return {
        text: t('modpacks.installing'),
        icon: Loader2,
        onClick: () => { },
        className: 'bg-dark-700 text-dark-400 cursor-not-allowed border border-dark-600',
        disabled: true
      };
    }

    if (['installed', 'outdated', 'error'].includes(state.status)) {
      if (state.status === 'error') {
        return {
          text: t('modpacks.repair'),
          icon: Wrench,
          onClick: () => repairModpack(modpack.id),
          className: 'bg-orange-600 hover:bg-orange-700 text-white',
          disabled: false
        };
      }
      return {
        text: t('modpacks.installed'),
        icon: Download,
        onClick: () => { },
        className: 'bg-dark-700 text-dark-400 cursor-not-allowed border border-dark-600',
        disabled: true
      };
    }

    return {
      text: t('modpacks.install'),
      icon: Download,
      onClick: handleInstall,
      className: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/10',
      disabled: false
    };
  };

  const buttonConfig = getButtonConfig();
  const ButtonIcon = buttonConfig.icon;
  const isLoading = ['installing', 'updating', 'repairing', 'reinstalling', 'launching', 'stopping'].includes(state.status);

  const formatDownloads = (num?: number) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div
      onClick={onSelect}
      className={`p-4 flex flex-row items-center gap-4 bg-dark-800/40 hover:bg-dark-800/80 border border-dark-700/50 hover:border-dark-600/50 rounded-xl cursor-pointer group transition-all duration-75`}
      style={{
        animation: `fadeInUp 0.15s ease-out ${index * 0.02 + 0.1}s backwards`,
        ...getAnimationStyle({})
      }}
    >
      {/* Icon */}
      <div className="w-20 h-20 rounded-xl overflow-hidden bg-dark-800 border border-dark-700/80 flex-shrink-0 flex items-center justify-center p-2 relative group-hover:scale-105 transition-transform">
        {modpack.logo ? (
          <img
            src={modpack.logo}
            alt={modpack.name}
            className="w-full h-full object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0yNCAyNEg0MFY0MEgyNFYyNFoiIGZpbGw9IiM2Mzc1ODMiLz4KPC9zdmc+';
            }}
          />
        ) : (
          <div className="text-3xl font-bold text-white opacity-20">
            {modpack.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Center Info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-bold text-base truncate group-hover:text-emerald-400 transition-colors">
            {modpack.name}
          </h3>
          {modpack.authorName && (
            <span className="text-dark-400 text-xs truncate">by {modpack.authorName}</span>
          )}
        </div>

        <p className="text-dark-300 text-sm line-clamp-1">
          {modpack.shortDescription || modpack.description}
        </p>

        {/* Tags Row */}
        <div className="flex items-center space-x-2 text-xs text-dark-500">
          <span className="bg-dark-700/40 px-2 py-0.5 rounded-full text-dark-300">
            {modpack.minecraftVersion}
          </span>
          <span className="capitalize bg-dark-700/40 px-2 py-0.5 rounded-full text-dark-300">
            {modpack.modloader}
          </span>
          {modpack.downloads && (
            <span className="flex items-center gap-1 text-dark-400">
              <Download className="w-3 h-3" /> {formatDownloads(modpack.downloads)}
            </span>
          )}
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="flex-shrink-0 flex flex-col items-end gap-2 ml-auto">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!buttonConfig.disabled) buttonConfig.onClick();
          }}
          disabled={buttonConfig.disabled}
          className={`px-4 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1.5 transition-all ${buttonConfig.className}`}
        >
          <ButtonIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{buttonConfig.text}</span>
        </button>
      </div>
    </div>
  );
});

ModrinthListCard.displayName = 'ModrinthListCard';

export default ModrinthListCard;
