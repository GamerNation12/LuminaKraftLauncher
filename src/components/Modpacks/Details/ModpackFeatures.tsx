import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Sparkles } from 'lucide-react';
import type { Feature } from '../../../types/launcher';
import { useAnimation } from '../../../contexts/AnimationContext';

interface ModpackFeaturesProps {
  features?: Feature[];
}

const ModpackFeatures: React.FC<ModpackFeaturesProps> = ({ features }) => {
  const { t } = useTranslation();
  const { getAnimationStyle } = useAnimation();
  const [expandedFeatures, setExpandedFeatures] = useState<string[]>([]);

  if (!features || features.length === 0) {
    return null;
  }

  const toggleFeature = (featureId: string) => {
    setExpandedFeatures(prev =>
      prev.includes(featureId)
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
  };

  return (
    <div
      className="relative overflow-hidden bg-white/[0.02] backdrop-blur-xl rounded-[2rem] p-8 border border-white/5 shadow-2xl transition-all duration-300 hover:border-nebula-500/20"
      style={{
        animation: 'fadeInUp 0.15s ease-out 0.1s backwards',
        ...getAnimationStyle({})
      }}
    >
      {/* Background glow effect */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-nebula-500/10 rounded-full blur-[80px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-nebula-500/10 rounded-2xl border border-nebula-500/20 shadow-xl shadow-nebula-500/5">
          <Sparkles className="w-6 h-6 text-nebula-400" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">{t('modpacks.features')}</h2>
        <span className="ml-auto px-3 py-1 bg-white/5 text-dark-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-white/5">
          {features.length} SYSTEMS
        </span>
      </div>

      {/* Features list */}
      <div className="space-y-4">
        {features.map((feature, index) => {
          const featureId = `feature-${index}`;
          const isExpanded = expandedFeatures.includes(featureId);
          const hasDescription = feature.description && feature.description.trim().length > 0;

          return (
            <div
              key={featureId}
              className={`group relative bg-white/[0.01] backdrop-blur-sm rounded-2xl border transition-all duration-300 ${isExpanded
                ? 'border-nebula-500/30 bg-white/[0.03] shadow-2xl'
                : 'border-white/5 hover:border-white/10 hover:bg-white/[0.02]'
                }`}
            >
              <div
                className={`flex items-center gap-5 p-5 ${hasDescription ? 'cursor-pointer' : ''}`}
                onClick={() => hasDescription && toggleFeature(featureId)}
              >
                {/* Number badge */}
                <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl font-black text-xs transition-all duration-300 italic tracking-tighter ${isExpanded
                  ? 'bg-nebula-500 text-white shadow-lg shadow-nebula-500/20'
                  : 'bg-white/5 text-dark-400 border border-white/5 group-hover:bg-nebula-500/10 group-hover:text-nebula-400 group-hover:border-nebula-500/20'
                  }`}>
                  {String(index + 1).padStart(2, '0')}
                </div>

                {/* Title */}
                <h3 className={`flex-1 font-black text-sm uppercase italic tracking-widest transition-colors duration-300 ${isExpanded ? 'text-nebula-400' : 'text-white'
                  }`}>
                  {feature.title}
                </h3>

                {/* Expand indicator */}
                {hasDescription && (
                  <ChevronDown
                    className={`w-5 h-5 transition-all duration-500 ${isExpanded
                      ? 'rotate-180 text-nebula-400'
                      : 'text-dark-500 group-hover:text-nebula-400 translate-y-0 group-hover:translate-y-1'
                      }`}
                  />
                )}
              </div>

              {/* Description (expandable) */}
              {hasDescription && (
                <div
                  className={`overflow-hidden transition-all duration-500 ease-out ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                >
                  <div className="px-5 pb-6 pt-0">
                    <div className="pl-14 border-l-2 border-nebula-500/20">
                      <p className="text-dark-400 font-medium leading-relaxed italic text-xs">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ModpackFeatures;
