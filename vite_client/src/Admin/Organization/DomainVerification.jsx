import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { ORGANIZATION_ENDPOINT } from '../../utils/constant';
import { FiGlobe, FiCheckCircle, FiXCircle, FiRefreshCw, FiCopy, FiInfo } from 'react-icons/fi';
import logger from '../../utils/logger';

const DomainVerification = () => {
    const { user } = useSelector((state) => state.auth || {});
    const [organization, setOrganization] = useState(null);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const [dnsRecords, setDnsRecords] = useState([]);

    useEffect(() => {
        fetchOrganization();
    }, []);

    const fetchOrganization = async () => {
        try {
            const response = await axios.get(`${ORGANIZATION_ENDPOINT}/details`);
            if (response.data.success) {
                setOrganization(response.data.organization);
                if (response.data.organization.domain) {
                    fetchDNSRecords(response.data.organization.domain);
                }
            }
        } catch (error) {
            logger.error('Failed to fetch organization', { error: error.message });
        } finally {
            setLoading(false);
        }
    };

    const fetchDNSRecords = async (domain) => {
        try {
            const response = await axios.get(`${ORGANIZATION_ENDPOINT}/domain/dns-records`, {
                params: { domain }
            });
            if (response.data.success) {
                setDnsRecords(response.data.records || []);
            }
        } catch (error) {
            logger.error('Failed to fetch DNS records', { error: error.message });
        }
    };

    const verifyDomain = async () => {
        if (!organization?.domain) {
            toast.error('No domain configured');
            return;
        }

        try {
            setVerifying(true);
            const response = await axios.post(`${ORGANIZATION_ENDPOINT}/domain/verify`, {
                domain: organization.domain
            });

            if (response.data.success) {
                if (response.data.verified) {
                    toast.success('Domain verified successfully!');
                } else {
                    toast.warning('Domain verification failed. Please check your DNS records.');
                }
                await fetchOrganization();
            }
        } catch (error) {
            toast.error('Failed to verify domain');
            logger.error('Domain verification error', { error: error.message });
        } finally {
            setVerifying(false);
        }
    };

    const copyDNSEntry = (entry) => {
        navigator.clipboard.writeText(entry);
        toast.success('DNS entry copied to clipboard!');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-secondary"></div>
            </div>
        );
    }

    const domain = organization?.domain;
    const isVerified = organization?.domainVerified || false;
    const verificationToken = organization?.domainVerificationToken;

    return (
        <div className="page-shell min-h-screen bg-gray-50">
            <div className="page-shell-inner hrms-stack">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Domain Verification</h1>
                    <p className="mt-2 text-gray-600">
                        Verify your organization's domain to enable custom domain features
                    </p>
                </div>

                {!domain ? (
                    <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                        <FiGlobe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Domain Configured</h2>
                        <p className="text-gray-600 mb-4">
                            Please configure your domain in organization settings first.
                        </p>
                        <a
                            href="/organization/settings"
                            className="inline-block px-6 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90"
                        >
                            Go to Settings
                        </a>
                    </div>
                ) : (
                    <>
                        {/* Domain Status */}
                        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-900">Domain Status</h2>
                                    <p className="text-gray-600 mt-1">{domain}</p>
                                </div>
                                <div className="flex items-center space-x-4">
                                    {isVerified ? (
                                        <div className="flex items-center space-x-2 text-theme-primary">
                                            <FiCheckCircle className="w-6 h-6" />
                                            <span className="font-semibold">Verified</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center space-x-2 text-yellow-600">
                                            <FiXCircle className="w-6 h-6" />
                                            <span className="font-semibold">Not Verified</span>
                                        </div>
                                    )}
                                    <button
                                        onClick={verifyDomain}
                                        disabled={verifying}
                                        className="px-4 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center space-x-2"
                                    >
                                        <FiRefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
                                        <span>{verifying ? 'Verifying...' : 'Verify Domain'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* DNS Configuration Instructions */}
                        {!isVerified && verificationToken && (
                            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">DNS Configuration</h2>
                                <p className="text-gray-600 mb-4">
                                    To verify your domain, add the following DNS record to your domain's DNS settings:
                                </p>
                                
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-gray-700">TXT Record</p>
                                        <button
                                            onClick={() => copyDNSEntry(`ems-verification=${verificationToken}`)}
                                            className="text-theme-secondary hover:text-theme-secondary"
                                        >
                                            <FiCopy className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="space-y-2 font-mono text-sm">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-gray-600">Type:</span>
                                            <span className="text-gray-900">TXT</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-gray-600">Name:</span>
                                            <span className="text-gray-900">@</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-gray-600">Value:</span>
                                            <span className="text-gray-900">ems-verification={verificationToken}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-theme-secondary/10 border border-theme-secondary rounded-lg p-4">
                                    <div className="flex items-start space-x-2">
                                        <FiInfo className="w-5 h-5 text-theme-secondary mt-0.5" />
                                        <div className="text-sm text-theme-secondary">
                                            <p className="font-semibold mb-1">Instructions:</p>
                                            <ol className="list-decimal list-inside space-y-1">
                                                <li>Log in to your domain registrar or DNS provider</li>
                                                <li>Navigate to DNS settings</li>
                                                <li>Add a new TXT record with the values above</li>
                                                <li>Wait a few minutes for DNS propagation</li>
                                                <li>Click "Verify Domain" button above</li>
                                            </ol>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* DNS Records Status */}
                        {dnsRecords.length > 0 && (
                            <div className="bg-white rounded-lg shadow-lg p-6">
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">DNS Records</h2>
                                <div className="space-y-3">
                                    {dnsRecords.map((record, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div>
                                                <p className="font-medium text-gray-900">{record.type} Record</p>
                                                <p className="text-sm text-gray-600">{record.name}</p>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                {record.verified ? (
                                                    <FiCheckCircle className="w-5 h-5 text-theme-primary" />
                                                ) : (
                                                    <FiXCircle className="w-5 h-5 text-red-600" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default DomainVerification;

