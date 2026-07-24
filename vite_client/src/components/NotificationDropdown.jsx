import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaBell, FaTimes, FaCheck, FaTrash } from 'react-icons/fa';
import axios from '../utils/axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { BOTH_NOTIFICATION_ENDPOINT } from '../utils/constant';
import { getTokenFromCookie } from '../utils/authHelper';
import { getSocketIOUrl } from '../utils/socketUrl';

const NotificationDropdown = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, maxHeight: 512, width: 320 });
    const buttonRef = useRef(null);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();
    const authUser = useSelector((state) => state?.auth?.user);

    useEffect(() => {
        // Only fetch when a user is available (authenticated) and password reset is not required
        if (!authUser || authUser?.mustResetPassword) return;
        
        // Initial fetch with delay to avoid race conditions
        const initialTimeout = setTimeout(() => {
            fetchNotifications();
            fetchUnreadCount();
        }, 500);
        
        // Poll for new notifications every 60 seconds (reduced from 30s to reduce load)
        // Only poll when tab is visible to reduce unnecessary requests
        let interval;
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Tab is hidden, clear interval
                if (interval) {
                    clearInterval(interval);
                    interval = null;
                }
            } else {
                // Tab is visible, start polling
                if (!interval && authUser) {
                    interval = setInterval(() => {
                        if (authUser && !document.hidden) {
                            fetchUnreadCount();
                        }
                    }, 60000); // 60 seconds
                }
            }
        };
        
        // Start polling only if tab is visible
        if (!document.hidden && authUser) {
            interval = setInterval(() => {
                if (authUser && !document.hidden) {
                    fetchUnreadCount();
                }
            }, 60000); // 60 seconds
        }
        
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearTimeout(initialTimeout);
            if (interval) clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [authUser]);

    // Realtime in-app updates while the phone/laptop app is open
    useEffect(() => {
        if (!authUser || authUser?.mustResetPassword) return;

        const url = getSocketIOUrl();
        if (!url) return;

        const token = getTokenFromCookie();
        const socket = io(url, {
            path: '/socket.io',
            withCredentials: true,
            auth: token ? { token } : {},
            transports: ['websocket', 'polling'],
        });

        const onNotification = (payload) => {
            const notification = payload?.data || payload;
            if (!notification) return;

            setUnreadCount((prev) => prev + 1);
            setNotifications((prev) => {
                const id = notification._id || notification.id;
                if (id && prev.some((n) => String(n._id) === String(id))) return prev;
                return [notification, ...prev].slice(0, 10);
            });

            const message = notification.message || notification.title || 'New notification';
            toast.info(message, { autoClose: 4000 });
        };

        socket.on('notification', onNotification);

        return () => {
            socket.off('notification', onNotification);
            socket.disconnect();
        };
    }, [authUser]);

    // Calculate dropdown position when opening – panel opens to the right of the button, stays in viewport
    const DROPDOWN_MAX_HEIGHT_PX = 512;

    useEffect(() => {
        if (isOpen && buttonRef.current && typeof window !== 'undefined') {
            try {
                const buttonRect = buttonRef.current.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const viewportWidth = window.innerWidth;
                const spacing = 8;
                const dropdownWidth = Math.min(320, viewportWidth - spacing * 2);

                // Horizontal: prefer under/near button, never overflow viewport
                let left = buttonRect.right + spacing;
                if (left + dropdownWidth > viewportWidth - spacing) {
                    left = Math.max(spacing, buttonRect.right - dropdownWidth);
                }
                if (left + dropdownWidth > viewportWidth - spacing) {
                    left = Math.max(spacing, viewportWidth - dropdownWidth - spacing);
                }
                if (left < spacing) left = spacing;

                // Vertical: prefer below button, keep within viewport
                const spaceBelow = viewportHeight - buttonRect.bottom - spacing;
                const spaceAbove = buttonRect.top - spacing;
                const maxHeight = Math.min(DROPDOWN_MAX_HEIGHT_PX, viewportHeight - spacing * 2);
                const openBelow = spaceBelow >= Math.min(maxHeight, spaceBelow) || spaceBelow >= spaceAbove;
                let top;
                if (openBelow) {
                    top = buttonRect.bottom + spacing;
                    const maxTop = viewportHeight - maxHeight - spacing;
                    if (top > maxTop) top = Math.max(spacing, maxTop);
                } else {
                    top = buttonRect.top - spacing - maxHeight;
                    if (top < spacing) top = spacing;
                }

                setDropdownPosition({ top, left, maxHeight, width: dropdownWidth });
            } catch (error) {
                setDropdownPosition({ top: 80, left: 16, maxHeight: 400, width: Math.min(320, window.innerWidth - 32) });
            }
        }
    }, [isOpen]);

    const fetchNotifications = async () => {
        if (!authUser || authUser?.mustResetPassword) return;
        try {
            setLoading(true);
            const response = await axios.get(`${BOTH_NOTIFICATION_ENDPOINT}/user-notifications?limit=10&unreadOnly=true`);

            if (response.data.success) {
                setNotifications(response.data.notifications);
            }
        } catch (error) {
            // Gracefully handle connection errors (backend not running)
            const status = error?.response?.status;
            const isConnectionError = error.code === 'ECONNREFUSED' || 
                                     error.code === 'ECONNRESET' ||
                                     error.message?.includes('Network Error') ||
                                     error.message?.includes('ERR_CONNECTION_REFUSED') ||
                                     status === 503; // Service Unavailable (backend not running)
            
            if (isConnectionError) {
                // Backend is not running - silently fail
                setNotifications([]);
                return;
            }
            
            // Handle rate limiting (429) gracefully - don't retry immediately
            if (status === 429) {
                // Rate limited - silently fail, will retry on next poll
                setNotifications([]);
                return;
            }
            
            // Gracefully ignore auth errors; avoid noisy console in UI
            if (status !== 401 && status !== 403) {
                // Removed console.error for production
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchUnreadCount = async () => {
        if (!authUser || authUser?.mustResetPassword) return;
        try {
            const response = await axios.get(`${BOTH_NOTIFICATION_ENDPOINT}/unread-count`);

            if (response.data.success) {
                setUnreadCount(response.data.unreadCount);
            }
        } catch (error) {
            // Gracefully handle connection errors (backend not running)
            const status = error?.response?.status;
            const isConnectionError = error.code === 'ECONNREFUSED' || 
                                     error.code === 'ECONNRESET' ||
                                     error.message?.includes('Network Error') ||
                                     error.message?.includes('ERR_CONNECTION_REFUSED') ||
                                     status === 503; // Service Unavailable (backend not running)
            
            if (isConnectionError) {
                // Backend is not running - silently fail
                setUnreadCount(0);
                return;
            }
            
            // Handle rate limiting (429) gracefully - don't update count, will retry later
            if (status === 429) {
                // Rate limited - don't update count, will retry on next poll
                return;
            }
            
            if (status === 401 || status === 403) {
                setUnreadCount(0);
                return; // silently ignore
            }
            // Removed console.error for production
        }
    };

    const markAsRead = async (notificationId) => {
        try {
            await axios.patch(`${BOTH_NOTIFICATION_ENDPOINT}/${notificationId}/read`, {});
            // Auto-delete after reading
            try {
                await axios.delete(`${BOTH_NOTIFICATION_ENDPOINT}/${notificationId}`);
            } catch {}
            setNotifications(prev => prev.filter(notification => notification._id !== notificationId));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            const status = error?.response?.status;
            if (status !== 401 && status !== 403) {
                // Removed console.error for production
            }
        }
    };

    const markAllAsRead = async () => {
        try {
            await axios.patch(`${BOTH_NOTIFICATION_ENDPOINT}/mark-all-read`, {});
            // Do not batch-delete to avoid 404 noise for legacy items
            setNotifications([]);
            setUnreadCount(0);
            toast.success('All notifications marked as read');
        } catch (error) {
            const status = error?.response?.status;
            if (status !== 401 && status !== 403) {
                // Removed console.error for production
            }
        }
    };

    const deleteNotification = async (notificationId) => {
        try {
            await axios.delete(`${BOTH_NOTIFICATION_ENDPOINT}/${notificationId}`);

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
                // Removed console.error for production
            }
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'task_created':
            case 'task_assigned':
            case 'task_updated':
            case 'task_completed':
                return '📋';
            case 'system':
                return '⚙️';
            case 'general':
                return '📢';
            case 'break':
                return '☕';
            case 'announcement':
                return '📢';
            default:
                return '🔔';
        }
    };

    const getNotificationColor = (type) => {
        switch (type) {
            case 'task_completed':
                return 'text-theme-primary';
            case 'task_created':
            case 'task_assigned':
                return 'text-theme-secondary';
            case 'task_updated':
                return 'text-yellow-600';
            case 'system':
                return 'text-purple-600';
            case 'break':
                return 'text-orange-600';
            case 'announcement':
                return 'text-theme-accent';
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

            {isOpen && typeof document !== 'undefined' && createPortal(
                <>
                    {/* Backdrop to close on click outside */}
                    <div 
                        className="fixed inset-0 z-[9998] bg-black/20"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    />
                    <div 
                        ref={dropdownRef}
                        className="fixed bg-white rounded-lg shadow-xl border border-gray-200 z-[9999] flex flex-col"
                        style={{
                            top: `${dropdownPosition.top}px`,
                            left: `${dropdownPosition.left}px`,
                            width: `${dropdownPosition.width || 320}px`,
                            maxWidth: 'calc(100vw - 2rem)',
                            maxHeight: `${dropdownPosition.maxHeight || 512}px`,
                        }}
                        role="dialog"
                        aria-label="Notifications"
                    >
                    <div className="p-4 border-b border-gray-200 flex-shrink-0">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Notifications</h3>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="text-xs whitespace-nowrap font-medium text-theme-secondary hover:opacity-80"
            style={{ color: 'var(--color-secondary)' }}
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
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-theme-primary mx-auto"></div>
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
                                        !notification.isRead ? 'bg-theme-secondary/10' : ''
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
                                                    className="text-xs text-theme-secondary hover:opacity-80"
            style={{ color: 'var(--color-secondary)' }}
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
                                className="text-sm font-medium text-theme-secondary hover:opacity-80"
            style={{ color: 'var(--color-secondary)' }}
                            >
                                View all notifications
                            </button>
                        </div>
                    )}
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};

export default NotificationDropdown;
