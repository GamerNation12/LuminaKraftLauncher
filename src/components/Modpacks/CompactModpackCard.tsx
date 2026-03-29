import React, { memo } from 'react';
import { Play, Loader2, AlertTriangle } from 'lucide-react';
import type { Modpack, ModpackState } from '../../types/launcher';
import { useAnimation } from '../../contexts/AnimationContext';

interface CompactModpackCardProps {
  modpack: Modpack;
  state: ModpackState;
  isSelected: boolean;
  onSelect: () => void;
  index?: number;
}

const CompactModpackCard: React.FC<CompactModpackCardProps> = memo(({ 
  modpack, 
  state, 
  isSelected, 
  onSelect, 
  index = 0 
}) => {
  const { getAnimationClass } = useAnimation();
  
  const isLoading = ['installing', 'updating', 'repairing', 'reinstalling', 'launching', 'stopping'].includes(state.status);
  const isRunning = state.status === 'running';
  const hasError = state.status === 'error';

  return (
    <div
      onClick={onSelect}
      className={`card-compact group relative ${isSelected ? 'selected' : ''} ${getAnimationClass('hover:scale-105', '')}`}
      style={{
        animation: `fadeInUpFast 0.2s ease-out ${index * 0.03}s backwards`
      }}
    >
      {/* Icon Container */}
      <div className="w-full h-full relative p-2 flex flex-col items-center justify-center">
        {/* Background Glow (when selected or running) */}
        {(isSelected || isRunning) && (
          <div className={`absolute inset-0 bg-nebula-500/10 blur-xl transition-opacity duration-300 ${isRunning ? 'opacity-100' : 'opacity-40'}`} />
        )}

        {/* The Icon */}
        <div className="relative z-10 w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center bg-dark-700/50 glass-border">
          {modpack.logo ? (
            <img
              src={modpack.logo}
              alt={modpack.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0yNCAyNEg0MFY0MEgyNFYyNFoiIGZpbGw9IiM2Mzc1ODMiLz4KPC9zdmc+';
              }}
            />
          ) : (
            <div className="text-3xl font-bold text-white/20">
              {modpack.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Running Overlay */}
          {isRunning && (
            <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
            </div>
          )}
          
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-nebula-400 animate-spin" />
            </div>
          )}
        </div>

        {/* Name Label */}
        <span className={`mt-2 text-xs font-medium text-center truncate w-full px-1 transition-colors duration-200 ${isSelected ? 'text-nebula-300' : 'text-dark-300 group-hover:text-white'}`}>
          {modpack.name}
        </span>

        {/* Error Badge */}
        {hasError && (
          <div className="absolute top-1 right-1 bg-red-500 rounded-full p-0.5 shadow-lg">
            <AlertTriangle className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Hover Action Overlay (Quick Play) */}
      {!isLoading && !isRunning && !isSelected && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="bg-nebula-600/80 rounded-full p-2 translate-y-2 group-hover:translate-y-0 transition-transform duration-200 shadow-xl backdrop-blur-sm">
            <Play className="w-5 h-5 text-white fill-current" />
          </div>
        </div>
      )}
    </div>
  );
});

CompactModpackCard.displayName = 'CompactModpackCard';

export default CompactModpackCard;

