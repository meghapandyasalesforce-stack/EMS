import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaMoneyBillWave, FaChartLine } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { fetchOrganizationProfile, updateOrganizationSettings } from '../../context/organizationSlice';

const PayrollSettings = () => {
    const dispatch = useDispatch();
    const { profile, loading } = useSelector((state) => state.organization);

    const [settings, setSettings] = useState({
        calculationMode: 'work_hours',
        minHoursForFullDay: 8,
        minHoursForHalfDay: 4,
        tdsCalculationMode: 'cumulative',
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        dispatch(fetchOrganizationProfile());
    }, [dispatch]);

    useEffect(() => {
        if (profile?.settings?.payrollSettings) {
            const ps = profile.settings.payrollSettings;
            setSettings({
                calculationMode: ps.calculationMode || 'work_hours',
                minHoursForFullDay: ps.minHoursForFullDay ?? 8,
                minHoursForHalfDay: ps.minHoursForHalfDay ?? 4,
                tdsCalculationMode: profile.settings.tdsCalculationMode === 'independent' ? 'independent' : 'cumulative',
            });
        } else {
            setSettings((prev) => ({
                ...prev,
                tdsCalculationMode: profile?.settings?.tdsCalculationMode === 'independent' ? 'independent' : 'cumulative',
            }));
        }
    }, [profile]);

    const handleSave = async () => {
        if (settings.calculationMode === 'day_based') {
            const full = Number(settings.minHoursForFullDay);
            const half = Number(settings.minHoursForHalfDay);
            if (half >= full) {
                toast.error('Min hours for half-day must be less than min hours for full-day');
                return;
            }
        }
        try {
            setIsSaving(true);
            await dispatch(updateOrganizationSettings({
                payrollSettings: {
                    calculationMode: settings.calculationMode,
                    minHoursForFullDay: settings.minHoursForFullDay,
                    minHoursForHalfDay: settings.minHoursForHalfDay,
                },
                tdsCalculationMode: settings.tdsCalculationMode,
            })).unwrap();
            toast.success('Payroll settings saved successfully');
        } catch (error) {
            toast.error(error || 'Failed to save payroll settings');
        } finally {
            setIsSaving(false);
        }
    };

    const isDayBased = settings.calculationMode === 'day_based';

    if (loading && !profile) {
        return (
            <div className="p-6">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-theme-primary mx-auto" />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-5 md:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">Payroll Settings</h2>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex w-full items-center justify-center rounded-md bg-theme-primary px-4 py-2 text-white hover:opacity-90 disabled:opacity-50 sm:w-auto"
                >
                    {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>

            <div className="space-y-5">
                {/* Calculation Mode */}
                <div className="rounded-lg border border-gray-200 p-3 sm:p-4">
                    <h3 className="mb-1 flex items-center text-base font-medium text-gray-800 sm:text-lg">
                        <FaMoneyBillWave className="mr-2 flex-shrink-0" />
                        Payroll Calculation Mode
                    </h3>
                    <p className="mb-4 text-sm text-gray-500">
                        Applies on the next payroll generate / regenerate. Existing payslips are not changed automatically.
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => setSettings((prev) => ({ ...prev, calculationMode: 'work_hours' }))}
                            className={`rounded-lg border p-3 text-left transition sm:p-4 ${
                                settings.calculationMode === 'work_hours'
                                    ? 'border-theme-primary bg-theme-primary/5 ring-1 ring-theme-primary'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <div className="font-semibold text-gray-900">Work Hours Based</div>
                            <p className="mt-1 text-sm text-gray-500">
                                Salary is prorated by actual hours worked. Credit = hours worked ÷ standard hours (fractional, e.g. 4h = 0.5 day).
                            </p>
                        </button>
                        <button
                            type="button"
                            onClick={() => setSettings((prev) => ({ ...prev, calculationMode: 'day_based' }))}
                            className={`rounded-lg border p-3 text-left transition sm:p-4 ${
                                settings.calculationMode === 'day_based'
                                    ? 'border-theme-primary bg-theme-primary/5 ring-1 ring-theme-primary'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <div className="font-semibold text-gray-900">Day Based</div>
                            <p className="mt-1 text-sm text-gray-500">
                                Salary is based on attendance days. Punch-in + punch-out required; credit determined by minimum hour thresholds below.
                            </p>
                        </button>
                    </div>
                </div>

                {/* Day Based Rules — only shown when day_based is selected */}
                {isDayBased && (
                    <div className="rounded-lg border border-gray-200 p-3 sm:p-4">
                        <h3 className="mb-1 text-base font-medium text-gray-800 sm:text-lg">
                            Day Based Rules
                        </h3>
                        <p className="mb-4 text-sm text-gray-500">
                            Employee must punch in <strong>and</strong> punch out. No punch-out = no credit regardless of hours.
                        </p>

                        <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                            <p className="font-medium text-gray-700 mb-1">How credit is calculated:</p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li>Hours worked ≥ <strong>Min hours for full day</strong> → Full day (1.0)</li>
                                <li>Hours worked ≥ <strong>Min hours for half day</strong> but &lt; full day threshold → Half day (0.5)</li>
                                <li>Hours worked &lt; <strong>Min hours for half day</strong> → No credit (0)</li>
                            </ul>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Min hours for full day
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="24"
                                    step="0.5"
                                    value={settings.minHoursForFullDay}
                                    onChange={(e) =>
                                        setSettings((prev) => ({ ...prev, minHoursForFullDay: Number(e.target.value) }))
                                    }
                                    className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:ring-1 focus:ring-theme-primary"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Employee gets full day credit if they work at least this many hours
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Min hours for half day
                                </label>
                                <input
                                    type="number"
                                    min="0.5"
                                    max="24"
                                    step="0.5"
                                    value={settings.minHoursForHalfDay}
                                    onChange={(e) =>
                                        setSettings((prev) => ({ ...prev, minHoursForHalfDay: Number(e.target.value) }))
                                    }
                                    className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:ring-1 focus:ring-theme-primary"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Employee gets half day credit if they work at least this many hours (must be less than full day threshold)
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* TDS Calculation */}
                <div className="rounded-lg border border-gray-200 p-3 sm:p-4">
                    <h3 className="mb-1 flex items-center text-base font-medium text-gray-800 sm:text-lg">
                        <FaChartLine className="mr-2 flex-shrink-0" />
                        Payroll TDS Calculation
                    </h3>
                    <p className="mb-4 text-sm text-gray-500">
                        Applies on the next payroll generate / regenerate. Existing payslips are not changed automatically.
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => setSettings((prev) => ({ ...prev, tdsCalculationMode: 'cumulative' }))}
                            className={`rounded-lg border p-3 text-left transition sm:p-4 ${
                                settings.tdsCalculationMode === 'cumulative'
                                    ? 'border-theme-primary bg-theme-primary/5 ring-1 ring-theme-primary'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <div className="font-semibold text-gray-900">Past TDS adjustment</div>
                            <p className="mt-1 text-sm text-gray-500">
                                Cumulative: tax due through employment months in the FY minus TDS already deducted (mid-year join uses join→March span, not always ÷12).
                            </p>
                        </button>
                        <button
                            type="button"
                            onClick={() => setSettings((prev) => ({ ...prev, tdsCalculationMode: 'independent' }))}
                            className={`rounded-lg border p-3 text-left transition sm:p-4 ${
                                settings.tdsCalculationMode === 'independent'
                                    ? 'border-theme-primary bg-theme-primary/5 ring-1 ring-theme-primary'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <div className="font-semibold text-gray-900">No past TDS adjustment</div>
                            <p className="mt-1 text-sm text-gray-500">
                                Independent: remaining annual tax ÷ months left (this month → March). Past slips are not reopened; already-cut TDS is subtracted first.
                            </p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PayrollSettings;
