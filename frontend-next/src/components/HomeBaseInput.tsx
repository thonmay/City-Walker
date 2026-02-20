'use client';

/**
 * HomeBaseInput - Set starting/ending point for trips
 * 
 * Allows tourists to set their hotel/hostel location so routes
 * start and end there (round-trip convenience).
 * 
 * Features:
 * - Address search with autocomplete (Nominatim)
 * - "Use My Location" browser geolocation
 * - Clear/edit selected location
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Coordinates } from '@/types';

export interface HomeBase {
    address: string;
    coordinates: Coordinates;
}

interface HomeBaseInputProps {
    value: HomeBase | null;
    onChange: (homeBase: HomeBase | null) => void;
    city?: string; // City context for better geocoding
    className?: string;
}

interface SearchResult {
    display_name: string;
    lat: string;
    lon: string;
}

export function HomeBaseInput({ value, onChange, city = '', className = '' }: HomeBaseInputProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Close results when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                inputRef.current && !inputRef.current.contains(e.target as Node) &&
                resultsRef.current && !resultsRef.current.contains(e.target as Node)
            ) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Search for addresses using Nominatim
    const searchAddresses = useCallback(async (query: string) => {
        if (query.length < 3) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        setError(null);

        try {
            const searchTerm = city ? `${query}, ${city}` : query;
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?` +
                new URLSearchParams({
                    q: searchTerm,
                    format: 'json',
                    limit: '5',
                    addressdetails: '1',
                }),
                {
                    headers: { 'User-Agent': 'CityWalker/1.0' },
                }
            );

            if (!response.ok) throw new Error('Search failed');

            const results: SearchResult[] = await response.json();
            setSearchResults(results);
            setShowResults(results.length > 0);
        } catch (err) {
            console.error('Address search error:', err);
            setError('Search failed. Try again.');
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [city]);

    // Debounced search
    const handleSearchChange = useCallback((query: string) => {
        setSearchQuery(query);

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            searchAddresses(query);
        }, 300);
    }, [searchAddresses]);

    // Select a search result
    const handleSelectResult = useCallback((result: SearchResult) => {
        const shortAddress = result.display_name.split(',').slice(0, 3).join(',');
        onChange({
            address: shortAddress,
            coordinates: {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
            },
        });
        setSearchQuery('');
        setShowResults(false);
        setSearchResults([]);
    }, [onChange]);

    // Use browser geolocation
    const handleUseMyLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setError('Geolocation not supported by your browser');
            return;
        }

        setIsGettingLocation(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                onChange({
                    address: 'My Location',
                    coordinates: {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    },
                });
                setIsGettingLocation(false);
            },
            (err) => {
                console.error('Geolocation error:', err);
                setError('Could not get your location');
                setIsGettingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, [onChange]);

    // Clear home base
    const handleClear = useCallback(() => {
        onChange(null);
        setSearchQuery('');
        setError(null);
    }, [onChange]);

    // If we have a value, show it with edit/clear options
    if (value) {
        return (
            <div className={`${className}`}>
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-white">
                            <path d="M8 1C5.24 1 3 3.24 3 6C3 9.5 8 15 8 15C8 15 13 9.5 13 6C13 3.24 10.76 1 8 1Z" fill="currentColor" />
                            <circle cx="8" cy="6" r="2" fill="white" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-green-800 truncate">{value.address}</p>
                        <p className="text-xs text-green-600">Routes will start & end here</p>
                    </div>
                    <button
                        onClick={handleClear}
                        className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-lg transition-colors"
                        title="Remove home base"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`${className}`}>
            {/* Search Input */}
            <div className="relative">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            onFocus={() => searchResults.length > 0 && setShowResults(true)}
                            placeholder="Enter hotel or address..."
                            className="w-full px-3 py-2.5 pr-8 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        />
                        {isSearching && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Use My Location Button */}
                    <button
                        onClick={handleUseMyLocation}
                        disabled={isGettingLocation}
                        className="px-3 py-2.5 bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-50 text-zinc-600 rounded-xl transition-colors shrink-0"
                        title="Use my current location"
                    >
                        {isGettingLocation ? (
                            <div className="w-5 h-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="2" />
                                <path d="M10 2V4M10 16V18M2 10H4M16 10H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Search Results Dropdown */}
                {showResults && searchResults.length > 0 && (
                    <div
                        ref={resultsRef}
                        className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden z-50"
                    >
                        {searchResults.map((result, index) => (
                            <button
                                key={index}
                                onClick={() => handleSelectResult(result)}
                                className="w-full px-3 py-2.5 text-left hover:bg-amber-50 border-b border-zinc-100 last:border-b-0 transition-colors"
                            >
                                <p className="text-sm text-zinc-900 truncate">
                                    {result.display_name.split(',').slice(0, 2).join(',')}
                                </p>
                                <p className="text-xs text-zinc-500 truncate">
                                    {result.display_name.split(',').slice(2, 4).join(',')}
                                </p>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <p className="mt-2 text-xs text-red-500">{error}</p>
            )}
        </div>
    );
}
