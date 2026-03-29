import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Download, FolderOpen, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import toast from 'react-hot-toast';
import { appDataDir, tempDir } from '@tauri-apps/api/path';
import { remove, readFile, writeFile } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import JSZip from 'jszip';
import ModpackValidationService, { ModFileInfo } from '../../services/modpackValidationService';
import ModpackValidationDialog from './ModpackValidationDialog';
import { useLauncher } from '../../contexts/LauncherContext';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import LauncherService from '../../services/launcherService';
import type { Modpack } from '../../types/launcher';
import CompactModpackCard from './CompactModpackCard';
import InstanceSidebar from './InstanceSidebar';

interface LocalInstance {
  id: string;
  name: string;
  version: string;
  minecraftVersion: string;
  modloader: string;
  modloaderVersion: string;
  installedAt: string;
}

interface MyModpacksPageProps {
  initialModpackId?: string;
  onNavigate?: (_section: string, _modpackId?: string) => void;
}

export function MyModpacksPage({ initialModpackId, onNavigate: _onNavigate }: MyModpacksPageProps) {
  const { t } = useTranslation();
  const validationService = ModpackValidationService.getInstance();
  const launcherService = LauncherService.getInstance();
  const { installModpackFromZip, modpackStates, refreshData } = useLauncher();
  const lastProcessedStateRef = useRef<string>('');
  const launcherDataDirRef = useRef<string | null>(null);

  // State management
  const [instances, setInstances] = useState<LocalInstance[]>([]);
  const [modpackDataMap, setModpackDataMap] = useState<Map<string, Modpack>>(new Map());
  const [selectedModpackId, setSelectedModpackId] = useState<string | null>(initialModpackId || null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [showValidationProgress, setShowValidationProgress] = useState(false);
  const [_validationProgressMessage, setValidationProgressMessage] = useState('');
  const [importingModpackId, setImportingModpackId] = useState<string | null>(null);
  const [tempZipPath, setTempZipPath] = useState<string | null>(null);

  // Import/validation state
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationData, setValidationData] = useState<{
    modpackName: string;
    modsWithoutUrl: ModFileInfo[];
    modsInOverrides: string[];
    filePath: string;
  } | null>(null);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [pendingUploadedFiles, setPendingUploadedFiles] = useState<Map<string, File> | null>(null);

  const resolveImagePaths = async (modpack: Modpack): Promise<Modpack> => {
    if (!launcherDataDirRef.current) {
      try {
        const appData = await appDataDir();
        launcherDataDirRef.current = appData.endsWith('/') ? appData.slice(0, -1) : appData;
      } catch (error) {
        console.error('Failed to get app data directory:', error);
        return modpack;
      }
    }

    const resolved = { ...modpack };

    if (resolved.logo && (resolved.logo.startsWith('meta/') || resolved.logo.startsWith('caches/'))) {
      const fullPath = `${launcherDataDirRef.current}/${resolved.logo}`;
      try {
        resolved.logo = await invoke<string>('get_file_as_data_url', { filePath: fullPath });
      } catch (error) {
        console.error('Failed to load logo:', error);
        resolved.logo = '';
      }
    }

    if (resolved.backgroundImage && (resolved.backgroundImage.startsWith('meta/') || resolved.backgroundImage.startsWith('caches/'))) {
      const fullPath = `${launcherDataDirRef.current}/${resolved.backgroundImage}`;
      try {
        resolved.backgroundImage = await invoke<string>('get_file_as_data_url', { filePath: fullPath });
      } catch (error) {
        console.error('Failed to load background:', error);
        resolved.backgroundImage = '';
      }
    }

    return resolved;
  };

  const cleanupOldTempFiles = async () => {
    try {
      console.log('[Cleanup] Ready to clean up old temp files on demand');
    } catch (error) {
      console.warn('[Cleanup] Failed to clean old temp files:', error);
    }
  };

  useEffect(() => {
    setSelectedModpackId(initialModpackId || null);
  }, [initialModpackId]);

  useEffect(() => {
    cleanupOldTempFiles();
    loadInstancesAndMetadata();
  }, []);

  useEffect(() => {
    const handleStateChange = async () => {
      const installingIds = Object.entries(modpackStates)
        .filter(([_, state]) => state.status === 'installing')
        .map(([id]) => id);

      const installedIds = Object.entries(modpackStates)
        .filter(([_, state]) => state.status === 'installed')
        .map(([id]) => id);

      const initialPhaseIds = installingIds.filter(id => {
        const state = modpackStates[id];
        return state.status === 'installing' && !state.downloading;
      });

      if (initialPhaseIds.length > 0) {
        setImportingModpackId(initialPhaseIds[0]);
      } else if (importingModpackId && !installingIds.includes(importingModpackId)) {
        setImportingModpackId(null);
      }

      const currentInstallingHash = JSON.stringify(installingIds.sort());
      if (lastProcessedStateRef.current === currentInstallingHash) return;
      lastProcessedStateRef.current = currentInstallingHash;

      if (installingIds.length === 0 && installedIds.length > 0) {
        await saveInstallingModpackMetadata();
        await new Promise(resolve => setTimeout(resolve, 100));
        loadInstancesAndMetadata();
        return;
      }

      const recentlyRemoved = instances.some(instance => !installedIds.includes(instance.id));
      if (recentlyRemoved) loadInstancesAndMetadata();
    };

    handleStateChange();
  }, [modpackStates]);

  const saveInstallingModpackMetadata = async () => {
    const installedIds = Object.entries(modpackStates)
      .filter(([_, state]) => state.status === 'installed')
      .map(([id]) => id);

    for (const id of installedIds) {
      if (!instances.some(i => i.id === id)) {
        try {
          const savedData = localStorage.getItem(`installing_modpack_${id}`);
          if (savedData) {
            const modpack = JSON.parse(savedData);
            const essentialMetadata = {
              name: modpack.name || '',
              logo: modpack.logo || '',
              backgroundImage: modpack.backgroundImage || '',
              shortDescription: modpack.shortDescription || '',
              description: modpack.description || '',
              urlModpackZip: modpack.urlModpackZip || ''
            };
            await invoke('save_modpack_metadata_json', {
              modpackId: id,
              modpackJson: JSON.stringify(essentialMetadata)
            });
            localStorage.removeItem(`installing_modpack_${id}`);
          }
        } catch (error) {
          console.error(`Failed to save metadata for ${id}:`, error);
        }
      }
    }
  };

  const loadInstancesAndMetadata = async () => {
    try {
      setLoading(true);
      const result = await invoke<string>('get_local_modpacks');
      const parsedInstances: LocalInstance[] = JSON.parse(result);
      setInstances(parsedInstances);

      const dataMap = new Map<string, Modpack>();
      const installingIds = Object.entries(modpackStates)
        .filter(([_, state]) => state.status === 'installing')
        .map(([id]) => id);

      const allIdsToLoad = [...new Set([...parsedInstances.map(i => i.id), ...installingIds])];

      await Promise.all(
        allIdsToLoad.map(async (id) => {
          try {
            const cachedData = await invoke<string | null>('get_cached_modpack_data', { modpackId: id });
            if (cachedData) {
              let modpack = JSON.parse(cachedData) as Modpack;
              const isServerModpack = !!modpack.urlModpackZip;
              const requiredFields = ['name', 'logo', 'backgroundImage', 'shortDescription', 'description', 'urlModpackZip'];
              const isCacheIncomplete = requiredFields.some(field => !modpack[field as keyof Modpack]);

              if (isServerModpack || isCacheIncomplete) {
                try {
                  const serverData = await launcherService.fetchModpackDetails(id);
                  if (serverData) {
                    modpack = {
                      ...serverData,
                      ...modpack,
                      name: modpack.name || serverData.name || '',
                      shortDescription: modpack.shortDescription || serverData.shortDescription || '',
                      description: modpack.description || serverData.description || '',
                      urlModpackZip: modpack.urlModpackZip || serverData.urlModpackZip || '',
                      allowCustomMods: serverData.allowCustomMods,
                      allowCustomResourcepacks: serverData.allowCustomResourcepacks,
                      category: serverData.category,
                    };
                  }
                } catch (e) { console.warn(`Enrichment failed for ${id}:`, e); }
              }
              modpack = await resolveImagePaths(modpack);
              dataMap.set(id, modpack);
              return;
            }

            try {
              const modpack = await launcherService.fetchModpackDetails(id);
              if (modpack) {
                await invoke('save_modpack_metadata_json', {
                  modpackId: id,
                  modpackJson: JSON.stringify({
                    name: modpack.name || '',
                    logo: modpack.logo || '',
                    backgroundImage: modpack.backgroundImage || '',
                    shortDescription: modpack.shortDescription || '',
                    description: modpack.description || '',
                    urlModpackZip: modpack.urlModpackZip || ''
                  })
                });
                dataMap.set(id, modpack);
              }
            } catch {
              const localInstance = parsedInstances.find(i => i.id === id);
              if (localInstance) {
                dataMap.set(id, {
                  id: localInstance.id,
                  name: localInstance.name,
                  version: localInstance.version,
                  minecraftVersion: localInstance.minecraftVersion,
                  modloader: localInstance.modloader,
                  modloaderVersion: localInstance.modloaderVersion,
                  category: 'community',
                  logo: '',
                  backgroundImage: '',
                  description: '',
                  shortDescription: '',
                  urlModpackZip: ''
                });
              }
            }
          } catch (error) {
            console.error(`Error loading metadata for ${id}:`, error);
          }
        })
      );

      setModpackDataMap(dataMap);
    } catch (error) {
      console.error('Error loading local modpacks:', error);
      toast.error(t('errors.failedLoadModpacks'));
    } finally {
      setLoading(false);
    }
  };

  const handleModpackSelect = (modpackId: string) => {
    setSelectedModpackId(modpackId);
  };

  const handleBackToList = () => {
    setSelectedModpackId(null);
    if (_onNavigate) _onNavigate('my-modpacks');
  };

  const handleModpackUpdated = async (modpackId: string, updates: Partial<Modpack>) => {
    try {
      const currentModpack = modpackDataMap.get(modpackId);
      if (!currentModpack) return;
      const updated = { ...currentModpack, ...updates };
      if (updates.logo || updates.backgroundImage) {
        const resolved = await resolveImagePaths(updated);
        setModpackDataMap(prev => new Map(prev).set(modpackId, resolved));
      } else {
        setModpackDataMap(prev => new Map(prev).set(modpackId, updated));
      }
    } catch (error) {
      console.error('Failed to update modpack:', error);
    }
  };

  const handleImportModpack = async () => {
    setValidating(false);
    try {
      const filePath = await open({
        multiple: false,
        filters: [{ name: 'Modpack Files', extensions: ['zip', 'mrpack'] }],
        title: 'Select Modpack File'
      });
      if (filePath) await handleFileSelected(filePath as string);
    } catch (error) {
      console.error('[Import] Failed to open file dialog:', error);
      toast.error('Failed to open file dialog');
    }
  };

  const handleFileSelected = async (filePath: string) => {
    if (!filePath.endsWith('.zip') && !filePath.endsWith('.mrpack')) {
      toast.error(t('validation.selectZipFile'));
      return;
    }

    try {
      setValidating(true);
      setShowValidationProgress(true);
      setValidationProgressMessage(t('myModpacks.validating'));
      const result = await validationService.validateModpackZipFromPath(filePath);

      if (!result.success) {
        setShowValidationProgress(false);
        toast.error(result.error || t('errors.failedValidateModpack'));
        return;
      }

      setShowValidationProgress(false);
      const missingMods = result.modsWithoutUrl.filter(mod => !result.modsInOverrides?.includes(mod.fileName));

      if (result.modsWithoutUrl && result.modsWithoutUrl.length > 0 && missingMods.length > 0) {
        setValidationData({
          modpackName: result.manifest?.name || filePath.split('/').pop() || 'Modpack',
          modsWithoutUrl: result.modsWithoutUrl,
          modsInOverrides: result.modsInOverrides || [],
          filePath
        });
        setShowValidationDialog(true);
      } else {
        await performImport(filePath);
      }
    } catch (error) {
      console.error('Error validating modpack:', error);
      toast.error('Failed to validate modpack');
    } finally {
      setValidating(false);
    }
  };

  const performImport = async (filePath: string) => {
    try {
      await installModpackFromZip(filePath);
      await loadInstancesAndMetadata();
      await refreshData();
    } catch (error) {
      console.error('[Import] Error installing modpack:', error);
      toast.error(error instanceof Error ? error.message : t('errors.failedInstallModpack'));
    } finally {
      if (tempZipPath) {
        try { await remove(tempZipPath); } catch (e) { console.warn('Cleanup failed:', e); }
        setTempZipPath(null);
      }
    }
  };

  const handleValidationContinue = async (uploadedFiles?: Map<string, File>) => {
    setShowValidationDialog(false);
    if (validationData) {
      if (uploadedFiles && uploadedFiles.size > 0) {
        setPendingUploadedFiles(uploadedFiles);
        setShowDownloadDialog(true);
      } else {
        await performImport(validationData.filePath);
      }
    }
  };

  const handleSkipDownload = async () => {
    if (validationData) {
      try {
        let zipToImport = validationData.filePath;
        if (pendingUploadedFiles && pendingUploadedFiles.size > 0) {
          zipToImport = await prepareZipWithOverrides(validationData.filePath, pendingUploadedFiles);
        }
        await performImport(zipToImport);
        setPendingUploadedFiles(null);
        setValidationData(null);
      } catch (error) {
        console.error('Error importing:', error);
      }
    }
  };

  const prepareZipWithOverrides = async (filePath: string, uploadedFiles: Map<string, File>): Promise<string> => {
    try {
      const buffer = await readFile(filePath);
      const zip = new JSZip();
      await zip.loadAsync(buffer);

      for (const file of uploadedFiles.values()) {
        const fileBuf = await file.arrayBuffer();
        const target = file.name.endsWith('.jar') ? `overrides/mods/${file.name}` : `overrides/resourcepacks/${file.name}`;
        zip.file(target, fileBuf);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const outBuf = await blob.arrayBuffer();
      const tempDir_ = await tempDir();
      const outPath = `${tempDir_}/nebula-import-${Date.now()}.zip`;
      await writeFile(outPath, new Uint8Array(outBuf));
      setTempZipPath(outPath);
      return outPath;
    } catch (error) {
      console.error('ZIP preparation failed:', error);
      return filePath;
    }
  };

  const handleDownloadDialogConfirm = async () => {
    if (validationData && pendingUploadedFiles) {
      try {
        setShowDownloadDialog(false);
        const updatedZip = await prepareZipWithOverrides(validationData.filePath, pendingUploadedFiles);
        await performImport(updatedZip);
        setPendingUploadedFiles(null);
        setValidationData(null);
      } catch (error) {
        console.error('Download dialog error:', error);
      }
    }
  };

  const selectedModpack = selectedModpackId ? modpackDataMap.get(selectedModpackId) : null;
  const selectedState = selectedModpackId ? (modpackStates[selectedModpackId] || {
    installed: true,
    downloading: false,
    progress: { percentage: 0 },
    status: 'installed' as const
  }) : null;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {!selectedModpack ? (
          <div className="p-8 max-w-[1600px] mx-auto">
            <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div>
                <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic">
                  {t('myModpacks.title')}
                </h1>
                <p className="text-dark-400 font-bold mt-2 text-lg">{t('myModpacks.subtitle')}</p>
              </div>
              <button
                onClick={handleImportModpack}
                disabled={validating}
                className="btn-primary flex items-center gap-3 px-8 py-4 text-lg shadow-[0_0_30px_rgba(139,92,246,0.3)] group"
              >
                <Download className="w-6 h-6 transition-transform group-hover:-translate-y-1" />
                <span>{validating ? t('myModpacks.validating') : t('myModpacks.import')}</span>
              </button>
            </div>

            {validationData && (
              <ModpackValidationDialog
                isOpen={showValidationDialog}
                onClose={() => setShowValidationDialog(false)}
                onContinue={handleValidationContinue}
                modpackName={validationData.modpackName}
                modsWithoutUrl={validationData.modsWithoutUrl}
                modsInOverrides={validationData.modsInOverrides}
              />
            )}

            {(() => {
              const installingIds = Object.entries(modpackStates)
                .filter(([id, state]) => state.status === 'installing' && !instances.some(i => i.id === id))
                .map(([id]) => id);
              
              if (instances.length === 0 && installingIds.length === 0) {
                return (
                  <div className="bg-dark-900/40 backdrop-blur-xl rounded-[2rem] p-24 border border-white/5 text-center flex flex-col items-center justify-center min-h-[400px] shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-nebula-500/5 blur-3xl rounded-full translate-y-1/2"></div>
                    <FolderOpen className="w-24 h-24 mb-6 text-dark-500 opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
                    <h2 className="text-3xl font-black text-white mb-3 tracking-tight">{t('myModpacks.empty.title')}</h2>
                    <p className="text-dark-400 max-w-sm text-lg font-medium leading-relaxed">{t('myModpacks.empty.description')}</p>
                    <button onClick={handleImportModpack} className="mt-8 text-nebula-400 font-bold hover:text-nebula-300 transition-colors">
                      {t('myModpacks.empty.button')} →
                    </button>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-6 animate-fadeInUp">
                  {installingIds.map((id, index) => {
                    const state = modpackStates[id];
                    let modData = modpackDataMap.get(id);
                    if (!modData) {
                      try {
                        const saved = localStorage.getItem(`installing_modpack_${id}`);
                        if (saved) modData = JSON.parse(saved);
                      } catch (e) { console.error(e); }
                    }
                    const modpack: Modpack = modData ? { ...modData, id } : { id, name: t('myModpacks.importing.name'), category: 'community' } as Modpack;
                    return (
                      <CompactModpackCard
                        key={`installing-${id}`}
                        modpack={modpack}
                        state={state}
                        isSelected={selectedModpackId === id}
                        onSelect={() => handleModpackSelect(id)}
                        index={index}
                      />
                    );
                  })}

                  {instances.map((instance, index) => {
                    const cached = modpackDataMap.get(instance.id);
                    const state = modpackStates[instance.id] || { installed: true, downloading: false, progress: { percentage: 0 }, status: 'installed' as const };
                    const modpack: Modpack = cached ? {
                      ...cached,
                      id: instance.id,
                      version: instance.version,
                      minecraftVersion: instance.minecraftVersion,
                      modloader: instance.modloader,
                      modloaderVersion: instance.modloaderVersion
                    } : {
                      id: instance.id,
                      name: instance.name,
                      minecraftVersion: instance.minecraftVersion,
                      modloader: instance.modloader,
                      modloaderVersion: instance.modloaderVersion,
                      category: 'community'
                    } as Modpack;
                    return (
                      <CompactModpackCard
                        key={instance.id}
                        modpack={modpack}
                        state={state}
                        isSelected={selectedModpackId === instance.id}
                        onSelect={() => handleModpackSelect(instance.id)}
                        index={index + installingIds.length}
                      />
                    );
                  })}
                </div>
              );
            })()}
          </div>
        ) : (
          /* Instance Detail View (The "Modrinth-style" Details) */
          <div className="h-full flex flex-col animate-fadeInUp">
            {selectedModpack && selectedState && (
              <InstanceSidebar
                modpack={selectedModpack}
                state={selectedState}
                onClose={handleBackToList}
                onOpenSettings={() => console.log('Settings for:', selectedModpackId)}
                onModpackUpdated={(updates) => handleModpackUpdated(selectedModpackId!, updates)}
              />
            )}
          </div>
        )}

        {loading && instances.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-900/40 backdrop-blur-sm z-50">
            <Loader2 className="w-16 h-16 text-nebula-400 animate-spin" />
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showDownloadDialog}
        onClose={() => setShowDownloadDialog(false)}
        onConfirm={handleDownloadDialogConfirm}
        onCancel={handleSkipDownload}
        title={t('myModpacks.downloadDialog.title')}
        message={t('myModpacks.downloadDialog.message', { count: pendingUploadedFiles?.size || 0 })}
        confirmText={t('myModpacks.downloadDialog.downloadButton')}
        cancelText={t('myModpacks.downloadDialog.skipButton')}
        variant="info"
      />

      {showValidationProgress && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999]">
          <div className="glass-dark border border-white/5 p-16 flex flex-col items-center gap-8 w-full max-w-md rounded-[3rem] shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-nebula-500/10 blur-3xl pointer-events-none"></div>
            <div className="relative">
              <div className="absolute inset-0 bg-nebula-500 blur-3xl opacity-30 animate-pulse" />
              <Loader2 className="w-20 h-20 text-nebula-400 animate-spin relative" />
            </div>
            <div className="text-center relative z-10">
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">
                {t('myModpacks.validating')}
              </h2>
              <p className="text-dark-300 mt-3 text-lg font-medium max-w-xs mx-auto">
                {t('myModpacks.validatingDescription')}
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default MyModpacksPage;
