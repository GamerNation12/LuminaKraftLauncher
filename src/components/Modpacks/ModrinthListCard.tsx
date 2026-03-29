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
        className: 'bg-white/5 text-dark-500 cursor-not-allowed border border-white/5',
        disabled: true
      };
    }

    if (['installed', 'outdated', 'error'].includes(state.status)) {
      if (state.status === 'error') {
        return {
          text: t('modpacks.repair'),
          icon: Wrench,
          onClick: () => repairModpack(modpack.id),
          className: 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30',
          disabled: false
        };
      }
      return {
        text: t('modpacks.installed'),
        icon: Download,
        onClick: () => { },
        className: 'bg-white/5 text-dark-500 cursor-not-allowed border border-white/5',
        disabled: true
      };
    }

    return {
      text: t('modpacks.install'),
      icon: Download,
      onClick: handleInstall,
      className: 'bg-nebula-500/90 hover:bg-nebula-500 text-white shadow-lg shadow-nebula-500/20 border border-nebula-400/30',
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
      className="p-6 flex flex-row items-center gap-8 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 rounded-[2rem] cursor-pointer group transition-all duration-500 shadow-xl active:scale-[0.99] backdrop-blur-3xl"
      style={{
        animation: `fadeInUp 0.15s ease-out ${index * 0.02 + 0.1}s backwards`,
        ...getAnimationStyle({})
      }}
    >
      {/* Icon */}
      <div className="w-24 h-24 rounded-3xl overflow-hidden bg-nebula-950 border-2 border-white/5 flex-shrink-0 flex items-center justify-center p-0 relative transition-all duration-700 group-hover:scale-110 group-hover:-rotate-3 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-nebula-500/10 to-indigo-500/10 opacity-40" />
        {modpack.logo ? (
          <img
            src={modpack.logo}
            alt={modpack.name}
            className="w-full h-full object-cover transition-transform duration-700"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0yNCAyNEg0MFY0MEgyNFYyNFoiIGZpbGw9IiM2Mzc1ODMiLz4KPC9zdmc+';
            }}
          />
        ) : (
          <div className="text-5xl font-black text-white opacity-10 italic uppercase select-none">
            {modpack.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Center Info */}
      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
          <h3 className="text-white font-black text-xl truncate uppercase italic tracking-tighter group-hover:text-nebula-400 transition-colors leading-[0.9]">
            {modpack.name}
          </h3>
          {modpack.authorName && (
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-dark-500 hidden md:block" />
              <span className="text-dark-500 text-[10px] font-black uppercase tracking-[0.2em] italic truncate opacity-60">BY {modpack.authorName}</span>
            </div>
          )}
        </div>

        <p className="text-dark-400 text-sm line-clamp-1 font-black uppercase italic tracking-wider opacity-60 group-hover:opacity-100 transition-opacity">
          {modpack.shortDescription || modpack.description}
        </p>

        {/* Tags Row */}
        <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.2em] italic text-dark-500">
          <div className="bg-white/5 px-4 py-1.5 rounded-xl text-dark-400 border border-white/5 shadow-inner">
            {modpack.minecraftVersion}
          </div>
          <div className="bg-white/5 px-4 py-1.5 rounded-xl text-dark-400 border border-white/5 shadow-inner">
            {modpack.modloader}
          </div>
          {modpack.downloads && (
            <div className="flex items-center gap-2 text-nebula-400/80 bg-nebula-500/5 px-4 py-1.5 rounded-xl border border-nebula-500/10">
              <Download className="w-3 h-3" /> 
              {formatDownloads(modpack.downloads)}
            </div>
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
          className={`h-14 px-10 rounded-2xl flex items-center justify-center gap-4 font-black text-xs uppercase italic tracking-[0.1em] transition-all shadow-xl active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed group/action-btn ${buttonConfig.className}`}
        >
          <ButtonIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''} group-hover/action-btn:scale-110 transition-transform`} />
          <span>{buttonConfig.text}</span>
        </button>
      </div>
    </div>
  );
});

ModrinthListCard.displayName = 'ModrinthListCard';

export default ModrinthListCard;
