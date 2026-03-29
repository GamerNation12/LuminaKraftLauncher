import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { User as UserIcon, Pencil, X, Check } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { DiscordAccount } from '../../types/launcher';
import { supabase, updateUser } from '../../services/supabaseClient';

interface ProfileEditorProps {
  NebulaUser: User;
  discordAccount: DiscordAccount | null;
  onUpdate: () => void;
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({ NebulaUser, discordAccount, onUpdate }) => {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(NebulaUser.user_metadata?.display_name || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState(displayName);

  // Sync state with prop changes (e.g. silent background updates)
  React.useEffect(() => {
    const newName = NebulaUser.user_metadata?.display_name;
    if (newName && newName !== displayName) {
      setDisplayName(newName);
    }
  }, [NebulaUser]);

  const handleStartEdit = () => {
    setTempDisplayName(displayName);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setTempDisplayName(displayName);
    setIsEditing(false);
  };

  const handleUpdateDisplayName = async () => {
    if (!tempDisplayName.trim()) {
      toast.error(t('validation.displayNameEmpty'));
      return;
    }

    setIsSaving(true);

    try {
      // 1. Update Supabase Auth User (metadata)
      const { error } = await supabase.auth.updateUser({
        data: { display_name: tempDisplayName }
      });

      if (error) throw error;

      // 2. Update Public User Table (DB)
      try {
        await updateUser(NebulaUser.id, { display_name: tempDisplayName });
      } catch (dbError) {
        console.error('Failed to update public user profile:', dbError);
        // Don't block UI if only DB sync fails but Auth succeeded
      }

      setDisplayName(tempDisplayName);
      setIsEditing(false); // Update local state immediately
      onUpdate(); // Notify parent

      toast.success(t('settings.profileUpdated'));
    } catch (error) {
      console.error('Error updating display name:', error);
      toast.error(t('errors.failedUpdateDisplay'));
    } finally {
      setIsSaving(false);
    }
  };

  const getProfilePicture = () => {
    if (NebulaUser.user_metadata?.avatar_url) {
      return NebulaUser.user_metadata.avatar_url;
    }

    if (discordAccount?.avatar) {
      return `https://cdn.discordapp.com/avatars/${discordAccount.id}/${discordAccount.avatar}.webp`;
    }

    return null;
  };

  const profilePic = getProfilePicture();

  return (
    <div className="flex items-center gap-8 mb-10 p-8 bg-white/5 rounded-[2rem] border border-white/5 shadow-inner transition-all hover:bg-white/[0.07] group/profile">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="absolute -inset-1 bg-gradient-to-tr from-nebula-500 to-blue-500 rounded-full blur opacity-20 group-hover/profile:opacity-40 transition-opacity"></div>
        {profilePic ? (
          <img
            src={profilePic}
            alt="Profile"
            className="w-24 h-24 rounded-full object-cover border-4 border-white/10 shadow-2xl relative z-10"
          />
        ) : (
          <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border-4 border-white/10 relative z-10">
            <UserIcon className="w-10 h-10 text-dark-500" />
          </div>
        )}
      </div>

      {/* Info & Edit */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-dark-500 uppercase tracking-[0.2em] italic mb-3 px-1">
          {t('settings.displayName')}
        </p>

        {isEditing ? (
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={tempDisplayName}
              onChange={(e) => setTempDisplayName(e.target.value)}
              disabled={isSaving}
              className="flex-1 px-5 py-3 bg-white/5 border border-nebula-500/50 rounded-2xl focus:outline-none text-white font-black italic tracking-tighter disabled:opacity-50 transition-all shadow-inner"
              placeholder="DISPLAY_NAME"
              autoFocus
            />
            <button
              onClick={handleUpdateDisplayName}
              disabled={isSaving}
              className="p-3 bg-nebula-500/10 text-nebula-400 rounded-xl hover:bg-nebula-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Check size={20} />
              )}
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="p-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <X size={20} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 group">
            <h3 className="text-3xl font-black text-white italic tracking-tighter truncate">{displayName || 'COMMAND_PILOT'}</h3>
            <button
              onClick={handleStartEdit}
              className="p-2 text-dark-500 hover:text-nebula-400 opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
              title={t('settings.edit')}
            >
              <Pencil size={18} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 mt-2 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-nebula-500 animate-pulse"></div>
          <p className="text-[10px] text-dark-500 font-bold uppercase tracking-widest truncate">{NebulaUser.email}</p>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditor;
