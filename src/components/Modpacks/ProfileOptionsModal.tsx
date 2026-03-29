import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, HardDrive, Shield, ShieldOff, X, ChevronDown, ChevronUp, Wrench, RefreshCcw } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import toast from 'react-hot-toast';
import { useLauncher } from '../../contexts/LauncherContext';

interface ProfileOptionsModalProps {
  modpackId: string;
  modpackName: string;
  isOpen: boolean;
  onClose: () => void;
  isLocalModpack?: boolean; // True if imported locally, not from server
  onSaveComplete?: () => void; // Called after successful save to refresh parent data
  onModpackUpdated?: (_updates: { name?: string; logo?: string; backgroundImage?: string }) => void; // Called to update parent state
  metadata?: {
    recommendedRam?: number;
    ramAllocation?: string;
    customRam?: number;
    allow_custom_mods?: boolean;
    allow_custom_resourcepacks?: boolean;
    category?: string;
  };
}

const ProfileOptionsModal: React.FC<ProfileOptionsModalProps> = ({
  modpackId,
  modpackName,
  isOpen,
  onClose,
  isLocalModpack = false,
  onSaveComplete,
  onModpackUpdated,
  metadata
}) => {
  const { t } = useTranslation();
  const { userSettings, repairModpack, reinstallModpack } = useLauncher();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const appDataDirRef = useRef<string | null>(null);

  const [displayName, setDisplayName] = useState(modpackName);
  const [ramMode, setRamMode] = useState<'recommended' | 'custom' | 'global'>(() => {
    const rawMode = metadata?.ramAllocation as 'recommended' | 'custom' | 'global';
    if (rawMode === 'recommended' && !metadata?.recommendedRam) return 'global';
    return rawMode || (metadata?.recommendedRam ? 'recommended' : 'global');
  });
  const [customRamValue, setCustomRamValue] = useState<number>(
    metadata?.customRam || userSettings.allocatedRam || 4096
  );
  const [isSaving, setIsSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [selectedBannerFile, setSelectedBannerFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [systemRamMB, setSystemRamMB] = useState<number>(8192); // Default fallback
  const [maxAllocatableRam, setMaxAllocatableRam] = useState<number>(32768);

  // Repair and reinstall confirmation state
  const [showRepairConfirm, setShowRepairConfirm] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [showReinstallConfirm, setShowReinstallConfirm] = useState(false);
  const [isReinstalling, setIsReinstalling] = useState(false);

  // Protection Mode State
  const [allowCustomMods, setAllowCustomMods] = useState(metadata?.allow_custom_mods ?? true);
  const [allowCustomResourcepacks, setAllowCustomResourcepacks] = useState(metadata?.allow_custom_resourcepacks ?? true);
  const [showAdvancedProtection, setShowAdvancedProtection] = useState(false);

  // Derived state for protection mode
  const isProtected = !allowCustomMods && !allowCustomResourcepacks;
  const isFullyOpen = allowCustomMods && allowCustomResourcepacks;
  const isCustomMode = !isProtected && !isFullyOpen;

  // Load system memory and cached images when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const initData = async () => {
      try {
        // Get system memory
        const totalBytes = await invoke<number>('get_system_memory');
        const totalMB = Math.floor(totalBytes / 1024 / 1024);
        setSystemRamMB(totalMB);
        setMaxAllocatableRam(totalMB); // Allow allocating up to total RAM (or maybe slightly less?)

        if (!appDataDirRef.current) {
          const appData = await appDataDir();
          appDataDirRef.current = appData.endsWith('/') ? appData.slice(0, -1) : appData;
        }

        if (isLocalModpack) {
          // Get cached modpack data to find correct image paths
          const cachedData = await invoke<string | null>('get_cached_modpack_data', { modpackId });
          if (cachedData) {
            const cache = JSON.parse(cachedData);

            // Load logo if path exists in cache
            if (cache.logo) {
              try {
                const fullLogoPath = `${appDataDirRef.current}/${cache.logo}`;
                const logo = await invoke<string>('get_file_as_data_url', { filePath: fullLogoPath });
                setLogoUrl(logo);
              } catch {
                setLogoUrl(null);
              }
            }

            // Load banner if path exists in cache
            if (cache.backgroundImage) {
              try {
                const fullBannerPath = `${appDataDirRef.current}/${cache.backgroundImage}`;
                const banner = await invoke<string>('get_file_as_data_url', { filePath: fullBannerPath });
                setBannerUrl(banner);
              } catch {
                setBannerUrl(null);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to init modal data:', error);
      }
    };

    initData();
  }, [isOpen, isLocalModpack, modpackId]);

  useEffect(() => {
    setDisplayName(modpackName);
  }, [modpackName]);

  useEffect(() => {
    if (metadata) {
      const initialMode = (metadata.ramAllocation as 'recommended' | 'custom' | 'global') || (metadata.recommendedRam ? 'recommended' : 'global');
      setRamMode(initialMode === 'recommended' && !metadata.recommendedRam ? 'global' : initialMode);
      setCustomRamValue(metadata.customRam || userSettings.allocatedRam || 4096);

      setAllowCustomMods(metadata.allow_custom_mods ?? true);
      setAllowCustomResourcepacks(metadata.allow_custom_resourcepacks ?? true);
    }
  }, [metadata, userSettings.allocatedRam]);

  // Force global if recommended is unsafe
  useEffect(() => {
    if (metadata?.recommendedRam && systemRamMB > 0) {
      const recommendedMB = metadata.recommendedRam;
      // Use real system RAM from Rust (MB)
      // Safety threshold: System RAM - 1.5GB (1536MB)
      const safeLimitMB = systemRamMB - 1536;

      if (recommendedMB > safeLimitMB && ramMode === 'recommended') {
        console.warn(`Recommended RAM (${recommendedMB}MB) unsafe for System (${systemRamMB}MB), forcing global`);
        setRamMode('global');
      }
    }
  }, [metadata, ramMode, systemRamMB]);

  // Constants for RAM settings (must be before any conditional returns)
  const MIN_RAM = 512; // 512MB minimum
  const SNAP_RANGE = 256; // Snap to common values if within this range

  // Generate snap points (powers of 2 starting from 1024: 1GB, 2GB, 4GB, 8GB, 16GB, 32GB...)
  const snapPoints = React.useMemo(() => {
    const points: number[] = [];
    let memory = 1024; // Start at 1 GB
    while (memory <= maxAllocatableRam) {
      points.push(memory);
      memory *= 2;
    }
    return points;
  }, [maxAllocatableRam]);

  // Find if value is close to a snap point
  const snapToNearestPoint = React.useCallback((value: number): number => {
    for (const point of snapPoints) {
      if (Math.abs(value - point) <= SNAP_RANGE) {
        return point;
      }
    }
    return value;
  }, [snapPoints]);

  const handleCustomRamSliderChange = React.useCallback((value: number) => {
    // Round to nearest 64 MB step
    const stepped = Math.round(value / 64) * 64;
    // Snap to common values if close
    const snapped = snapToNearestPoint(stepped);
    setCustomRamValue(Math.max(MIN_RAM, Math.min(maxAllocatableRam, snapped)));
  }, [snapToNearestPoint, maxAllocatableRam]);

  if (!isOpen) return null;

  // Generate random ID for image filenames
  const generateImageId = () => Math.random().toString(36).substring(2, 10);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Track what was updated
      const updates: { name?: string; logo?: string; backgroundImage?: string } = {};
      const cacheUpdates: { [key: string]: string } = {};

      // Update name if it changed (for local modpacks only)
      if (isLocalModpack && displayName !== modpackName) {
        // Get existing cache data to preserve logo/backgroundImage
        const cachedData = await invoke<string | null>('get_cached_modpack_data', { modpackId });
        const existingCache = cachedData ? JSON.parse(cachedData) : {};

        // Only save essential user-editable fields
        const essentialMetadata = {
          name: displayName,
          logo: existingCache.logo || '',
          backgroundImage: existingCache.backgroundImage || ''
        };

        await invoke('save_modpack_metadata_json', {
          modpackId,
          modpackJson: JSON.stringify(essentialMetadata)
        });
        updates.name = displayName;
        cacheUpdates.name = displayName;
      }

      // If logo was selected, save it with random ID
      if (isLocalModpack && selectedLogoFile) {
        const logoId = generateImageId();
        const arrayBuffer = await selectedLogoFile.arrayBuffer();
        const bytes = Array.from(new Uint8Array(arrayBuffer));

        await invoke('save_modpack_image', {
          modpackId,
          imageType: 'logo',
          imageData: bytes,
          fileName: `logo_${logoId}.png`
        });

        const logoPath = `meta/modpacks/${modpackId}/images/logo_${logoId}.png`;
        updates.logo = logoPath;
        cacheUpdates.logo = logoPath;
        setSelectedLogoFile(null);
        setLogoPreviewUrl(null);
      }

      // If banner was selected, save it with random ID
      if (isLocalModpack && selectedBannerFile) {
        const bannerId = generateImageId();
        const arrayBuffer = await selectedBannerFile.arrayBuffer();
        const bytes = Array.from(new Uint8Array(arrayBuffer));

        await invoke('save_modpack_image', {
          modpackId,
          imageType: 'banner',
          imageData: bytes,
          fileName: `banner_${bannerId}.jpeg`
        });

        const bannerPath = `meta/modpacks/${modpackId}/images/banner_${bannerId}.jpeg`;
        updates.backgroundImage = bannerPath;
        cacheUpdates.backgroundImage = bannerPath;
        setSelectedBannerFile(null);
        setBannerPreviewUrl(null);
      }

      // Update cache JSON if there are changes
      if (Object.keys(cacheUpdates).length > 0) {
        try {
          await invoke('update_modpack_cache_json', {
            modpackId,
            updates: cacheUpdates
          });
        } catch (error) {
          console.error('Warning: Failed to update cache JSON:', error);
          // Non-fatal error - continue anyway
        }
      }

      // Update RAM settings
      await invoke('update_instance_ram_settings', {
        modpackId,
        ramAllocation: ramMode,
        customRam: ramMode === 'custom' ? customRamValue : null,
        allowCustomMods,
        allowCustomResourcepacks,
      });

      toast.success(t('settings.saved'));

      // Notify parent about updates
      if (onModpackUpdated && Object.keys(updates).length > 0) {
        onModpackUpdated(updates);
      }

      // Notify parent to refresh data
      if (onSaveComplete) {
        onSaveComplete();
      }

      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error(t('settings.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (imageType: 'logo' | 'banner', file: File) => {
    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      if (imageType === 'logo') {
        setSelectedLogoFile(file);
        setLogoPreviewUrl(preview);
      } else {
        setSelectedBannerFile(file);
        setBannerPreviewUrl(preview);
      }
    };
    reader.readAsDataURL(file);
  };

  return createPortal(
    <div className="fixed inset-0 bg-nebula-950/40 backdrop-blur-2xl z-[100] flex items-center justify-center p-8 overflow-hidden pointer-events-auto" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white/[0.02] backdrop-blur-3xl rounded-[2.5rem] p-10 max-w-2xl w-full border border-white/10 max-h-[90vh] overflow-y-auto pointer-events-auto shadow-[0_0_100px_rgba(139,92,246,0.1)] custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">{t('profileOptions.title')}</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-dark-500 hover:text-white hover:bg-white/10 transition-all border border-white/5"
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Name Section - Only for local modpacks */}
        {isLocalModpack && (
          <div className="mb-10">
            <label className="block text-[10px] font-black text-dark-500 uppercase tracking-widest italic mb-4 px-1">
              {t('profileOptions.name')} {!editingName && <span className="text-nebula-400 opacity-50 ml-2">(TRANSMISSION IDENTIFIER)</span>}
            </label>
            {editingName ? (
              <div className="flex gap-3">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-black italic tracking-tighter outline-none focus:border-nebula-500/50 transition-all"
                  autoFocus
                />
                <button
                  onClick={() => setEditingName(false)}
                  className="px-6 py-4 bg-nebula-500 hover:bg-nebula-600 text-white rounded-2xl font-black text-xs uppercase italic tracking-widest transition-all shadow-xl shadow-nebula-500/20"
                >
                  {t('app.confirm')}
                </button>
              </div>
            ) : (
              <div
                onClick={() => setEditingName(true)}
                className="w-full transition-all cursor-pointer border border-white/5 hover:border-nebula-500/30 bg-white/5 hover:bg-white/[0.08] p-4 rounded-2xl flex items-center shadow-inner"
              >
                <span className="text-white font-black text-lg italic tracking-tighter">{displayName}</span>
              </div>
            )}
          </div>
        )}

        {/* Image Settings for Local Modpacks */}
        {isLocalModpack && (
          <div className="mb-10">
            <label className="block text-[10px] font-black text-dark-500 uppercase tracking-widest italic mb-6 px-1">
              {t('profileOptions.images', 'Profile Holographics')}
            </label>
            <div className="flex items-center gap-6">
              {/* Logo */}
              <div
                className="relative w-20 h-20 rounded-[1.5rem] bg-white/5 flex-shrink-0 cursor-pointer overflow-hidden group/img border border-white/5 transition-all hover:border-nebula-500/30 shadow-xl"
                onClick={() => logoInputRef.current?.click()}
              >
                {logoPreviewUrl ? (
                  <img src={logoPreviewUrl} alt="Logo Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" />
                ) : logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-nebula-600 to-nebula-400 flex items-center justify-center text-white text-2xl font-black italic">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-nebula-900/60 backdrop-blur-[2px] opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-[10px] font-black uppercase italic tracking-widest">Update</span>
                </div>
              </div>

              {/* Banner */}
              <div
                className="relative flex-1 h-20 rounded-[1.5rem] bg-white/5 cursor-pointer overflow-hidden group/img border border-white/5 transition-all hover:border-nebula-500/30 shadow-xl"
                onClick={() => bannerInputRef.current?.click()}
              >
                {bannerPreviewUrl ? (
                  <img src={bannerPreviewUrl} alt="Banner Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" />
                ) : bannerUrl ? (
                  <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-nebula-900/40 to-nebula-500/20"></div>
                )}
                <div className="absolute inset-0 bg-nebula-900/60 backdrop-blur-[2px] opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-[10px] font-black uppercase italic tracking-widest">Update Core Surface</span>
                </div>
              </div>

              {/* Hidden inputs */}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload('logo', file);
                }}
              />
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload('banner', file);
                }}
              />
            </div>
          </div>
        )}

        {/* Protection Mode Section (Official/Partner only) */}
        {!isLocalModpack && metadata?.category && (metadata.category === 'official' || metadata.category === 'partner' || metadata.category === 'community') && (
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-2.5 bg-nebula-500/10 rounded-xl border border-nebula-500/20">
                <Shield className="w-5 h-5 text-nebula-400" />
              </div>
              <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">{t('profileOptions.stability.title')}</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Protected (Recommended) - Now Read-Only */}
              <div
                className={`flex flex-col items-start p-6 rounded-[1.5rem] border transition-all text-left cursor-not-allowed shadow-xl ${isProtected
                  ? 'border-nebula-500/40 bg-nebula-500/10'
                  : 'border-white/5 bg-white/5 opacity-40'
                  }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Shield className={`w-5 h-5 ${isProtected ? 'text-nebula-400' : 'text-dark-500'}`} />
                  <span className={`font-black text-xs uppercase italic tracking-widest ${isProtected ? 'text-white' : 'text-dark-500'}`}>
                    {t('profileOptions.stability.protected')}
                  </span>
                </div>
                <p className="text-[10px] text-dark-400 font-medium leading-relaxed italic">
                  {t('profileOptions.stability.protectedDesc')}
                </p>
              </div>

              {/* Open - Now Read-Only */}
              <div
                className={`flex flex-col items-start p-6 rounded-[1.5rem] border transition-all text-left cursor-not-allowed shadow-xl ${isFullyOpen
                  ? 'border-nebula-400/40 bg-nebula-400/10'
                  : 'border-white/5 bg-white/5 opacity-40'
                  }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <ShieldOff className={`w-5 h-5 ${isFullyOpen ? 'text-nebula-400' : 'text-dark-500'}`} />
                  <span className={`font-black text-xs uppercase italic tracking-widest ${isFullyOpen ? 'text-white' : 'text-dark-500'}`}>
                    {t('profileOptions.stability.open')}
                  </span>
                </div>
                <p className="text-[10px] text-dark-400 font-medium leading-relaxed italic">
                  {t('profileOptions.stability.openDesc')}
                </p>
              </div>
            </div>

            {/* Advanced Toggle */}
            <div className="border-t border-white/5 pt-4">
              <button
                type="button"
                onClick={() => setShowAdvancedProtection(!showAdvancedProtection)}
                className="flex items-center justify-between w-full text-dark-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest italic"
              >
                <span className="flex items-center gap-3">
                  <Shield className="w-4 h-4" />
                  {t('profileOptions.stability.advancedMode')}
                  {isCustomMode && <span className="text-nebula-400 px-2 py-0.5 bg-nebula-500/10 rounded-full ml-3 border border-nebula-500/20">CUSTOM</span>}
                </span>
                {showAdvancedProtection ? <ChevronUp className="w-4 h-4 text-nebula-400" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAdvancedProtection && (
                <div className="mt-6 space-y-4 bg-white/5 p-6 rounded-2xl border border-white/5 shadow-inner">
                  <table className="w-full text-[10px] font-black uppercase tracking-widest italic">
                    <thead>
                      <tr className="text-dark-500 border-b border-white/5">
                        <th className="text-left pb-3">{t('profileOptions.stability.foldersTable.folder')}</th>
                        <th className="text-right pb-3">{t('profileOptions.stability.foldersTable.status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      <tr>
                        <td className="py-4 text-white">/mods</td>
                        <td className="py-4 text-right">
                          <div
                            className={`px-3 py-1 rounded-full inline-block transition-all ${!allowCustomMods ? 'bg-nebula-500/10 text-nebula-400 border border-nebula-500/20' : 'bg-white/5 text-dark-500 border border-white/5'
                              }`}
                          >
                            {!allowCustomMods ? t('profileOptions.stability.protected') : t('profileOptions.stability.foldersTable.unprotected')}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-4 text-white">/resourcepacks</td>
                        <td className="py-4 text-right">
                          <div
                            className={`px-3 py-1 rounded-full inline-block transition-all ${!allowCustomResourcepacks ? 'bg-nebula-500/10 text-nebula-400 border border-nebula-500/20' : 'bg-white/5 text-dark-500 border border-white/5'
                              }`}
                          >
                            {!allowCustomResourcepacks ? t('profileOptions.stability.protected') : t('profileOptions.stability.foldersTable.unprotected')}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-4 p-4 bg-nebula-500/5 border border-nebula-500/10 rounded-2xl text-[10px] text-nebula-400 flex items-center gap-3 font-black uppercase tracking-widest italic">
                    <Shield className="w-4 h-4 flex-shrink-0" />
                    <span>{t('profileOptions.stability.managedByCreator', 'Operational parameters preserved by mission control.')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Memory Settings */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-2.5 bg-nebula-500/10 rounded-xl border border-nebula-500/20">
              <HardDrive className="w-5 h-5 text-nebula-400" />
            </div>
            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">{t('profileOptions.memorySettings')}</h3>
          </div>

          <div className="space-y-3">
            {/* Recommended by Author Option - Only shown if author provided a recommendation */}
            {(() => {
              if (!metadata?.recommendedRam) return null;

              // Calculate safety using real system memory
              const recommendedMB = metadata.recommendedRam;
              const safeLimitMB = systemRamMB - 1536; // Buffer 1.5GB
              const isUnsafe = recommendedMB > safeLimitMB;

              return (
                <label className={`flex items-start gap-4 p-5 rounded-[1.5rem] border transition-all cursor-pointer shadow-xl ${isUnsafe
                  ? 'border-red-900/10 bg-red-900/5 opacity-50 cursor-not-allowed'
                  : ramMode === 'recommended'
                    ? 'border-nebula-500/40 bg-nebula-500/10 shadow-nebula-500/5'
                    : 'border-white/5 bg-white/5 hover:border-white/10'
                  }`}>
                  <input
                    type="radio"
                    name="ramMode"
                    value="recommended"
                    checked={ramMode === 'recommended'}
                    onChange={(e) => {
                      if (!isUnsafe) setRamMode(e.target.value as 'recommended');
                    }}
                    disabled={isUnsafe}
                    className="mt-1.5 w-5 h-5 text-nebula-500 bg-white/5 border-white/10 accent-nebula-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-black uppercase italic tracking-widest ${isUnsafe ? 'text-red-400' : 'text-white'}`}>
                        {t('profileOptions.recommendedByAuthor')} - {recommendedMB}MB
                      </span>
                      {ramMode === 'recommended' && !isUnsafe && <span className="text-[10px] font-black uppercase tracking-widest italic text-nebula-400 bg-nebula-500/10 px-2 py-0.5 rounded-full border border-nebula-500/20 ml-2">SELECTED</span>}
                    </div>

                    <div className="text-[10px] font-medium text-dark-500 italic mt-2 leading-relaxed">
                      {isUnsafe ? (
                        <span className="text-red-400 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          {t('profileOptions.unsafeRamWarning', 'Critical: Core memory overflow. Switching to global telemetry.')}
                        </span>
                      ) : (
                        t('profileOptions.recommendedDescription')
                      )}
                    </div>
                  </div>
                </label>
              );
            })()}

            {/* Global Settings Option */}
            <label className={`flex items-start gap-4 p-5 rounded-[1.5rem] border transition-all cursor-pointer shadow-xl ${ramMode === 'global'
              ? 'border-nebula-500/40 bg-nebula-500/10 shadow-nebula-500/5'
              : 'border-white/5 bg-white/5 hover:border-white/10'
              }`}>
              <input
                type="radio"
                name="ramMode"
                value="global"
                checked={ramMode === 'global'}
                onChange={(e) => setRamMode(e.target.value as 'global')}
                className="mt-1.5 w-5 h-5 text-nebula-500 bg-white/5 border-white/10 accent-nebula-500"
              />
              <div className="flex-1">
                <div className="text-sm font-black uppercase italic tracking-widest text-white">
                  {t('profileOptions.globalSettings')} - {userSettings.allocatedRam}MB
                </div>
                <div className="text-[10px] font-medium text-dark-500 italic mt-2 leading-relaxed">{t('profileOptions.globalDescription')}</div>
              </div>
            </label>

            {/* Custom RAM Allocation Option */}
            <div className={`p-5 rounded-[1.5rem] border transition-all shadow-xl ${ramMode === 'custom'
              ? 'border-nebula-500/40 bg-nebula-500/10 shadow-nebula-500/5'
              : 'border-white/5 bg-white/5 hover:border-white/10'
              }`}>
              <label className="flex items-start gap-4 cursor-pointer">
                <input
                  type="radio"
                  name="ramMode"
                  value="custom"
                  checked={ramMode === 'custom'}
                  onChange={(e) => setRamMode(e.target.value as 'custom')}
                  className="mt-1.5 w-5 h-5 text-nebula-500 bg-white/5 border-white/10 accent-nebula-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-black uppercase italic tracking-widest text-white mb-6">{t('profileOptions.customAllocation')}</div>

                  {/* Custom RAM Slider */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] italic text-dark-500">{t('profileOptions.memory')}:</span>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={MIN_RAM}
                          max={maxAllocatableRam}
                          value={customRamValue}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            if (!isNaN(value)) {
                              setCustomRamValue(Math.max(MIN_RAM, Math.min(maxAllocatableRam, value)));
                            }
                          }}
                          disabled={ramMode !== 'custom'}
                          className="bg-white/5 border border-white/10 text-white font-black italic text-lg rounded-2xl px-5 py-2 w-32 text-right outline-none focus:border-nebula-500/50 disabled:opacity-30 transition-all shadow-inner"
                        />
                        <span className="text-dark-500 text-[10px] font-black italic uppercase tracking-widest">MEGA_BYTES</span>
                      </div>
                    </div>

                    <div className="px-1">
                      {/* Snap point markers */}
                      <div className={`relative h-2 mb-4 ${ramMode !== 'custom' ? 'opacity-30' : ''}`}>
                        <div className="absolute inset-0" style={{ marginLeft: '4px', marginRight: '4px' }}>
                          {snapPoints.map((point) => (
                            <div
                              key={point}
                              className={`absolute w-1 h-3 rounded-full transition-all duration-500 ${point <= customRamValue ? 'bg-nebula-500 shadow-[0_0_8px_rgba(139,92,246,0.6)]' : 'bg-white/10'
                                }`}
                              style={{
                                left: `${((point - MIN_RAM) / (maxAllocatableRam - MIN_RAM)) * 100}%`,
                                transform: 'translateX(-50%)'
                              }}
                              title={`${point} MB (${(point / 1024).toFixed(0)} GB)`}
                            />
                          ))}
                        </div>
                      </div>

                      <input
                        type="range"
                        min={MIN_RAM}
                        max={maxAllocatableRam}
                        step="64"
                        value={customRamValue}
                        onChange={(e) => handleCustomRamSliderChange(parseInt(e.target.value))}
                        disabled={ramMode !== 'custom'}
                        className="w-full h-3 bg-white/5 rounded-full appearance-none cursor-pointer accent-nebula-500 border border-white/5 transition-all hover:bg-white/10 disabled:opacity-30"
                      />
                      <div className="flex justify-between text-[10px] font-black italic text-dark-500 uppercase tracking-widest mt-4">
                        <span>{MIN_RAM} MB</span>
                        <span className="text-nebula-400 opacity-50 underline decoration-nebula-500/30 underline-offset-4">DYNAMIC OVERRIDE</span>
                        <span>{maxAllocatableRam} MB</span>
                      </div>
                    </div>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Repair Section - Safe action (green) - Only reinstalls Minecraft deps */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-2.5 bg-green-500/10 rounded-xl border border-green-500/20">
              <Wrench className="w-5 h-5 text-green-400" />
            </div>
            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">{t('profileOptions.repair.title', 'Instance Restoration')}</h3>
          </div>

          {!showRepairConfirm ? (
            <button
              onClick={() => setShowRepairConfirm(true)}
              className="w-full p-6 bg-green-500/5 hover:bg-green-500/10 text-green-400 border border-green-500/10 rounded-[1.5rem] transition-all text-left group/repair shadow-xl"
              disabled={isRepairing || isSaving}
            >
              <div className="font-black text-sm uppercase italic tracking-widest mb-2 group-hover/repair:text-green-300 transition-colors">{t('profileOptions.repair.button', 'INITIALIZE REPAIR SEQUENCE...')}</div>
              <div className="text-[10px] text-green-500/50 font-medium italic leading-relaxed">
                {t('profileOptions.repair.hint', 'Synchronizes Minecraft engine assets and validates structural integrity.')}
              </div>
            </button>
          ) : (
            <div className="p-8 rounded-[1.5rem] border border-green-500/20 bg-green-500/5 shadow-2xl">
              <div className="flex items-start gap-5 mb-8">
                <div className="p-3 bg-green-500/10 rounded-2xl border border-green-500/20">
                  <Wrench className="w-6 h-6 text-green-400 flex-shrink-0" />
                </div>
                <div>
                  <h4 className="text-white font-black text-base uppercase italic tracking-tighter mb-3">
                    {t('profileOptions.repair.confirmTitle', 'CONFIRM TELEMETRY REPAIR?')}
                  </h4>
                  <p className="text-[10px] text-dark-500 font-medium italic leading-relaxed">
                    {t('profileOptions.repair.confirmDescription', 'Restoration sequence will re-download core engine components. This process handles missing dependencies but preserves your custom tactical modifications (mods/config).')}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={async () => {
                    setIsRepairing(true);
                    setShowRepairConfirm(false);
                    onClose();
                    await repairModpack(modpackId);
                    setIsRepairing(false);
                  }}
                  className="flex-1 px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl transition-all font-black text-xs uppercase italic tracking-widest shadow-xl shadow-green-500/20"
                  disabled={isRepairing}
                >
                  {isRepairing ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
                      {t('profileOptions.repair.repairing', 'REPAIRING...')}
                    </div>
                  ) : (
                    t('profileOptions.repair.confirm', 'CONFIRM')
                  )}
                </button>
                <button
                  onClick={() => setShowRepairConfirm(false)}
                  className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl transition-all font-black text-xs uppercase italic tracking-widest border border-white/5"
                  disabled={isRepairing}
                >
                  {t('profileOptions.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Reinstall Section */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20">
              <RefreshCcw className="w-5 h-5 text-red-500" />
            </div>
            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">{t('profileOptions.reinstall.title', 'Instance Decommission')}</h3>
          </div>

          {!showReinstallConfirm ? (
            <button
              onClick={() => setShowReinstallConfirm(true)}
              className="w-full p-6 bg-red-500/5 hover:bg-red-500/10 text-red-500/60 hover:text-red-500 border border-red-500/10 rounded-[1.5rem] transition-all text-left group/reinstall shadow-xl"
              disabled={isReinstalling || isSaving || isRepairing}
            >
              <div className="font-black text-sm uppercase italic tracking-widest mb-2 group-hover/reinstall:text-red-500 transition-colors">{t('profileOptions.reinstall.button', 'PURGE AND RESYNC...')}</div>
              <div className="text-[10px] text-red-500/40 font-medium italic leading-relaxed">
                {t('profileOptions.reinstall.hint', 'Factory reset. Reverts entire instance configuration to baseline. Warning: Local tactical additions will be lost.')}
              </div>
            </button>
          ) : (
            <div className="p-8 rounded-[1.5rem] border border-red-500/20 bg-red-500/5 shadow-2xl">
              <div className="flex items-start gap-5 mb-8">
                <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                  <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                </div>
                <div>
                  <h4 className="text-white font-black text-base uppercase italic tracking-tighter mb-3">
                    {t('profileOptions.reinstall.confirmTitle', 'CONFIRM SIGNAL PURGE?')}
                  </h4>
                  <p className="text-[10px] text-dark-500 font-medium italic leading-relaxed">
                    {t('profileOptions.reinstall.confirmDescription', 'Total reinstallation sequence. All secondary modifications, custom mods, and configurations will be neutralized. Signal baseline will be restored from source. World data remains on disk but compatibility is not guaranteed after reset.')}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={async () => {
                    setIsReinstalling(true);
                    setShowReinstallConfirm(false);
                    onClose();
                    await reinstallModpack(modpackId);
                    setIsReinstalling(false);
                  }}
                  className="flex-1 px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl transition-all font-black text-xs uppercase italic tracking-widest shadow-xl shadow-red-500/20"
                  disabled={isReinstalling}
                >
                  {isReinstalling ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
                      {t('profileOptions.reinstall.reinstalling', 'PURGING...')}
                    </div>
                  ) : (
                    t('profileOptions.reinstall.confirm', 'CONFIRM PURGE')
                  )}
                </button>
                <button
                  onClick={() => setShowReinstallConfirm(false)}
                  className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl transition-all font-black text-xs uppercase italic tracking-widest border border-white/5"
                  disabled={isReinstalling}
                >
                  {t('profileOptions.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 mt-12 pt-8 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-8 py-4 bg-white/5 hover:bg-white/10 text-dark-500 hover:text-white rounded-2xl transition-all font-black text-xs uppercase italic tracking-widest border border-white/5"
            disabled={isSaving}
          >
            {t('profileOptions.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-10 py-4 bg-nebula-500 hover:bg-nebula-600 text-white rounded-2xl font-black text-xs uppercase italic tracking-widest transition-all shadow-xl shadow-nebula-500/20 flex items-center"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white mr-3"></div>
                {t('profileOptions.saving')}
              </>
            ) : (
              t('profileOptions.done')
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProfileOptionsModal;
