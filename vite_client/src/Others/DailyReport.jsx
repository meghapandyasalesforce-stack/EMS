import React, { useEffect, useState } from 'react';
import axios from '../utils/axios';

function DailyReport() {
    const [report, setReport] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDailyReport = async () => {
            try {
                // Use axios for consistent API client with automatic cookie handling
                const response = await axios.get('/v1/both/attendance/daily-report');

                if (response.data?.success && response.data?.data) {
                    setReport(response.data.data);
                } else if (Array.isArray(response.data)) {
                    setReport(response.data);
                } else {
                    throw new Error(response.data?.message || 'Failed to fetch daily report');
                }
            } catch (err) {
                setError(err.response?.data?.message || err.message || 'Failed to fetch daily report');
            } finally {
                setLoading(false);
            }
        };

        fetchDailyReport();
    }, []);

    if (loading) return <p className="p-5">Loading daily report...</p>;
    if (error) return <p className="p-5 text-red-500">{error}</p>;

    return (
        <div className="p-5">
            <h2 className="text-xl font-bold mb-4">Daily Report</h2>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="border border-gray-300 bg-gray-100 p-2 text-center">Date</th>
                            <th className="border border-gray-300 bg-gray-100 p-2 text-center">Check-In Time</th>
                            <th className="border border-gray-300 bg-gray-100 p-2 text-center">Check-Out Time</th>
                            <th className="border border-gray-300 bg-gray-100 p-2 text-center">Total Working Hours</th>
                            <th className="border border-gray-300 bg-gray-100 p-2 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {report.map((entry, index) => {
                            const totalHours = entry.totalWorkingTime / 3600; // Convert seconds to hours
                            const isMatched = totalHours >= 8;
                            
                            return (
                                <tr key={index}>
                                    <td className="border border-gray-300 p-2 text-center">
                                        {entry.date}
                                    </td>
                                    <td className="border border-gray-300 p-2 text-center">
                                        {new Date(entry.checkInTime).toLocaleTimeString()}
                                    </td>
                                    <td className="border border-gray-300 p-2 text-center">
                                        {new Date(entry.checkOutTime).toLocaleTimeString()}
                                    </td>
                                    <td className="border border-gray-300 p-2 text-center">
                                        {totalHours.toFixed(2)} hrs
                                    </td>
                                    <td className={`border border-gray-300 p-2 text-center ${isMatched ? 'text-theme-primary' : 'text-red-600'}`}>
                                        {isMatched ? 'Matched' : 'Not Matched'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default DailyReport;