import React from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';

const libraries = ['places'];

const containerStyle = {
    width: '100%',
    height: '400px',
    borderRadius: '8px'
};

const defaultCenter = {
    lat: 28.6139,
    lng: 77.2090
};

const GoogleMapsComponent = ({ latitude, longitude, onMarkerDrag, onLocationSelect }) => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: apiKey,
        libraries: libraries,
        version: 'weekly'
    });

    const [map, setMap] = React.useState(null);

    const onLoad = React.useCallback(function callback(map) {
        const bounds = new window.google.maps.LatLngBounds({ lat: latitude || defaultCenter.lat, lng: longitude || defaultCenter.lng });
        map.fitBounds(bounds);
        setMap(map);
    }, [latitude, longitude]);

    const onUnmount = React.useCallback(function callback(map) {
        setMap(null);
    }, []);

    const onMarkerDragEnd = (e) => {
        const newLat = e.latLng.lat();
        const newLng = e.latLng.lng();
        if (onMarkerDrag) {
            onMarkerDrag(newLat, newLng);
        }
    };

    const onMapClick = (e) => {
        const newLat = e.latLng.lat();
        const newLng = e.latLng.lng();
        if (onLocationSelect) {
            onLocationSelect(newLat, newLng);
        }
    };

    if (loadError || !apiKey) {
        return (
            <div className="bg-gray-100 rounded-lg p-4 h-64 flex items-center justify-center border-2 border-dashed border-gray-300">
                <div className="text-center">
                    <p className="text-gray-600 font-medium mb-2">Map unavailable</p>
                    <p className="text-sm text-gray-500">
                        {!apiKey 
                            ? 'Google Maps API key not configured'
                            : 'Failed to load map. Please check your API key.'}
                    </p>
                    {latitude && longitude && (
                        <a
                            href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline mt-4 inline-block"
                        >
                            View on Google Maps →
                        </a>
                    )}
                </div>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className="bg-gray-100 rounded-lg p-4 h-64 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading map...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={latitude && longitude ? { lat: parseFloat(latitude), lng: parseFloat(longitude) } : defaultCenter}
                zoom={latitude && longitude ? 17 : 12}
                onLoad={onLoad}
                onUnmount={onUnmount}
                onClick={onMapClick}
                options={{
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: true,
                    clickableIcons: false
                }}
            >
                {latitude && longitude && (
                    <Marker
                        position={{ lat: parseFloat(latitude), lng: parseFloat(longitude) }}
                        draggable={true}
                        onDragEnd={onMarkerDragEnd}
                        icon={{
                            url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                            scaledSize: new window.google.maps.Size(40, 40)
                        }}
                    />
                )}
            </GoogleMap>
        </div>
    );
};

export default GoogleMapsComponent;

