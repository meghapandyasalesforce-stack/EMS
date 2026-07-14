import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import logger from '../../utils/logger.js';

/**
 * Email Settings Component
 * Allows admins to test and view email configuration status
 */
const EmailSettings = () => {
    const [emailStatus, setEmailStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [testing, setTesting] = useState(false);

    // Fetch email status on component mount
    useEffect(() => {
        fetchEmailStatus();
    }, []);

    const fetchEmailStatus = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/v1/both/email/status');
            setEmailStatus(response.data);
        } catch (error) {
            toast.error('Failed to fetch email configuration status');
            logger.error('Email status error', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTestEmail = async (e) => {
        e.preventDefault();
        if (!testEmail) {
            toast.error('Please enter a test email address');
            return;
        }

        try {
            setTesting(true);
            const response = await axios.post('/v1/both/email/test', { testEmail });
            toast.success(response.data.message || 'Test email sent successfully!');
            setTestEmail('');
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Failed to send test email';
            const troubleshooting = error.response?.data?.troubleshooting || '';
            
            toast.error(
                <div>
                    <div className="font-semibold">{errorMsg}</div>
                    {troubleshooting && <div className="text-sm mt-1">{troubleshooting}</div>}
                </div>,
                { autoClose: 10000 }
            );
        } finally {
            setTesting(false);
        }
    };

    if (loading) {
        return (
            <div className="p-4 sm:p-5 md:p-6">
                <div className="animate-pulse">Loading email configuration...</div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-5 md:p-6">
            <h2 className="mb-4 text-xl font-semibold text-gray-800 sm:mb-6 sm:text-2xl">Email Configuration</h2>
            
            {emailStatus && (
                <div className="mb-6">
                    <div className={`mb-4 rounded-lg p-3 sm:p-4 ${emailStatus.validated ? 'bg-theme-primary/10 border border-theme-primary' : emailStatus.configured ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'}`}>
                        <div className="mb-2 flex items-center">
                            <span className={`font-semibold ${emailStatus.validated ? 'text-theme-primary' : emailStatus.configured ? 'text-yellow-800' : 'text-red-800'}`}>
                                Status: {emailStatus.validated ? '✓ Validated & Working' : emailStatus.configured ? '⚠ Configured (Not Validated)' : '✗ Not Configured'}
                            </span>
                        </div>
                        {emailStatus.validationMessage && (
                            <div className={`mb-2 text-sm ${emailStatus.validated ? 'text-theme-primary' : 'text-yellow-700'}`}>
                                {emailStatus.validationMessage}
                            </div>
                        )}
                        {emailStatus.validationRecommendation && !emailStatus.validated && (
                            <div className="mb-2 text-sm text-yellow-700">
                                <strong>Recommendation:</strong> {emailStatus.validationRecommendation}
                            </div>
                        )}
                        <div className="space-y-1 break-words text-sm text-gray-600">
                            <p><strong>Provider:</strong> {emailStatus.provider}</p>
                            <p><strong>Host:</strong> {emailStatus.emailHost}</p>
                            <p><strong>Port:</strong> {emailStatus.emailPort}</p>
                            <p><strong>From:</strong> {emailStatus.emailFrom}</p>
                            <p><strong>User:</strong> {emailStatus.emailUser}</p>
                            <p><strong>Password:</strong> {emailStatus.hasPassword ? '✓ Set' : '✗ Not Set'}</p>
                        </div>
                    </div>

                    {emailStatus.recommendations && emailStatus.recommendations.length > 0 && (
                        <div className="mb-4 rounded-lg border border-theme-secondary bg-theme-secondary/10 p-3 sm:p-4">
                            <h3 className="mb-2 font-semibold text-theme-secondary">Recommendations:</h3>
                            <ul className="list-disc space-y-1 pl-5 text-sm text-theme-secondary">
                                {emailStatus.recommendations.map((rec, index) => (
                                    <li key={index}>{rec}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div className="border-t pt-5 sm:pt-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-800">Test Email Configuration</h3>
                <form onSubmit={handleTestEmail} className="space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            Test Email Address
                        </label>
                        <input
                            type="email"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            placeholder="Enter email address to test"
                            className="w-full rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={testing}
                        className={`w-full rounded-md bg-theme-secondary px-6 py-2 text-white transition-colors hover:bg-theme-primary sm:w-auto ${
                            testing ? 'cursor-not-allowed opacity-50' : ''
                        }`}
                    >
                        {testing ? 'Sending...' : 'Send Test Email'}
                    </button>
                </form>
            </div>

            <div className="mt-6 rounded-lg bg-gray-50 p-3 sm:p-4">
                <h4 className="mb-2 font-semibold text-gray-800">Troubleshooting</h4>
                <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
                    <li>Check server logs for detailed error messages</li>
                    <li>Verify environment variables are set correctly</li>
                    <li>For Gmail: Use App Password instead of regular password</li>
                    <li>For Outlook: Ensure EMAIL_HOST is set to smtp.office365.com</li>
                    <li>Check firewall/network allows SMTP connections</li>
                </ul>
            </div>
        </div>
    );
};

export default EmailSettings;

