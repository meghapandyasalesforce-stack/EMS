import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { 
    FaCalendar, FaClock, FaMapMarkerAlt, FaVideo, FaUser,
    FaCheckCircle, FaTimesCircle, FaSpinner, FaArrowLeft
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

const EmployeeOneOnOnePage = () => {
    const user = useSelector((state) => state.auth.user);
    const navigate = useNavigate();
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => {
        fetchMeetings();
    }, [filterStatus]);

    const fetchMeetings = async () => {
        try {
            setLoading(true);
            const params = filterStatus !== 'all' ? { status: filterStatus } : {};
            const response = await axios.get('/v1/both/one-on-one/one-on-ones', {
                params,
                withCredentials: true
            });
            // Filter to show only meetings where current user is the employee
            const employeeMeetings = (response.data?.data || []).filter(meeting => {
                const meetingEmployeeId = meeting.employeeId?._id || meeting.employeeId;
                const currentUserId = user?._id || user?.id;
                return meetingEmployeeId === currentUserId;
            });
            setMeetings(employeeMeetings);
        } catch (error) {
            console.error('Error fetching meetings:', error);
            toast.error('Failed to load one-on-one meetings');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            'Scheduled': 'bg-blue-100 text-blue-800 border-blue-200',
            'Completed': 'bg-green-100 text-green-800 border-green-200',
            'Cancelled': 'bg-red-100 text-red-800 border-red-200',
            'Rescheduled': 'bg-yellow-100 text-yellow-800 border-yellow-200',
            'No Show': 'bg-gray-100 text-gray-800 border-gray-200'
        };
        return badges[status] || badges.Scheduled;
    };

    if (loading) {
        return <LoadingSpinner message="Loading your one-on-one meetings..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 ml-0 lg:ml-64 transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                    <div className="flex items-center gap-4 mb-6">
                        <button
                            onClick={() => navigate('/dashboard-employee')}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
                        >
                            <FaArrowLeft /> Back
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">My One-on-One Meetings</h1>
                            <p className="text-gray-600 mt-1">View meetings scheduled with your manager</p>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-2 mb-6 border-b">
                        {['all', 'Scheduled', 'Completed', 'Cancelled'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-4 py-2 font-medium text-sm transition-colors ${
                                    filterStatus === status
                                        ? 'border-b-2 border-blue-500 text-blue-600'
                                        : 'text-gray-600 hover:text-gray-800'
                                }`}
                            >
                                {status.charAt(0).toUpperCase() + status.slice(1)} ({meetings.filter(m => status === 'all' || m.status === status).length})
                            </button>
                        ))}
                    </div>

                    {/* Meetings List */}
                    {meetings.length === 0 ? (
                        <div className="text-center py-12">
                            <FaCalendar className="mx-auto text-gray-400 text-4xl mb-4" />
                            <p className="text-gray-600 mb-2">No one-on-one meetings scheduled</p>
                            <p className="text-sm text-gray-500">Your manager will schedule meetings with you here</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {meetings.map((meeting) => (
                                <div
                                    key={meeting._id}
                                    className="border rounded-lg p-6 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-semibold text-gray-800">
                                                    Meeting with {meeting.managerId?.name || 'Your Manager'}
                                                </h3>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(meeting.status)}`}>
                                                    {meeting.status}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                                                <div className="flex items-center gap-2">
                                                    <FaCalendar className="text-blue-500" />
                                                    <span>{format(new Date(meeting.scheduledDate), 'EEEE, MMMM dd, yyyy')}</span>
                                                </div>
                                                {meeting.scheduledTime && (
                                                    <div className="flex items-center gap-2">
                                                        <FaClock className="text-blue-500" />
                                                        <span>{meeting.scheduledTime}</span>
                                                    </div>
                                                )}
                                                {meeting.duration && (
                                                    <div className="flex items-center gap-2">
                                                        <FaClock className="text-gray-400" />
                                                        <span>{meeting.duration} minutes</span>
                                                    </div>
                                                )}
                                                {meeting.location && (
                                                    <div className="flex items-center gap-2">
                                                        <FaMapMarkerAlt className="text-green-500" />
                                                        <span>{meeting.location}</span>
                                                    </div>
                                                )}
                                                {meeting.meetingLink && (
                                                    <div className="flex items-center gap-2">
                                                        <FaVideo className="text-purple-500" />
                                                        <a 
                                                            href={meeting.meetingLink} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:underline"
                                                        >
                                                            Join Meeting
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Agenda Items */}
                                    {meeting.agenda && meeting.agenda.length > 0 && (
                                        <div className="mt-4 pt-4 border-t">
                                            <h4 className="font-medium text-gray-700 mb-2">Agenda:</h4>
                                            <ul className="space-y-2">
                                                {meeting.agenda.map((item, index) => (
                                                    <li key={index} className="flex items-start gap-2 text-sm">
                                                        {item.discussed ? (
                                                            <FaCheckCircle className="text-green-500 mt-0.5 flex-shrink-0" />
                                                        ) : (
                                                            <FaTimesCircle className="text-gray-400 mt-0.5 flex-shrink-0" />
                                                        )}
                                                        <div>
                                                            <span className="font-medium">{item.topic}</span>
                                                            {item.notes && (
                                                                <p className="text-gray-600 text-xs mt-1">{item.notes}</p>
                                                            )}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Meeting Notes */}
                                    {meeting.notes && (
                                        <div className="mt-4 pt-4 border-t">
                                            <h4 className="font-medium text-gray-700 mb-2">Notes:</h4>
                                            <p className="text-sm text-gray-600">{meeting.notes}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EmployeeOneOnOnePage;

