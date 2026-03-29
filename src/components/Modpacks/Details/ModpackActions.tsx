import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download, Play, RefreshCw, Wrench, FolderOpen, Trash2,
  Loader2, StopCircle, Globe, AlertTriangle, Settings, Clock, Info
} from 'lucide-react';
import type { Modpack, ModpackState, ProgressInfo } from '../../../types/launcher';
import { useLauncher } from '../../../contexts/LauncherContext';
import { useAnimation } from '../../../contexts/AnimationContext';
import ConfirmDialog from '../../ConfirmDialog';
import LauncherService from '../../../services/launcherService';
import { UnknownErrorModal } from '../../UnknownErrorModal';

// Helper component for clickable error message with modal
const ErrorMessageClickable: React.FC<{ error: string; modpackId: string }> = ({ error, modpackId }) => {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl w-full text-left hover:bg-red-500/20 transition-all cursor-pointer group shadow-xl"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-400 text-xs font-black uppercase tracking-widest flex-1 line-clamp-2">{error}</span>
          <Info className="w-5 h-5 text-red-400 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
      </button>
      <UnknownErrorModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        modpackId={modpackId}
        errorMessage={error}
      />
    </>
  );
};

interface ModpackActionsProps {
  modpack: Modpack;
  state: ModpackState & {
    progress?: ProgressInfo;
  };
  isReadOnly?: boolean; // Read-only mode: show Install/Installed only
  showProfileOptions?: boolean;
  setShowProfileOptions?: (_show: boolean) => void;
  onNavigate?: (_section: string, _modpackId?: string) => void;
}

const ModpackActions: React.FC<ModpackActionsProps> = ({
  modpack,
  state,
  isReadOnly = false,
  setShowProfileOptions = () => { },
  onNavigate
}) => {
  const { t } = useTranslation();
  const { installModpack, updateModpack, launchModpack, repairModpack, removeModpack, stopInstance } = useLauncher();
  const { getAnimationStyle } = useAnimation();
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const requiresModpack = !!modpack.urlModpackZip;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const getStatusInfo = () => {
    const hasValidIp = modpack.ip && modpack.ip.trim() !== '';

    // Check if Coming Soon - disable downloads
    if (modpack.isComingSoon) {
      return {
        icon: Clock,
        label: t('modpacks.comingSoon'),
        bgColor: 'bg-gray-600/50 cursor-not-allowed',
        textColor: 'text-gray-400',
        action: () => { },
        disabled: true
      };
    }

    // Read-only mode (Home/Explore): Show Install or Installed only
    if (isReadOnly) {
      // Show installing/updating/repairing/reinstalling state in read-only mode
      if (['installing', 'updating', 'repairing', 'reinstalling'].includes(state.status)) {
        const labels: Record<string, string> = {
          'installing': t('modpacks.installing'),
          'updating': t('modpacks.updating'),
          'repairing': t('modpacks.repairing'),
          'reinstalling': t('modpacks.reinstalling')
        };
        return {
          icon: Loader2,
          label: labels[state.status] || t('modpacks.installing'),
          bgColor: 'bg-white/5 border border-white/5',
          textColor: 'text-dark-500',
          spinning: true,
          disabled: true
        };
      }

      if (['installed', 'outdated', 'error'].includes(state.status)) {
        // Show Repair for error state, Installed for others
        if (state.status === 'error') {
          return {
            icon: Wrench,
            label: t('modpacks.repair'),
            bgColor: 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/30',
            textColor: 'text-red-400',
            action: () => repairModpack(modpack.id),
            disabled: false
          };
        }
        return {
          icon: Download,
          label: t('modpacks.installed'),
          bgColor: 'bg-white/5 border border-white/5',
          textColor: 'text-dark-500',
          action: () => { },
          disabled: true
        };
      }

      // Not installed in read-only mode - install and navigate to my-modpacks
      return {
        icon: Download,
        label: t('modpacks.install'),
        bgColor: 'bg-nebula-500 hover:bg-nebula-600 shadow-nebula-500/20 border border-nebula-400/30',
        textColor: 'text-white',
        action: async () => {
          // Save full modpack data to localStorage so MyModpacksPage can use it during installation
          let modpackToSave = modpack;
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

          if (!modpack.backgroundImage && uuidRegex.test(modpack.id)) {
            try {
              const data = await LauncherService.getInstance().fetchModpacksData();
              const fullModpack = data.modpacks.find(m => m.id === modpack.id);
              if (fullModpack && fullModpack.backgroundImage) {
                modpackToSave = { ...modpack, ...fullModpack };
              }
            } catch (e) {
              console.error('Failed to fetch full modpack metadata:', e);
            }
          }

          try {
            localStorage.setItem(`installing_modpack_${modpack.id}`, JSON.stringify(modpackToSave));
          } catch (error) {
            console.error('Failed to save modpack to localStorage:', error);
          }

          // Wait for installModpack and only navigate if it started successfully
          const started = await installModpack(modpack.id);
          if (started) {
            onNavigate?.('my-modpacks', modpack.id);
          }
        },
        disabled: false
      };
    }

    switch (state.status) {
      case 'not_installed':
        return {
          icon: Download,
          label: t('modpacks.install'),
          bgColor: 'bg-nebula-500 hover:bg-nebula-600 shadow-nebula-500/20 border border-nebula-400/30',
          textColor: 'text-white',
          action: () => installModpack(modpack.id)
        };
      case 'installed':
        return {
          icon: Play,
          label: t('modpacks.play'),
          bgColor: 'bg-nebula-500 hover:bg-nebula-600 shadow-nebula-500/20 border border-nebula-400/30',
          textColor: 'text-white',
          action: () => launchModpack(modpack.id)
        };
      case 'outdated':
        // Optional update: Primary action is still PLAY
        return {
          icon: Play,
          label: t('modpacks.play'),
          bgColor: 'bg-nebula-500 hover:bg-nebula-600 shadow-nebula-500/20 border border-nebula-400/30',
          textColor: 'text-white',
          action: () => launchModpack(modpack.id)
        };
      case 'installing':
      case 'updating':
      case 'repairing':
      case 'reinstalling': {
        const labels: Record<string, string> = {
          'installing': t('modpacks.installing'),
          'updating': t('modpacks.updating'),
          'repairing': t('modpacks.repairing'),
          'reinstalling': t('modpacks.reinstalling')
        };
        const bgColors: Record<string, string> = {
          'installing': 'bg-white/5 border border-white/5',
          'updating': 'bg-white/5 border border-white/5',
          'repairing': 'bg-white/5 border border-white/5',
          'reinstalling': 'bg-white/5 border border-white/5'
        };
        return {
          icon: Loader2,
          label: labels[state.status] || t('modpacks.installing'),
          bgColor: bgColors[state.status] || 'bg-white/5 border border-white/5',
          textColor: 'text-dark-500',
          spinning: true,
          disabled: true
        };
      }
      case 'launching':
        return {
          icon: Loader2,
          label: t('modpacks.launching'),
          bgColor: 'bg-nebula-500/20 border border-nebula-500/30',
          textColor: 'text-nebula-400',
          spinning: true,
          disabled: true
        };
      case 'running':
        return {
          icon: StopCircle,
          label: t('modpacks.stop'),
          bgColor: 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/30',
          textColor: 'text-red-400',
          action: () => stopInstance(modpack.id),
          disabled: false
        };
      case 'stopping':
        return {
          icon: Loader2,
          label: t('modpacks.stopping'),
          bgColor: 'bg-red-500/10 border border-red-500/20',
          textColor: 'text-red-500/60',
          spinning: true,
          disabled: true
        };
      case 'error':
        return {
          icon: Wrench,
          label: t('modpacks.repair'),
          bgColor: 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/30',
          textColor: 'text-red-400',
          action: () => repairModpack(modpack.id)
        };

      default:
        // Handle servers without modpack
        // If has IP: show connect button
        if (!requiresModpack && hasValidIp) {
          return {
            icon: Globe,
            label: `${t('modpacks.connect')} ${modpack.ip}`,
            bgColor: 'bg-nebula-500 hover:bg-nebula-600 shadow-nebula-500/20 border border-nebula-400/30',
            textColor: 'text-white',
            action: () => copyToClipboard(modpack.ip!),
            disabled: false
          };
        }

        // If no modpack and no IP: show not available
        if (!requiresModpack && !hasValidIp) {
          return {
            icon: AlertTriangle,
            label: t('modpacks.notAvailable'),
            bgColor: 'bg-white/5 border border-white/5',
            textColor: 'text-dark-500',
            action: () => { },
            disabled: true
          };
        }

        // Default: show install button for modpacks
        return {
          icon: Download,
          label: t('modpacks.install'),
          bgColor: 'bg-nebula-500 hover:bg-nebula-600 shadow-nebula-500/20 border border-nebula-400/30',
          textColor: 'text-white',
          action: () => installModpack(modpack.id)
        };
    }
  };

  const getStepMessage = (step?: string): string => {
    if (!step) return '';

    const stepMappings: { [key: string]: string } = {
      'downloading_manifest': t('modpacks.steps.downloadingManifest'),
      'processing_manifest': t('modpacks.steps.processingManifest'),
      'downloading_mods': t('modpacks.steps.downloadingMods'),
      'downloading_overrides': t('modpacks.steps.downloadingOverrides'),
      'extracting_overrides': t('modpacks.steps.extractingOverrides'),
      'installing_modloader': t('modpacks.steps.installingModloader'),
      'finalizing': t('modpacks.steps.finalizing'),
      'complete': t('modpacks.steps.complete')
    };

    return stepMappings[step] || step;
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await removeModpack(modpack.id);
      setShowRemoveDialog(false);
      // Navigate back to my-modpacks after successful removal
      onNavigate?.('my-modpacks');
    } catch (error) {
      console.error('Failed to remove instance:', error);
    } finally {
      setIsRemoving(false);
    }
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

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
          return prev + 2; // +2% cada 50 ms -> ~2.5 s
        });
      }, 50);
    } else {
      setFakeLaunchProgress(0);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [state.status]);

  const displayedPercentage = state.status === 'launching'
    ? fakeLaunchProgress
    : state.progress?.percentage ?? 0;

  return (
    <>
      {/* Main Action Button */}
      <div className="space-y-6">
        <button
          onClick={statusInfo.action}
          disabled={statusInfo.disabled}
          className={`w-full flex items-center justify-center gap-4 px-8 py-5 rounded-[2rem] font-black text-xl italic uppercase tracking-tighter transition-all duration-300 shadow-2xl hover:scale-[1.02] active:scale-[0.98] ${statusInfo.bgColor} ${statusInfo.textColor} disabled:opacity-50 disabled:cursor-not-allowed`}
          style={getAnimationStyle({})}
        >
          <Icon className={`w-7 h-7 ${statusInfo.spinning ? 'animate-spin' : ''}`} />
          <span>{statusInfo.label}</span>
        </button>

        {/* Optional Update Button */}
        {!isReadOnly && state.status === 'outdated' && (
          <button
            onClick={() => updateModpack(modpack.id)}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-black text-sm italic uppercase tracking-widest transition-all duration-300 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 hover:shadow-xl shadow-yellow-500/5"
          >
            <RefreshCw className="w-5 h-5 animate-spin-slow" />
            <span>{t('modpacks.updateAvailable')}</span>
          </button>
        )}

        {/* Progress Display */}
        {['installing', 'updating', 'repairing', 'reinstalling', 'launching'].includes(state.status) && state.progress && (
          <div className="space-y-4 px-2">
            {/* Progress header */}
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-dark-500 px-1">
              <span className="truncate">
                {state.progress.generalMessage || getStepMessage(state.progress.step) || statusInfo.label}
              </span>
              <span className="text-nebula-400 underline decoration-nebula-500/30 underline-offset-4">{Math.round(displayedPercentage)}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden p-0.5 border border-white/5">
              <div
                className="bg-nebula-400 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_15px_rgba(139,92,246,0.5)]"
                style={{ width: `${displayedPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Message - Clickable to show modal */}
        {state.status === 'error' && state.error && (
          <ErrorMessageClickable error={state.error} modpackId={modpack.id} />
        )}

        {/* Secondary Actions - only in full management mode */}
        {!isReadOnly && ['installed', 'outdated', 'error'].includes(state.status) && (
          <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
            {/* Profile Options Button (Full Width) */}
            <button
              onClick={() => setShowProfileOptions(true)}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-nebula-500/10 hover:bg-nebula-500/20 text-nebula-400 border border-nebula-500/20 transition-all font-black text-xs uppercase tracking-widest italic group/btn"
              style={getAnimationStyle({})}
            >
              <Settings className="w-4 h-4 flex-shrink-0 transition-transform duration-500 group-hover/btn:rotate-90" />
              <span>{t('profileOptions.button')}</span>
            </button>

            {/* Other Actions Row */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => LauncherService.getInstance().openInstanceFolder(modpack.id)}
                className="flex items-center justify-center gap-3 px-4 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-dark-400 hover:text-white border border-white/5 transition-all font-black text-[10px] uppercase tracking-widest italic min-w-0 group/btn"
                style={getAnimationStyle({})}
              >
                <FolderOpen className="w-4 h-4 flex-shrink-0 transition-transform duration-500 group-hover/btn:scale-110" />
                <span className="truncate">ORBITAL FILES</span>
              </button>
              <button
                onClick={() => setShowRemoveDialog(true)}
                className="flex items-center justify-center gap-3 px-4 py-4 rounded-2xl bg-red-500/5 hover:bg-red-500/10 text-red-500/50 hover:text-red-500 border border-red-500/10 hover:border-red-500/20 transition-all font-black text-[10px] uppercase tracking-widest italic min-w-0 group/btn"
                style={getAnimationStyle({})}
              >
                <Trash2 className="w-4 h-4 flex-shrink-0 transition-transform duration-500 group-hover/btn:scale-110" />
                <span className="truncate">DECOMMISSION</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Remove Confirmation Dialog */}
      {showRemoveDialog && (
        <ConfirmDialog
          title={t('modpacks.removeConfirmTitle')}
          message={t('modpacks.removeConfirmMessage', { name: modpack.name })}
          confirmText={t('modpacks.removeButton')}
          cancelText={t('app.cancel')}
          onConfirm={handleRemove}
          onCancel={() => setShowRemoveDialog(false)}
          isLoading={isRemoving}
          type="danger"
        />
      )}
    </>
  );
};

export default ModpackActions; 