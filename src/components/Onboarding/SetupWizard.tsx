import React, { useState, useEffect } from 'react';
import { User, Check, ArrowRight, ChevronRight, Gamepad2, Monitor, ExternalLink, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useLauncher } from '../../contexts/LauncherContext';
import AuthService from '../../services/authService';
import { ModpackManagementService } from '../../services/modpackManagementService';
import logo from '../../assets/logo.png';

interface SetupWizardProps {
    onComplete: () => void;
}

type Step = 'welcome' | 'account' | 'profile' | 'finish';

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
    const { t, i18n } = useTranslation();
    const { userSettings, updateUserSettings, changeLanguage } = useLauncher();
    const [step, setStep] = useState<Step>('welcome');
    const [username, setUsername] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    // Local state to prevent flickering if context updates are slow/resetting
    const [localMsAccount, setLocalMsAccount] = useState<any>(null); // Type 'any' to avoid import complexity for now, or use MicrosoftAccount if imported

    // Animation state (simple fade/slide effect)
    const [animating, setAnimating] = useState(false);

    // Initialize username from settings if available
    useEffect(() => {
        if (userSettings.username && userSettings.username !== 'Player') {
            setUsername(userSettings.username);
        } else if (userSettings.microsoftAccount?.username) {
            setUsername(userSettings.microsoftAccount.username);
        }
    }, [userSettings]);

    const changeStep = (newStep: Step) => {
        setAnimating(true);
        setTimeout(() => {
            setStep(newStep);
            setAnimating(false);
        }, 300);
    };

    const handleMicrosoftLogin = async () => {
        try {
            setIsLoading(true);
            const authService = AuthService.getInstance();
            const account = await authService.authenticateWithMicrosoftModal();

            if (account) {
                setLocalMsAccount(account);
                // Register with ModpackManagementService (same as AccountDropdown)
                ModpackManagementService.getInstance().setMicrosoftAccount(account);
                await updateUserSettings({
                    authMethod: 'microsoft',
                    microsoftAccount: account,
                    username: account.username
                });
            }
        } catch (error) {
            console.error('Microsoft login failed', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLuminaLogin = async () => {
        try {
            setIsLoading(true);
            const authService = AuthService.getInstance();
            await authService.signInToNebulaAccount();
        } catch (error) {
            console.error('Nebula login failed', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNextFromAccount = () => {
        const msAccount = userSettings.microsoftAccount || localMsAccount;
        if (msAccount) {
            // If logged in with Microsoft, skip profile (username) step
            changeStep('finish');
        } else {
            changeStep('profile');
        }
    };

    const handleBack = () => {
        if (step === 'account') changeStep('welcome');
        if (step === 'profile') changeStep('account');
        if (step === 'finish') {
            // If logged in with Microsoft, go back to account (profile offline step is skipped)
            const msAccount = userSettings.microsoftAccount || localMsAccount;
            if (msAccount) {
                changeStep('account');
            } else {
                changeStep('profile');
            }
        }
    };

    const handleFinish = async () => {
        // If username was set in profile step (offline mode), save it
        if (username && username.trim() !== '' && (!userSettings.microsoftAccount && !userSettings.discordAccount)) {
            await updateUserSettings({
                username: username,
                authMethod: 'offline',
                onboardingCompleted: true
            });
        } else {
            // Just mark as completed
            await updateUserSettings({ onboardingCompleted: true });
        }
        onComplete();
    };

    const handleOpenDiscord = async () => {
        try {
            await invoke('open_url', { url: "https://discord.gg/UJZRrcUFMj" });
        } catch (error) {
            console.warn('Tauri command not available, using fallback:', error);
            window.open("https://discord.gg/UJZRrcUFMj", '_blank', 'noopener,noreferrer');
        }
    };

    const renderWelcome = () => (
        <div className="flex flex-col items-center justify-center text-center space-y-10 animate-fadeIn h-full relative overflow-hidden nebula-glow-bg">
            {/* Dynamic Star Field Overlay */}
            <div className="absolute inset-0 z-0 opacity-60 pointer-events-none">
                {/* Fixed Stars with Twinkle */}
                {[...Array(80)].map((_, i) => (
                    <div 
                        key={`star-${i}`}
                        className="star"
                        style={{
                            top: `${Math.random() * 100}%`,
                            left: `${Math.random() * 100}%`,
                            width: `${Math.random() * 2 + 1}px`,
                            height: `${Math.random() * 2 + 1}px`,
                            '--duration': `${Math.random() * 3 + 2}s`,
                            '--delay': `${Math.random() * 5}s`
                        } as any}
                    />
                ))}

                {/* Shooting Stars */}
                <div className="shooting-star top-[15%] right-[10%]" style={{ animationDelay: '0s', animationDuration: '3s' }}></div>
                <div className="shooting-star top-[40%] right-[30%]" style={{ animationDelay: '6s', animationDuration: '4s' }}></div>
                <div className="shooting-star top-[65%] right-[5%]" style={{ animationDelay: '12s', animationDuration: '5s' }}></div>
            </div>

            <div className="relative z-10 group">
                <div className="relative w-32 h-32 flex items-center justify-center transition-transform duration-700 group-hover:scale-110">
                    {/* Pulsing Glow behind logo */}
                    <div className="absolute inset-0 bg-nebula-500/40 blur-[40px] rounded-full animate-pulse"></div>
                    
                    <img 
                        src={logo} 
                        alt="Nebula Logo" 
                        className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_20px_rgba(139,92,246,0.8)] animate-float" 
                    />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-nebula-500 rounded-full flex items-center justify-center border-2 border-dark-900 z-20 shadow-lg">
                    <Check className="w-5 h-5 text-white" />
                </div>
            </div>

            <div className="space-y-4 max-w-md relative z-10">
                <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none">
                    {t('onboarding.welcome.title')}
                </h1>
                <p className="text-nebula-300/80 text-xl font-medium tracking-tight">
                    {t('onboarding.welcome.subtitle')}
                </p>
            </div>

            <button
                onClick={() => changeStep('account')}
                className="group relative flex items-center gap-3 px-10 py-5 bg-white text-dark-900 rounded-2xl font-black uppercase italic tracking-widest text-sm hover:bg-nebula-50 transition-all shadow-[0_20px_40px_-15px_rgba(255,255,255,0.3)] hover:shadow-[0_25px_50px_-12px_rgba(139,92,246,0.4)] hover:-translate-y-1 active:scale-95 z-10"
            >
                {t('onboarding.welcome.start')}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
        </div>
    );

    const renderAccount = () => {
        const msAccount = userSettings.microsoftAccount || localMsAccount;

        return (
            <div className="flex flex-col h-full animate-fadeIn">
                <div className="mb-8 text-center pt-8">
                    <h2 className="text-2xl font-bold text-white mb-2">{t('onboarding.account.title')}</h2>
                    <p className="text-gray-400">{t('onboarding.account.subtitle')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 content-center px-4 md:px-12">
                    {/* Microsoft Account Card */}
                    <div className={`relative group p-6 rounded-2xl border transition-all duration-300 ${msAccount
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-dark-800/50 border-dark-700 hover:border-nebula-500/50 hover:bg-dark-700/50'
                        }`}>
                        <div className="flex flex-col items-center space-y-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${msAccount ? 'bg-transparent' : 'bg-[#00A4EF] text-white'
                                }`}>
                                {msAccount ? (
                                    <img
                                        src={`https://mc-heads.net/avatar/${msAccount.uuid}/64`}
                                        alt={msAccount.username}
                                        className="w-full h-full rounded-xl shadow-lg border-2 border-green-500/50"
                                    />
                                ) : (
                                    <Monitor className="w-6 h-6" />
                                )}
                            </div>
                            <div className="text-center">
                                <h3 className="font-semibold text-white mb-1">{t('onboarding.account.microsoft.title')}</h3>
                                <p className="text-sm text-gray-400">{t('onboarding.account.microsoft.description')}</p>
                            </div>

                            {msAccount ? (
                                <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                                    {t('onboarding.account.microsoft.connected', { username: msAccount.username })}
                                </div>
                            ) : (
                                <button
                                    onClick={handleMicrosoftLogin}
                                    disabled={isLoading}
                                    className="w-full py-2.5 bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    {isLoading ? t('onboarding.account.microsoft.connecting') : t('onboarding.account.microsoft.connect')}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Nebula Account Card */}
                    <div className={`relative group p-6 rounded-2xl border transition-all duration-300 ${userSettings.discordAccount // Using discord account as proxy for Nebula linked account for now
                        ? 'bg-nebula-500/10 border-nebula-500/30'
                        : 'bg-dark-800/50 border-dark-700 hover:border-nebula-500/50 hover:bg-dark-700/50'
                        }`}>
                        <div className="flex flex-col items-center space-y-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${userSettings.discordAccount ? 'bg-transparent' : 'bg-nebula-600'
                                }`}>
                                {userSettings.discordAccount?.avatar ? (
                                    <img
                                        src={`https://cdn.discordapp.com/avatars/${userSettings.discordAccount.id}/${userSettings.discordAccount.avatar}.png`}
                                        alt={userSettings.discordAccount.username || 'Discord Avatar'}
                                        className="w-full h-full rounded-xl shadow-lg border-2 border-nebula-500/50"
                                    />
                                ) : (
                                    <User className="w-8 h-8 text-white" />
                                )}
                            </div>
                            <div className="text-center">
                                <h3 className="font-semibold text-white mb-1">{t('onboarding.account.Nebula.title')}</h3>
                                <p className="text-sm text-gray-400">{t('onboarding.account.Nebula.description')}</p>
                            </div>

                            {userSettings.discordAccount ? (
                                <div className="flex items-center gap-2 px-3 py-1 bg-nebula-500/20 text-nebula-300 rounded-full text-sm font-medium">
                                    <span className="w-2 h-2 rounded-full bg-nebula-400"></span>
                                    {t('onboarding.account.Nebula.connected')}
                                </div>
                            ) : (
                                <div className="flex gap-2 w-full">
                                    <button
                                        onClick={handleLuminaLogin}
                                        disabled={isLoading}
                                        className="flex-1 py-2.5 bg-nebula-600 hover:bg-nebula-500 rounded-xl text-white font-medium transition-colors text-sm"
                                    >
                                        {t('onboarding.account.Nebula.connect')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className={`mt-8 flex items-center px-4 md:px-12 pb-8 ${msAccount ? 'justify-end' : 'justify-between'}`}>
                    {!msAccount && (
                        <button
                            onClick={handleNextFromAccount}
                            className="text-gray-400 hover:text-white transition-colors text-sm font-medium"
                        >
                            {t('onboarding.account.configureLater')}
                        </button>
                    )}
                    <button
                        onClick={handleNextFromAccount}
                        className="px-6 py-2.5 bg-white text-dark-900 rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center gap-2"
                    >
                        {t('onboarding.account.next')} <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    };

    const renderProfile = () => (
        <div className="flex flex-col h-full animate-fadeIn max-w-lg mx-auto w-full justify-center">
            <div className="text-center mb-8">
                <div className="w-20 h-20 bg-dark-800 rounded-full flex items-center justify-center mx-auto mb-6 border border-dark-700">
                    <User className="w-10 h-10 text-gray-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{t('onboarding.profile.title')}</h2>
                <p className="text-gray-400">{t('onboarding.profile.subtitle')}</p>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">{t('onboarding.profile.usernameLabel')}</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t('onboarding.profile.usernamePlaceholder')}
                        className="w-full bg-dark-800 border-dark-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-nebula-500 focus:border-transparent outline-none transition-all"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                        {t('onboarding.profile.usernameDescription')}
                    </p>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={() => changeStep('finish')}
                        disabled={!username.trim()}
                        className="w-full py-3 bg-white text-dark-900 rounded-xl font-bold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t('onboarding.profile.continue')}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderFinish = () => (
        <div className="flex flex-col h-full animate-fadeIn w-full items-center justify-center text-center px-8">
            <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mb-8 ring-1 ring-green-500/20 shadow-[0_0_30px_-5px_rgba(34,197,94,0.3)]">
                <Check className="w-12 h-12 text-green-500" />
            </div>

            <h2 className="text-3xl font-bold text-white mb-3">{t('onboarding.finish.title')}</h2>
            <p className="text-gray-400 max-w-md mx-auto mb-12 text-lg">{t('onboarding.finish.description')}</p>

            <div className="w-full max-w-sm space-y-4">
                <button
                    onClick={handleFinish}
                    className="w-full py-4 bg-white text-dark-900 rounded-2xl font-bold text-lg hover:bg-gray-100 transition-all shadow-xl shadow-white/5 active:scale-95 flex items-center justify-center gap-3"
                >
                    <Gamepad2 className="w-6 h-6" />
                    {t('onboarding.finish.startPlaying')}
                </button>

                <button
                    onClick={handleOpenDiscord}
                    className="w-full py-2 text-gray-500 hover:text-indigo-400 transition-colors flex items-center justify-center gap-2 text-sm font-medium group"
                >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 71 55" xmlns="http://www.w3.org/2000/svg">
                        <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z" />
                    </svg>
                    {t('onboarding.finish.joinDiscord.button')}
                    <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                </button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-dark-900/90 backdrop-blur-md">
            {/* Background ambience */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-nebula-500/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 animate-pulse" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-pink-500/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2 animate-pulse" style={{ animationDelay: '2s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-b from-transparent via-nebula-500/5 to-transparent opacity-30" />
            </div>

            <div
                className={`w-full max-w-4xl h-[600px] bg-dark-900 rounded-3xl shadow-2xl overflow-hidden border border-dark-700 flex relative transition-all duration-300 ${animating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
            >
                <div className="relative z-10 w-full h-full p-8 md:p-12">
                    {/* Language Switcher Removed */}


                    {step !== 'welcome' && (
                        <button
                            onClick={handleBack}
                            className="absolute top-8 left-8 p-2 text-gray-500 hover:text-white transition-colors rounded-full hover:bg-white/10"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    )}

                    {step === 'welcome' && renderWelcome()}
                    {step === 'account' && renderAccount()}
                    {step === 'profile' && renderProfile()}
                    {step === 'finish' && renderFinish()}
                </div>

                {/* Status Bar / Dots */}
                {/* Status Bar / Dots */}
                {step !== 'welcome' && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
                        <div className={`w-2 h-2 rounded-full transition-colors ${step === 'account' ? 'bg-white' : 'bg-dark-600'}`} />
                        {!(userSettings.microsoftAccount || localMsAccount) && (
                            <div className={`w-2 h-2 rounded-full transition-colors ${step === 'profile' ? 'bg-white' : 'bg-dark-600'}`} />
                        )}
                        <div className={`w-2 h-2 rounded-full transition-colors ${step === 'finish' ? 'bg-white' : 'bg-dark-600'}`} />
                    </div>
                )}
            </div>
        </div>
    );
};

