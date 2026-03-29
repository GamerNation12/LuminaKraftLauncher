import type { Modpack } from '../types/launcher';
import type { ModrinthSearchResult } from '../types/modrinth';

const MODRINTH_API_URL = 'https://api.modrinth.com/v2';

export class ModrinthService {
  private static instance: ModrinthService;

  public static getInstance(): ModrinthService {
    if (!ModrinthService.instance) {
      ModrinthService.instance = new ModrinthService();
    }
    return ModrinthService.instance;
  }

  /**
   * Search for modpacks on Modrinth
   * @param query Search string
   * @param limit Maximum results (default 21)
   * @param offset Offset results (default 0)
   * @param index Sorting index (default 'relevance')
   * @param version Minecraft version filter
   * @param loader Modloader filter
   */
  async searchModpacks(query: string, limit: number = 20, offset: number = 0, index: string = 'relevance', version?: string, loader?: string, categories: string[] = []): Promise<Modpack[]> {
    try {
      const facetList: string[][] = [['project_type:modpack']];
      
      if (categories && categories.length > 0) {
        categories.forEach(cat => {
          facetList.push([`categories:${cat.toLowerCase()}`]);
        });
      }

      if (version && version.trim() !== '') {
        facetList.push([`versions:${version}`]);
      }

      if (loader && loader.trim() !== '') {
        facetList.push([`categories:${loader.toLowerCase()}`]);
      }

      const facets = encodeURIComponent(JSON.stringify(facetList));
      const url = `${MODRINTH_API_URL}/search?query=${encodeURIComponent(query)}&facets=${facets}&limit=${limit}&offset=${offset}&index=${index}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'NebulaLauncher/0.1.7 (contact@Nebula.com)'
        }
      });

      if (!response.ok) {
        throw new Error(`Modrinth API error: ${response.statusText}`);
      }

      const result: ModrinthSearchResult = await response.json();
      return result.hits.map(hit => this.mapHitToModpack(hit));
    } catch (error) {
      console.error('Error searching Modrinth modpacks:', error);
      return [];
    }
  }

  /**
   * Get detail information for a specific Modrinth modpack
   * (Matches design flow for handling clicks)
   */
  async getModpackDetails(projectId: string): Promise<Modpack | null> {
    try {
      const url = `${MODRINTH_API_URL}/project/${projectId}`;
      const response = await fetch(url);

      if (!response.ok) return null;

      const project = await response.json();
      // Fetch latest version for file URL
      const versionsResponse = await fetch(`${MODRINTH_API_URL}/project/${projectId}/version`);
      const versions = await versionsResponse.json();
      const latestVersion = versions[0];

      return {
        id: project.id,
        name: project.title,
        description: project.description,
        shortDescription: project.description?.substring(0, 150),
        longDescription: project.body,
        version: latestVersion?.version_number || '1.0.0',
        minecraftVersion: latestVersion?.game_versions?.[0] || '1.20.1',
        modloader: latestVersion?.loaders?.[0] || 'forge',
        modloaderVersion: latestVersion?.loaders?.[0] || 'unknown',
        logo: project.icon_url || '',
        backgroundImage: project.gallery?.[0]?.url || project.icon_url || '',
        images: project.gallery?.map((img: any) => img.url) || [],
        category: 'community',
        downloads: project.downloads,
        isActive: true,
        urlModpackZip: latestVersion?.files?.find((f: any) => f.primary)?.url || latestVersion?.files?.[0]?.url,
        gameVersions: latestVersion?.game_versions || [],
        links: {
          issues: project.issues_url || undefined,
          source: project.source_url || undefined,
          wiki: project.wiki_url || undefined,
          discord: project.discord_url || undefined,
          donate: project.donation_urls?.[0]?.url || undefined
        }
      };
    } catch (error) {
      console.error('Error fetching Modrinth details:', error);
      return null;
    }
  }

  /**
   * Map a Modrinth search hit onto the Launcher's generic Modpack interface
   */
  private mapHitToModpack(hit: any): Modpack {
    // Determine modloader from categories
    const modloaders = ['fabric', 'forge', 'neoforge', 'quilt'];
    const detectedModloader = hit.categories?.find((c: string) => modloaders.includes(c)) || 'forge';

    return {
      id: hit.project_id,
      name: hit.title,
      description: hit.description,
      shortDescription: hit.description,
      version: 'Latest', // Search doesn't give latest version release string directly 
      minecraftVersion: hit.versions?.[0] || 'Unknown',
      modloader: detectedModloader,
      modloaderVersion: 'latest',
      logo: hit.icon_url || '',
      backgroundImage: hit.featured_gallery || hit.icon_url || '',
      category: 'community',
      isNew: false,
      downloads: hit.downloads,
      isActive: true,
      authorName: hit.author
    };
  }
}
