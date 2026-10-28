import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FaBell, FaTimes, FaCheck, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { io } from 'socket.io-client';
import { getTokenFromCookie } from '../utils/authHelper';
import { getSocketIOUrl } from '../utils/socketUrl';
import useHrmsPopupDismiss from '../Hooks/useHrmsPopupDismiss';
import {
    fetchUserNotifications,
    fetchUnreadCount,
    markOneNotificationRead,
    markAllNotificationsRead,
    deleteNotificationById,
    deleteAllNotifications,
    receiveSocketNotification
} from '../context/notificationSlice';

/** Hide org announcements sent before this employee was added to EMS. */
function getAnnouncementAudienceCutoff(employee, authUser) {
    // Prefer EMS createdAt over joiningDate (joiningDate is often backdated)
    for (const value of [employee?.createdAt, authUser?.createdAt, employee?.joiningDate]) {
        if (!value) continue;
        const t = new Date(value).getTime();
        if (!Number.isNaN(t)) return new Date(t);
    }
    return null;
}

function isVisibleAnnouncementForHire(notification, cutoff) {
    if (!notification) return false;
    const isAnnouncement =
        notification.type === 'announcement' ||
        (notification.isBroadcast === true && notification.type === 'announcement');
    if (!isAnnouncement || !notification.isBroadcast) return true;
    if (!cutoff) return true;
    const created = new Date(notification.createdAt).getTime();
    if (Number.isNaN(created)) return true;
    return created >= cutoff.getTime();
}

const isImportantNotification = (n) =>
    n?.priority === 'high' || n?.metadata?.important === true || n?.metadata?.priority === 'high';

const notificationDisplayText = (n) => {
    const titled = String(n?.metadata?.title || '').replace(/\s+/g, ' ').trim();
    if (titled) return titled;
    return String(n?.message || 'Notification')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || 'Notification';
};

const NotificationDropdown = () => {
    const dispatch = useDispatch();
    const [isOpen, setIsOpen] = useState(false);
    const closeDropdown = useCallback(() => setIsOpen(false), []);
    useHrmsPopupDismiss(closeDropdown, isOpen);
    
    const notifications = useSelector((state) => state.notifications.notifications || []);
    const loading = useSelector((state) => state.notifications.loading || false);

    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, maxHeight: 512, width: 320 });
    const buttonRef = useRef(null);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const authUser = useSelector((state) => state?.auth?.user);
    const employeeUser = useSelector((state) => state?.employeeDetails?.employee);
    const sessionUser = authUser || employeeUser;

    // Prevent stuck notification backdrop from blocking navbar after navigation
    useEffect(() => {
        setIsOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen]);

    const announcementCutoff = useMemo(
        () => getAnnouncementAudienceCutoff(employeeUser, authUser),
        [employeeUser, authUser]
    );
    // Primitive dep so socket effect does not reconnect on every new Date() identity
    const announcementCutoffMs = announcementCutoff ? announcementCutoff.getTime() : 0;

    const visibleNotifications = useMemo(
        () =>
            (Array.isArray(notifications) ? notifications : [])
                .filter((n) => isVisibleAnnouncementForHire(n, announcementCutoff))
                .slice()
                .sort((a, b) => {
                    const imp = Number(isImportantNotification(b)) - Number(isImportantNotification(a));
                    if (imp !== 0) return imp;
                    return new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0);
                }),
        [notifications, announcementCutoff]
    );

    const visibleUnreadCount = useMemo(
        () =>
            visibleNotifications.filter(
                (n) => n?.isRead === false || n?.read === false
            ).length,
        [visibleNotifications]
    );

    useEffect(() => {
        // Only fetch when a user is available (authenticated) and password reset is not required
        if (!sessionUser || sessionUser?.mustResetPassword) return;
        
        // Initial fetch
        const initialTimeout = setTimeout(() => {
            dispatch(fetchUserNotifications({ limit: 50, page: 1 }));
            dispatch(fetchUnreadCount());
        }, 300);
        
        // Poll for new notifications every 60 seconds
        let interval;
        const handleVisibilityChange = () => {
            if (document.hidden) {
                if (interval) {
                    clearInterval(interval);
                    interval = null;
                }
            } else {
                if (!interval && sessionUser) {
                    interval = setInterval(() => {
                        if (sessionUser && !document.hidden) {
                            dispatch(fetchUnreadCount());
                        }
                    }, 60000);
                }
            }
        };
        
        if (!document.hidden && sessionUser) {
            interval = setInterval(() => {
                if (sessionUser && !document.hidden) {
                    dispatch(fetchUnreadCount());
                }
            }, 60000);
        }
        
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearTimeout(initialTimeout);
            if (interval) clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [sessionUser, dispatch]);

    // Realtime in-app updates while the app is open
    useEffect(() => {
        if (!sessionUser || sessionUser?.mustResetPassword) return;

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
            // Do not surface pre-hire announcements to newly added employees
            if (!isVisibleAnnouncementForHire(notification, announcementCutoff)) return;

            dispatch(receiveSocketNotification(notification));
            const message = notification.message || notification.title || 'New notification';
            toast.info(message, { autoClose: 4000 });
        };

        socket.on('notification', onNotification);

        return () => {
            socket.off('notification', onNotification);
            socket.disconnect();
        };
    }, [sessionUser, dispatch, announcementCutoffMs]);

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

                // Keep panel to the right of the desktop sidebar so it never steals nav clicks
                const sidebarOffset =
                    window.matchMedia('(min-width: 1024px)').matches ? 256 + spacing : spacing;

                // Horizontal: prefer just right of the bell; never cover the sidebar
                let left = Math.max(buttonRect.right + spacing, sidebarOffset);
                if (left + dropdownWidth > viewportWidth - spacing) {
                    left = Math.max(sidebarOffset, viewportWidth - dropdownWidth - spacing);
                }

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

    const markAsRead = async (notificationId) => {
        try {
            await dispatch(markOneNotificationRead(notificationId)).unwrap();
        } catch (error) {
            toast.error(typeof error === 'string' ? error : 'Failed to mark as read');
        }
    };

    const markAllAsRead = async () => {
        try {
            await dispatch(markAllNotificationsRead()).unwrap();
            toast.success('All notifications marked as read');
        } catch (error) {
            toast.error(typeof error === 'string' ? error : 'Failed to mark all as read');
        }
    };

    const deleteNotification = async (notificationId) => {
        try {
            await dispatch(deleteNotificationById(notificationId)).unwrap();
        } catch (error) {
            toast.error(typeof error === 'string' ? error : 'Failed to delete notification');
        }
    };

    const deleteAll = async () => {
        if (!visibleNotifications.length) return;
        try {
            await dispatch(deleteAllNotifications()).unwrap();
            toast.success('All notifications deleted');
            dispatch(fetchUserNotifications({ limit: 50, page: 1 }));
            dispatch(fetchUnreadCount());
        } catch (error) {
            toast.error(typeof error === 'string' ? error : 'Failed to delete all notifications');
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'birthday':
            case 'celebration_birthday_upcoming':
            case 'celebration_birthday_today':
                return '🎂';
            case 'celebration_birthday_wish':
            case 'celebration_anniversary_wish':
            case 'celebration_marriage_anniversary_wish':
                return '💬';
            case 'anniversary':
            case 'celebration_anniversary_upcoming':
            case 'celebration_anniversary_today':
                return '🎉';
            case 'marriage_anniversary':
            case 'celebration_marriage_anniversary_upcoming':
            case 'celebration_marriage_anniversary_today':
                return '💍';
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
                type="button"
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) {
                        dispatch(fetchUserNotifications({ limit: 50, page: 1 }));
                        dispatch(fetchUnreadCount());
                    }
                }}
                className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Notifications"
                aria-expanded={isOpen}
                data-hrms-popup-trigger
            >
                <FaBell className="text-xl" />
                {visibleUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                        {visibleUnreadCount > 9 ? '9+' : visibleUnreadCount}
                    </span>
                )}
            </button>

            {isOpen && typeof document !== 'undefined' && createPortal(
                <>
                    {/* Backdrop to close on click outside */}
                    <div 
                        className="fixed inset-0 z-[9998] bg-black/20 lg:left-[var(--ui-sidebar-width,15rem)]"
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
                                {visibleUnreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="text-xs whitespace-nowrap font-medium text-theme-secondary hover:opacity-80"
            style={{ color: 'var(--color-secondary)' }}
                                    >
                                        Mark all read
                                    </button>
                                )}
                                {visibleNotifications.length > 0 && (
                                    <button
                                        onClick={deleteAll}
                                        className="text-xs whitespace-nowrap font-medium text-red-600 hover:opacity-80"
                                    >
                                        Delete all
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
                        ) : visibleNotifications.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                No notifications yet
                            </div>
                        ) : (
                            visibleNotifications.map((notification) => (
                                <div
                                    key={notification?._id || Math.random()}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                        const meta = notification?.metadata || {};
                                        const meetingId = meta.oneOnOneId || meta.meetingId;
                                        const isOneOnOne =
                                            meta.type === 'one_on_one' || Boolean(meetingId);
                                        if (isOneOnOne && meetingId) {
                                            if (!notification?.isRead) markAsRead(notification._id);
                                            setIsOpen(false);
                                            const action = String(meta.action || '');
                                            // Invitations / schedule changes → personal My 1:1
                                            // Responses / organizer updates → organizer One-on-One
                                            const inviteeActions = new Set([
                                                'invite',
                                                'schedule_changed',
                                                'updated',
                                                'cancelled',
                                                'reschedule_accepted',
                                                'reschedule_rejected',
                                                'reschedule_countered'
                                            ]);
                                            const organizerActions = new Set([
                                                'accepted',
                                                'declined',
                                                'reschedule_requested'
                                            ]);
                                            let path = meta.link || null;
                                            if (!path) {
                                                if (organizerActions.has(action)) {
                                                    path = `/one-on-one?meetingId=${meetingId}`;
                                                } else if (inviteeActions.has(action) || action === 'invite') {
                                                    path = `/1-on-1?meetingId=${meetingId}`;
                                                } else {
                                                    path = `/1-on-1?meetingId=${meetingId}`;
                                                }
                                            }
                                            navigate(path);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') e.currentTarget.click();
                                    }}
                                    className={`p-4 border-b border-gray-100 hover:bg-gray-50 ${
                                        !notification?.isRead ? 'bg-theme-secondary/10' : ''
                                    } ${
                                        isImportantNotification(notification)
                                            ? 'border-l-4 border-l-red-500'
                                            : ''
                                    } ${
                                        notification?.metadata?.type === 'one_on_one' ||
                                        notification?.metadata?.oneOnOneId
                                            ? 'cursor-pointer'
                                            : ''
                                    }`}
                                >
                                    <div className="flex items-start space-x-3">
                                        <span className="text-lg">
                                            {getNotificationIcon(notification?.type)}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                                {isImportantNotification(notification) ? (
                                                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 border border-red-200">
                                                        Important
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className={`text-sm font-medium ${getNotificationColor(notification?.type)}`}>
                                                {notificationDisplayText(notification)}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {formatTime(notification?.createdAt)}
                                            </p>
                                            {notification?.sender && (
                                                <p className="text-xs text-gray-400 mt-1">
                                                    From: {notification.sender.name || 'System'}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex flex-col space-y-1">
                                            {!notification?.isRead && (
                                                <button
                                                    onClick={() => markAsRead(notification?._id)}
                                                    className="text-xs text-theme-secondary hover:opacity-80"
                                                    style={{ color: 'var(--color-secondary)' }}
                                                    title="Mark as read"
                                                >
                                                    <FaCheck />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => deleteNotification(notification?._id)}
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
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};

export default NotificationDropdown;
