import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { createEmployee } from '../../context/employeeSlice';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';

function AddEmployee() {
    const queryClient = useQueryClient();
    const [form, setForm] = useState({
        name: '',
        lastName: '',
        department: '',
        manager: '',
        jobTitle: '',
        jobCategory: '',
        email: '',
        password: '',
        position: '',
        salary: '',
    });

    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [managers, setManagers] = useState([]);
    const [loadingManagers, setLoadingManagers] = useState(false);
    const employeeStatus = useSelector(state => state.employees.status);
    const employeeError = useSelector(state => state.employees.error);
    const user = useSelector((state) => state.auth?.user);
    const employee = useSelector((state) => state.employeeDetails?.employee);

    // Determine the correct dashboard route based on user role
    const getDashboardRoute = useMemo(() => {
        const userRole = user?.role || employee?.role || localStorage.getItem('role');
        const department = (user?.department || employee?.department || '').toLowerCase().trim();
        const jobTitle = (user?.jobTitle || employee?.jobTitle || '').toLowerCase().trim();
        const position = (user?.position || employee?.position || '').toLowerCase().trim();

        // Admin goes to admin dashboard
        if (userRole === 'admin') {
            return '/dashboard-admin';
        }

        // Check if user is HR
        const isHR = 
            department === 'hr' || 
            department.includes('hr') || 
            department.includes('human resource') ||
            jobTitle.includes('hr manager') ||
            jobTitle.includes('human resource') ||
            jobTitle.includes('hr') ||
            position.includes('hr manager') ||
            (position.includes('hr') && position.includes('manager'));

        if (isHR) {
            return '/dashboard-hr';
        }

        // Default to admin dashboard
        return '/dashboard-admin';
    }, [user, employee]);

    const departments = [
        "Engineering", "HR", "Finance", "Sales", "Marketing", "IT Support", "Operations",
        "Customer Support", "Legal", "Product", "Research & Development", "Design", "Administration"
    ];

    const jobTitles = [
        "Software Engineer", "Frontend Developer", "Backend Developer", "DevOps Engineer", "HR Manager",
        "Financial Analyst", "Marketing Executive", "Sales Representative", "Product Manager",
        "QA Tester", "Customer Support Specialist", "UX/UI Designer", "Project Manager",
        "Legal Advisor", "Operations Coordinator", "Full Stack Developer"
    ];

    const jobCategories = [
        "Information Technology", "Human Resources", "Finance", "Marketing", "Sales", "Operations",
        "Customer Service", "Research and Development", "Engineering", "Legal", "Administration",
        "Management", "Design", "Product Management"
    ];

    const positions = [
        "Intern", "Junior", "Mid-Level", "Senior", "Lead", "Supervisor", "Manager",
        "Director", "VP", "CTO", "CFO", "CEO"
    ];

    // Fetch managers (supports paginated { data } or array response)
    const fetchManagers = React.useCallback(async () => {
        try {
            setLoadingManagers(true);
            const response = await axios.get('/v1/admin/employee/managers?limit=500', { withCredentials: true });
            const data = response.data;
            const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
            setManagers(list);
            if (list.length === 0) {
                setForm(prev => ({ ...prev, manager: 'CEO' }));
            } else {
                setForm(prev => (prev.manager === 'CEO' ? { ...prev, manager: '' } : prev));
            }
        } catch (error) {
            const status = error?.response?.status;
            if (status !== 401 && status !== 403 && status !== 503) {
                // Only log non-auth/connection errors
            }
            setManagers([]);
            setForm(prev => ({ ...prev, manager: 'CEO' }));
        } finally {
            setLoadingManagers(false);
        }
    }, []);

    useEffect(() => {
        fetchManagers();
    }, [fetchManagers]);

    // Refetch managers when page gains focus (e.g. after creating first employee and coming back to add second)
    useEffect(() => {
        const onFocus = () => fetchManagers();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [fetchManagers]);

    const handleChange = e => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async e => {
        e.preventDefault();
        setError('');

        if (form.password && form.password.length < 8) {
            toast.error('Password must be at least 8 characters');
            setError('Password must be at least 8 characters');
            return;
        }

        // After the first employee, manager is required (first employee can be CEO/Manager without a manager)
        if (managers.length > 0 && (!form.manager || !String(form.manager).trim())) {
            toast.error('Please select a manager. All employees after the first must have a manager assigned.');
            setError('Please select a manager.');
            return;
        }

        const resultAction = await dispatch(createEmployee(form));

        if (createEmployee.fulfilled.match(resultAction)) {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            // Check email status and show appropriate notifications
            const { emailSent, emailWarning, emailError } = resultAction.payload;
            
            if (emailSent) {
                toast.success('Employee created successfully! Welcome email sent.', {
                    autoClose: 3000
                });
            } else if (emailWarning || emailError) {
                // Show warning first
                toast.warning('Employee created, but welcome email failed!', {
                    autoClose: 5000
                });
                // Then show detailed error with troubleshooting
                setTimeout(() => {
                    const errorMsg = emailWarning || emailError || 'Email service unavailable';
                    const isGmailError = errorMsg.includes('Gmail') || errorMsg.includes('App Password');
                    const troubleshooting = isGmailError 
                        ? ' For Gmail, use an App Password. Generate one at: https://myaccount.google.com/apppasswords'
                        : ' Check your email server configuration in environment variables.';
                    
                    toast.error(
                        <div>
                            <div className="font-semibold">{errorMsg}</div>
                            <div className="text-sm mt-1">{troubleshooting}</div>
                        </div>,
                        {
                            autoClose: 10000,
                            className: 'toast-error-with-details'
                        }
                    );
                }, 500);
            } else {
                toast.success('Employee created successfully!', {
                    autoClose: 3000
                });
            }
            
            navigate(getDashboardRoute);
        } else {
            const errorMsg = resultAction.payload || 'Failed to create employee';
            setError(errorMsg);
            toast.error(errorMsg, {
                autoClose: 5000
            });
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Main Content - responsive to sidebar state */}
            <div className="transition-all duration-300 ease-in-out p-4 sm:p-6 lg:p-8">
                {/* Mobile header would go here if needed */}
                
                <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 lg:p-8">
                    <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-800 mb-4 sm:mb-6">➕ Add Employee</h1>
                    
                    {(error || employeeError) && (
                        <p className="text-red-500 mb-4">{error || employeeError}</p>
                    )}
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="flex flex-col lg:flex-row gap-4">
                            <input
                                className="flex-1 px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                name="name"
                                placeholder="Name"
                                onChange={handleChange}
                                required
                            />
                            <input
                                className="flex-1 px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                name="lastName"
                                placeholder="Last Name"
                                onChange={handleChange}
                                required
                            />
                        </div>
                        
                        <div className="flex flex-col lg:flex-row gap-4">
                            <select
                                className="flex-1 px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                name="department"
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select Department</option>
                                {departments.map(dep => <option key={dep} value={dep}>{dep}</option>)}
                            </select>
                            <select
                                className="flex-1 px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                name="manager"
                                onChange={handleChange}
                                value={form.manager}
                                required={managers.length > 0}
                                disabled={loadingManagers}
                                title={managers.length > 0 ? 'Manager is required for all employees after the first' : ''}
                            >
                                <option value="">
                                    {loadingManagers ? 'Loading managers...' : (managers.length > 0 ? 'Select Manager (required)' : 'Select Manager')}
                                </option>
                                {managers.length === 0 && !loadingManagers && (
                                    <option value="CEO">First employee (CEO/Manager) - No manager assigned</option>
                                )}
                                {managers.map(mgr => {
                                    const fullName = `${mgr.name}${mgr.lastName ? ' ' + mgr.lastName : ''}`.trim();
                                    return (
                                        <option 
                                            key={mgr._id || mgr.employeeId} 
                                            value={fullName}
                                        >
                                            {fullName} - {mgr.position}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        
                        <div className="flex flex-col lg:flex-row gap-4">
                            <select
                                className="flex-1 px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                name="jobTitle"
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select Job Title</option>
                                {jobTitles.map(title => <option key={title} value={title}>{title}</option>)}
                            </select>
                            <select
                                className="flex-1 px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                name="jobCategory"
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select Job Category</option>
                                {jobCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        
                        <div className="flex flex-col lg:flex-row gap-4">
                            <input
                                className="flex-1 px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                name="email"
                                placeholder="E-Mail"
                                type="email"
                                onChange={handleChange}
                                required
                            />
                            <input
                                className="flex-1 px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                name="password"
                                placeholder="Password (min 8 characters)"
                                type="password"
                                minLength={8}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        
                        <div className="flex flex-col lg:flex-row gap-4">
                            <select
                                className="flex-1 px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                name="position"
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select Position</option>
                                {positions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                            </select>
                            <input
                                className="flex-1 px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                                name="salary"
                                placeholder="Salary"
                                type="number"
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={employeeStatus === 'loading'}
                            className="w-full lg:w-auto px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                        >
                            {employeeStatus === 'loading' ? 'Adding...' : 'Add Employee'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default AddEmployee;