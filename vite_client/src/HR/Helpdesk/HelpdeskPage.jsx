import React, { useState, useEffect } from 'react';
import { FaTicketAlt, FaPlus, FaFilter } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';

const HelpdeskPage = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchTickets();
    }, [filter]);

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const params = filter !== 'all' ? { status: filter } : {};
            const response = await axios.get('/v1/both/helpdesk/tickets', { 
                params,
                withCredentials: true 
            });
            setTickets(response.data?.data || []);
        } catch (error) {
            console.error('Error fetching tickets:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading helpdesk tickets..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 ml-0 lg:ml-64 transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">HR Helpdesk</h1>
                        <p className="text-gray-600 mt-1">Manage employee tickets</p>
                    </div>
                    <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-2">
                        <FaPlus className="w-4 h-4" />
                        New Ticket
                    </button>
                </div>

                <div className="bg-white rounded-lg shadow-md mb-6 p-4">
                    <div className="flex gap-2">
                        {['all', 'Open', 'In Progress', 'Resolved', 'Closed'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilter(status.toLowerCase())}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                                    filter === status.toLowerCase() 
                                        ? 'bg-blue-500 text-white' 
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket #</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested By</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {tickets.map((ticket) => (
                                <tr key={ticket._id}>
                                    <td className="px-6 py-4 font-mono text-sm">{ticket.ticketNumber}</td>
                                    <td className="px-6 py-4">{ticket.subject}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                                            {ticket.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs ${
                                            ticket.priority === 'Urgent' ? 'bg-red-100 text-red-800' :
                                            ticket.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                                            ticket.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {ticket.priority}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs ${
                                            ticket.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                                            ticket.status === 'Open' ? 'bg-yellow-100 text-yellow-800' :
                                            ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {ticket.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">{ticket.requestedBy?.name || 'N/A'}</td>
                                    <td className="px-6 py-4">
                                        <button className="text-blue-600 hover:text-blue-800">
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {tickets.length === 0 && (
                        <div className="text-center py-12">
                            <FaTicketAlt className="mx-auto text-gray-400 text-5xl mb-4" />
                            <p className="text-gray-500">No tickets found.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HelpdeskPage;

