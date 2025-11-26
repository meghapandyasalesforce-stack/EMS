import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { ORGANIZATION_SUBSCRIPTION_ENDPOINT, ORGANIZATION_ENDPOINT } from '../../utils/constant';
import { FiCheck, FiArrowUp, FiArrowDown, FiCreditCard, FiCalendar, FiUsers } from 'react-icons/fi';
import logger from '../../utils/logger';

const SubscriptionManagement = () => {
    const dispatch = useDispatch();
    const { user } = useSelector((state) => state.auth || {});
    const [plans, setPlans] = useState([]);
    const [currentPlan, setCurrentPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [upgrading, setUpgrading] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);

    useEffect(() => {
        fetchPlans();
        fetchCurrentPlan();
    }, []);

    const fetchPlans = async () => {
        try {
            const response = await axios.get(`${ORGANIZATION_SUBSCRIPTION_ENDPOINT}/plans`);
            if (response.data.success && response.data.plans) {
                setPlans(response.data.plans);
            }
        } catch (error) {
            logger.error('Failed to fetch subscription plans', { error: error.message });
            toast.error('Failed to load subscription plans');
        } finally {
            setLoading(false);
        }
    };

    const fetchCurrentPlan = async () => {
        try {
            const response = await axios.get(`${ORGANIZATION_ENDPOINT}/details`);
            if (response.data.success && response.data.organization) {
                setCurrentPlan(response.data.organization.subscriptionPlan);
            }
        } catch (error) {
            logger.error('Failed to fetch current plan', { error: error.message });
        }
    };

    const handleUpgrade = async (planId) => {
        if (upgrading) return;
        
        try {
            setUpgrading(true);
            const response = await axios.put(`${ORGANIZATION_ENDPOINT}/subscription`, {
                subscriptionPlan: planId
            });
            
            if (response.data.success) {
                toast.success(`Successfully upgraded to ${planId} plan!`);
                setCurrentPlan(planId);
                setSelectedPlan(null);
                await fetchCurrentPlan();
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Failed to upgrade plan';
            toast.error(errorMessage);
            logger.error('Upgrade error', { error: error.message });
        } finally {
            setUpgrading(false);
        }
    };

    const getPlanComparison = () => {
        const planOrder = ['free', 'basic', 'premium', 'enterprise'];
        return planOrder.map(planId => plans.find(p => p.id === planId)).filter(Boolean);
    };

    const isCurrentPlan = (planId) => currentPlan === planId;
    const canUpgrade = (planId) => {
        const planOrder = ['free', 'basic', 'premium', 'enterprise'];
        const currentIndex = planOrder.indexOf(currentPlan);
        const targetIndex = planOrder.indexOf(planId);
        return targetIndex > currentIndex;
    };
    const canDowngrade = (planId) => {
        const planOrder = ['free', 'basic', 'premium', 'enterprise'];
        const currentIndex = planOrder.indexOf(currentPlan);
        const targetIndex = planOrder.indexOf(planId);
        return targetIndex < currentIndex;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const sortedPlans = getPlanComparison();

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Subscription Management</h1>
                    <p className="mt-2 text-gray-600">
                        Manage your subscription plan and billing information
                    </p>
                </div>

                {/* Current Plan Banner */}
                {currentPlan && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-blue-900">Current Plan</h3>
                                <p className="text-blue-700">
                                    You are currently on the <strong>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</strong> plan
                                </p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <FiCalendar className="w-5 h-5 text-blue-600" />
                                <span className="text-blue-700">Active</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Plan Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {sortedPlans.map((plan) => {
                        const isCurrent = isCurrentPlan(plan.id);
                        const canUp = canUpgrade(plan.id);
                        const canDown = canDowngrade(plan.id);
                        
                        return (
                            <div
                                key={plan.id}
                                className={`relative bg-white rounded-lg shadow-lg border-2 overflow-hidden ${
                                    isCurrent
                                        ? 'border-blue-600 ring-2 ring-blue-200'
                                        : 'border-gray-200'
                                }`}
                            >
                                {isCurrent && (
                                    <div className="absolute top-0 left-0 right-0 bg-blue-600 text-white text-center py-1 text-sm font-semibold">
                                        Current Plan
                                    </div>
                                )}
                                
                                <div className={`p-6 ${isCurrent ? 'pt-10' : ''}`}>
                                    <div className="text-center mb-6">
                                        <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                                        <div className="mb-4">
                                            <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                                            <span className="text-gray-600">/month</span>
                                        </div>
                                        <div className="flex items-center justify-center text-sm text-gray-600">
                                            <FiUsers className="w-4 h-4 mr-1" />
                                            <span>Up to {plan.maxEmployees} employees</span>
                                        </div>
                                    </div>

                                    <ul className="space-y-3 mb-6">
                                        {plan.features.map((feature, idx) => (
                                            <li key={idx} className="flex items-start">
                                                <FiCheck className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                                                <span className="text-sm text-gray-700">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="mt-6">
                                        {isCurrent ? (
                                            <button
                                                disabled
                                                className="w-full px-4 py-2 bg-gray-200 text-gray-600 rounded-md cursor-not-allowed"
                                            >
                                                Current Plan
                                            </button>
                                        ) : canUp ? (
                                            <button
                                                onClick={() => {
                                                    setSelectedPlan(plan.id);
                                                    handleUpgrade(plan.id);
                                                }}
                                                disabled={upgrading}
                                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                                            >
                                                {upgrading && selectedPlan === plan.id ? (
                                                    <>
                                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Upgrading...
                                                    </>
                                                ) : (
                                                    <>
                                                        <FiArrowUp className="mr-2" />
                                                        Upgrade
                                                    </>
                                                )}
                                            </button>
                                        ) : canDown ? (
                                            <button
                                                onClick={() => {
                                                    if (window.confirm(`Are you sure you want to downgrade to ${plan.name}?`)) {
                                                        setSelectedPlan(plan.id);
                                                        handleUpgrade(plan.id);
                                                    }
                                                }}
                                                disabled={upgrading}
                                                className="w-full px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 flex items-center justify-center"
                                            >
                                                <FiArrowDown className="mr-2" />
                                                Downgrade
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleUpgrade(plan.id)}
                                                disabled={upgrading}
                                                className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
                                            >
                                                Select Plan
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Billing Information */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Billing Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Payment Method
                            </label>
                            <div className="flex items-center space-x-2 p-4 border border-gray-300 rounded-md">
                                <FiCreditCard className="w-5 h-5 text-gray-400" />
                                <span className="text-gray-600">No payment method on file</span>
                            </div>
                            <button className="mt-2 text-sm text-blue-600 hover:text-blue-700">
                                Add Payment Method
                            </button>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Billing History
                            </label>
                            <div className="p-4 border border-gray-300 rounded-md">
                                <p className="text-gray-600 text-sm">No billing history available</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionManagement;

