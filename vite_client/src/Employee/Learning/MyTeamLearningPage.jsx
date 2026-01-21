import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { 
    FaBook, FaYoutube, FaFilePdf, FaLink, FaVideo, FaTag,
    FaCheckCircle, FaClock, FaSpinner, FaArrowLeft, FaDownload
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

const MyTeamLearningPage = () => {
    const user = useSelector((state) => state.auth.user);
    const navigate = useNavigate();
    const [learnings, setLearnings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState('all');
    const [updatingProgress, setUpdatingProgress] = useState(null);

    useEffect(() => {
        fetchLearnings();
    }, [filterCategory]);

    const fetchLearnings = async () => {
        try {
            setLoading(true);
            const params = filterCategory !== 'all' ? { category: filterCategory } : {};
            const response = await axios.get('/v1/both/team-learning', {
                params,
                withCredentials: true
            });
            // Filter to show only learning resources assigned to current user
            const allLearnings = response.data?.data || [];
            const currentUserId = user?._id || user?.id;
            const assignedLearnings = allLearnings.filter(learning => {
                // Check if user is in assignedTo array or if no specific assignment (available to all)
                if (!learning.assignedTo || learning.assignedTo.length === 0) {
                    return true; // Available to all
                }
                return learning.assignedTo.some(id => 
                    (id._id || id) === currentUserId
                );
            });
            setLearnings(assignedLearnings);
        } catch (error) {
            toast.error('Failed to load learning resources');
        } finally {
            setLoading(false);
        }
    };

    const updateProgress = async (learningId, progress) => {
        try {
            setUpdatingProgress(learningId);
            await axios.post(
                `/v1/both/team-learning/${learningId}/progress`,
                { progress },
                { withCredentials: true }
            );
            toast.success('Progress updated successfully');
            fetchLearnings();
        } catch (error) {
            toast.error('Failed to update progress');
        } finally {
            setUpdatingProgress(null);
        }
    };

    const getResourceIcon = (type) => {
        switch (type) {
            case 'Video':
                return <FaVideo className="text-red-500" />;
            case 'Document':
                return <FaFilePdf className="text-red-500" />;
            case 'Link':
                return <FaLink className="text-blue-500" />;
            case 'YouTube':
                return <FaYoutube className="text-red-500" />;
            default:
                return <FaBook className="text-gray-500" />;
        }
    };

    const getCategoryColor = (category) => {
        const colors = {
            'Technical': 'bg-blue-100 text-blue-800',
            'Soft Skills': 'bg-green-100 text-green-800',
            'Leadership': 'bg-purple-100 text-purple-800',
            'Compliance': 'bg-red-100 text-red-800',
            'Other': 'bg-gray-100 text-gray-800'
        };
        return colors[category] || colors.Other;
    };

    if (loading) {
        return <LoadingSpinner message="Loading your learning resources..." />;
    }

    const categories = ['all', ...new Set(learnings.map(l => l.category))];

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
                            <h1 className="text-2xl font-bold text-gray-800">My Learning Resources</h1>
                            <p className="text-gray-600 mt-1">Access learning materials assigned to you</p>
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div className="flex gap-2 mb-6 border-b flex-wrap">
                        {categories.map((category) => (
                            <button
                                key={category}
                                onClick={() => setFilterCategory(category)}
                                className={`px-4 py-2 font-medium text-sm transition-colors ${
                                    filterCategory === category
                                        ? 'border-b-2 border-blue-500 text-blue-600'
                                        : 'text-gray-600 hover:text-gray-800'
                                }`}
                            >
                                {category.charAt(0).toUpperCase() + category.slice(1)} ({learnings.filter(l => category === 'all' || l.category === category).length})
                            </button>
                        ))}
                    </div>

                    {/* Learning Resources List */}
                    {learnings.length === 0 ? (
                        <div className="text-center py-12">
                            <FaBook className="mx-auto text-gray-400 text-4xl mb-4" />
                            <p className="text-gray-600 mb-2">No learning resources assigned</p>
                            <p className="text-sm text-gray-500">Your manager will assign learning resources here</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {learnings.map((learning) => (
                                <div
                                    key={learning._id}
                                    className="border rounded-lg p-6 hover:shadow-lg transition-shadow bg-white"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-800 mb-1">{learning.title}</h3>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(learning.category)}`}>
                                                {learning.category}
                                            </span>
                                        </div>
                                    </div>

                                    {learning.description && (
                                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{learning.description}</p>
                                    )}

                                    {/* Resources */}
                                    {learning.resources && learning.resources.length > 0 && (
                                        <div className="mb-4">
                                            <h4 className="text-xs font-medium text-gray-700 mb-2">Resources:</h4>
                                            <div className="space-y-2">
                                                {learning.resources.map((resource, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 text-sm">
                                                        {getResourceIcon(resource.type)}
                                                        <span className="flex-1 truncate">{resource.title}</span>
                                                        {resource.url && (
                                                            <a
                                                                href={resource.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-600 hover:underline"
                                                            >
                                                                <FaDownload className="text-xs" />
                                                            </a>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tags */}
                                    {learning.tags && learning.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-4">
                                            {learning.tags.map((tag, idx) => (
                                                <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                                    <FaTag className="inline mr-1" />
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Due Date */}
                                    {learning.dueDate && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                                            <FaClock />
                                            <span>Due: {format(new Date(learning.dueDate), 'MMM dd, yyyy')}</span>
                                        </div>
                                    )}

                                    {/* Progress */}
                                    {learning.progress !== undefined && (
                                        <div className="mb-4">
                                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                                                <span>Progress</span>
                                                <span>{learning.progress || 0}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className="bg-blue-600 h-2 rounded-full transition-all"
                                                    style={{ width: `${learning.progress || 0}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Priority */}
                                    {learning.priority && (
                                        <div className="mb-4">
                                            <span className={`text-xs px-2 py-1 rounded ${
                                                learning.priority === 'High' ? 'bg-red-100 text-red-800' :
                                                learning.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {learning.priority} Priority
                                            </span>
                                        </div>
                                    )}

                                    {/* Update Progress Button */}
                                    {learning.progress !== undefined && learning.progress < 100 && (
                                        <button
                                            onClick={() => {
                                                const newProgress = Math.min((learning.progress || 0) + 25, 100);
                                                updateProgress(learning._id, newProgress);
                                            }}
                                            disabled={updatingProgress === learning._id}
                                            className="w-full mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {updatingProgress === learning._id ? (
                                                <>
                                                    <FaSpinner className="animate-spin" />
                                                    Updating...
                                                </>
                                            ) : (
                                                <>
                                                    <FaCheckCircle />
                                                    Update Progress
                                                </>
                                            )}
                                        </button>
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

export default MyTeamLearningPage;

