import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaBook, FaGraduationCap, FaUsers, FaChartLine, FaPlus } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { isHR } from '../../utils/managerHelper';

const LearningPage = () => {
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
    const [courses, setCourses] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('courses');

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        try {
            setLoading(true);
            if (activeTab === 'courses') {
                const response = await axios.get('/v1/both/learning/courses', { withCredentials: true });
                setCourses(response.data?.data || []);
            } else {
                const response = await axios.get('/v1/both/learning/enrollments', { withCredentials: true });
                setEnrollments(response.data?.data || []);
            }
        } catch (error) {
            // Error handled silently
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading learning data..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Learning & Development</h1>
                        <p className="text-gray-600 mt-1">Manage training courses and employee development</p>
                    </div>
                    {isHRUser && (
                        <button
                            onClick={() => navigate('/learning/create-course')}
                            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-2"
                        >
                            <FaPlus className="w-4 h-4" />
                            Create Course
                        </button>
                    )}
                </div>

                <div className="bg-white rounded-lg shadow-md mb-6">
                    <div className="flex border-b">
                        <button
                            onClick={() => setActiveTab('courses')}
                            className={`px-6 py-3 font-medium ${activeTab === 'courses' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                        >
                            <FaBook className="inline mr-2" />
                            Courses ({courses.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('enrollments')}
                            className={`px-6 py-3 font-medium ${activeTab === 'enrollments' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                        >
                            <FaGraduationCap className="inline mr-2" />
                            Enrollments ({enrollments.length})
                        </button>
                    </div>
                </div>

                {activeTab === 'courses' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {courses.map((course) => (
                            <div key={course._id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="bg-blue-100 p-3 rounded-lg">
                                        <FaBook className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-800">{course.title}</h3>
                                        <p className="text-sm text-gray-600">{course.category}</p>
                                    </div>
                                </div>
                                <p className="text-gray-600 mb-4 line-clamp-2">{course.description}</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">{course.duration} hours</span>
                                    <span className={`px-2 py-1 rounded text-xs ${
                                        course.status === 'Published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                        {course.status}
                                    </span>
                                </div>
                                <button
                                    onClick={() => navigate(`/learning/courses/${course._id}`)}
                                    className="mt-4 w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition"
                                >
                                    View Course
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {enrollments.map((enrollment) => (
                                    <tr key={enrollment._id}>
                                        <td className="px-6 py-4">{enrollment.courseId?.title || 'N/A'}</td>
                                        <td className="px-6 py-4">{enrollment.employeeId?.name || 'N/A'}</td>
                                        <td className="px-6 py-4">
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className="bg-blue-600 h-2 rounded-full"
                                                    style={{ width: `${enrollment.progress || 0}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-sm text-gray-600">{enrollment.progress || 0}%</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                                enrollment.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                                enrollment.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {enrollment.status}
                                            </span>
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

export default LearningPage;

