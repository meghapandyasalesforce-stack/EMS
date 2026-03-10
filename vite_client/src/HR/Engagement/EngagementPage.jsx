import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaChartLine, FaComments, FaTrophy, FaClipboardList, FaPlus } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { isHR } from '../../utils/managerHelper';

const EngagementPage = () => {
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    
    // Check if user is HR or Admin
    const isHRUser = useMemo(() => {
        const userRole = user?.role || employee?.role;
        if (userRole === 'admin') return true;
        const userObj = user || employee;
        return isHR(userObj);
    }, [user, employee]);
    const [surveys, setSurveys] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('surveys');

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        try {
            setLoading(true);
            if (activeTab === 'surveys') {
                const response = await axios.get('/v1/both/engagement/surveys', { withCredentials: true });
                setSurveys(response.data?.data || []);
            } else {
                const response = await axios.get('/v1/both/engagement/feedback', { withCredentials: true });
                setFeedback(response.data?.data || []);
            }
        } catch (error) {
            // Error handled silently
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading engagement data..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Employee Engagement</h1>
                        <p className="text-gray-600 mt-1">Surveys, feedback, and recognition</p>
                    </div>
                    {activeTab === 'surveys' && isHRUser && (
                        <button
                            onClick={() => navigate('/engagement/create-survey')}
                            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-2"
                        >
                            <FaPlus className="w-4 h-4" />
                            Create Survey
                        </button>
                    )}
                </div>

                <div className="bg-white rounded-lg shadow-md mb-6">
                    <div className="flex border-b">
                        <button
                            onClick={() => setActiveTab('surveys')}
                            className={`px-6 py-3 font-medium ${activeTab === 'surveys' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                        >
                            <FaClipboardList className="inline mr-2" />
                            Surveys ({surveys.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('feedback')}
                            className={`px-6 py-3 font-medium ${activeTab === 'feedback' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                        >
                            <FaComments className="inline mr-2" />
                            Feedback ({feedback.length})
                        </button>
                    </div>
                </div>

                {activeTab === 'surveys' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {surveys.map((survey) => (
                            <div key={survey._id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">{survey.title}</h3>
                                <p className="text-gray-600 mb-4 text-sm">{survey.description}</p>
                                <div className="flex items-center justify-between">
                                    <span className={`px-3 py-1 rounded-full text-sm ${
                                        survey.status === 'Active' ? 'bg-green-100 text-green-800' :
                                        survey.status === 'Closed' ? 'bg-gray-100 text-gray-800' :
                                        'bg-yellow-100 text-yellow-800'
                                    }`}>
                                        {survey.status}
                                    </span>
                                    <span className="text-sm text-gray-600">
                                        {survey.responseCount || 0} responses
                                    </span>
                                </div>
                                <button
                                    onClick={() => navigate(`/engagement/surveys/${survey._id}`)}
                                    className="mt-4 w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition"
                                >
                                    View Survey
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {feedback.map((item) => (
                                    <tr key={item._id}>
                                        <td className="px-6 py-4">{item.subject}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                                item.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                                                item.status === 'Open' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {new Date(item.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EngagementPage;

