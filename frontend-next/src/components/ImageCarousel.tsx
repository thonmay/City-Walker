'use client';

/**
 * ImageCarousel - Swipeable image carousel for POI cards
 * 
 * Features:
 * - Touch/mouse swipe gestures
 * - Dot indicators for position
 * - Fade-in animation as images load
 * - Robust error handling with fallback placeholders
 * - Supports progressive image loading (images array can grow)
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface ImageCarouselProps {
    images: string[];
    alt: string;
    className?: string;
    onImageLoad?: () => void;
}

export function ImageCarousel({ images, alt, className = '', onImageLoad }: ImageCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
    const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const startXRef = useRef(0);
    const dragStartedRef = useRef(false);

    // Ensure currentIndex is valid when images array changes
    useEffect(() => {
        if (currentIndex >= images.length && images.length > 0) {
            setCurrentIndex(images.length - 1);
        }
    }, [images.length, currentIndex]);

    // Preload adjacent images
    useEffect(() => {
        if (images.length <= 1) return;

        const toLoad = [currentIndex];
        if (currentIndex > 0) toLoad.push(currentIndex - 1);
        if (currentIndex < images.length - 1) toLoad.push(currentIndex + 1);

        toLoad.forEach(idx => {
            if (!loadedImages.has(idx) && !failedImages.has(idx)) {
                const img = new window.Image();
                img.src = images[idx];
                img.onload = () => {
                    setLoadedImages(prev => new Set([...prev, idx]));
                };
                img.onerror = () => {
                    setFailedImages(prev => new Set([...prev, idx]));
                };
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex, images]);

    const goToSlide = useCallback((index: number) => {
        if (index >= 0 && index < images.length) {
            setCurrentIndex(index);
        }
    }, [images.length]);

    const handleDragStart = useCallback((clientX: number) => {
        startXRef.current = clientX;
        dragStartedRef.current = true;
        setIsDragging(true);
    }, []);

    const handleDragMove = useCallback((clientX: number) => {
        if (!dragStartedRef.current) return;
        const diff = clientX - startXRef.current;
        setDragOffset(diff);
    }, []);

    const handleDragEnd = useCallback(() => {
        if (!dragStartedRef.current) return;
        dragStartedRef.current = false;
        setIsDragging(false);

        const threshold = 50; // Minimum drag distance to change slide
        if (dragOffset > threshold && currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        } else if (dragOffset < -threshold && currentIndex < images.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
        setDragOffset(0);
    }, [dragOffset, currentIndex, images.length]);

    // Mouse events
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        handleDragStart(e.clientX);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        handleDragMove(e.clientX);
    };

    const handleMouseUp = () => handleDragEnd();
    const handleMouseLeave = () => {
        if (dragStartedRef.current) handleDragEnd();
    };

    // Touch events
    const handleTouchStart = (e: React.TouchEvent) => {
        handleDragStart(e.touches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        handleDragMove(e.touches[0].clientX);
    };

    const handleTouchEnd = () => handleDragEnd();

    // Handle single image or empty state
    if (!images.length) {
        return (
            <div className={`bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center ${className}`}>
                <span className="text-4xl">📍</span>
            </div>
        );
    }

    const showNavigation = images.length > 1;
    const translateX = -currentIndex * 100 + (dragOffset / (containerRef.current?.offsetWidth || 300)) * 100;

    // Fallback placeholder component
    const FallbackPlaceholder = ({ emoji = "📍" }: { emoji?: string }) => (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center">
            <span className="text-5xl opacity-80">{emoji}</span>
        </div>
    );

    return (
        <div
            ref={containerRef}
            className={`relative overflow-hidden select-none ${className}`}
            onMouseDown={showNavigation ? handleMouseDown : undefined}
            onMouseMove={showNavigation && isDragging ? handleMouseMove : undefined}
            onMouseUp={showNavigation ? handleMouseUp : undefined}
            onMouseLeave={showNavigation ? handleMouseLeave : undefined}
            onTouchStart={showNavigation ? handleTouchStart : undefined}
            onTouchMove={showNavigation ? handleTouchMove : undefined}
            onTouchEnd={showNavigation ? handleTouchEnd : undefined}
            style={{ cursor: showNavigation ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
            {/* Image Track */}
            <div
                className="flex h-full"
                style={{
                    transform: `translateX(${translateX}%)`,
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                {images.map((src, idx) => (
                    <div
                        key={idx}
                        className="flex-shrink-0 w-full h-full relative"
                    >
                        {/* Show fallback if image failed */}
                        {failedImages.has(idx) ? (
                            <FallbackPlaceholder emoji="🏛️" />
                        ) : (
                            <>
                                {/* Loading skeleton - animated pulse */}
                                {!loadedImages.has(idx) && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200 animate-pulse" />
                                )}

                                {/* Image with fade-in */}
                                <img
                                    src={src}
                                    alt={`${alt} - ${idx + 1}`}
                                    className={`w-full h-full object-cover transition-opacity duration-300 ${loadedImages.has(idx) ? 'opacity-100' : 'opacity-0'
                                        }`}
                                    onLoad={() => {
                                        setLoadedImages(prev => new Set([...prev, idx]));
                                        if (idx === 0) onImageLoad?.();
                                    }}
                                    onError={() => {
                                        // Mark as failed to show fallback
                                        setFailedImages(prev => new Set([...prev, idx]));
                                    }}
                                    draggable={false}
                                />
                            </>
                        )}
                    </div>
                ))}
            </div>

            {/* Dot Indicators */}
            {showNavigation && (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                    {images.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={(e) => {
                                e.stopPropagation();
                                goToSlide(idx);
                            }}
                            className={`rounded-full transition-all duration-200 ${idx === currentIndex
                                ? 'w-6 h-2 bg-white shadow-md'
                                : 'w-2 h-2 bg-white/60 hover:bg-white/80'
                                }`}
                            aria-label={`Go to image ${idx + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* Image counter badge */}
            {showNavigation && (
                <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full font-medium backdrop-blur-sm">
                    {currentIndex + 1}/{images.length}
                </div>
            )}

            {/* Gradient overlay for text legibility */}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        </div>
    );
}
