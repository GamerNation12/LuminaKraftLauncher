import React, { useState, useEffect } from 'react';
import { User as UserIcon, LogOut, LogIn, WifiOff, Gamepad2, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { UserSettings } from '../../types/launcher';
import AuthService from '../../services/authService';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabaseClient';
import { ModpackManagementService } from '../../services/modpackManagementService';

interface MinecraftAccountDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLDivElement>;
  userSettings: UserSettings;
  onUpdateSettings: (_settings: UserSettings) => void;
  onNavigateToAccount?: () => void;
}

const MinecraftAccountDropdown: React.FC<MinecraftAccountDropdownProps> = ({
  isOpen,
  onClose,
  anchorRef,
  userSettings,
  onUpdateSettings,
  onNavigateToAccount,
}) => {
  const { t } = useTranslation();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [offlineUsername, setOfflineUsername] = useState(userSettings.username || 'Player');
  const [luminaKraftUser, setLuminaKraftUser] = useState<any>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node) &&
        !(event.target as Element).closest('.minecraft-account-dropdown')
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  // Listen for LuminaKraft profile updates
  useEffect(() => {
    const loadLuminaKraftUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setLuminaKraftUser(user);
      } catch (error) {
        console.error('Error loading LuminaKraft user:', error);
      }
    };

    // Load initial state
    loadLuminaKraftUser();

    // Listen for profile updates
    const handleProfileUpdate = () => {
      loadLuminaKraftUser();
    };

    window.addEventListener('luminakraft:profile-updated', handleProfileUpdate);

    return () => {
      window.removeEventListener('luminakraft:profile-updated', handleProfileUpdate);
    };
  }, []);

  // Initialize offline username from settings if not in Microsoft mode
  useEffect(() => {
    if (userSettings.authMethod !== 'microsoft') {
      setOfflineUsername(userSettings.username);
    }
  }, [userSettings]);

  if (!isOpen || !anchorRef.current) return null;

  const rect = anchorRef.current.getBoundingClientRect();
  // Position the dropdown ABOVE the player section if it's at the bottom of the sidebar
  // or adjust based on your layout. Assuming sidebar is full height and player is at top:
  // The Sidebar.tsx shows player section at the TOP. So dropdown should be BELOW.
  const style: React.CSSProperties = {
    position: 'absolute',
    top: rect.bottom + 8,
    left: rect.left,
    zIndex: 1000,
  };

  const handleMicrosoftLogin = async () => {
    setIsAuthenticating(true);
    try {
      const authService = AuthService.getInstance();
      const account = await authService.authenticateWithMicrosoftModal();

      // Update ModpackManagementService with Microsoft account
      ModpackManagementService.getInstance().setMicrosoftAccount(account);

      const newSettings = {
        ...userSettings,
        authMethod: 'microsoft' as const,
        microsoftAccount: account,
        username: account.username
      };
      onUpdateSettings(newSettings);
      toast.success(t('toast.login'));
      onClose();
    } catch (error: any) {
      console.error('Microsoft login failed:', error);
      toast.error(error.message || t('errors.failedLogin'));
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSwitchToOffline = () => {
    // Restore previous username or default
    const newSettings = {
      ...userSettings,
      authMethod: 'offline' as const,
      microsoftAccount: undefined,
      username: offlineUsername || 'Player'
    };
    onUpdateSettings(newSettings);
    toast.success(t('toast.offlineMode'));
  };

  const handleSaveOfflineUsername = () => {
    if (!offlineUsername.trim()) {
      toast.error(t('validation.usernameEmpty'));
      return;
    }

    const newSettings = {
      ...userSettings,
      username: offlineUsername.trim()
    };
    onUpdateSettings(newSettings);
    toast.success(t('toast.usernameUpdated'));
  };

  const isMicrosoft = userSettings.authMethod === 'microsoft' && userSettings.microsoftAccount;

  return (
    <div
      className="minecraft-account-dropdown w-80 bg-white/[0.01] backdrop-blur-3xl border border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 z-[1001]"
      style={style}
    >
      <div className="p-6 border-b border-white/5 bg-white/[0.02]">
        <h3 className="text-[10px] font-black text-nebula-400 uppercase tracking-[0.2em] italic mb-1">{t('auth.microsoftAccount')}</h3>
        <p className="text-[10px] text-dark-500 font-bold uppercase italic tracking-wider opacity-60">{t('auth.minecraftAccountDesc')}</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Current Status */}
        <div className={`p-4 rounded-2xl border transition-all duration-300 ${isMicrosoft ? 'bg-nebula-500/10 border-nebula-500/30 shadow-lg shadow-nebula-500/5' : 'bg-white/5 border-white/10'}`}>
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 ${isMicrosoft ? 'bg-nebula-500/20 text-nebula-400 shadow-[0_0_15px_rgba(139,92,246,0.2)]' : 'bg-white/5 text-dark-500'}`}>
              {isMicrosoft ? <Gamepad2 className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
            </div>
            <div className="min-w-0 flex-1">
              {isMicrosoft ? (
                <p className="text-white font-black uppercase italic tracking-tighter truncate text-lg leading-[0.9]">
                  {userSettings.microsoftAccount?.username}
                </p>
              ) : (
                <>
                  <p className="text-white font-black uppercase italic tracking-tighter text-lg leading-[0.9]">{t('auth.offlineMode')}</p>
                  <p className="text-[10px] text-dark-500 font-bold uppercase italic tracking-[0.1em] truncate opacity-60">{userSettings.username}</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {!isMicrosoft ? (
          <div className="space-y-4">
            {/* Offline Username Editor */}
            <div>
              <label className="block text-[9px] font-black text-dark-500 uppercase tracking-[0.2em] italic mb-2 ml-1">{t('settings.username')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={offlineUsername}
                  onChange={(e) => setOfflineUsername(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-dark-600 focus:ring-2 focus:ring-nebula-500/30 outline-none font-bold italic uppercase tracking-wider transition-all"
                  placeholder={t('settings.usernamePlaceholder')}
                />
                <button
                  onClick={handleSaveOfflineUsername}
                  className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase italic rounded-xl border border-white/5 transition-all active:scale-95"
                >
                  {t('app.save')}
                </button>
              </div>
            </div>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center text-[8px] font-black tracking-[0.3em] italic">
                <span className="px-3 bg-transparent text-dark-600">OR_REACH_STARS</span>
              </div>
            </div>

            <button
              onClick={handleMicrosoftLogin}
              disabled={isAuthenticating}
              className="w-full h-14 bg-nebula-500 hover:bg-nebula-400 text-white flex items-center justify-center gap-3 rounded-2xl shadow-lg shadow-nebula-500/30 transition-all duration-300 disabled:opacity-40 active:scale-95 group/ms-btn"
            >
              {isAuthenticating ? (
                <span className="animate-pulse font-black uppercase italic text-xs tracking-widest">{t('auth.signing')}</span>
              ) : (
                <>
                  <svg className="w-5 h-5 transition-transform duration-500 group-hover/ms-btn:rotate-12" viewBox="0 0 21 21" fill="currentColor">
                    <path d="M0 0h10v10H0V0zm11 0h10v10H11V0zM0 11h10v10H0V11zm11 0h10v10H11V11z" />
                  </svg>
                  <span className="font-black uppercase italic text-xs tracking-widest">{t('auth.signInMicrosoft')}</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-dark-500 font-bold italic uppercase tracking-tighter opacity-40">
              {t('auth.microsoftDescription')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={handleSwitchToOffline}
              className="w-full h-14 bg-white/5 hover:bg-red-500/10 text-dark-400 hover:text-red-500 border border-white/5 hover:border-red-500/20 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 active:scale-95 group/off-btn"
            >
              <LogOut className="w-5 h-5 transition-transform duration-500 group-hover/off-btn:-translate-x-1" />
              <span className="font-black uppercase italic text-xs tracking-widest">{t('auth.offlineMode')}</span>
            </button>
            <p className="text-[10px] text-center text-dark-500 font-bold italic uppercase tracking-tighter opacity-40">
              {t('auth.offlineModeDescription')}
            </p>
          </div>
        )}

        {/* LuminaKraft Account Section */}
        <div className="pt-6 border-t border-white/5">
          <div className="flex items-center justify-between mb-4 px-1">
            <h4 className="text-[10px] font-black text-dark-500 uppercase tracking-[0.2em] italic">NEBULA_PROFILE</h4>
          </div>
          {luminaKraftUser ? (
            <div className="flex items-center justify-between p-4 bg-nebula-500/5 border border-nebula-500/20 rounded-2xl group/profile">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-nebula-500/10 flex items-center justify-center text-nebula-400 shadow-inner">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs text-white font-black uppercase italic tracking-tighter truncate block">{luminaKraftUser.user_metadata?.display_name || luminaKraftUser.email}</span>
                  <span className="text-[8px] text-nebula-400/60 font-black uppercase tracking-widest">AUTHENTICATED</span>
                </div>
              </div>
              <button
                onClick={() => {
                  onNavigateToAccount?.();
                  onClose();
                }}
                className="w-10 h-10 flex items-center justify-center text-dark-500 hover:text-nebula-400 bg-white/5 hover:bg-white/10 rounded-xl transition-all active:scale-90"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                onNavigateToAccount?.();
                onClose();
              }}
              className="w-full h-14 bg-white/5 hover:bg-nebula-500/10 text-dark-500 hover:text-nebula-400 border border-white/10 hover:border-nebula-500/30 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 active:scale-95"
            >
              <LogIn className="w-5 h-5" />
              <span className="font-black uppercase italic text-xs tracking-widest">CONNECT_PROFILE</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MinecraftAccountDropdown;

