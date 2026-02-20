/**
 * Geocoding API Route - Proxy to Python backend
 * 
 * Converts POI names to coordinates using the backend's Nominatim service
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export interface GeocodeRequest {
    places: Array<{ name: string; id?: string }>;
    city: string;
}

export interface GeocodedPlace {
    name: string;
    id?: string;
    lat: number;
    lng: number;
    found: boolean;
    address?: string;
}

export async function POST(req: Request) {
    try {
        const body: GeocodeRequest = await req.json();
        const { places, city } = body;

        if (!places?.length || !city) {
            return Response.json(
                { error: 'places array and city are required' },
                { status: 400 }
            );
        }

        // Call Python backend's batch geocode endpoint
        const response = await fetch(`${BACKEND_URL}/api/geocode/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ places, city }),
        });

        if (!response.ok) {
            // Fallback: geocode one by one
            const results: GeocodedPlace[] = [];

            for (const place of places) {
                try {
                    const singleResponse = await fetch(`${BACKEND_URL}/api/geocode`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: place.name, city }),
                    });

                    if (singleResponse.ok) {
                        const data = await singleResponse.json();
                        if (data.success && data.lat && data.lng) {
                            results.push({
                                name: place.name,
                                id: place.id,
                                lat: data.lat,
                                lng: data.lng,
                                found: true,
                                address: data.display_name,
                            });
                        } else {
                            results.push({ name: place.name, id: place.id, lat: 0, lng: 0, found: false });
                        }
                    } else {
                        results.push({ name: place.name, id: place.id, lat: 0, lng: 0, found: false });
                    }
                } catch {
                    results.push({ name: place.name, id: place.id, lat: 0, lng: 0, found: false });
                }
            }

            return Response.json({ success: true, results });
        }

        const data = await response.json();
        return Response.json(data);
    } catch (error) {
        console.error('Geocode API error:', error);
        return Response.json(
            { error: 'Failed to geocode places' },
            { status: 500 }
        );
    }
}
