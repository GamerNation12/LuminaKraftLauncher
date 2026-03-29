import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { User, Trash2, Shield, Globe, ExternalLink, Mail, Lock, ChevronRight, LogOut, Disc } from 'lucide-react';
import AuthService from '../../services/authService';
import ProfileEditor from '../Settings/ProfileEditor';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import { LoadingModal } from '../Common/LoadingModal';
import type { DiscordAccount } from '../../types/launcher';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabaseClient';
import { useAnimation } from '../../contexts/AnimationContext';

const AccountPage: React.FC = () => {
  const { t } = useTranslation();
  const { getAnimationStyle } = useAnimation();
  const [luminaKraftUser, setLuminaKraftUser] = useState<any>(null);
  const [discordAccount, setDiscordAccount] = useState<DiscordAccount | null>(null);
  const [linkedProviders, setLinkedProviders] = useState<{ provider: string; email?: string; id: string }[]>([]);
  const [isLoadingLuminaKraft, setIsLoadingLuminaKraft] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const hasLoadedUserRef = React.useRef(false);

  const canUnlink = (luminaKraftUser?.identities?.length || 0) > 1;

  // Load LuminaKraft account session and listen for changes
  useEffect(() => {

    const setupAuth = async () => {
      try {

        const fetchUserWithProfile = async (existingUser: any = null) => {
          let user = existingUser;

          if (!user) {
            // Use Promise.race to timeout getUser() if it takes too long
            const getUserPromise = supabase.auth.getUser();
            const timeoutPromise = new Promise<{ data: { user: null } }>((resolve) =>
              setTimeout(() => {
                resolve({ data: { user: null } });
              }, 3000)
            );
            const { data: { user: fetchedUser } } = await Promise.race([getUserPromise, timeoutPromise]);
            user = fetchedUser;
          }

          if (!user) {
            return { user: null, discord: null, providers: [] };
          }

          // CRITICAL: Clone user object to ensure React detects state change
          user = JSON.parse(JSON.stringify(user));

          // Helper to timeout promises
          // Note: <T,> syntax is required in TSX files
          const timeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
            return Promise.race([
              promise,
              new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
            ]);
          };

          // Parallelize fetches
          const authService = AuthService.getInstance();

          const [discord, providers, profileData]: [any, any, any] = await Promise.all([
            // 1. Discord Account - 3s timeout safe
            timeout(authService.getDiscordAccount(), 3000, null),
            // 2. Linked Providers - 3s timeout
            timeout(authService.getLinkedProviders(), 3000, []),
            // 3. Public Profile
            (async () => {
              try {
                const profilePromise = supabase
                  .from('users')
                  .select('display_name, avatar_url')
                  .eq('id', user.id)
                  .single();
                const { data } = await timeout(profilePromise as any, 3000, { data: null } as any);
                return data;
              } catch { return null; }
            })()
          ]);

          let dbDisplayName = null;

          // 1. Prioritize DB Profile Data
          if (profileData) {
            dbDisplayName = (profileData as any).display_name;
            user.user_metadata = {
              ...user.user_metadata,
              display_name: dbDisplayName || user.user_metadata.display_name, // Only overwrite if DB has value
              avatar_url: (profileData as any).avatar_url || user.user_metadata.avatar_url,
              full_name: dbDisplayName || user.user_metadata.full_name
            };
          }

          // 2. Fallback logic: Only override if we DON'T have a valid display_name from DB or current metadata
          const currentName = user.user_metadata.display_name;
          const isGenericOrEmpty = !currentName || currentName === 'User';

          // Only apply fallback if we really need it (empty or "User") AND we didn't just get a valid one from DB
          if (isGenericOrEmpty) {
            let betterName = discord?.global_name || discord?.username;
            let betterAvatar = null;

            if (!betterName) {
              const targetIdentity = user.identities?.find((id: any) => id.provider === 'discord' || id.provider === 'google' || id.provider === 'azure') || user.identities?.[0];

              if (targetIdentity?.identity_data) {
                const data = targetIdentity.identity_data;
                betterName = data.global_name || data.full_name || data.name || data.user_name || data.display_name;
                betterAvatar = data.avatar_url || data.picture || data.avatar;
              }
            }

            if (betterName) {
              user.user_metadata = {
                ...user.user_metadata,
                display_name: betterName,
                full_name: betterName, // Sync full_name too
                avatar_url: user.user_metadata.avatar_url || betterAvatar
              };
            }
          }

          return { user, discord, providers };
        };

        const { user: initialUser, discord: initialDiscord, providers: initialProviders } = await fetchUserWithProfile();

        setLuminaKraftUser(initialUser);
        setDiscordAccount(initialDiscord);
        setLinkedProviders(initialProviders);

        if (initialUser) hasLoadedUserRef.current = true;
        setIsLoadingLuminaKraft(false);

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            // IGNORE TOKEN_REFRESHED to prevent flicker. 
            if (event === 'TOKEN_REFRESHED') {
              return;
            }

            if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
              // Only show loader if we haven't loaded a user yet
              if (!hasLoadedUserRef.current) {
                setIsLoadingLuminaKraft(true);
              }

              const currentUser = session?.user;

              const { user: updatedUser, discord: updatedDiscord, providers: updatedProviders } =
                await fetchUserWithProfile(currentUser);

              if (updatedUser) {
                setLuminaKraftUser(updatedUser);
                hasLoadedUserRef.current = true;

                // Persistence logic: Only update if valid, or if we are sure it's gone.
                // If update fetch failed (null) but user has identity, keep old one?
                // Actually, fetchUserWithProfile returns null discord if timeout.
                // If we have a user identity for discord, but discord obj is null, implies fetch error/timeout.
                // In that case, DO NOT clear the existing discord state.

                const hasDiscordIdentity = updatedUser.identities?.some((id: any) => id.provider === 'discord');

                if (updatedDiscord) {
                  setDiscordAccount(updatedDiscord);
                } else if (!hasDiscordIdentity) {
                  // Only clear if user genuinely doesn't have discord linked anymore
                  setDiscordAccount(null);
                }
                // If hashDiscordIdentity is true but updatedDiscord is null (timeout), we Keep existing state (do nothing)

                if (updatedProviders && updatedProviders.length > 0) {
                  setLinkedProviders(updatedProviders);
                }
                // For providers, it's harder to check "hasIdentity" for all, but same principle applies.
                // If empty list mainly due to timeout?
                // Safest: always update providers if NOT empty. If empty, check if we timed out?
                // For now, let's assume empty list is valid unlinking unless it was timeout.
                // But we don't know if it was timeout returned from fetchUserWithProfile easily without flag.
                // Simplification: If we have an authenticated user, we trust the providers list unless it's empty AND we had ones before?
                // Let's stick to standard behavior for providers for now, usually it loads fast.
                if (updatedProviders && updatedProviders.length === 0 && (linkedProviders.length > 0)) {
                  // Only clear if we really think it's unlinked. 
                  // Without clearer signal, we might just accept the clear.
                  // But for Discord specifically (the icon), the logic above handles it.
                } else {
                  setLinkedProviders(updatedProviders);
                }

              } else {
                // Update failed or user null?
              }

              setIsLoadingLuminaKraft(false);
              setIsSigningIn(false);
            } else if (event === 'SIGNED_OUT') {
              setLuminaKraftUser(null);
              hasLoadedUserRef.current = false;
              setDiscordAccount(null);
              setLinkedProviders([]);
              setIsSigningIn(false);
            }
          }
        );

        // Listen for custom profile update events (triggered by authService after sync)
        const handleProfileUpdateEvent = async () => {
          try {
            // Update silently without showing loader
            // setIsLoadingLuminaKraft(true); // Commented out to prevent flicker

            // Try to get cached session first to avoid network calls/timeouts
            const { data: { session } } = await supabase.auth.getSession();
            const currentUser = session?.user;

            const { user: updatedUser, discord: updatedDiscord, providers: updatedProviders } =
              await fetchUserWithProfile(currentUser);

            if (updatedUser) {
              setLuminaKraftUser(updatedUser);
              // Also update hasLoadedUserRef to ensure subsequent auth events don't trigger loader
              hasLoadedUserRef.current = true;

              // CRITICAL FIX: Also update linked accounts (Discord, Providers)
              if (updatedDiscord) {
                setDiscordAccount(updatedDiscord);
              }

              if (updatedProviders) {
                setLinkedProviders(updatedProviders);
              }
            }

            // setIsLoadingLuminaKraft(false);
          } catch (error) {
            console.error('Error updating user from profile event:', error);
            // setIsLoadingLuminaKraft(false);
          }
        };
        window.addEventListener('luminakraft:profile-updated', handleProfileUpdateEvent);

        // Cleanup subscription on unmount
        return () => {
          subscription.unsubscribe();
          window.removeEventListener('luminakraft:profile-updated', handleProfileUpdateEvent);
        };
      } catch (error) {
        console.error('Error loading LuminaKraft session:', error);
        setIsLoadingLuminaKraft(false);
      }
    };

    const cleanup = setupAuth();
    return () => {
      cleanup?.then(fn => fn && fn());
    };
  }, []);

  const handleSignInToLuminaKraft = async () => {
    setIsSigningIn(true);
    const authService = AuthService.getInstance();
    await authService.signInToLuminaKraftAccount();
  };

  const handleSignUpToLuminaKraft = async () => {
    setIsSigningIn(true);
    const authService = AuthService.getInstance();
    await authService.signUpLuminaKraftAccount();
  };

  const handleSignOutFromLuminaKraft = async () => {
    setShowSignOutConfirm(true);
  };

  const performSignOut = async () => {
    try {
      const authService = AuthService.getInstance();
      await authService.signOutSupabase();
      // Force state update to ensure UI reflects sign out immediately
      setLuminaKraftUser(null);
      setDiscordAccount(null);
      setLinkedProviders([]);
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
    }
  };

  const handleProfileUpdate = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setLuminaKraftUser(user);
  };

  const handleLinkDiscord = async () => {
    setIsSigningIn(true);
    const authService = AuthService.getInstance();
    await authService.linkDiscordAccount();
  };

  const handleLinkProvider = async (provider: 'github' | 'google' | 'azure') => {
    setIsSigningIn(true);
    const authService = AuthService.getInstance();
    await authService.linkProvider(provider);
  };

  const handleUnlinkProvider = async (provider: 'github' | 'google' | 'azure' | 'discord') => {
    if (!canUnlink) {
      toast.error(t('auth.cannotUnlinkOnlyProvider') || 'Cannot unlink your only provider');
      return;
    }

    const authService = AuthService.getInstance();
    const success = await authService.unlinkProvider(provider);

    if (success) {
      toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} account unlinked`);
      // Reload providers after unlinking
      const providers = await authService.getLinkedProviders();
      setLinkedProviders(providers);
      if (provider === 'discord') {
        setDiscordAccount(null);
      }
    } else {
      toast.error(`Failed to unlink ${provider} account`);
    }
  };

  const handleDeleteAccount = () => {
    setShowDeleteConfirm(true);
  };

  const performDeleteAccount = async () => {
    try {
      const authService = AuthService.getInstance();
      const success = await authService.deleteAccount();

      if (success) {
        toast.success('Account deleted successfully');
        setLuminaKraftUser(null);
      } else {
        toast.error('Failed to delete account');
      }
    } catch (error) {
      console.error('Delete account error:', error);
      toast.error('Failed to delete account');
    }
  };

  if (isLoadingLuminaKraft) {
    return (
      <div className="p-10 max-w-5xl mx-auto w-full custom-scrollbar overflow-y-auto h-full">
        {/* Title skeleton */}
        <div className="h-10 w-48 bg-white/5 rounded-2xl animate-pulse mb-10 border border-white/5" />

        {/* Account card skeleton */}
        <div className="bg-white/[0.02] backdrop-blur-3xl rounded-[2.5rem] p-10 border border-white/5 shadow-2xl animate-pulse">
          {/* Header skeleton */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-white/5 rounded-2xl border border-white/5" />
            <div className="h-8 w-64 bg-white/5 rounded-2xl" />
          </div>

          {/* Profile section skeleton */}
          <div className="flex items-center gap-8 mb-10 p-8 bg-white/5 rounded-3xl border border-white/5">
            <div className="w-24 h-24 bg-white/5 rounded-full border-4 border-white/5" />
            <div className="flex-1 space-y-3">
              <div className="h-6 w-48 bg-white/5 rounded-xl" />
              <div className="h-4 w-64 bg-white/5 rounded-xl" />
            </div>
          </div>

          {/* Linked accounts skeleton */}
          <div className="h-4 w-32 bg-white/5 rounded-full mb-6 mx-2" />
          <div className="space-y-4">
            <div className="h-20 bg-white/5 rounded-3xl border border-white/5" />
            <div className="h-20 bg-white/5 rounded-3xl border border-white/5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-5xl mx-auto w-full h-full custom-scrollbar overflow-y-auto">
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={performDeleteAccount}
        title={t('settings.deleteAccount')}
        message={t('auth.confirmDeleteAccount')}
        confirmText={t('settings.deleteAccount')}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={performSignOut}
        title={t('auth.signOut')}
        message={t('auth.confirmSignOut')}
        confirmText={t('auth.signOut')}
      />

      <div className="mb-12" style={getAnimationStyle({})}>
        <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-3">COMMAND_ACCOUNT</h1>
        <p className="text-dark-500 font-black text-[10px] uppercase tracking-[0.2em] italic px-1 opacity-60">
          NEBULA_DEEP_SPACE_IDENTITY_MANAGEMENT
        </p>
      </div>

      {/* Nebula Account Section */}
      <div
        className="bg-white/[0.02] backdrop-blur-3xl rounded-[2.5rem] p-10 border border-white/5 shadow-2xl transition-all duration-300 hover:border-nebula-500/10 mb-10"
        style={getAnimationStyle({})}
      >
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-nebula-500/10 rounded-2xl border border-nebula-500/20">
            <User className="w-6 h-6 text-nebula-400" />
          </div>
          <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">NEBULA_IDENTITY</h2>
        </div>

        {isLoadingLuminaKraft ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white/5 rounded-3xl border border-white/5 animate-pulse">
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-white/5"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-nebula-500 animate-spin"></div>
            </div>
            <p className="text-dark-500 font-black text-[10px] uppercase italic tracking-[0.2em]">{t('common.loading')}</p>
          </div>
        ) : luminaKraftUser ? (
          <>
            <ProfileEditor
              luminaKraftUser={luminaKraftUser}
              discordAccount={discordAccount || null}
              onUpdate={handleProfileUpdate}
            />

            <div className="mt-12">
              <div className="flex items-center gap-4 mb-6 px-1">
                <Shield className="w-4 h-4 text-nebula-400" />
                <h3 className="text-[10px] font-black text-dark-500 uppercase tracking-[0.2em] italic">{t('settings.linkedAccounts')}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Discord */}
                {discordAccount ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/5 shadow-inner group transition-all hover:bg-white/10">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-[#5865F2] flex items-center justify-center shadow-lg shadow-[#5865F2]/20 rotate-3 group-hover:rotate-0 transition-transform">
                          <Disc className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-black text-white italic tracking-tighter">DISCORD</p>
                          <p className="text-[10px] text-dark-500 font-bold uppercase tracking-widest">{discordAccount.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {discordAccount.isMember ? (
                          <div className="p-2 bg-nebula-500/10 border border-nebula-500/20 rounded-xl">
                            <Shield className="w-4 h-4 text-nebula-400" />
                          </div>
                        ) : (
                          <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                            <Lock className="w-4 h-4 text-yellow-400" />
                          </div>
                        )}
                        <button
                          onClick={() => handleUnlinkProvider('discord')}
                          disabled={!canUnlink}
                          className={`p-3 rounded-xl transition-all ${canUnlink
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95'
                            : 'bg-white/5 text-dark-500 opacity-20 cursor-not-allowed'
                            }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {/* Join Discord Server button for non-members */}
                    {!discordAccount.isMember && (
                      <button
                        onClick={async () => {
                          try {
                            await invoke('open_url', { url: 'https://discord.gg/UJZRrcUFMj' });
                          } catch (error) {
                            console.warn('Tauri command not available, using fallback:', error);
                            window.open('https://discord.gg/UJZRrcUFMj', '_blank', 'noopener,noreferrer');
                          }
                        }}
                        className="w-full px-6 py-4 bg-[#5865F2] hover:bg-[#4752C4] rounded-2xl transition-all shadow-xl shadow-[#5865F2]/20 flex items-center justify-between group active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-4">
                          <Globe className="w-5 h-5 text-white/80 group-hover:animate-pulse" />
                          <span className="text-white font-black text-xs uppercase italic tracking-widest">{t('auth.joinDiscordServer')}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-lg">
                          <span className="text-[10px] text-white font-black italic">50x_SYNC</span>
                        </div>
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handleLinkDiscord}
                    className="w-full p-6 border-2 border-dashed border-white/5 rounded-[2rem] hover:border-nebula-500/30 hover:bg-nebula-500/5 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 group-hover:bg-[#5865F2]/20 flex items-center justify-center transition-all">
                        <Disc className="w-6 h-6 text-dark-500 group-hover:text-[#5865F2]" />
                      </div>
                      <span className="text-dark-500 group-hover:text-white transition-colors font-black text-xs uppercase italic tracking-widest">CONNECT_DISCORD</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-dark-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </button>
                )}

                {/* GitHub */}
                {linkedProviders.find(p => p.provider === 'github') ? (
                  <div className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/5 shadow-inner group transition-all hover:bg-white/10">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center border border-white/10 shadow-lg shadow-black/20 group-hover:rotate-3 transition-transform">
                        <Mail className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-black text-white italic tracking-tighter">GITHUB</p>
                        <p className="text-[10px] text-dark-500 font-bold uppercase tracking-widest">{linkedProviders.find(p => p.provider === 'github')?.email || 'Connected'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnlinkProvider('github')}
                      disabled={!canUnlink}
                      className={`p-3 rounded-xl transition-all ${canUnlink
                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95'
                        : 'bg-white/5 text-dark-500 opacity-20 cursor-not-allowed'
                        }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleLinkProvider('github')}
                    className="w-full p-6 border-2 border-dashed border-white/5 rounded-[2rem] hover:border-nebula-500/30 hover:bg-nebula-500/5 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 group-hover:bg-black/20 flex items-center justify-center transition-all">
                        <Mail className="w-6 h-6 text-dark-500 group-hover:text-white" />
                      </div>
                      <span className="text-dark-500 group-hover:text-white transition-colors font-black text-xs uppercase italic tracking-widest">CONNECT_GITHUB</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-dark-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </button>
                )}

                {/* Google */}
                {linkedProviders.find(p => p.provider === 'google') ? (
                  <div className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/5 shadow-inner group transition-all hover:bg-white/10">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-white/5 group-hover:-rotate-3 transition-transform">
                        <ExternalLink className="w-6 h-6 text-[#4285F4]" />
                      </div>
                      <div>
                        <p className="font-black text-white italic tracking-tighter">GOOGLE</p>
                        <p className="text-[10px] text-dark-500 font-bold uppercase tracking-widest">{linkedProviders.find(p => p.provider === 'google')?.email || 'Connected'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnlinkProvider('google')}
                      disabled={!canUnlink}
                      className={`p-3 rounded-xl transition-all ${canUnlink
                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95'
                        : 'bg-white/5 text-dark-500 opacity-20 cursor-not-allowed'
                        }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleLinkProvider('google')}
                    className="w-full p-6 border-2 border-dashed border-white/5 rounded-[2rem] hover:border-nebula-500/30 hover:bg-nebula-500/5 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 group-hover:bg-white/10 flex items-center justify-center transition-all">
                        <ExternalLink className="w-6 h-6 text-dark-500 group-hover:text-[#4285F4]" />
                      </div>
                      <span className="text-dark-500 group-hover:text-white transition-colors font-black text-xs uppercase italic tracking-widest">CONNECT_GOOGLE</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-dark-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </button>
                )}

                {/* Microsoft/Azure */}
                {linkedProviders.find(p => p.provider === 'azure') ? (
                  <div className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/5 shadow-inner group transition-all hover:bg-white/10">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-[#00A4EF] flex items-center justify-center shadow-lg shadow-[#00A4EF]/20 group-hover:rotate-6 transition-transform">
                        <Lock className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-black text-white italic tracking-tighter">MICROSOFT</p>
                        <p className="text-[10px] text-dark-500 font-bold uppercase tracking-widest">{linkedProviders.find(p => p.provider === 'azure')?.email || 'Connected'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnlinkProvider('azure')}
                      disabled={!canUnlink}
                      className={`p-3 rounded-xl transition-all ${canUnlink
                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95'
                        : 'bg-white/5 text-dark-500 opacity-20 cursor-not-allowed'
                        }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleLinkProvider('azure')}
                    className="w-full p-6 border-2 border-dashed border-white/5 rounded-[2rem] hover:border-nebula-500/30 hover:bg-nebula-500/5 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 group-hover:bg-[#00A4EF]/20 flex items-center justify-center transition-all">
                        <Lock className="w-6 h-6 text-dark-500 group-hover:text-[#00A4EF]" />
                      </div>
                      <span className="text-dark-300 group-hover:text-white transition-colors font-black text-xs uppercase italic tracking-widest">CONNECT_MICROSOFT</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-dark-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-16 pt-10 border-t border-white/5">
              <div className="flex flex-col md:flex-row gap-6">
                <button
                  onClick={handleSignOutFromLuminaKraft}
                  className="flex-1 px-8 py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-xs uppercase italic tracking-widest transition-all border border-white/5 flex items-center justify-center gap-3 group active:scale-[0.98]"
                >
                  <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-all" />
                  {t('auth.signOut')}
                </button>

                <div className="flex-1 bg-red-500/5 rounded-[2rem] p-8 border border-red-500/10 relative overflow-hidden group/danger">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Trash2 className="w-16 h-16 text-red-500" />
                  </div>
                  <h3 className="text-[10px] font-black text-red-500/70 uppercase tracking-[0.2em] italic mb-4">{t('settings.dangerZone')}</h3>
                  <button
                    onClick={handleDeleteAccount}
                    className="text-xs font-black text-red-400 hover:text-red-300 uppercase italic tracking-widest transition-all flex items-center gap-3"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t('settings.deleteAccount')}</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-16 bg-white/5 rounded-[3rem] border border-white/5 shadow-inner">
            <div className="w-24 h-24 bg-nebula-500/10 rounded-[2rem] flex items-center justify-center mb-8 border border-nebula-500/20 shadow-2xl shadow-nebula-500/10">
              <User className="w-10 h-10 text-nebula-400" />
            </div>
            <h3 className="text-3xl font-black text-white italic tracking-tighter mb-4">{t('settings.accountAccess')}</h3>
            <p className="text-dark-500 text-center mb-10 max-w-sm font-medium italic leading-relaxed">
              {t('settings.luminakraftAccountHelp')}
            </p>
            <div className="flex gap-6 w-full max-w-md">
              <button
                onClick={handleSignInToLuminaKraft}
                className="flex-1 px-8 py-5 bg-nebula-500 hover:bg-nebula-600 text-white rounded-2xl font-black text-xs uppercase italic tracking-widest transition-all shadow-xl shadow-nebula-500/20 active:scale-95"
              >
                {t('auth.signIn')}
              </button>
              <button
                onClick={handleSignUpToLuminaKraft}
                className="flex-1 px-8 py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-xs uppercase italic tracking-widest transition-all border border-white/5 active:scale-95"
              >
                {t('auth.signUp')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Loading Modal */}
      <LoadingModal
        isOpen={isSigningIn}
        message={t('auth.authenticating')}
        submessage={t('auth.pleaseWaitAuth')}
        onCancel={() => {
          invoke('stop_oauth_server').catch(console.error);
          setIsSigningIn(false);
        }}
      />
    </div>
  );
};

export default AccountPage;
