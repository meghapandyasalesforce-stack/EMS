import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { ORGANIZATION_ENDPOINT } from '../../utils/constant';
import { FiCopy, FiUsers, FiGift, FiShare2, FiCheckCircle } from 'react-icons/fi';
import logger from '../../utils/logger';

const ReferralProgram = () => {
    const { user } = useSelector((state) => state.auth || {});
    const [organization, setOrganization] = useState(null);
    const [referrals, setReferrals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        fetchOrganization();
        fetchReferrals();
    }, []);

    const fetchOrganization = async () => {
        try {
            const response = await axios.get(`${ORGANIZATION_ENDPOINT}/details`);
            if (response.data.success) {
                setOrganization(response.data.organization);
            }
        } catch (error) {
            logger.error('Failed to fetch organization', { error: error.message });
        } finally {
            setLoading(false);
        }
    };

    const fetchReferrals = async () => {
        try {
            const response = await axios.get(`${ORGANIZATION_ENDPOINT}/referrals`);
            if (response.data.success) {
                setReferrals(response.data.referrals || []);
            }
        } catch (error) {
            logger.error('Failed to fetch referrals', { error: error.message });
        }
    };

    const generateReferralCode = async () => {
        try {
            setGenerating(true);
            const response = await axios.post(`${ORGANIZATION_ENDPOINT}/referral-code`);
            if (response.data.success) {
                setOrganization(prev => ({
                    ...prev,
                    referralCode: response.data.referralCode
                }));
                toast.success('Referral code generated successfully!');
            }
        } catch (error) {
            toast.error('Failed to generate referral code');
            logger.error('Referral code generation error', { error: error.message });
        } finally {
            setGenerating(false);
        }
    };

    const copyReferralLink = () => {
        const referralLink = `${window.location.origin}/organization/register?ref=${organization?.referralCode}`;
        navigator.clipboard.writeText(referralLink);
        toast.success('Referral link copied to clipboard!');
    };

    const shareReferralLink = () => {
        const referralLink = `${window.location.origin}/organization/register?ref=${organization?.referralCode}`;
        const shareText = `Join ${organization?.name || 'our organization'} using my referral link: ${referralLink}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Join Our Organization',
                text: shareText,
                url: referralLink
            });
        } else {
            copyReferralLink();
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-secondary"></div>
            </div>
        );
    }

    const referralCode = organization?.referralCode;
    const referralLink = referralCode ? `${window.location.origin}/organization/register?ref=${referralCode}` : '';

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Referral Program</h1>
                    <p className="mt-2 text-gray-600">
                        Invite others to join and earn rewards
                    </p>
                </div>

                {/* Referral Code Section */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Referral Code</h2>
                    
                    {referralCode ? (
                        <div className="space-y-4">
                            <div className="flex items-center space-x-4">
                                <div className="flex-1 bg-gray-50 border border-gray-300 rounded-lg p-4">
                                    <p className="text-sm text-gray-600 mb-1">Referral Code</p>
                                    <p className="text-2xl font-bold text-gray-900 font-mono">{referralCode}</p>
                                </div>
                                <button
                                    onClick={copyReferralLink}
                                    className="px-4 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 flex items-center space-x-2"
                                >
                                    <FiCopy className="w-5 h-5" />
                                    <span>Copy Link</span>
                                </button>
                                <button
                                    onClick={shareReferralLink}
                                    className="px-4 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 flex items-center space-x-2"
                                >
                                    <FiShare2 className="w-5 h-5" />
                                    <span>Share</span>
                                </button>
                            </div>
                            
                            <div className="bg-theme-secondary/10 border border-theme-secondary rounded-lg p-4">
                                <p className="text-sm text-theme-secondary">
                                    <strong>Referral Link:</strong> {referralLink}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <FiGift className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 mb-4">You don't have a referral code yet</p>
                            <button
                                onClick={generateReferralCode}
                                disabled={generating}
                                className="px-6 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                            >
                                {generating ? 'Generating...' : 'Generate Referral Code'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Referral Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Referrals</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">
                                    {referrals.length}
                                </p>
                            </div>
                            <div className="bg-theme-secondary/10 rounded-full p-3">
                                <FiUsers className="w-8 h-8 text-theme-secondary" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Active Referrals</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">
                                    {referrals.filter(r => r.status === 'active').length}
                                </p>
                            </div>
                            <div className="bg-theme-primary/10 rounded-full p-3">
                                <FiCheckCircle className="w-8 h-8 text-theme-primary" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Rewards Earned</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">
                                    {referrals.filter(r => r.rewardEarned).length}
                                </p>
                            </div>
                            <div className="bg-yellow-100 rounded-full p-3">
                                <FiGift className="w-8 h-8 text-yellow-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Referrals List */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Referral History</h2>
                    {referrals.length > 0 ? (
                        <div className="space-y-4">
                            {referrals.map((referral, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                    <div className="flex items-center space-x-4">
                                        <div className="bg-theme-secondary/10 rounded-full p-2">
                                            <FiUsers className="w-5 h-5 text-theme-secondary" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{referral.organizationName}</p>
                                            <p className="text-sm text-gray-500">
                                                Referred on {new Date(referral.referredAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <span className={`px-3 py-1 rounded-full text-sm ${
                                            referral.status === 'active'
                                                ? 'bg-theme-primary/10 text-theme-primary'
                                                : 'bg-gray-100 text-gray-800'
                                        }`}>
                                            {referral.status}
                                        </span>
                                        {referral.rewardEarned && (
                                            <FiGift className="w-5 h-5 text-yellow-600" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <FiUsers className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">No referrals yet</p>
                            <p className="text-sm text-gray-500 mt-2">
                                Share your referral link to start earning rewards!
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReferralProgram;

