import React, { useState, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Play, RefreshCw, Wrench, AlertTriangle, Loader2, Globe, Trash2, FolderOpen, StopCircle, Clock, Settings, Info, User } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { Modpack, ModpackState, ProgressInfo } from '../../types/launcher';
import { useLauncher } from '../../contexts/LauncherContext';
import { useAnimation } from '../../contexts/AnimationContext';
import ConfirmDialog from '../ConfirmDialog';
import ProfileOptionsModal from './ProfileOptionsModal';
import LauncherService from '../../services/launcherService';
import { UnknownErrorModal } from '../UnknownErrorModal';

interface ModpackCardProps {
  modpack: Modpack;
  state: ModpackState & {
    progress?: ProgressInfo;
  };
  onSelect: () => void;
  index?: number;
  hideServerBadges?: boolean; // Hide category and status badges for local modpacks
  isReadOnly?: boolean; // Read-only mode: only show Install/Installed buttons (for Home/Explore)
  onNavigateToMyModpacks?: () => void; // Callback to navigate to My Modpacks after install
  onModpackUpdated?: (_updates: { name?: string; logo?: string; backgroundImage?: string }) => void; // Called when modpack is updated
}

const ModpackCard: React.FC<ModpackCardProps> = memo(({ modpack, state, onSelect, index = 0, hideServerBadges = false, isReadOnly = false, onNavigateToMyModpacks, onModpackUpdated }) => {
  const { t } = useTranslation();
  const { getAnimationClass, getAnimationStyle } = useAnimation();
  const { installModpack, updateModpack, launchModpack, repairModpack, removeModpack, stopInstance } = useLauncher();
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showProfileOptionsModal, setShowProfileOptionsModal] = useState(false);
  const [instanceMetadata, setInstanceMetadata] = useState<any>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);

  const getServerStatusBadge = () => {
    // Priority: New > Coming Soon (don't show Active if it's New or Coming Soon)
    if (modpack.isNew) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-green-500/10 text-green-400 border border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.3)] backdrop-blur-md">
          <div className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
          {t('modpacks.status.new')}
        </div>
      );
    }
    if (modpack.isComingSoon) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-nebula-500/10 text-nebula-400 border border-nebula-500/20 shadow-[0_0_20px_rgba(139,92,246,0.3)] backdrop-blur-md">
          <div className="w-1 h-1 rounded-full bg-nebula-400 animate-pulse" />
          {t('modpacks.status.coming_soon')}
        </div>
      );
    }
    // Only show Inactive badge if it's not active (hide Active badge by default)
    if (!modpack.isActive) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-white/5 text-dark-500 border border-white/5 backdrop-blur-md italic">
          {t('modpacks.status.inactive')}
        </div>
      );
    }
    return null; // Don't show badge for regular active modpacks
  };

  const requiresModpack = !!modpack.urlModpackZip;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const handleInstall = async () => {
    // Save full modpack data to localStorage so MyModpacksPage can use it during installation
    try {
      localStorage.setItem(`installing_modpack_${modpack.id}`, JSON.stringify({ ...modpack, isModrinth: true }));
    } catch (error) {
      console.error('Failed to save modpack to localStorage:', error);
    }
    return await installModpack(modpack.id);
  };

  const getButtonConfig = () => {
    const hasValidIp = modpack.ip && modpack.ip.trim() !== '';

    // Check if Coming Soon - disable downloads
    if (modpack.isComingSoon) {
      return {
        text: t('modpacks.comingSoon'),
        icon: Clock,
        onClick: () => { },
        className: 'btn-secondary',
        disabled: true
      };
    }

    // Read-only mode (Home/Explore): Show Install or Installed (disabled) only
    if (isReadOnly) {
      // Show installing/updating/reinstalling state
      if (['installing', 'updating', 'reinstalling'].includes(state.status)) {
        return {
          text: state.status === 'installing' ? t('modpacks.installing')
            : state.status === 'reinstalling' ? t('modpacks.reinstalling', 'Reinstalling...')
              : t('modpacks.updating'),
          icon: Loader2,
          onClick: () => { },
          className: 'bg-white/5 text-dark-500 border border-white/5',
          disabled: true
        };
      }

      if (['installed', 'outdated', 'error'].includes(state.status)) {
        // Show Repair for error state, Installed for others
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
          className: 'bg-white/5 text-dark-500 border border-white/5',
          disabled: true
        };
      }

      // Not installed in read-only mode: Show Install with navigation
      return {
        text: t('modpacks.install'),
        icon: Download,
        onClick: async () => {
          const started = await handleInstall();
          if (started && onNavigateToMyModpacks) {
            onNavigateToMyModpacks();
          }
        },
        className: 'bg-nebula-500 text-white shadow-lg shadow-nebula-500/20 border border-nebula-400/30',
        disabled: false
      };
    }

    // Full management mode (My Modpacks): Regular button logic
    switch (state.status) {
      case 'not_installed':
        return {
          text: t('modpacks.install'),
          icon: Download,
          onClick: () => handleInstall(),
          className: 'bg-nebula-500 text-white shadow-lg shadow-nebula-500/20 border border-nebula-400/30 font-black italic uppercase tracking-tighter',
          disabled: false
        };
      case 'installed':
        return {
          text: t('modpacks.play'),
          icon: Play,
          onClick: () => launchModpack(modpack.id),
          className: 'bg-nebula-500 text-white shadow-lg shadow-nebula-500/20 border border-nebula-400/30 font-black italic uppercase tracking-tighter',
          disabled: false
        };
      case 'outdated':
        return {
          text: t('modpacks.update'),
          icon: RefreshCw,
          onClick: () => updateModpack(modpack.id),
          className: 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 font-black italic uppercase tracking-tighter',
          disabled: false
        };
      case 'installing':
      case 'updating':
      case 'repairing':
      case 'reinstalling':
        return {
          text: state.status === 'installing' ? t('modpacks.installing')
            : state.status === 'updating' ? t('modpacks.updating')
              : state.status === 'reinstalling' ? t('modpacks.reinstalling', 'Reinstalling...')
                : t('modpacks.repairing'),
          icon: Loader2,
          onClick: () => { },
          className: 'bg-white/5 text-dark-500 border border-white/5 font-black italic uppercase tracking-tighter',
          disabled: true
        };
      case 'launching':
        return {
          text: t('modpacks.launching'),
          icon: Loader2,
          onClick: () => { },
          className: 'bg-nebula-500/20 text-nebula-400 border border-nebula-500/30 font-black italic uppercase tracking-tighter',
          disabled: true
        };
      case 'running':
        return {
          text: t('modpacks.stop'),
          icon: StopCircle,
          onClick: () => stopInstance(modpack.id),
          className: 'bg-red-500/20 text-red-400 border border-red-500/30 font-black italic uppercase tracking-tighter',
          disabled: false
        };
      case 'stopping':
        return {
          text: t('modpacks.stopping'),
          icon: Loader2,
          onClick: () => { },
          className: 'bg-red-500/10 text-red-500 border border-red-500/20 font-black italic uppercase tracking-tighter',
          disabled: true
        };
      case 'error':
        return {
          text: t('modpacks.repair'),
          icon: Wrench,
          onClick: () => repairModpack(modpack.id),
          className: 'bg-red-500/20 text-red-400 border border-red-500/30 font-black italic uppercase tracking-tighter',
          disabled: false
        };
      default:
        // Handle servers without modpack and without IP (not available)
        if (!requiresModpack && !hasValidIp) {
          return {
            text: t('modpacks.notAvailable'),
            icon: AlertTriangle,
            onClick: () => { },
            className: 'bg-white/5 text-dark-500 border border-white/5 font-black italic uppercase tracking-tighter',
            disabled: true
          };
        }

        // Handle any server with IP (vanilla or non-vanilla)
        if (!requiresModpack && hasValidIp) {
          return {
            text: `${t('modpacks.connect')} ${modpack.ip}`,
            icon: Globe,
            onClick: () => copyToClipboard(modpack.ip!),
            className: 'bg-white/5 text-dark-300 border border-white/10 font-black italic uppercase tracking-tighter',
            disabled: false
          };
        }

        // Default: show install button for modpacks
        return {
          text: t('modpacks.install'),
          icon: Download,
          onClick: () => handleInstall(),
          className: 'bg-nebula-500 text-white shadow-lg shadow-nebula-500/20 border border-nebula-400/30 font-black italic uppercase tracking-tighter',
          disabled: false
        };
    }
  };

  const buttonConfig = getButtonConfig();
  const ButtonIcon = buttonConfig.icon;
  const isLoading = ['installing', 'updating', 'repairing', 'reinstalling', 'launching', 'stopping'].includes(state.status);

  // Fake progress for the "launching" phase
  const [fakeLaunchProgress, setFakeLaunchProgress] = useState(0);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    if (state.status === 'launching') {
      setFakeLaunchProgress(0);

      intervalId = setInterval(() => {
        setFakeLaunchProgress(prev => {
          if (prev >= 100) {
            if (intervalId) clearInterval(intervalId);
            return 100;
          }
          return prev + 2; // +2% cada 50 ms -> ~2.5 s para llegar a 100 %
        });
      }, 50);
    } else {
      setFakeLaunchProgress(0);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [state.status]);

  // Load instance metadata when installed
  useEffect(() => {
    const loadMetadata = async () => {
      // Skip if no modpack ID or not installed
      if (!modpack.id || !state.installed) return;

      try {
        const metadataJson = await invoke<string | null>('get_instance_metadata', {
          modpackId: modpack.id
        });

        if (metadataJson) {
          setInstanceMetadata(JSON.parse(metadataJson));
        }
      } catch (error) {
        console.error('Failed to load instance metadata:', error);
      }
    };

    loadMetadata();
  }, [state.installed, modpack.id]);

  const displayedPercentage = state.status === 'launching'
    ? fakeLaunchProgress
    : state.progress?.percentage ?? 0;

  // Use modpack.name as source of truth - it's updated immediately when edited in MyModpacksPage
  const displayName = modpack.name;
  const displayDescription = modpack.shortDescription || modpack.description || '';

  const reloadInstanceMetadata = async () => {
    try {
      const metadataJson = await invoke<string | null>('get_instance_metadata', {
        modpackId: modpack.id
      });

      if (metadataJson) {
        setInstanceMetadata(JSON.parse(metadataJson));
      }
    } catch (error) {
      console.error('Failed to reload instance metadata:', error);
    }
  };

  // Parse general message format: "progress.key|counter" or just "progress.key"
  const parseGeneralMessage = (message?: string): { translatedMessage: string; counter?: string } => {
    if (!message) return { translatedMessage: '' };

    const parts = message.split('|');
    const key = parts[0];
    const counter = parts[1]; // Could be "3/150" or undefined

    // If the key starts with "progress.", translate it
    if (key.startsWith('progress.')) {
      const translationKey = key.substring('progress.'.length);
      const translatedMessage = t(`progress.${translationKey}`, key);
      return { translatedMessage, counter };
    }

    return { translatedMessage: message, counter };
  };

  const getStepMessage = (step?: string): string => {
    if (!step) return '';

    // Map snake_case step names to camelCase translation keys
    const stepToTranslationKey: { [key: string]: string } = {
      'checking': 'checking',
      'initializing': 'initializing',
      'preparing_installation': 'preparingInstallation',
      'verifying_modpack_config': 'verifyingModpackConfig',
      'configuring_minecraft': 'configuringMinecraft',
      'downloading_minecraft': 'downloadingMinecraft',
      'installing_minecraft': 'installingMinecraft',
      'downloading_minecraft_file': 'downloadingMinecraft',
      'downloading_minecraft_multiple': 'downloadingMinecraftMultiple',
      'installing_component': 'installingComponent',
      'minecraft_ready': 'minecraftReady',
      'downloading_modpack': 'downloadingModpack',
      'processing_modpack': 'processingModpack',
      'processing_curseforge': 'processingCurseforge',
      'preparing_mod_downloads': 'preparingModDownloads',
      'downloading_modpack_file': 'downloadingModpackFile',
      'downloading_mod_file': 'downloadingModFile',
      'downloading_mod': 'downloadingMods', // New from parallel system
      'mod_already_exists': 'modAlreadyExists',
      'file_already_exists': 'modAlreadyExists', // New from parallel system
      'mod_downloaded_verified': 'modDownloadedVerified',
      'mod_unavailable': 'modUnavailable',
      'file_unavailable': 'modUnavailable', // New from parallel system
      'file_in_overrides': 'modAlreadyExists', // New from parallel system
      'mod_in_overrides': 'modAlreadyExists', // CurseForge mods in overrides
      'file_download_error': 'modDownloadError', // New from parallel system
      'extracting_modpack': 'extractingModpack',
      'downloading': 'downloading',
      'downloading_update': 'downloadingUpdate',
      'processing': 'processing',
      'processing_update': 'processingUpdate',
      'extracting': 'extracting',
      'modpack_ready': 'modpackReady',
      'modpack_extracted': 'modpackExtracted',
      'no_modpack_files': 'noModpackFiles',
      'finalizing': 'finalizing',
      'updating': 'updating',
      'updating_curseforge_mods': 'updatingCurseforgeMods',
      'replacing_mods': 'replacingMods',
      'updating_configs': 'updatingConfigs',
      'updating_standard_modpack': 'updatingStandardModpack',
      'backing_up_minecraft': 'backingUpMinecraft',
      'extracting_new_version': 'extractingNewVersion',
      'restoring_minecraft': 'restoringMinecraft',
      'finalizing_update': 'finalizingUpdate',
      'copying_modpack': 'copyingModpack',
      'saving_instance_config': 'savingInstanceConfig',
      'finalizing_installation': 'finalizingInstallation',
      'installation_completed': 'installationCompleted',
      'installing_loader': 'installingModLoader', // New from parallel system
      'complete': 'completed',
      'completed': 'completed',
      'fetching': 'initializing', // New from parallel system
      'preparing': 'preparing', // New from parallel system
      'downloading_modrinth_files': 'downloadingModrinthFiles' // New from parallel system
    };

    const translationKey = stepToTranslationKey[step];
    return translationKey ? t(`progress.${translationKey}`) : step;
  };

  const handleRemoveModpack = async () => {
    try {
      setIsRemoving(true);
      console.log('🗑️ Removing instance:', modpack.id);
      await removeModpack(modpack.id);
      setShowRemoveDialog(false);
    } catch (error) {
      console.error('❌ Error removing instance:', error);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleOpenInstanceFolder = async () => {
    try {
      console.log('📂 Opening instance folder for:', modpack.id);
      await LauncherService.getInstance().openInstanceFolder(modpack.id);
    } catch (error) {
      console.error('❌ Error opening instance folder:', error);
    }
  };

  // Special styling for coming soon items
  const isComingSoon = modpack.isComingSoon;
  const cardClasses = `group flex flex-col h-full relative transition-all duration-700 bg-white/[0.02] backdrop-blur-3xl border border-white/5 rounded-[2.5rem] overflow-hidden hover:bg-white/[0.04] hover:border-white/10 hover:-translate-y-2 shadow-2xl ${
    isComingSoon ? 'ring-2 ring-nebula-500/20 shadow-nebula-500/10' : ''
  }`;

  return (
    <div
      className={cardClasses}
      style={{
        animation: `fadeInUp 0.15s ease-out ${index * 0.02 + 0.1}s backwards`,
        ...getAnimationStyle({})
      }}
    >
      {/* Status Badge - Top right corner of entire card */}
      {!hideServerBadges && (
        <div className="absolute top-2 right-2 z-20 transition-all duration-75">
          {getServerStatusBadge()}
        </div>
      )}

      {/* Coming Soon Glow Effect */}
      {isComingSoon && (
        <div className={`absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-nebula-500/5 via-transparent to-indigo-500/5 pointer-events-none ${getAnimationClass('', 'animate-pulse')
          }`} />
      )}

      <div onClick={onSelect} className="flex-1 flex flex-col">
        <div className="space-y-3 flex-1">
          {/* Modpack Icon with API Background - Reduced height */}
          <div className={`w-full h-40 rounded-[2rem] overflow-hidden flex items-center justify-center p-6 relative transition-all duration-700 ${!modpack.backgroundImage ? 'bg-gradient-to-br from-nebula-950 via-dark-900 to-indigo-950' : ''}`}>
            {/* API backgroundImage */}
            {modpack.backgroundImage && (
              <div
                className="absolute inset-0 bg-center bg-cover transition-transform duration-1000 group-hover:scale-110"
                style={{
                  backgroundImage: modpack.backgroundImage.startsWith('linear-gradient')
                    ? modpack.backgroundImage
                    : `url(${modpack.backgroundImage})`,
                  opacity: 0.5
                }}
              />
            )}

            {/* Dark overlay to ensure readability (only for images) */}
            {modpack.backgroundImage && <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-900/40 to-transparent" />}
            <div className="absolute inset-0 bg-nebula-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

            {/* Logo or first letter */}
            {modpack.logo && modpack.logo.length === 1 ? (
              // Show first letter for local modpacks
              <div className="text-7xl font-black text-white/20 italic relative z-10 select-none drop-shadow-2xl">
                {modpack.logo}
              </div>
            ) : modpack.logo ? (
              // Show logo image for server modpacks
              <img
                src={modpack.logo}
                alt={displayName}
                loading="lazy"
                className="relative z-10 max-w-full max-h-full object-contain transition-all duration-700 group-hover:scale-110 group-hover:-rotate-3 drop-shadow-[0_0_30px_rgba(0,0,0,0.5)]"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0yNCAyNEg0MFY0MEgyNFYyNFoiIGZpbGw9IiM2Mzc1ODMiLz4KPC9zdmc+';
                }}
              />
            ) : (
              // Show first letter of modpack name when no logo
              <div className="text-7xl font-black text-white/20 italic relative z-10 select-none drop-shadow-2xl">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Modpack Info */}
          <div className="p-8 pt-4 space-y-4 flex-1">
            <h3 className="text-white font-black text-2xl truncate transition-all duration-500 uppercase italic tracking-tighter group-hover:text-nebula-400 group-hover:translate-x-1">
              {displayName}
            </h3>

            <p className="text-dark-400 text-sm line-clamp-2 transition-colors duration-500 font-black uppercase italic tracking-wider opacity-60 group-hover:opacity-100 group-hover:text-dark-300">
              {displayDescription}
            </p>

            {/* Partner Name Display */}
            {!hideServerBadges && modpack.category === 'partner' && modpack.partnerName && (
              <div className="mb-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] bg-nebula-500/10 text-nebula-400 border border-nebula-500/20 italic">
                  <Globe className="w-3 h-3" />
                  {modpack.partnerName}
                </div>
              </div>
            )}

            {/* Author Name Display for Community Modpacks */}
            {!hideServerBadges && modpack.category === 'community' && modpack.authorName && (
              <div className="mb-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] bg-green-500/10 text-green-400 border border-green-500/20 italic">
                  <User className="w-3 h-3" />
                  {modpack.authorName}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] italic text-dark-500">
              <div className="bg-white/5 px-4 py-2 rounded-xl text-dark-300 border border-white/5 group-hover:border-nebula-500/20 transition-all shadow-inner">
                {modpack.minecraftVersion}
              </div>
              <div className="bg-white/5 px-4 py-2 rounded-xl text-dark-300 border border-white/5 group-hover:border-nebula-500/20 transition-all shadow-inner">
                {modpack.modloader}
              </div>
              {modpack.gamemode && (
                <div className="text-nebula-400 bg-nebula-500/10 px-4 py-2 rounded-xl border border-nebula-500/20 shadow-lg shadow-nebula-500/5">
                  {modpack.gamemode}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar - Simplified */}
        {isLoading && state.progress && (
          <div className="px-8 mb-6">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] italic text-dark-500 mb-2 px-1">
              <span className="truncate opacity-60">
                {(() => {
                  const { translatedMessage } = parseGeneralMessage(state.progress.generalMessage);
                  return translatedMessage || getStepMessage(state.progress.step) || buttonConfig.text;
                })()}
              </span>
              <span className="text-nebula-400">{Math.round(displayedPercentage)}%</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden p-0.5 border border-white/5 shadow-inner">
              <div
                className="bg-gradient-to-r from-nebula-600 to-nebula-400 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_15px_rgba(139,92,246,0.6)] relative"
                style={{ width: `${displayedPercentage}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
              </div>
            </div>
          </div>
        )}

        {/* Error Message - Clickable to show modal */}
        {state.status === 'error' && state.error && (
          <div className="px-8 pb-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowErrorModal(true);
              }}
              className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl w-full text-left hover:bg-red-500/10 transition-all cursor-pointer group/error active:scale-[0.98] shadow-inner"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-red-400 text-[10px] font-black uppercase italic tracking-wider flex-1 line-clamp-2">{state.error}</span>
                <Info className="w-4 h-4 text-red-400 opacity-40 group-hover/error:opacity-100 transition-opacity flex-shrink-0" />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-8 pt-0 transition-colors duration-500">
        <div className="flex gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              buttonConfig.onClick();
            }}
            disabled={buttonConfig.disabled}
            className={`${buttonConfig.className} flex-1 h-14 rounded-2xl flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 active:scale-95 group/btn-main shadow-lg`}
          >
            <ButtonIcon
              className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''} transition-all duration-500 ${!isLoading && !buttonConfig.disabled ? 'group-hover/btn-main:scale-110' : ''}`}
            />
            <span className="font-black italic uppercase tracking-[0.1em] text-xs">{buttonConfig.text}</span>
          </button>

          {/* Settings/Profile Options button - only in full management mode */}
          {!isReadOnly && ['installed', 'outdated', 'error'].includes(state.status) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowProfileOptionsModal(true);
              }}
              disabled={isLoading}
              className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white/5 text-dark-400 hover:text-white border border-white/5 hover:bg-white/10 transition-all shadow-xl group/btn-settings border-white/10"
              title="Profile Options"
            >
              <Settings className="w-5 h-5 transition-all duration-700 group-hover/btn-settings:rotate-180" />
            </button>
          )}

          {/* Open folder button - only in full management mode */}
          {!isReadOnly && ['installed', 'outdated', 'error'].includes(state.status) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenInstanceFolder();
              }}
              disabled={isLoading}
              className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white/5 text-dark-400 hover:text-white border border-white/5 hover:bg-white/10 transition-all shadow-xl group/btn-folder border-white/10"
              title={t('modpacks.openFolderTooltip')}
            >
              <FolderOpen className="w-5 h-5 transition-all duration-500 group-hover/btn-folder:scale-110" />
            </button>
          )}

          {/* Remove button - only in full management mode */}
          {!isReadOnly && ['installed', 'outdated', 'error'].includes(state.status) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                console.log('🔴 Remove button clicked for instance:', modpack.id);
                setShowRemoveDialog(true);
              }}
              disabled={isLoading}
              className="w-14 h-14 flex items-center justify-center rounded-2xl bg-red-500/5 text-red-500/40 hover:text-red-500 border border-red-500/10 hover:bg-red-500/10 transition-all shadow-xl group/btn-remove border-white/10"
              title={t('modpacks.removeTooltip')}
            >
              <Trash2 className="w-5 h-5 transition-all duration-500 group-hover/btn-remove:scale-110 group-hover/btn-remove:rotate-12" />
            </button>
          )}
        </div>
      </div>

      {/* Remove Confirmation Dialog */}
      {showRemoveDialog && (
        <ConfirmDialog
          title={t('modpacks.removeConfirmTitle')}
          message={t('modpacks.removeConfirmMessage', { name: displayName })}
          confirmText={t('modpacks.removeButton')}
          cancelText={t('app.cancel')}
          onConfirm={handleRemoveModpack}
          onCancel={() => setShowRemoveDialog(false)}
          isLoading={isRemoving}
          type="danger"
        />
      )}

      {/* Profile Options Modal */}
      <ProfileOptionsModal
        modpackId={modpack.id}
        modpackName={displayName}
        isOpen={showProfileOptionsModal}
        onClose={() => setShowProfileOptionsModal(false)}
        isLocalModpack={!modpack.urlModpackZip}
        metadata={{
          ...instanceMetadata,
          // Merge protection flags from remote modpack data (takes precedence over local)
          allow_custom_mods: modpack.allowCustomMods,
          allow_custom_resourcepacks: modpack.allowCustomResourcepacks,
          category: modpack.category,
        }}
        onSaveComplete={reloadInstanceMetadata}
        onModpackUpdated={onModpackUpdated}
      />

      {/* Error Modal */}
      <UnknownErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        modpackId={modpack.id}
        errorMessage={state.error || ''}
      />
    </div>
  );
});

ModpackCard.displayName = 'ModpackCard';

export default ModpackCard; 
