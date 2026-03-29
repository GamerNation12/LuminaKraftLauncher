import { supabase } from './supabaseClient';
import { CurseForgeModInfo, CurseForgeFileInfo } from '../types/curseforge';

export class CurseForgeService {
  private static instance: CurseForgeService;

  private constructor() {
    // Supabase client handles authentication automatically
  }

  public static getInstance(): CurseForgeService {
    if (!CurseForgeService.instance) {
      CurseForgeService.instance = new CurseForgeService();
    }
    return CurseForgeService.instance;
  }

  /**
   * Helper to invoke Supabase Edge Function for CurseForge proxy
   */
  private async invokeCurseForgeProxy(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('curseforge-proxy', {
        body: {
          endpoint,
          method,
          body
        }
      });

      if (error) {
        console.error('[CurseForgeService] Edge Function error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[CurseForgeService] Error invoking CurseForge proxy:', error);
      throw error;
    }
  }

  /**
   * Obtiene información de un mod específico a través del proxy
   */
  async getModInfo(modId: number): Promise<CurseForgeModInfo | null> {
    try {
      console.log(`[CurseForgeService] Fetching mod info for: ${modId}`);
      const response = await this.invokeCurseForgeProxy(`/mods/${modId}`, 'GET');

      if (response && response.data) {
        return response.data;
      }

      console.error('Error fetching mod info: No data returned');
      return null;
    } catch (error: any) {
      console.error('Error fetching mod info:', error);
      return null;
    }
  }

  /**
   * Obtiene información sobre un archivo específico de un mod
   */
  async getModFileInfo(modId: number, fileId: number): Promise<CurseForgeFileInfo | null> {
    try {
      const response = await this.invokeCurseForgeProxy(`/mods/${modId}/files/${fileId}`, 'GET');

      if (response && response.data) {
        const fileInfo = response.data;

        // La API de CurseForge devuelve información completa incluyendo hashes
        // fileName, downloadUrl, y hashes están disponibles directamente
        console.log(`Información obtenida para archivo ${fileId}: ${fileInfo.fileName || fileInfo.displayName}`);

        return fileInfo;
      }

      console.error('Error fetching mod file info: No data returned');
      return null;
    } catch (error) {
      console.error('Error fetching mod file info:', error);
      return null;
    }
  }

  /**
   * Obtiene información de varios mods en lote
   */
  async getBatchModInfo(modIds: number[]): Promise<CurseForgeModInfo[]> {
    try {
      const response = await this.invokeCurseForgeProxy('/mods', 'POST', { modIds, filterPcOnly: true });

      if (response && Array.isArray(response.data)) {
        return response.data;
      }

      console.error('Error fetching batch mod info: No data returned');
      return [];
    } catch (error) {
      console.error('Error fetching batch mod info:', error);
      return [];
    }
  }

  /**
   * Obtiene información de varios archivos de mods en lote
   */
  async getBatchFileInfo(modFiles: { modId: number, fileId: number }[]): Promise<CurseForgeFileInfo[]> {
    try {
      const response = await this.invokeCurseForgeProxy('/mods/files', 'POST', {
        fileIds: modFiles.map(mf => mf.fileId)
      });

      if (response && Array.isArray(response.data)) {
        return response.data;
      }

      console.error('Error fetching batch file info: No data returned');
      return [];
    } catch (error) {
      console.error('Error fetching batch file info:', error);
      return [];
    }
  }

  /**
   * Obtiene la URL de descarga de un archivo específico
   */
  async getDownloadUrl(modId: number, fileId: number): Promise<string | null> {
    try {
      const fileInfo = await this.getModFileInfo(modId, fileId);
      return fileInfo?.downloadUrl || null;
    } catch (error) {
      console.error('Error getting download URL:', error);
      return null;
    }
  }

  /**
   * Search for modpacks on CurseForge
   */
  async searchModpacks(
    query: string,
    limit: number = 20,
    offset: number = 0,
    sortField: number = 2, // 2 = Popularity/Downloads, 1 = Featured, 5 = Last Updated
    version?: string,
    loader?: string
  ): Promise<any[]> {
    try {
      // modLoaderType: 0 (Any), 1 (Forge), 2 (Cauldron-skip), 3 (LiteLoader), 4 (Fabric), 5 (Quilt), 6 (NeoForge)
      let modLoaderType = 0;
      if (loader?.toLowerCase() === 'forge') modLoaderType = 1;
      else if (loader?.toLowerCase() === 'fabric') modLoaderType = 4;
      else if (loader?.toLowerCase() === 'quilt') modLoaderType = 5;
      else if (loader?.toLowerCase() === 'neoforge') modLoaderType = 6;

      const response = await this.invokeCurseForgeProxy('/mods/search', 'GET', {
        gameId: 432,
        classId: 4471,
        searchFilter: query,
        index: offset,
        pageSize: limit,
        gameVersion: version || '',
        modLoaderType,
        sortField
      });

      if (response && Array.isArray(response.data)) {
        return response.data.map((cfMod: CurseForgeModInfo) => this.mapToModpack(cfMod));
      }
      return [];
    } catch (error) {
      console.error('[CurseForgeService] searchModpacks error:', error);
      return [];
    }
  }

  /**
   * Maps CurseForgeModInfo to standard Modpack interface
   */
  private mapToModpack(cfMod: CurseForgeModInfo): any {
    const latestFile = cfMod.latestFiles?.[0];
    
    // Find the first gameVersion that isn't a modloader name
    const gameVersion = latestFile?.gameVersions?.find(v => 
      !['Forge', 'Fabric', 'NeoForge', 'Quilt', 'Liteloader'].includes(v)
    ) || 'Unknown';

    // Find modloader
    const loader = latestFile?.gameVersions?.find(v => 
      ['Forge', 'Fabric', 'NeoForge', 'Quilt'].includes(v)
    )?.toLowerCase() || 'forge';

    return {
      id: `cf-${cfMod.id}`,
      name: cfMod.name,
      shortDescription: cfMod.summary,
      longDescription: cfMod.summary,
      version: latestFile?.displayName || 'latest',
      minecraftVersion: gameVersion,
      modloader: loader,
      modloaderVersion: 'latest',
      logo: cfMod.logo?.url || '',
      backgroundImage: cfMod.logo?.url || '',
      category: 'community',
      downloads: cfMod.downloadCount,
      authorName: cfMod.links?.websiteUrl?.split('/').pop() || 'Unknown',
      isActive: true,
      allowCustomMods: true,
      allowCustomResourcepacks: true
    };
  }

  /**
   * Debug method to test authentication with the proxy
   */
  async testAuthentication(): Promise<boolean> {
    try {
      console.log('[CurseForgeService] Testing authentication with Supabase Edge Function');
      // Try to fetch a known mod to test the proxy
      const testMod = await this.getModInfo(32274); // JEI mod ID for testing
      console.log('[CurseForgeService] Authentication test successful:', !!testMod);
      return !!testMod;
    } catch (error: any) {
      console.error('[CurseForgeService] Authentication test failed:', error);
      return false;
    }
  }
} 
