import React, { useState, useEffect } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { FaMapMarkerAlt, FaRuler, FaSave, FaTimes } from 'react-icons/fa';
import GoogleMapsComponent from '../../utils/GoogleMaps';

const AttendanceRules = () => {
    const [formData, setFormData] = useState({
        location: '',
        address: '',
        coordinates: { latitude: 0, longitude: 0 },
        maximumRadius: 500,
        enableCompOff: true,
        autoApprove: false,
        enableSimplePunches: false,
        enablePenaltyRules: true
    });

    const [mapKey, setMapKey] = useState(Date.now());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasAddress, setHasAddress] = useState(false);

    // Fetch current attendance rule on component mount
    useEffect(() => {
        fetchAttendanceRule();
    }, []);

    const fetchAttendanceRule = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/v1/admin/attendance-rules/current');

            if (response.data.success && response.data.rule) {
                console.log('=== Loading Attendance Rule ===');
                console.log('Server response:', response.data.rule);
                
                const newFormData = {
                    location: response.data.rule.location || '',
                    address: response.data.rule.address || '',
                    coordinates: response.data.rule.coordinates || { latitude: 0, longitude: 0 },
                    maximumRadius: response.data.rule.maximumRadius || 500,
                    enableCompOff: response.data.rule.enableCompOff !== undefined ? response.data.rule.enableCompOff : true,
                    autoApprove: response.data.rule.autoApprove !== undefined ? response.data.rule.autoApprove : false,
                    enableSimplePunches: response.data.rule.enableSimplePunches !== undefined ? response.data.rule.enableSimplePunches : false,
                    enablePenaltyRules: response.data.rule.enablePenaltyRules !== undefined ? response.data.rule.enablePenaltyRules : true
                };
                
                console.log('Setting form data:', newFormData);
                setFormData(newFormData);
                setHasAddress(!!response.data.rule.address);
            }
        } catch (error) {
            if (error.response?.status !== 404) {
                toast.error('Failed to fetch attendance rules');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLocationSelect = (event) => {
        const address = event.target.value;
        setFormData(prev => ({ 
            ...prev, 
            address,
            location: address // Set location same as address
        }));
        
        // Trigger map update
        if (address) {
            setHasAddress(true);
            geocodeAddress(address);
        }
    };

    const geocodeAddress = async (address) => {
        try {
            // This would typically call a geocoding API (Google Maps, Mapbox, etc.)
            // For now, we'll show the map with the address
            // In production, replace this with actual geocoding service
            toast.info('Map location will be set when you provide coordinates');
        } catch (error) {
            console.error('Geocoding error:', error);
        }
    };

    const handleCoordinateChange = (e) => {
        const { name, value } = e.target;
        const numValue = parseFloat(value) || 0;
        setFormData(prev => ({
            ...prev,
            coordinates: {
                ...prev.coordinates,
                [name]: numValue
            }
        }));
    };

    const handleSliderChange = (e) => {
        const value = parseInt(e.target.value);
        setFormData(prev => ({ ...prev, maximumRadius: value }));
    };

    const toggleFeature = (feature) => {
        setFormData(prev => ({
            ...prev,
            [feature]: !prev[feature]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Allow saving without coordinates to work without map
        if (!formData.address) {
            toast.error('Please provide an office address');
            return;
        }
        
        // Prepare the data to send
        const dataToSend = {
            ...formData,
            location: formData.location || formData.address, // Ensure location is set
            coordinates: {
                latitude: formData.coordinates.latitude || 0,
                longitude: formData.coordinates.longitude || 0
            }
        };

        console.log('=== Saving Attendance Rule ===');
        console.log('Sending data:', dataToSend);

        try {
            setSaving(true);
            const response = await axios.post(
                '/api/v1/admin/attendance-rules/create-or-update',
                dataToSend
            );

            if (response.data.success) {
                toast.success('Attendance rules saved successfully!');
                fetchAttendanceRule();
            }
        } catch (error) {
            console.error('Error saving attendance rules:', error);
            toast.error(error.response?.data?.message || 'Failed to save attendance rules');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        fetchAttendanceRule();
        toast.info('Changes cancelled');
    };

    const googleMapsUrl = formData.coordinates.latitude && formData.coordinates.longitude
        ? `https://www.google.com/maps?q=${formData.coordinates.latitude},${formData.coordinates.longitude}`
        : '';

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                    <FaRuler className="mr-3 text-blue-600" />
                    Attendance Rules
                </h2>
                <p className="text-gray-600 mt-1">Configure location-based attendance and rules</p>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-96">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <form onSubmit={handleSubmit}>
                        {/* Location Selection */}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                <FaMapMarkerAlt className="inline mr-2" />
                                Select a Location
                            </label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={handleLocationSelect}
                                placeholder="Enter office address"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {hasAddress && (
                                <a
                                    href={googleMapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                                >
                                    View on Google Maps
                                </a>
                            )}
                        </div>

                        {/* Coordinates Input */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Latitude
                                </label>
                                <input
                                    type="number"
                                    name="latitude"
                                    value={formData.coordinates.latitude || 0}
                                    onChange={handleCoordinateChange}
                                    step="any"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Longitude
                                </label>
                                <input
                                    type="number"
                                    name="longitude"
                                    value={formData.coordinates.longitude || 0}
                                    onChange={handleCoordinateChange}
                                    step="any"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Maximum Attendance Radius */}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-4">
                                Maximum Attendance Radius: {formData.maximumRadius} m
                            </label>
                            <div className="flex items-center space-x-4">
                                <span className="text-sm text-gray-600">50 m</span>
                                <input
                                    type="range"
                                    min="50"
                                    max="1000"
                                    value={formData.maximumRadius}
                                    onChange={handleSliderChange}
                                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-blue"
                                />
                                <span className="text-sm text-gray-600">1000 m</span>
                            </div>
                            <div className="mt-2">
                                <input
                                    type="number"
                                    value={formData.maximumRadius}
                                    onChange={(e) => setFormData(prev => ({ ...prev, maximumRadius: parseInt(e.target.value) || 500 }))}
                                    min="50"
                                    max="1000"
                                    className="px-3 py-1 border border-gray-300 rounded w-24 text-center"
                                />
                                <span className="ml-2 text-sm text-gray-600">meters</span>
                            </div>
                        </div>

                        {/* Map Visualization */}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Office Location Map
                            </label>
                            <GoogleMapsComponent
                                latitude={formData.coordinates.latitude}
                                longitude={formData.coordinates.longitude}
                                onMarkerDrag={(newLat, newLng) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        coordinates: {
                                            latitude: newLat,
                                            longitude: newLng
                                        }
                                    }));
                                    toast.info('Location updated! Click Save to confirm.');
                                }}
                                onLocationSelect={(newLat, newLng) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        coordinates: {
                                            latitude: newLat,
                                            longitude: newLng
                                        }
                                    }));
                                    toast.success('Location set! Click Save to confirm.');
                                }}
                            />
                            <div className="mt-2 text-sm text-gray-600">
                                <p>💡 <strong>Tip:</strong> Click anywhere on the map to set the check-in location, or drag the marker to adjust it.</p>
                            </div>
                        </div>

                        {/* Manual Coordinate Entry */}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Manual Coordinate Entry
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Latitude
                                    </label>
                                    <input
                                        type="number"
                                        name="latitude"
                                        value={formData.coordinates.latitude || 0}
                                        onChange={handleCoordinateChange}
                                        step="any"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Longitude
                                    </label>
                                    <input
                                        type="number"
                                        name="longitude"
                                        value={formData.coordinates.longitude || 0}
                                        onChange={handleCoordinateChange}
                                        step="any"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>


                        {/* Feature Toggles */}
                        <div className="space-y-4 mb-8">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Settings</h3>
                            
                            {/* Enable Comp Off */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <h4 className="font-medium text-gray-900">Enable Comp Off</h4>
                                    <p className="text-sm text-gray-600">Allow employees to accumulate compensatory off days</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => toggleFeature('enableCompOff')}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        formData.enableCompOff ? 'bg-blue-600' : 'bg-gray-300'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                            formData.enableCompOff ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>

                            {formData.enableCompOff && (
                                <div className="ml-8 flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                                    <div>
                                        <h4 className="font-medium text-gray-900">Auto Approve</h4>
                                        <p className="text-sm text-gray-600">Automatically approve comp off requests</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => toggleFeature('autoApprove')}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            formData.autoApprove ? 'bg-blue-600' : 'bg-gray-300'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                                formData.autoApprove ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </div>
                            )}

                            {/* Enable Simple Punches */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <h4 className="font-medium text-gray-900">Enable Simple Punches</h4>
                                    <p className="text-sm text-gray-600">Allow basic check-in/check-out without location verification</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => toggleFeature('enableSimplePunches')}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        formData.enableSimplePunches ? 'bg-blue-600' : 'bg-gray-300'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                            formData.enableSimplePunches ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>

                            {/* Enable Penalty Rules */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <h4 className="font-medium text-gray-900">Enable Penalty Rules</h4>
                                    <p className="text-sm text-gray-600">Apply penalties for late arrivals and early departures</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => toggleFeature('enablePenaltyRules')}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        formData.enablePenaltyRules ? 'bg-blue-600' : 'bg-gray-300'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                            formData.enablePenaltyRules ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end space-x-4 pt-6 border-t">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center"
                            >
                                <FaTimes className="mr-2" />
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center disabled:opacity-50"
                            >
                                <FaSave className="mr-2" />
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </form>
                )}
        </div>
    );
};

export default AttendanceRules;

