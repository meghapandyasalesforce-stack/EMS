import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaBriefcase, FaUsers, FaFileContract } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import OfferTemplateManager from '../../components/recruitment/OfferTemplateManager';

const RecruitmentPage = () => {
    const navigate = useNavigate();
    const [jobPostings, setJobPostings] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('jobs');

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        try {
            setLoading(true);
            if (activeTab === 'jobs') {
                const response = await axios.get('/v1/admin/recruitment/jobs', { withCredentials: true });
                setJobPostings(response.data?.data || []);
            } else if (activeTab === 'candidates') {
                const response = await axios.get('/v1/admin/recruitment/candidates', { withCredentials: true });
                setCandidates(response.data?.data || []);
            }
        } catch (error) {
            // Error handled silently for production
        } finally {
            setLoading(false);
        }
    };

    if (loading && activeTab !== 'offers') {
        return <LoadingSpinner message="Loading recruitment data..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-3 sm:p-4 transition-all duration-300">
            <div className="w-full max-w-[1600px] mx-auto">
                {/* Header */}
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Recruitment & ATS</h1>
                        <p className="text-gray-600 mt-1">Manage job postings and candidates</p>
                    </div>
                    <button
                        onClick={() => navigate('/recruitment/create-job')}
                        className="bg-theme-secondary text-white px-4 py-2 rounded-lg hover:bg-theme-primary transition flex items-center gap-2"
                    >
                        <FaPlus className="w-4 h-4" />
                        Post New Job
                    </button>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-lg shadow-md mb-6">
                    <div className="flex border-b overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('jobs')}
                            className={`px-6 py-3 font-medium ${activeTab === 'jobs' ? 'border-b-2 border-theme-secondary text-theme-secondary' : 'text-gray-600'}`}
                        >
                            <FaBriefcase className="inline mr-2" />
                            Job Postings ({jobPostings.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('candidates')}
                            className={`px-6 py-3 font-medium ${activeTab === 'candidates' ? 'border-b-2 border-theme-secondary text-theme-secondary' : 'text-gray-600'}`}
                        >
                            <FaUsers className="inline mr-2" />
                            Candidates ({candidates.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('offers')}
                            className={`px-6 py-3 font-medium ${activeTab === 'offers' ? 'border-b-2 border-theme-secondary text-theme-secondary' : 'text-gray-600'}`}
                        >
                            <FaFileContract className="inline mr-2" />
                            Offer Templates
                        </button>
                    </div>
                </div>

                {activeTab === 'jobs' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {jobPostings.map((job) => (
                            <div key={job._id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
                                <h3 className="text-xl font-semibold text-gray-800 mb-2">{job.jobTitle}</h3>
                                <p className="text-gray-600 mb-4">{job.department}</p>
                                <div className="flex items-center justify-between">
                                    <span className={`px-3 py-1 rounded-full text-sm ${
                                        job.status === 'Open' ? 'bg-theme-primary/10 text-theme-primary' :
                                        job.status === 'Closed' ? 'bg-gray-100 text-gray-800' :
                                        'bg-yellow-100 text-yellow-800'
                                    }`}>
                                        {job.status}
                                    </span>
                                    <button
                                        onClick={() => navigate(`/recruitment/jobs/${job._id}`)}
                                        className="text-theme-secondary hover:text-theme-secondary"
                                    >
                                        View Details
                                    </button>
                                </div>
                            </div>
                        ))}
                        {jobPostings.length === 0 && (
                            <div className="col-span-3 text-center py-8 sm:py-10">
                                <p className="text-gray-500">No job postings yet. Create your first job posting!</p>
                            </div>
                        )}
                    </div>
                ) : activeTab === 'candidates' ? (
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <div className="overflow-x-auto">
                        <table className="min-w-[640px] w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applied</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {candidates.map((candidate) => (
                                    <tr key={candidate._id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {candidate.firstName} {candidate.lastName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                            {candidate.jobPostingId?.jobTitle || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded-full text-xs ${
                                                candidate.status === 'Offer Accepted' ? 'bg-theme-primary/10 text-theme-primary' :
                                                candidate.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {candidate.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                            {new Date(candidate.applicationDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button
                                                onClick={() => navigate(`/recruitment/candidates/${candidate._id}`)}
                                                className="text-theme-secondary hover:text-theme-secondary"
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                        {candidates.length === 0 && (
                            <div className="text-center py-8 sm:py-10">
                                <p className="text-gray-500">No candidates yet.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="rounded-lg bg-white p-4 shadow-md sm:p-6">
                        <OfferTemplateManager />
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecruitmentPage;

