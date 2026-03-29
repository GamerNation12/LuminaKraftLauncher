import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield } from 'lucide-react';
import { useAnimation } from '../../../contexts/AnimationContext';
import type { Modpack } from '../../../types/launcher';

interface ModpackRequirementsProps {
  modpack: Modpack;
}

const ModpackRequirements: React.FC<ModpackRequirementsProps> = ({ modpack }) => {
  const { t } = useTranslation();
  const { getAnimationStyle } = useAnimation();

  // Convert MB to GB for display
  const recommendedRamGB = modpack.recommendedRam
    ? (modpack.recommendedRam / 1024).toFixed(1)
    : null;

  return (
    <div
      className="bg-white/[0.02] backdrop-blur-xl rounded-[2rem] p-8 border border-white/5 shadow-2xl transition-all duration-300 hover:border-nebula-500/20"
      style={{
        animation: 'fadeInUp 0.15s ease-out 0.1s backwards',
        ...getAnimationStyle({})
      }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-nebula-500/10 rounded-xl border border-nebula-500/20">
          <Shield className="w-5 h-5 text-nebula-400" />
        </div>
        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">{t('modpacks.requirements')}</h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <div className="text-[10px] font-black text-dark-500 uppercase tracking-widest italic mb-2 px-1">
            {t('modpacks.recommendedRAM')}
          </div>
          <div className="text-white bg-white/5 border border-white/5 px-4 py-3 rounded-2xl font-black text-lg italic tracking-tighter shadow-inner">
            {recommendedRamGB
              ? `${recommendedRamGB} GB`
              : t('modpacks.ramMinRecommended', { min: 4, recommended: 8 })
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModpackRequirements; 