import React from 'react';
import { ExternalLink, ShieldAlert, FileCode, BookOpen, MessageSquare, Heart } from 'lucide-react';
import type { Modpack } from '../../../types/launcher';

interface ModpackInfoProps {
  modpack: Modpack;
}

const ModpackInfo: React.FC<ModpackInfoProps> = ({ modpack }) => {
  const links = modpack.links;

  const getModloaderDisplayName = (modloader?: string) => {
    if (!modloader) return 'Unknown';
    const mappings: { [key: string]: string } = {
      forge: 'Forge', fabric: 'Fabric', quilt: 'Quilt', neoforge: 'NeoForge'
    };
    return mappings[modloader.toLowerCase()] || modloader;
  };

  return (
    <div className="space-y-6">
      {/* Compatibility */}
      {modpack.gameVersions && modpack.gameVersions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-dark-400 uppercase tracking-wider">Compatibility</h3>
          <p className="text-xs text-dark-300">Minecraft: Java Edition</p>
          <div className="flex flex-wrap gap-1.5">
            {modpack.gameVersions.slice(0, 8).map((v, i) => (
              <span key={i} className="bg-dark-800 border border-dark-700/80 px-2 py-0.5 rounded-lg text-xs text-white">
                {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Platforms */}
      <div className="space-y-3 pt-4 border-t border-dark-800/80">
        <h3 className="text-xs font-bold text-dark-400 uppercase tracking-wider">Platforms</h3>
        <div className="flex flex-wrap gap-2">
          <span className="bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">
             {getModloaderDisplayName(modpack.modloader)}
          </span>
        </div>
      </div>

      {/* Links */}
      {links && (Object.values(links).some(v => v)) && (
        <div className="space-y-3 pt-4 border-t border-dark-800/80">
          <h3 className="text-xs font-bold text-dark-400 uppercase tracking-wider">Links</h3>
          <div className="space-y-2">
            {links.issues && (
              <a href={links.issues} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-dark-200 hover:text-white text-sm group">
                <ShieldAlert className="w-4 h-4 text-dark-400 group-hover:text-emerald-400" />
                <span>Report issues</span>
                <ExternalLink className="w-3.5 h-3.5 ml-auto text-dark-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            )}
            {links.source && (
              <a href={links.source} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-dark-200 hover:text-white text-sm group">
                <FileCode className="w-4 h-4 text-dark-400 group-hover:text-emerald-400" />
                <span>View source</span>
                <ExternalLink className="w-3.5 h-3.5 ml-auto text-dark-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            )}
            {links.wiki && (
              <a href={links.wiki} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-dark-200 hover:text-white text-sm group">
                <BookOpen className="w-4 h-4 text-dark-400 group-hover:text-emerald-400" />
                <span>Visit wiki</span>
                <ExternalLink className="w-3.5 h-3.5 ml-auto text-dark-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            )}
            {links.discord && (
              <a href={links.discord} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-dark-200 hover:text-white text-sm group">
                <MessageSquare className="w-4 h-4 text-dark-400 group-hover:text-emerald-400" />
                <span>Join Discord server</span>
                <ExternalLink className="w-3.5 h-3.5 ml-auto text-dark-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Donate */}
      {links?.donate && (
        <div className="pt-4 border-t border-dark-800/80">
          <a href={links.donate} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/20 rounded-xl py-2 text-sm font-medium transition-colors">
            <Heart className="w-4 h-4 fill-pink-500/30" />
            <span>Donate</span>
          </a>
        </div>
      )}
    </div>
  );
};

export default ModpackInfo;
 