import React, { useState, useEffect } from 'react';
import { FiUser, FiCalendar, FiClock, FiFileText, FiDollarSign, FiCheckCircle, FiXCircle, FiAlertCircle } from 'react-icons/fi';
import { format, formatDistanceToNow } from 'date-fns';
import axios from '../utils/axios';

const ActivityTimeline = ({ organizationId, entityType, entityId, limit = 50 }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    entityType: entityType || ''
  });

  useEffect(() => {
    fetchActivities();
  }, [organizationId, entityType, entityId, filters]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const params = {
        page: 1,
        limit: limit || 50
      };
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      let response;
      if (entityId && entityType) {
        // Fetch specific entity activities
        response = await axios.get(`/v1/organization/activity`, { params });
        // Filter by entity
        const filtered = (response.data?.data?.activity || {});
        setActivities(filterActivitiesByEntity(filtered, entityType, entityId));
      } else {
        // Fetch organization activities
        response = await axios.get(`/v1/organization/activity`, { params });
        const activityData = response.data?.data?.activity || {};
        setActivities(combineActivities(activityData));
      }
    } catch (error) {
      // Error handled silently for production
    } finally {
      setLoading(false);
    }
  };

  const filterActivitiesByEntity = (activityData, type, id) => {
    const allActivities = combineActivities(activityData);
    return allActivities.filter(activity => {
      if (type === 'Employee') {
        return activity.entityId === id || activity.employeeId === id;
      }
      return activity.entityId === id;
    });
  };

  const combineActivities = (activityData) => {
    const activities = [];

    // Employees
    if (activityData.recentEmployees) {
      activityData.recentEmployees.forEach(emp => {
        activities.push({
          id: emp._id,
          type: 'employee',
          action: 'Created',
          entityType: 'Employee',
          entityName: emp.name,
          timestamp: emp.createdAt,
          metadata: {
            email: emp.email,
            department: emp.department,
            joiningDate: emp.joiningDate
          }
        });
      });
    }

    // Attendance
    if (activityData.recentAttendances) {
      activityData.recentAttendances.forEach(att => {
        activities.push({
          id: att._id,
          type: 'attendance',
          action: att.status === 'present' ? 'Checked In' : 'Checked Out',
          entityType: 'Attendance',
          entityName: att.userId?.name || 'Unknown',
          timestamp: att.createdAt,
          metadata: {
            date: att.date,
            clockIn: att.clockIn,
            clockOut: att.clockOut,
            status: att.status
          }
        });
      });
    }

    // Leaves
    if (activityData.recentLeaves) {
      activityData.recentLeaves.forEach(leave => {
        activities.push({
          id: leave._id,
          type: 'leave',
          action: leave.status === 'approved' ? 'Approved' : leave.status === 'rejected' ? 'Rejected' : 'Requested',
          entityType: 'Leave',
          entityName: leave.employee?.name || 'Unknown',
          timestamp: leave.createdAt,
          metadata: {
            leaveType: leave.leaveType,
            startDate: leave.startDate,
            endDate: leave.endDate,
            status: leave.status
          }
        });
      });
    }

    // Sort by timestamp
    return activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'employee':
        return <FiUser className="w-5 h-5" />;
      case 'attendance':
        return <FiClock className="w-5 h-5" />;
      case 'leave':
        return <FiCalendar className="w-5 h-5" />;
      case 'document':
        return <FiFileText className="w-5 h-5" />;
      case 'expense':
        return <FiDollarSign className="w-5 h-5" />;
      default:
        return <FiAlertCircle className="w-5 h-5" />;
    }
  };

  const getActivityColor = (type, action) => {
    if (action === 'Approved' || action === 'Checked In') return 'text-theme-primary bg-theme-primary/10';
    if (action === 'Rejected') return 'text-red-600 bg-red-100';
    if (action === 'Requested') return 'text-theme-secondary bg-theme-secondary/10';
    return 'text-gray-600 bg-gray-100';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-secondary"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">Activity Timeline</h3>
        <div className="flex gap-2">
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
            placeholder="Start Date"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
            placeholder="End Date"
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        <div className="space-y-6">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No activities found
            </div>
          ) : (
            activities.map((activity, index) => (
              <div key={activity.id || index} className="relative flex items-start gap-4">
                {/* Icon */}
                <div className={`relative z-10 flex items-center justify-center w-16 h-16 rounded-full ${getActivityColor(activity.type, activity.action)}`}>
                  {getActivityIcon(activity.type)}
                </div>

                {/* Content */}
                <div className="flex-1 pb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{activity.action}</h4>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">{activity.entityType}:</span> {activity.entityName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(activity.timestamp), 'PPpp')}
                    </p>

                    {/* Metadata */}
                    {activity.metadata && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                        {activity.metadata.department && (
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">Department:</span> {activity.metadata.department}
                          </p>
                        )}
                        {activity.metadata.leaveType && (
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">Leave Type:</span> {activity.metadata.leaveType}
                          </p>
                        )}
                        {activity.metadata.status && (
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            activity.metadata.status === 'approved' ? 'bg-theme-primary/10 text-theme-primary' :
                            activity.metadata.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {activity.metadata.status}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityTimeline;

