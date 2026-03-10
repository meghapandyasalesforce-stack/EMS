import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { 
    FaPlus, FaCalendar, FaUser, FaClock, FaMapMarkerAlt, 
    FaVideo, FaTrash, FaEdit, FaCheckCircle, FaTimesCircle,
    FaSpinner, FaBell, FaList
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import { filterEmployeesByManager, isManager } from '../../utils/managerHelper';

const OneOnOnePage = () => {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const navigate = useNavigate();
    
    // Check if user is Manager
    const isManagerUser = useMemo(() => {
        const userRole = user?.role || employee?.role;
        if (userRole === 'admin') return true;
        const userObj = user || employee;
        return isManager(userObj);
    }, [user, employee]);
    
    // Show loading while checking role
    useEffect(() => {
        if (user && !isManagerUser) {
            // Non-managers should see employee view - but we'll handle this in routes
            // For now, just hide admin actions
        }
    }, [isManagerUser, user]);
    const [meetings, setMeetings] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');
    const [submitting, setSubmitting] = useState(false);
    
    const [formData, setFormData] = useState({
        employeeId: '',
        scheduledDate: '',
        scheduledTime: '',
        duration: 30,
        location: '',
        meetingLink: '',
        agenda: [{ topic: '', notes: '', discussed: false }]
    });

    useEffect(() => {
        fetchMeetings();
        fetchEmployees();
    }, [filterStatus]);

    const fetchMeetings = async () => {
        try {
            setLoading(true);
            const params = filterStatus !== 'all' ? { status: filterStatus } : {};
            const response = await axios.get('/v1/both/one-on-one/one-on-ones', {
                params,
                withCredentials: true
            });
            setMeetings(response.data?.data || []);
        } catch (error) {
            toast.error('Failed to load one-on-one meetings');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const response = await axios.get('/v1/employee/auth/get-all-employees', {
                withCredentials: true
            });
            const allEmployees = response.data?.employees || [];
            // Filter by manager if user is a manager
            const teamMembers = filterEmployeesByManager(allEmployees, user);
            setEmployees(teamMembers);
        } catch (error) {
            // Error handled silently for production
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.employeeId || !formData.scheduledDate || !formData.scheduledTime) {
            toast.warning('Please fill in all required fields');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                ...formData,
                scheduledDate: new Date(`${formData.scheduledDate}T${formData.scheduledTime}`).toISOString(),
                agenda: formData.agenda.filter(item => item.topic.trim() !== '')
            };

            if (selectedMeeting) {
                await axios.put(`/v1/both/one-on-one/one-on-ones/${selectedMeeting._id}`, payload, {
                    withCredentials: true
                });
                toast.success('Meeting updated successfully');
            } else {
                await axios.post('/v1/both/one-on-one/one-on-ones', payload, {
                    withCredentials: true
                });
                toast.success('One-on-one meeting scheduled and notification sent to employee');
            }
            
            setShowCreateModal(false);
            setSelectedMeeting(null);
            resetForm();
            fetchMeetings();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save meeting');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this meeting?')) {
            return;
        }

        try {
            await axios.delete(`/v1/both/one-on-one/one-on-ones/${id}`, {
                withCredentials: true
            });
            toast.success('Meeting deleted successfully');
            fetchMeetings();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete meeting');
        }
    };

    const addAgendaItem = () => {
        setFormData({
            ...formData,
            agenda: [...formData.agenda, { topic: '', notes: '', discussed: false }]
        });
    };

    const removeAgendaItem = (index) => {
        setFormData({
            ...formData,
            agenda: formData.agenda.filter((_, i) => i !== index)
        });
    };

    const updateAgendaItem = (index, field, value) => {
        const updatedAgenda = [...formData.agenda];
        updatedAgenda[index][field] = value;
        setFormData({ ...formData, agenda: updatedAgenda });
    };

    const resetForm = () => {
        setFormData({
            employeeId: '',
            scheduledDate: '',
            scheduledTime: '',
            duration: 30,
            location: '',
            meetingLink: '',
            agenda: [{ topic: '', notes: '', discussed: false }]
        });
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
        return <LoadingSpinner message="Loading one-on-one meetings..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">One-on-One Meetings</h1>
                            <p className="text-gray-600 mt-1">Schedule and manage one-on-one meetings with your team</p>
                        </div>
                        {isManagerUser && (
                            <button
                                onClick={() => {
                                    setSelectedMeeting(null);
                                    resetForm();
                                    setShowCreateModal(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                            >
                                <FaPlus />
                                Schedule Meeting
                            </button>
                        )}
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
                            <p className="text-gray-600 mb-4">No one-on-one meetings found</p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                            >
                                Schedule Your First Meeting
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {meetings.map((meeting) => (
                                <div
                                    key={meeting._id}
                                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="font-semibold text-gray-800">
                                                    {meeting.employeeId?.name} {meeting.employeeId?.lastName}
                                                </h3>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(meeting.status)}`}>
                                                    {meeting.status}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                                                <div className="flex items-center gap-2">
                                                    <FaCalendar />
                                                    <span>{format(new Date(meeting.scheduledDate), 'MMM dd, yyyy')}</span>
                                                </div>
                                                {meeting.scheduledTime && (
                                                    <div className="flex items-center gap-2">
                                                        <FaClock />
                                                        <span>{meeting.scheduledTime}</span>
                                                    </div>
                                                )}
                                                {meeting.location && (
                                                    <div className="flex items-center gap-2">
                                                        <FaMapMarkerAlt />
                                                        <span>{meeting.location}</span>
                                                    </div>
                                                )}
                                                {meeting.meetingLink && (
                                                    <div className="flex items-center gap-2">
                                                        <FaVideo />
                                                        <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                                            Join Meeting
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                            {meeting.agenda && meeting.agenda.length > 0 && (
                                                <div className="mt-3">
                                                    <p className="text-xs font-medium text-gray-700 mb-1">Agenda:</p>
                                                    <ul className="text-xs text-gray-600 space-y-1">
                                                        {meeting.agenda.slice(0, 3).map((item, idx) => (
                                                            <li key={idx}>• {item.topic}</li>
                                                        ))}
                                                        {meeting.agenda.length > 3 && (
                                                            <li className="text-gray-400">+ {meeting.agenda.length - 3} more items</li>
                                                        )}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {meeting.status === 'Scheduled' && isManagerUser && (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedMeeting(meeting);
                                                            const meetingDate = new Date(meeting.scheduledDate);
                                                            setFormData({
                                                                employeeId: meeting.employeeId?._id || meeting.employeeId,
                                                                scheduledDate: format(meetingDate, 'yyyy-MM-dd'),
                                                                scheduledTime: meeting.scheduledTime || '',
                                                                duration: meeting.duration || 30,
                                                                location: meeting.location || '',
                                                                meetingLink: meeting.meetingLink || '',
                                                                agenda: meeting.agenda && meeting.agenda.length > 0 
                                                                    ? meeting.agenda 
                                                                    : [{ topic: '', notes: '', discussed: false }]
                                                            });
                                                            setShowCreateModal(true);
                                                        }}
                                                        className="p-2 text-blue-500 hover:bg-blue-50 rounded"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(meeting._id)}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {showCreateModal && isManagerUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold mb-4">
                            {selectedMeeting ? 'Edit Meeting' : 'Schedule One-on-One Meeting'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Employee <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.employeeId}
                                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                    required
                                    disabled={!!selectedMeeting}
                                >
                                    <option value="">Select Employee</option>
                                    {employees.map((emp) => (
                                        <option key={emp._id || emp.id} value={emp._id || emp.id}>
                                            {emp.name} {emp.lastName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.scheduledDate}
                                        onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                        required
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Time <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.scheduledTime}
                                        onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Duration (minutes)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.duration}
                                        onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 30 })}
                                        className="w-full p-3 border rounded-lg"
                                        min="15"
                                        step="15"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Location
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                        placeholder="e.g., Conference Room A"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Meeting Link (Optional)
                                </label>
                                <input
                                    type="url"
                                    value={formData.meetingLink}
                                    onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                    placeholder="https://meet.google.com/..."
                                />
                            </div>

                            {/* Agenda Items */}
                            <div className="border-t pt-4">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-medium">Meeting Agenda</h4>
                                    <button
                                        type="button"
                                        onClick={addAgendaItem}
                                        className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                                    >
                                        <FaPlus />
                                        Add Item
                                    </button>
                                </div>
                                {formData.agenda.map((item, index) => (
                                    <div key={index} className="mb-3 p-3 bg-gray-50 rounded">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-medium">Item {index + 1}</span>
                                            {formData.agenda.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeAgendaItem(index)}
                                                    className="text-red-500 hover:bg-red-50 p-1 rounded"
                                                >
                                                    <FaTimesCircle />
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            value={item.topic}
                                            onChange={(e) => updateAgendaItem(index, 'topic', e.target.value)}
                                            className="w-full p-2 border rounded mb-2 text-sm"
                                            placeholder="Topic"
                                        />
                                        <textarea
                                            value={item.notes}
                                            onChange={(e) => updateAgendaItem(index, 'notes', e.target.value)}
                                            className="w-full p-2 border rounded text-sm"
                                            rows="2"
                                            placeholder="Notes (optional)"
                                        />
                                    </div>
                                ))}
                            </div>

                            {!selectedMeeting && (
                                <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-2">
                                    <FaBell className="text-blue-500 mt-1" />
                                    <p className="text-sm text-blue-700">
                                        A notification will be automatically sent to the employee when you schedule this meeting.
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setSelectedMeeting(null);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    {submitting ? (
                                        <>
                                            <FaSpinner className="animate-spin inline mr-2" />
                                            {selectedMeeting ? 'Updating...' : 'Scheduling...'}
                                        </>
                                    ) : (
                                        selectedMeeting ? 'Update Meeting' : 'Schedule Meeting'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OneOnOnePage;

