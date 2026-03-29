import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAnimation } from '../../../contexts/AnimationContext';

interface ScreenshotGalleryProps {
  images: string[];
  modpackName: string;
  variant?: 'default' | 'large';
}

const ModpackScreenshotGallery: React.FC<ScreenshotGalleryProps> = ({ images, modpackName, variant = 'default' }) => {
  const { t } = useTranslation();
  const { getAnimationStyle, withDelay } = useAnimation();
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalAnimating, setImageModalAnimating] = useState(false);
  const [isChangingImage, setIsChangingImage] = useState(false);
  const [imagesPerPage, setImagesPerPage] = useState(1);

  const getImagesPerPage = () => {
    if (variant === 'large') {
      if (window.innerWidth < 768) return 2; // Mobile larger view still 2
      if (window.innerWidth < 1280) return 4; // Tablet/Small desktop shows 4
      return 6; // Large desktop shows 6 per page
    }
    // default behavior
    if (window.innerWidth < 768) return 1; // Mobile
    if (window.innerWidth < 1280) return 2; // Tablet/Small desktop
    return 3; // Large desktop
  };

  useEffect(() => {
    const updateImagesPerPage = () => {
      setImagesPerPage(getImagesPerPage());
    };

    const handleResize = () => {
      updateImagesPerPage();
    };

    updateImagesPerPage();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const totalPages = Math.ceil(images.length / imagesPerPage);

  const nextCarouselPage = () => {
    setCurrentCarouselIndex((prev) => (prev + 1) % totalPages);
  };

  const prevCarouselPage = () => {
    setCurrentCarouselIndex((prev) => (prev - 1 + totalPages) % totalPages);
  };

  const goToCarouselPage = (pageIndex: number) => {
    setCurrentCarouselIndex(pageIndex);
  };

  const openImageModal = (index: number) => {
    setSelectedImageIndex(index);
    setImageModalOpen(true);
    withDelay(() => setImageModalAnimating(true), 50);
  };

  const closeImageModal = () => {
    setImageModalAnimating(false);
    withDelay(() => {
      setImageModalOpen(false);
      setSelectedImageIndex(null);
      setIsChangingImage(false);
    }, 75);
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (selectedImageIndex === null) return;

    const newIndex =
      direction === 'prev'
        ? selectedImageIndex === 0
          ? images.length - 1
          : selectedImageIndex - 1
        : selectedImageIndex === images.length - 1
          ? 0
          : selectedImageIndex + 1;

    // Simple zoom out/zoom in animation
    setIsChangingImage(true);

    withDelay(() => {
      setSelectedImageIndex(newIndex);
      setIsChangingImage(false);
    }, 50);
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!imageModalOpen) return;

      if (e.key === 'Escape') {
        closeImageModal();
        return;
      }

      if (e.key === 'ArrowLeft') {
        navigateImage('prev');
      } else if (e.key === 'ArrowRight') {
        navigateImage('next');
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [imageModalOpen, selectedImageIndex]);

  if (!images || images.length === 0) return null;

  return (
    <>
      {/* PC-Friendly Screenshots Carousel */}
      <div
        className="bg-white/[0.02] backdrop-blur-xl rounded-[2rem] p-8 border border-white/5 mb-8 shadow-2xl transition-all duration-300 hover:border-nebula-500/10"
        style={{
          animation: 'fadeInUp 0.15s ease-out 0.05s backwards',
          ...getAnimationStyle({}),
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-1">{t('modpacks.screenshots')}</h2>
            <p className="text-dark-500 text-[10px] font-black uppercase tracking-widest italic px-1">
              {images.length} {t('modpacks.imagesAvailable')}
            </p>
          </div>

          {/* Navigation controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center sm:justify-end gap-4">
              <button
                onClick={prevCarouselPage}
                disabled={currentCarouselIndex === 0}
                className="w-12 h-12 bg-white/5 hover:bg-nebula-500 border border-white/5 hover:border-nebula-400 disabled:opacity-20 disabled:cursor-not-allowed text-white rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xl"
                style={getAnimationStyle({})}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              {/* Page indicators */}
              <div className="flex gap-2">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => goToCarouselPage(i)}
                    className={`h-1.5 rounded-full transition-all duration-500 ${i === currentCarouselIndex
                        ? 'bg-nebula-400 w-8 shadow-[0_0_10px_rgba(139,92,246,0.5)]'
                        : 'bg-white/10 w-4 hover:bg-white/20'
                      }`}
                    style={getAnimationStyle({})}
                  />
                ))}
              </div>

              <button
                onClick={nextCarouselPage}
                disabled={currentCarouselIndex === totalPages - 1}
                className="w-12 h-12 bg-white/5 hover:bg-nebula-500 border border-white/5 hover:border-nebula-400 disabled:opacity-20 disabled:cursor-not-allowed text-white rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xl"
                style={getAnimationStyle({})}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>

        {/* Images grid - dynamic columns based on actual images */}
        <div
          className={`grid gap-6 ${(() => {
            const currentPageImages = images.slice(
              currentCarouselIndex * imagesPerPage,
              (currentCarouselIndex + 1) * imagesPerPage,
            );
            const imageCount = currentPageImages.length;

            if (imageCount === 1) return 'grid-cols-1 max-w-2xl mx-auto';
            if (imageCount === 2) return 'grid-cols-1 md:grid-cols-2';
            return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
          })()}`}
        >
          {images
            .slice(currentCarouselIndex * imagesPerPage, (currentCarouselIndex + 1) * imagesPerPage)
            .map((image, index) => {
              const actualIndex = currentCarouselIndex * imagesPerPage + index;
              return (
                <div
                  key={actualIndex}
                  className="group relative aspect-video bg-white/5 rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 hover:scale-[1.02] hover:ring-2 hover:ring-nebula-500/20 border border-white/5"
                  style={getAnimationStyle({})}
                  onClick={() => openImageModal(actualIndex)}
                >
                  <img
                    src={image}
                    alt={`${modpackName} screenshot ${actualIndex + 1}`}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Hover overlay */}
                  <div
                    className="absolute inset-0 bg-nebula-900/40 backdrop-blur-[2px] opacity-0 transition-opacity duration-500 flex items-center justify-center group-hover:opacity-100"
                  >
                    <div className="bg-nebula-500 text-white rounded-full p-4 shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-500">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Navigation hint */}
        {totalPages > 1 && (
          <div className="mt-8 text-center">
            <p className="text-dark-500 text-[10px] font-black uppercase tracking-[0.2em] italic opacity-50">{t('modpacks.carouselHint')}</p>
          </div>
        )}
      </div>

      {/* Image Modal - Properly Centered */}
      {imageModalOpen && selectedImageIndex !== null && (
        <div
          className={`fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-nebula-950/80 backdrop-blur-2xl transition-all duration-500 ease-out ${imageModalAnimating ? 'opacity-100' : 'opacity-0'}`}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
          }}
          onClick={closeImageModal}
        >
          {/* Close button */}
          <button
            onClick={closeImageModal}
            className={`absolute top-8 right-8 z-[10000] w-14 h-14 bg-white/5 backdrop-blur-xl text-white rounded-full flex items-center justify-center border border-white/10 shadow-2xl transition-all duration-300 hover:bg-red-500/20 hover:border-red-500/40 ${imageModalAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-90 translate-y-4'}`}
            style={getAnimationStyle({})}
          >
            <X className="w-6 h-6" />
          </button>

          {/* Navigation buttons */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage('prev');
                }}
                className={`absolute left-8 top-1/2 -translate-y-1/2 z-[10000] w-16 h-16 bg-white/5 backdrop-blur-xl text-white rounded-full flex items-center justify-center border border-white/10 shadow-2xl transition-all duration-300 hover:bg-nebula-500/20 hover:border-nebula-500/40 ${imageModalAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
                style={getAnimationStyle({})}
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage('next');
                }}
                className={`absolute right-8 top-1/2 -translate-y-1/2 z-[10000] w-16 h-16 bg-white/5 backdrop-blur-xl text-white rounded-full flex items-center justify-center border border-white/10 shadow-2xl transition-all duration-300 hover:bg-nebula-500/20 hover:border-nebula-500/40 ${imageModalAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
                style={getAnimationStyle({})}
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}

          {/* Centered image container - smaller size */}
          <div
            className={`relative max-w-[85vw] max-h-[85vh] flex items-center justify-center transition-all duration-500 ease-out ${imageModalAnimating ? (isChangingImage ? 'scale-95 opacity-50 blur-sm' : 'scale-100 opacity-100 blur-0') : 'scale-90 opacity-0 blur-2xl'}`}
            style={getAnimationStyle({})}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              key={selectedImageIndex}
              src={images[selectedImageIndex]}
              alt={`${modpackName} screenshot ${selectedImageIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-[2rem] shadow-[0_0_100px_rgba(139,92,246,0.3)] ring-1 ring-white/20"
              onClick={(e) => e.stopPropagation()}
              draggable={false}
              style={{
                maxWidth: '85vw',
                maxHeight: '85vh',
              }}
            />
          </div>

          {/* Image counter */}
          {images.length > 1 && (
            <div
              className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-[10000] px-6 py-3 bg-white/5 backdrop-blur-xl text-white text-xs font-black uppercase tracking-[0.3em] italic rounded-full border border-white/10 shadow-2xl transition-all duration-500 ${imageModalAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              SIGNAL {selectedImageIndex + 1} // {images.length}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ModpackScreenshotGallery; 
