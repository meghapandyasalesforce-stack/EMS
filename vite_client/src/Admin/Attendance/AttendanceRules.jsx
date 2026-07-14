import React, { useState, useEffect } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { FaMapMarkerAlt, FaRuler, FaSave, FaTimes, FaCalendarAlt } from 'react-icons/fa';
import GoogleMapsComponent from '../../utils/GoogleMaps';
import LeavePolicyManagement from '../../HR/Leave/LeavePolicyManagement';
import TimezoneSelect from '../../components/TimezoneSelect';
import { fetchOrganizationTimezone } from '../../context/timezoneSlice';
import { fetchOrganizationProfile } from '../../context/organizationSlice';
import { useDispatch, useSelector } from 'react-redux';
import { DEFAULT_TIMEZONE } from '../../utils/timezoneOptions';

const AttendanceRules = () => {
    const dispatch = useDispatch();
    const orgTimezone = useSelector((state) => state.organization.profile?.timezone) || DEFAULT_TIMEZONE;
    const [formData, setFormData] = useState({
        timezone: orgTimezone,
        location: '',
        address: '',
        coordinates: { latitude: 0, longitude: 0 },
        maximumRadius: 500,
        enableCompOff: true,
        autoApprove: false,
        enableSimplePunches: false,
        enablePenaltyRules: true,
        // New fields
        officeHours: {
            startTime: '09:00',
            endTime: '17:00'
        },
        checkInOutTimes: {
            checkInStartTime: '09:00',
            checkInEndTime: '10:00',
            checkOutStartTime: '17:00',
            checkOutEndTime: '18:00',
            checkInGracePeriod: 15,
            checkOutGracePeriod: 30
        },
        autoCheckOut: {
            enabled: false,
            time: '18:00',
            notifyBeforeMinutes: 15
        },
        timeStop: {
            enabled: false,
            time: '20:00',
            action: 'auto_checkout'
        },
        regularizationRules: {
            enabled: true,
            allowedPerMonth: 5
        }
    });

    const [mapKey, setMapKey] = useState(Date.now());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasAddress, setHasAddress] = useState(false);

    // Fetch current attendance rule on component mount
    useEffect(() => {
        dispatch(fetchOrganizationProfile());
        fetchAttendanceRule();
    }, [dispatch]);

    const fetchAttendanceRule = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/v1/admin/attendance-rules/current');

            if (response.data.success && response.data.rule) {
                const rule = response.data.rule;
                const newFormData = {
                    timezone: rule.timezone || orgTimezone || DEFAULT_TIMEZONE,
                    location: rule.location || '',
                    address: rule.address || '',
                    coordinates: rule.coordinates || { latitude: 0, longitude: 0 },
                    maximumRadius: rule.maximumRadius || 500,
                    enableCompOff: rule.enableCompOff !== undefined ? rule.enableCompOff : true,
                    autoApprove: rule.autoApprove !== undefined ? rule.autoApprove : false,
                    enableSimplePunches: rule.enableSimplePunches !== undefined ? rule.enableSimplePunches : false,
                    enablePenaltyRules: rule.enablePenaltyRules !== undefined ? rule.enablePenaltyRules : true,
                    // New fields
                    officeHours: rule.officeHours || { startTime: '09:00', endTime: '17:00' },
                    checkInOutTimes: rule.checkInOutTimes || {
                        checkInStartTime: '09:00',
                        checkInEndTime: '10:00',
                        checkOutStartTime: '17:00',
                        checkOutEndTime: '18:00',
                        checkInGracePeriod: 15,
                        checkOutGracePeriod: 30
                    },
                    autoCheckOut: rule.autoCheckOut || {
                        enabled: false,
                        time: '18:00',
                        notifyBeforeMinutes: 15
                    },
                    timeStop: rule.timeStop || {
                        enabled: false,
                        time: '20:00',
                        action: 'auto_checkout'
                    },
                    regularizationRules: rule.regularizationRules || {
                        enabled: true,
                        allowedPerMonth: 5
                    }
                };
                
                setFormData(newFormData);
                setHasAddress(!!rule.address);
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
            // Removed console.error for production
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

    const handleTimeChange = (section, field, value) => {
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
    };

    const handleNumberChange = (section, field, value) => {
        const numValue = parseInt(value) || 0;
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: numValue
            }
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
            location: formData.location || formData.address,
            coordinates: {
                latitude: formData.coordinates.latitude || 0,
                longitude: formData.coordinates.longitude || 0
            },
            // Omit timezone if it matches org timezone — avoids overriding org timezone unnecessarily
            ...(formData.timezone !== orgTimezone && { timezone: formData.timezone }),
        };

        // Removed console.log statements for production

        try {
            setSaving(true);
            const response = await axios.post(
                '/v1/admin/attendance-rules/create-or-update',
                dataToSend
            );

            if (response.data.success) {
                toast.success('Attendance rules saved successfully!');
                dispatch(fetchOrganizationTimezone());
                fetchAttendanceRule();
            }
        } catch (error) {
            // Removed console.error for production
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
        <div className="p-4 sm:p-5 md:p-6">
            {/* Header */}
            <div className="mb-5 sm:mb-6">
                <h2 className="flex items-center text-xl font-bold text-gray-900 sm:text-2xl">
                    <FaRuler className="mr-2 flex-shrink-0 text-theme-secondary sm:mr-3" />
                    Attendance Rules
                </h2>
                <p className="mt-1 text-sm text-gray-600 sm:text-base">Configure location-based attendance and rules</p>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-96">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-secondary"></div>
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
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                            />
                            {hasAddress && (
                                <a
                                    href={googleMapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-theme-secondary hover:underline mt-2 inline-block"
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
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
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
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
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
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
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
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mb-8 border-t pt-6">
                            <TimezoneSelect
                                id="attendance-rule-timezone"
                                value={formData.timezone}
                                onChange={(tz) => setFormData((prev) => ({ ...prev, timezone: tz }))}
                                label="Attendance timezone"
                                hint="Overrides organization timezone for punch times and office hours. Match organization settings unless you need a different rule."
                            />
                        </div>

                        {/* Office Hours Section */}
                        <div className="mb-8 border-t pt-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Office Hours</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Office Start Time
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.officeHours.startTime}
                                        onChange={(e) => handleTimeChange('officeHours', 'startTime', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Office End Time
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.officeHours.endTime}
                                        onChange={(e) => handleTimeChange('officeHours', 'endTime', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Check-In/Check-Out Times Section */}
                        <div className="mb-8 border-t pt-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Check-In & Check-Out Times</h3>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Check-In Start Time
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.checkInOutTimes.checkInStartTime}
                                        onChange={(e) => handleTimeChange('checkInOutTimes', 'checkInStartTime', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Check-In End Time
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.checkInOutTimes.checkInEndTime}
                                        onChange={(e) => handleTimeChange('checkInOutTimes', 'checkInEndTime', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Check-Out Start Time
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.checkInOutTimes.checkOutStartTime}
                                        onChange={(e) => handleTimeChange('checkInOutTimes', 'checkOutStartTime', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Check-Out End Time
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.checkInOutTimes.checkOutEndTime}
                                        onChange={(e) => handleTimeChange('checkInOutTimes', 'checkOutEndTime', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                                    />
                                </div>
                            </div>

                            {/* Grace Periods */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Check-In Grace Period (minutes)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="120"
                                        value={formData.checkInOutTimes.checkInGracePeriod}
                                        onChange={(e) => handleNumberChange('checkInOutTimes', 'checkInGracePeriod', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Employees can check-in within this grace period without penalty</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Check-Out Grace Period (minutes)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="120"
                                        value={formData.checkInOutTimes.checkOutGracePeriod}
                                        onChange={(e) => handleNumberChange('checkInOutTimes', 'checkOutGracePeriod', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Employees can check-out within this grace period without penalty</p>
                                </div>
                            </div>
                        </div>

                        {/* Auto Check-Out Section */}
                        <div className="mb-8 border-t pt-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Auto Check-Out</h3>
                                    <p className="text-sm text-gray-600">Automatically check out employees at a specific time</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleTimeChange('autoCheckOut', 'enabled', !formData.autoCheckOut.enabled)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        formData.autoCheckOut.enabled ? 'bg-theme-primary' : 'bg-gray-300'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                            formData.autoCheckOut.enabled ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>

                            {formData.autoCheckOut.enabled && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Auto Check-Out Time
                                        </label>
                                        <input
                                            type="time"
                                            value={formData.autoCheckOut.time}
                                            onChange={(e) => handleTimeChange('autoCheckOut', 'time', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Notify Before (minutes)
                                        </label>
                                        <input
                                            type="number"
                                            min="5"
                                            max="60"
                                            value={formData.autoCheckOut.notifyBeforeMinutes}
                                            onChange={(e) => handleNumberChange('autoCheckOut', 'notifyBeforeMinutes', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Send notification X minutes before auto check-out</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Time Stop Section */}
                        <div className="mb-8 border-t pt-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Time Stop</h3>
                                    <p className="text-sm text-gray-600">Stop time tracking after a specific time</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleTimeChange('timeStop', 'enabled', !formData.timeStop.enabled)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        formData.timeStop.enabled ? 'bg-theme-primary' : 'bg-gray-300'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                            formData.timeStop.enabled ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>

                            {formData.timeStop.enabled && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Time Stop Time
                                        </label>
                                        <input
                                            type="time"
                                            value={formData.timeStop.time}
                                            onChange={(e) => handleTimeChange('timeStop', 'time', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Action When Time Stops
                                        </label>
                                        <select
                                            value={formData.timeStop.action}
                                            onChange={(e) => handleTimeChange('timeStop', 'action', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                                        >
                                            <option value="stop_tracking">Stop Tracking</option>
                                            <option value="auto_checkout">Auto Check-Out</option>
                                            <option value="warning">Send Warning</option>
                                        </select>
                                    </div>
                                </div>
                            )}
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
                                        formData.enableCompOff ? 'bg-theme-primary' : 'bg-gray-300'
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
                                <div className="ml-8 flex items-center justify-between p-4 bg-theme-secondary/10 rounded-lg">
                                    <div>
                                        <h4 className="font-medium text-gray-900">Auto Approve</h4>
                                        <p className="text-sm text-gray-600">Automatically approve comp off requests</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => toggleFeature('autoApprove')}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            formData.autoApprove ? 'bg-theme-primary' : 'bg-gray-300'
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

                            {/* Attendance Regularization */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <h4 className="font-medium text-gray-900">Enable Attendance Regularization</h4>
                                    <p className="text-sm text-gray-600">Allow employees to request attendance corrections</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleTimeChange('regularizationRules', 'enabled', !formData.regularizationRules.enabled)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        formData.regularizationRules.enabled ? 'bg-theme-primary' : 'bg-gray-300'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                            formData.regularizationRules.enabled ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>

                            {formData.regularizationRules.enabled && (
                                <div className="ml-8 p-4 bg-theme-secondary/10 rounded-lg">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Max regularization requests per employee per month
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="31"
                                        value={formData.regularizationRules.allowedPerMonth}
                                        onChange={(e) => handleNumberChange('regularizationRules', 'allowedPerMonth', e.target.value)}
                                        className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Set to 0 for unlimited. Pending and approved requests count toward the limit.
                                    </p>
                                </div>
                            )}

                            {/* Enable Simple Punches */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <h4 className="font-medium text-gray-900">Enable Simple Punches</h4>
                                    <p className="text-sm text-gray-600">Employees must share GPS with each punch; office radius is not enforced (for audit only)</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => toggleFeature('enableSimplePunches')}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        formData.enableSimplePunches ? 'bg-theme-primary' : 'bg-gray-300'
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
                                        formData.enablePenaltyRules ? 'bg-theme-primary' : 'bg-gray-300'
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
                                className="px-6 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 transition flex items-center disabled:opacity-50"
                            >
                                <FaSave className="mr-2" />
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Leave Policy Section - Moved outside the form to prevent nested forms */}
                <div className="mt-8 border-t pt-8">
                    <LeavePolicyManagement />
                </div>
        </div>
    );
};

export default AttendanceRules;

