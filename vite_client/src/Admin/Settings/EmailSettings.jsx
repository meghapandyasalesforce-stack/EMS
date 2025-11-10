import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from '../../../utils/axios';

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
            console.error('Email status error:', error);
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
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="animate-pulse">Loading email configuration...</div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Email Configuration</h2>
            
            {emailStatus && (
                <div className="mb-6">
                    <div className={`p-4 rounded-lg mb-4 ${emailStatus.validated ? 'bg-green-50 border border-green-200' : emailStatus.configured ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'}`}>
                        <div className="flex items-center mb-2">
                            <span className={`font-semibold ${emailStatus.validated ? 'text-green-800' : emailStatus.configured ? 'text-yellow-800' : 'text-red-800'}`}>
                                Status: {emailStatus.validated ? '✓ Validated & Working' : emailStatus.configured ? '⚠ Configured (Not Validated)' : '✗ Not Configured'}
                            </span>
                        </div>
                        {emailStatus.validationMessage && (
                            <div className={`text-sm mb-2 ${emailStatus.validated ? 'text-green-700' : 'text-yellow-700'}`}>
                                {emailStatus.validationMessage}
                            </div>
                        )}
                        {emailStatus.validationRecommendation && !emailStatus.validated && (
                            <div className="text-sm text-yellow-700 mb-2">
                                <strong>Recommendation:</strong> {emailStatus.validationRecommendation}
                            </div>
                        )}
                        <div className="text-sm text-gray-600 space-y-1">
                            <p><strong>Provider:</strong> {emailStatus.provider}</p>
                            <p><strong>Host:</strong> {emailStatus.emailHost}</p>
                            <p><strong>Port:</strong> {emailStatus.emailPort}</p>
                            <p><strong>From:</strong> {emailStatus.emailFrom}</p>
                            <p><strong>User:</strong> {emailStatus.emailUser}</p>
                            <p><strong>Password:</strong> {emailStatus.hasPassword ? '✓ Set' : '✗ Not Set'}</p>
                        </div>
                    </div>

                    {emailStatus.recommendations && emailStatus.recommendations.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <h3 className="font-semibold text-blue-800 mb-2">Recommendations:</h3>
                            <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                                {emailStatus.recommendations.map((rec, index) => (
                                    <li key={index}>{rec}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Test Email Configuration</h3>
                <form onSubmit={handleTestEmail} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Test Email Address
                        </label>
                        <input
                            type="email"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            placeholder="Enter email address to test"
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={testing}
                        className={`px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors ${
                            testing ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                    >
                        {testing ? 'Sending...' : 'Send Test Email'}
                    </button>
                </form>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-800 mb-2">Troubleshooting</h4>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
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

