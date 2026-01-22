import React, { useState, useEffect } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';

const EmployeeLeaveBalanceViewer = () => {
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [balance, setBalance] = useState(null);
    const [loading, setLoading] = useState(false);
    const [year, setYear] = useState(new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchEmployees();
    }, []);

    useEffect(() => {
        if (selectedEmployee) {
            fetchBalance(selectedEmployee._id);
        }
    }, [selectedEmployee, year]);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/v1/admin/employee');
            // Handle different response formats
            const employeesData = res.data?.data || res.data?.employees || [];
            setEmployees(Array.isArray(employeesData) ? employeesData : []);
        } catch (error) {
            console.error('Error fetching employees:', error);
            toast.error('Failed to fetch employees');
            setEmployees([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchBalance = async (employeeId) => {
        setLoading(true);
        try {
            const res = await axios.get(
                `/v1/admin/leave-policy/balance/${employeeId}`,
                { params: { year } }
            );
            setBalance(res.data.balance);
        } catch (error) {
            console.error('Error fetching balance:', error);
            if (error.response?.status === 404) {
                setBalance(null);
                toast.info('No leave balance found for this employee');
            } else {
                toast.error('Failed to fetch leave balance');
            }
        } finally {
            setLoading(false);
        }
    };

    const filteredEmployees = employees.filter(emp => {
        const name = `${emp.name} ${emp.lastName || ''}`.toLowerCase();
        const employeeId = (emp.employeeId || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        return name.includes(search) || employeeId.includes(search);
    });

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-4">View Employee Leave Balance</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Search Employee</label>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by name or employee ID"
                            className="w-full border rounded px-3 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Year</label>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="w-full border rounded px-3 py-2"
                        >
                            {[year - 1, year, year + 1].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="max-h-60 overflow-y-auto border rounded">
                    {filteredEmployees.map((emp) => (
                        <div
                            key={emp._id}
                            onClick={() => setSelectedEmployee(emp)}
                            className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                                selectedEmployee?._id === emp._id ? 'bg-blue-50' : ''
                            }`}
                        >
                            <div className="font-medium">{emp.name} {emp.lastName || ''}</div>
                            <div className="text-sm text-gray-600">
                                {emp.employeeId} • {emp.department}
                            </div>
                        </div>
                    ))}
                    {filteredEmployees.length === 0 && (
                        <div className="p-4 text-center text-gray-500">
                            No employees found
                        </div>
                    )}
                </div>
            </div>

            {selectedEmployee && balance && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-xl font-semibold mb-4">
                        Leave Balance for {selectedEmployee.name} {selectedEmployee.lastName || ''}
                    </h3>

                    {balance.policy && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                            <p className="text-blue-800">
                                <strong>Policy:</strong> {balance.policy.policyName}
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {balance.balances?.map((typeBalance) => {
                            const policyType = balance.policy?.leaveTypes?.find(lt => lt.type === typeBalance.leaveType);
                            return (
                                <div key={typeBalance.leaveType} className="bg-gray-50 rounded-lg shadow p-6">
                                    <h4 className="text-lg font-semibold mb-4 capitalize">
                                        {policyType?.displayName || typeBalance.leaveType} Leave
                                    </h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Accrued:</span>
                                            <span className="font-medium">{typeBalance.accrued} days</span>
                                        </div>
                                        {typeBalance.carriedForward > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Carried Forward:</span>
                                                <span className="font-medium text-blue-600">
                                                    +{typeBalance.carriedForward} days
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Used:</span>
                                            <span className="font-medium text-red-600">
                                                -{typeBalance.used} days
                                            </span>
                                        </div>
                                        {typeBalance.pending > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Pending:</span>
                                                <span className="font-medium text-yellow-600">
                                                    -{typeBalance.pending} days
                                                </span>
                                            </div>
                                        )}
                                        {typeBalance.expired > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Expired:</span>
                                                <span className="font-medium text-gray-600">
                                                    -{typeBalance.expired} days
                                                </span>
                                            </div>
                                        )}
                                        <div className="border-t pt-2 mt-2">
                                            <div className="flex justify-between">
                                                <span className="font-semibold">Available:</span>
                                                <span className={`font-bold text-lg ${
                                                    typeBalance.available > 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                    {typeBalance.available} days
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {balance.balances?.length === 0 && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <p className="text-gray-600">No leave types configured for this policy.</p>
                        </div>
                    )}
                </div>
            )}

            {selectedEmployee && !balance && !loading && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-yellow-800">
                        No leave balance found for {selectedEmployee.name}. 
                        Please ensure a leave policy is assigned to this employee.
                    </p>
                </div>
            )}
        </div>
    );
};

export default EmployeeLeaveBalanceViewer;

