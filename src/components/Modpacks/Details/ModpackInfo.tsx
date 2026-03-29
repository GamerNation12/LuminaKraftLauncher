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
    <div className="space-y-8 bg-white/[0.02] backdrop-blur-xl border border-white/5 p-8 rounded-[2rem] shadow-2xl">
      {/* Compatibility */}
      {modpack.gameVersions && modpack.gameVersions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-dark-500 uppercase tracking-[0.2em] italic">Compatibility</h3>
          <div className="flex flex-wrap gap-2">
            {modpack.gameVersions.slice(0, 8).map((v, i) => (
              <span key={i} className="bg-white/5 border border-white/5 px-3 py-1 rounded-full text-[10px] font-black text-white hover:border-nebula-500/20 transition-all cursor-default">
                {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Platforms */}
      <div className="space-y-4 pt-6 border-t border-white/5">
        <h3 className="text-[10px] font-black text-dark-500 uppercase tracking-[0.2em] italic">Engine</h3>
        <div className="flex flex-wrap gap-2">
          <span className="bg-nebula-500/10 text-nebula-400 border border-nebula-500/20 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest italic">
             {getModloaderDisplayName(modpack.modloader)}
          </span>
        </div>
      </div>

      {/* Links */}
      {links && (Object.values(links).some(v => v)) && (
        <div className="space-y-4 pt-6 border-t border-white/5">
          <h3 className="text-[10px] font-black text-dark-500 uppercase tracking-[0.2em] italic">Data Links</h3>
          <div className="space-y-3">
            {links.issues && (
              <a href={links.issues} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-dark-400 hover:text-white text-xs font-bold uppercase tracking-widest italic group">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-nebula-500/10 transition-all border border-white/5 group-hover:border-nebula-500/20">
                  <ShieldAlert className="w-4 h-4 text-dark-400 group-hover:text-nebula-400" />
                </div>
                <span>Report issues</span>
                <ExternalLink className="w-3.5 h-3.5 ml-auto text-dark-500 opacity-0 group-hover:opacity-100 transition-all" />
              </a>
            )}
            {links.source && (
              <a href={links.source} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-dark-400 hover:text-white text-xs font-bold uppercase tracking-widest italic group">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-nebula-500/10 transition-all border border-white/5 group-hover:border-nebula-500/20">
                  <FileCode className="w-4 h-4 text-dark-400 group-hover:text-nebula-400" />
                </div>
                <span>View source</span>
                <ExternalLink className="w-3.5 h-3.5 ml-auto text-dark-500 opacity-0 group-hover:opacity-100 transition-all" />
              </a>
            )}
            {links.wiki && (
              <a href={links.wiki} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-dark-400 hover:text-white text-xs font-bold uppercase tracking-widest italic group">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-nebula-500/10 transition-all border border-white/5 group-hover:border-nebula-500/20">
                  <BookOpen className="w-4 h-4 text-dark-400 group-hover:text-nebula-400" />
                </div>
                <span>Visit wiki</span>
                <ExternalLink className="w-3.5 h-3.5 ml-auto text-dark-500 opacity-0 group-hover:opacity-100 transition-all" />
              </a>
            )}
            {links.discord && (
              <a href={links.discord} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-dark-400 hover:text-white text-xs font-bold uppercase tracking-widest italic group">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-nebula-500/10 transition-all border border-white/5 group-hover:border-nebula-500/20">
                  <MessageSquare className="w-4 h-4 text-dark-400 group-hover:text-nebula-400" />
                </div>
                <span>Join Discord server</span>
                <ExternalLink className="w-3.5 h-3.5 ml-auto text-dark-500 opacity-0 group-hover:opacity-100 transition-all" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Donate */}
      {links?.donate && (
        <div className="pt-6 border-t border-white/5">
          <a href={links.donate} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-3 bg-red-500/5 hover:bg-red-500/10 text-red-500/60 hover:text-red-500 border border-red-500/10 hover:border-red-500/20 rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest italic transition-all shadow-xl shadow-red-500/5">
            <Heart className="w-4 h-4 fill-red-500/20" />
            <span>Support Transmission</span>
          </a>
        </div>
      )}
    </div>
  );
};

export default ModpackInfo;
 
