import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, Settings, UploadCloud, Compass, Download, LayoutGrid } from 'lucide-react';
import { useLauncher } from '../../contexts/LauncherContext';
import PlayerHeadLoader from '../PlayerHeadLoader';
import { check } from '@tauri-apps/plugin-updater';
import MinecraftAccountDropdown from './AccountDropdown';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (_section: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeSection, onSectionChange }) => {
  const { t } = useTranslation();
  const { userSettings, updateUserSettings } = useLauncher(); // Added updateUserSettings
  const [hasUpdate, setHasUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string>('');

  // Minecraft Account Dropdown State
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const playerSectionRef = useRef<HTMLDivElement>(null);

  // Check for updates (respecting experimental updates setting)
  useEffect(() => {
    const checkUpdates = async () => {
      try {
        // Check if prereleases are enabled
        const enablePrereleases = userSettings?.enablePrereleases ?? false;

        const update = await check();
        if (update?.available) {
          const isPrerelease = update.version.includes('alpha') || update.version.includes('beta') || update.version.includes('rc');

          // Only show update notification if:
          // - It's a stable release, OR
          // - It's a prerelease AND experimental updates are enabled
          if (!isPrerelease || enablePrereleases) {
            setHasUpdate(true);
            setLatestVersion(update.version);
          }
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    };
    checkUpdates();
  }, [userSettings?.enablePrereleases]);

  // Version is automatically updated by release.js


  const menuItems = [
    {
      id: 'home',
      label: t('navigation.home'),
      icon: Home,
    },
    {
      id: 'my-modpacks',
      label: t('navigation.myModpacks'),
      icon: LayoutGrid,
    },
    {
      id: 'explore',
      label: t('navigation.explore'),
      icon: Compass,
    },
    {
      id: 'published-modpacks',
      label: t('navigation.publishedModpacks'),
      icon: UploadCloud,
    },
    {
      id: 'downloads',
      label: t('navigation.downloads'),
      icon: Download,
    },
    {
      id: 'settings',
      label: t('navigation.settings'),
      icon: Settings,
    }
  ];

  const handleAvatarClick = () => {
    setIsAccountDropdownOpen(!isAccountDropdownOpen);
  };

  return (
    <div
      className="w-20 bg-white/[0.01] backdrop-blur-3xl border-r border-white/5 flex flex-col transition-all duration-500 select-none relative z-50 shadow-2xl"
      style={{
        animation: 'fadeInLeft 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Minecraft Account Dropdown */}
      <MinecraftAccountDropdown
        isOpen={isAccountDropdownOpen}
        onClose={() => setIsAccountDropdownOpen(false)}
        anchorRef={playerSectionRef}
        userSettings={userSettings}
        onUpdateSettings={updateUserSettings}
        onNavigateToAccount={() => onSectionChange('account')}
      />

      {/* Header - Avatar Section */}
      <div ref={playerSectionRef} className="p-4 h-24 flex flex-col items-center justify-center border-b border-white/5">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-tr from-nebula-500 to-blue-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
          {userSettings.authMethod === 'microsoft' && userSettings.microsoftAccount ? (
            <div
              className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer relative z-10 ring-1 ring-white/10 hover:ring-nebula-500/50 transition-all duration-300 bg-white/5 shadow-2xl group-hover:scale-110 active:scale-95"
              role="button"
              tabIndex={0}
              onClick={handleAvatarClick}
            >
              <img
                src={`https://mc-heads.net/avatar/${userSettings.microsoftAccount.uuid}/48`}
                alt={`${userSettings.microsoftAccount.username}'s head`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('crafatar')) {
                    target.src = `https://crafatar.com/avatars/${userSettings.microsoftAccount!.uuid}?size=48&overlay`;
                  }
                }}
              />
              {/* Status Indicator */}
              <div className="absolute bottom-1 right-1 w-3 h-3 bg-nebula-500 border-2 border-dark-950 rounded-full animate-pulse shadow-[0_0_10px_rgba(139,92,246,0.5)]"></div>
            </div>
          ) : (
            /* Offline mode - show loader */
            <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer group relative z-10 bg-white/5 border border-white/10 shadow-2xl hover:scale-110 active:scale-95 transition-all" role="button" tabIndex={0} onClick={handleAvatarClick}>
              <div className="transition-all duration-300 group-hover:scale-105">
                <PlayerHeadLoader />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-8 flex flex-col items-center gap-6">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id ||
            (item.id === 'published-modpacks' && (activeSection === 'publish-modpack' || activeSection === 'edit-modpack'));

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-all duration-500 relative group/nav
                ${isActive 
                  ? 'bg-nebula-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.4)] scale-110' 
                  : 'text-dark-500 hover:text-white hover:bg-white/5 hover:translate-x-1'}`}
              style={{
                animation: `fadeInLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.05 + 0.1}s backwards`
              }}
            >
              <Icon className={`w-6 h-6 z-10 transition-transform duration-500 ${isActive ? 'scale-110' : 'group-hover/nav:scale-110'}`} />
              
              {/* Tooltip */}
              <div className="absolute left-20 bg-white/5 backdrop-blur-2xl border border-white/10 px-4 py-2 rounded-xl opacity-0 translate-x-[-10px] pointer-events-none group-hover/nav:opacity-100 group-hover/nav:translate-x-0 transition-all duration-300 whitespace-nowrap text-[10px] font-black uppercase italic tracking-[0.2em] z-50 shadow-2xl text-white">
                {item.label}
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-white/5 rotate-45 border-l border-b border-white/10"></div>
              </div>

              {/* Active Indicator */}
              {isActive && (
                <div className="absolute -left-3 w-1.5 h-8 bg-nebula-400 rounded-full shadow-[0_0_15px_rgba(139,92,246,0.8)] animate-pulse"></div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer - Branding */}
      <div className="p-4 flex flex-col items-center gap-4 border-t border-white/5 relative">
        <button 
          className="w-12 h-12 rounded-[1.25rem] bg-dark-800/50 backdrop-blur-xl flex items-center justify-center cursor-pointer group hover:shadow-[0_0_25px_rgba(139,92,246,0.3)] transition-all duration-500 hover:scale-110 active:scale-95 border border-white/10 hover:border-nebula-500/50 relative overflow-hidden"
          onClick={() => onSectionChange('about')}
          title={hasUpdate ? t('notifications.updateAvailable', { version: latestVersion }) : undefined}
        >
          <img 
            src="/nebula-logo.png" 
            alt="Nebula Logo" 
            className="w-8 h-8 object-contain transition-transform duration-500 group-hover:scale-110" 
          />
          
          <div className="absolute inset-0 bg-gradient-to-tr from-nebula-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          
          {/* Update Badge */}
          {hasUpdate && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-dark-950 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-bounce z-20">
              <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-75"></div>
            </div>
          )}

          {/* Subtle spinning glow on hover */}
          <div className="absolute inset-0 rounded-[1.25rem] bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-[spin_3s_linear_infinite]"></div>
        </button>
        
        {/* Version marker */}
        <span className="text-[8px] font-bold text-dark-500 uppercase tracking-widest opacity-40">V1.0.0</span>
      </div>
    </div>
  );
};

export default Sidebar;
