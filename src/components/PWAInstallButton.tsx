import React, { useState } from 'react';
import { Download, Smartphone, X, Share, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  showLabel = false,
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  // If app is already installed in standalone mode, hide
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (!success) {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        title="Installer l'application sur votre appareil"
        className={`group relative flex items-center justify-center transition-all cursor-pointer rounded-xl border border-purple-500/30 hover:border-purple-400 bg-gradient-to-r from-purple-600/20 via-indigo-600/20 to-blue-600/20 hover:from-purple-600/35 hover:to-blue-600/35 text-purple-200 hover:text-white shadow-sm ${
          compact
            ? 'p-1.5 sm:p-2'
            : showLabel
            ? 'px-3 py-1.5 gap-2 text-xs font-bold'
            : 'p-1.5 sm:p-2 xl:px-2.5 xl:py-1.5 gap-1.5 text-xs font-bold'
        } ${className}`}
      >
        <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 group-hover:scale-110 transition-transform shrink-0" />
        {showLabel && <span>Installer l'application</span>}
        {!compact && !showLabel && (
          <span className="hidden xl:inline text-[11px] font-bold">Installer</span>
        )}
      </button>

      {/* Guide Modal for iOS Safari / Android without instant prompt */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-[#161622] border border-white/10 p-6 shadow-2xl text-left">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 p-0.5 shadow-lg shadow-purple-600/30">
                <div className="w-full h-full bg-[#161622] rounded-2xl flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-purple-400" />
                </div>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Installer NLSbox</h3>
                <p className="text-xs text-purple-300/80">Application mobile plein écran</p>
              </div>
            </div>

            {isIOS ? (
              <div className="space-y-3.5 my-4">
                <p className="text-xs text-gray-300 leading-relaxed">
                  Installez NLSbox directement sur l'écran d'accueil de votre iPhone ou iPad en 2 étapes :
                </p>
                <div className="bg-[#101018] rounded-xl p-3 border border-white/5 space-y-2.5 text-xs text-gray-300">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      1
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>Touchez le bouton</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 text-white font-medium">
                        <Share className="w-3 h-3 text-blue-400" /> Partager
                      </span>
                      <span>dans Safari.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      2
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>Faites défiler et choisissez</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 text-white font-medium">
                        <PlusSquare className="w-3 h-3 text-purple-400" /> Sur l'écran d'accueil
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 italic">
                  L'application s'ouvrira ensuite en plein écran sans barre d'adresse de navigateur.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5 my-4">
                <p className="text-xs text-gray-300 leading-relaxed">
                  Ajoutez l'application sur votre écran d'accueil pour profiter d'une lecture fluide, plein écran et d'un lancement instantané.
                </p>
                {isInstallable ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await install();
                      setShowModal(false);
                    }}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Installer maintenant</span>
                  </button>
                ) : (
                  <div className="bg-[#101018] rounded-xl p-3 border border-white/5 space-y-2 text-xs text-gray-300">
                    <p className="font-semibold text-white">Depuis votre navigateur :</p>
                    <p className="text-gray-400">
                      1. Appuyez sur le menu <strong className="text-white">(⋮)</strong> en haut à droite.
                    </p>
                    <p className="text-gray-400">
                      2. Sélectionnez <strong className="text-white">« Installer l'application »</strong> ou <strong className="text-white">« Ajouter à l'écran d'accueil »</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full mt-2 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
};
