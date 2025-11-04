import React, { useState, useEffect, useRef } from 'react';
import { FaBell, FaTimes, FaCheck, FaTrash } from 'react-icons/fa';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const NotificationDropdown = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
    const buttonRef = useRef(null);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();
    const authUser = useSelector((state) => state?.auth?.user);

    useEffect(() => {
        // Only fetch when a user is available (authenticated)
        if (!authUser) return;
        fetchNotifications();
        fetchUnreadCount();
        
        // Poll for new notifications every 30 seconds
        const interval = setInterval(() => {
            if (authUser) fetchUnreadCount();
        }, 30000);

        return () => clearInterval(interval);
    }, [authUser]);

    // Calculate dropdown position when opening
    useEffect(() => {
        if (isOpen && buttonRef.current && typeof window !== 'undefined') {
            try {
                const buttonRect = buttonRef.current.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const viewportWidth = window.innerWidth;
                const dropdownMaxHeight = 512; // max-h-[32rem] = 32 * 16px = 512px
                const spacing = 8; // 8px spacing
                const spaceAbove = buttonRect.top;
                const spaceBelow = viewportHeight - buttonRect.bottom;

                // Determine best position: above if enough space, otherwise below
                // Also check if positioning above would go negative (above viewport)
                const positionAboveTop = buttonRect.top - dropdownMaxHeight - spacing;
                const positionBelowTop = buttonRect.bottom + spacing;

                if (spaceAbove > spaceBelow && spaceAbove > dropdownMaxHeight && positionAboveTop >= 0) {
                    // Position above (but ensure it doesn't go above viewport)
                    setDropdownPosition({
                        top: Math.max(0, positionAboveTop),
                        right: viewportWidth - buttonRect.right
                    });
                } else {
                    // Position below (ensure it doesn't go below viewport)
                    const maxBottom = viewportHeight - spacing;
                    const calculatedTop = positionBelowTop;
                    setDropdownPosition({
                        top: Math.min(calculatedTop, maxBottom - dropdownMaxHeight),
                        right: viewportWidth - buttonRect.right
                    });
                }
            } catch (error) {
                // Fallback positioning if calculation fails
                console.error('Error calculating dropdown position:', error);
                setDropdownPosition({
                    top: 0,
                    right: 0
                });
            }
        }
    }, [isOpen]);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/v1/both/notification/user-notifications?limit=10&unreadOnly=true', {
                withCredentials: true
            });

            if (response.data.success) {
                setNotifications(response.data.notifications);
            }
        } catch (error) {
            // Gracefully ignore auth errors; avoid noisy console in UI
            const status = error?.response?.status;
            if (status !== 401 && status !== 403) {
                console.error('Error fetching notifications:', error);
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchUnreadCount = async () => {
        try {
            const response = await axios.get('/api/v1/both/notification/unread-count', {
                withCredentials: true
            });

            if (response.data.success) {
                setUnreadCount(response.data.unreadCount);
            }
        } catch (error) {
            const status = error?.response?.status;
            if (status === 401 || status === 403) {
                setUnreadCount(0);
                return; // silently ignore
            }
            console.error('Error fetching unread count:', error);
        }
    };

    const markAsRead = async (notificationId) => {
        try {
            await axios.patch(`/api/v1/both/notification/${notificationId}/read`, {}, {
                withCredentials: true
            });
            // Auto-delete after reading
            try {
                await axios.delete(`/api/v1/both/notification/${notificationId}`, { withCredentials: true });
            } catch {}
            setNotifications(prev => prev.filter(notification => notification._id !== notificationId));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            const status = error?.response?.status;
            if (status !== 401 && status !== 403) {
                console.error('Error marking notification as read:', error);
            }
        }
    };

    const markAllAsRead = async () => {
        try {
            await axios.patch('/api/v1/both/notification/mark-all-read', {}, {
                withCredentials: true
            });
            // Do not batch-delete to avoid 404 noise for legacy items
            setNotifications([]);
            setUnreadCount(0);
            toast.success('All notifications marked as read');
        } catch (error) {
            const status = error?.response?.status;
            if (status !== 401 && status !== 403) {
                console.error('Error marking all notifications as read:', error);
            }
        }
    };

    const deleteNotification = async (notificationId) => {
        try {
            await axios.delete(`/api/v1/both/notification/${notificationId}`, {
                withCredentials: true
            });

            setNotifications(prev => 
                prev.filter(notification => notification._id !== notificationId)
            );
            
            // Check if the deleted notification was unread
            const deletedNotification = notifications.find(n => n._id === notificationId);
            if (deletedNotification && !deletedNotification.isRead) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            const status = error?.response?.status;
            if (status !== 401 && status !== 403) {
                console.error('Error deleting notification:', error);
            }
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'task_created':
            case 'task_updated':
            case 'task_completed':
                return '📋';
            case 'system':
                return '⚙️';
            case 'general':
                return '📢';
            default:
                return '🔔';
        }
    };

    const getNotificationColor = (type) => {
        switch (type) {
            case 'task_completed':
                return 'text-green-600';
            case 'task_created':
                return 'text-blue-600';
            case 'task_updated':
                return 'text-yellow-600';
            case 'system':
                return 'text-purple-600';
            default:
                return 'text-gray-600';
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
        return `${Math.floor(diffInMinutes / 1440)}d ago`;
    };

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) {
                        fetchNotifications();
                    }
                }}
                className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
                <FaBell className="text-xl" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    {/* Backdrop to close on click outside */}
                    <div 
                        className="fixed inset-0 z-40 bg-transparent"
                        onClick={() => setIsOpen(false)}
                    />
                    <div 
                        ref={dropdownRef}
                        className="fixed w-[15rem] sm:w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[32rem] flex flex-col"
                        style={{
                            top: `${dropdownPosition.top}px`,
                            right: `${dropdownPosition.right}px`
                        }}
                    >
                    <div className="p-4 border-b border-gray-200 flex-shrink-0">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Notifications</h3>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap font-medium"
                                    >
                                        Mark all read
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-gray-400 hover:text-gray-600 p-1"
                                    aria-label="Close notifications"
                                >
                                    <FaTimes className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0">
                        {loading ? (
                            <div className="p-4 text-center">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                No notifications yet
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification._id}
                                    className={`p-4 border-b border-gray-100 hover:bg-gray-50 ${
                                        !notification.isRead ? 'bg-blue-50' : ''
                                    }`}
                                >
                                    <div className="flex items-start space-x-3">
                                        <span className="text-lg">
                                            {getNotificationIcon(notification.type)}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium ${getNotificationColor(notification.type)}`}>
                                                {notification.message}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {formatTime(notification.createdAt)}
                                            </p>
                                            {notification.sender && (
                                                <p className="text-xs text-gray-400 mt-1">
                                                    From: {notification.sender.name}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex flex-col space-y-1">
                                            {!notification.isRead && (
                                                <button
                                                    onClick={() => markAsRead(notification._id)}
                                                    className="text-blue-600 hover:text-blue-800 text-xs"
                                                    title="Mark as read"
                                                >
                                                    <FaCheck />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => deleteNotification(notification._id)}
                                                className="text-red-600 hover:text-red-800 text-xs"
                                                title="Delete"
                                            >
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {notifications.length > 0 && (
                        <div className="p-3 border-t border-gray-200 text-center flex-shrink-0 bg-gray-50">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    // Navigate to full notifications page
                                    navigate('/notifications');
                                }}
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                                View all notifications
                            </button>
                        </div>
                    )}
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationDropdown;
