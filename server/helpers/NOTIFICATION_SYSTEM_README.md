# Centralized Notification System Documentation

## Overview

The EMS application now uses a centralized, event-based notification system. All notifications flow through a single `NotificationManager` that handles notification creation, delivery, and tracking.

## Architecture

### Core Components

1. **Notification Manager** (`notificationManager.js`)
   - Single entry point for all notifications
   - Validates events and resolves recipients
   - Handles in-app notifications, push notifications, and future email notifications
   - Prevents duplicate notifications
   - Comprehensive error handling and logging

2. **Event Registry** (`notificationEventRegistry.js`)
   - Registers all notification event types
   - Defines event configuration (title, type, priority)
   - Contains recipient resolution logic
   - Contains message and metadata builders
   - Easy to add new events without modifying core notification logic

3. **Existing Services (Reused)**
   - `notificationService.js` - Database operations and WebSocket delivery
   - `pushNotificationService.js` - Push notification delivery via web-push
   - `notification.model.js` - Database schema (unchanged)

## How to Use

### Basic Usage

```javascript
import { notify } from '../helpers/notificationManager.js';
import '../helpers/notificationEventRegistry.js';

// Send a notification
await notify({
  type: 'leave_applied',
  organizationId: employee.organizationId,
  data: {
    leave,
    employee
  }
});
```

### Parameters

- **type** (required): Event type (must be registered in event registry)
- **organizationId** (required): Organization ID for multi-tenancy
- **recipients** (optional): Array of recipient IDs (if not using recipientResolver)
- **title** (optional): Notification title (uses default if not provided)
- **message** (optional): Notification message (uses messageBuilder if not provided)
- **priority** (optional): Priority level (low, medium, high)
- **data** (optional): Data object passed to recipientResolver, messageBuilder, and metadataBuilder
- **metadata** (optional): Additional metadata (uses metadataBuilder if not provided)
- **senderId** (optional): Sender ID
- **senderType** (optional): Sender type ('User' or 'Employee')

## Registered Events

### Leave Events
- `leave_applied` - New leave request submitted
- `leave_manager_approved` - Leave approved by manager (awaiting HR)
- `leave_approved` - Leave fully approved
- `leave_rejected` - Leave request rejected

### Break Events
- `break_started` - Employee started a break
- `break_ended` - Employee returned from break

### Attendance Events
- `punch_in` - Employee clocked in
- `punch_out` - Employee clocked out
- `late_arrival` - Employee arrived late
- `early_departure` - Employee left early
- `location_validation_failed` - Location validation failed

### Employee Events
- `new_employee_joined` - New employee created

### Payroll Events
- `payroll_released` - Payroll made visible to employee

### Task Events
- `task_created` - New task created
- `task_updated` - Task updated
- `task_completed` - Task completed

### Special Events
- `birthday` - Employee birthday
- `work_anniversary` - Employee work anniversary
- `holiday` - Holiday notification

## Adding a New Event

To add a new notification event:

1. **Register the event** in `notificationEventRegistry.js`:

```javascript
registerEvent({
  type: 'your_event_type',
  defaultTitle: 'Your Default Title',
  defaultType: 'your_notification_type',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId, employee }) => {
    // Return array of recipient IDs
    return [employee._id];
  },
  messageBuilder: ({ data }) => {
    // Build and return notification message
    return 'Your notification message';
  },
  metadataBuilder: ({ data }) => {
    // Build and return metadata object
    return { key: 'value' };
  },
  isBroadcast: false // Set to true for broadcast events
});
```

2. **Use the event** in your controller:

```javascript
import { notify } from '../helpers/notificationManager.js';
import '../helpers/notificationEventRegistry.js';

await notify({
  type: 'your_event_type',
  organizationId,
  data: { /* your data */ }
});
```

## Event Configuration Options

### recipientResolver
Function that resolves recipient IDs based on event data. If not provided, you must pass `recipients` array when calling `notify()`.

```javascript
recipientResolver: async ({ organizationId, employee }) => {
  // Query database for recipients
  const admins = await User.find({ organizationId, role: 'admin' });
  return admins.map(a => a._id.toString());
}
```

### messageBuilder
Function that builds the notification message. Uses event data to create contextual messages.

```javascript
messageBuilder: ({ employee, action }) => {
  return `${employee.name} performed ${action}`;
}
```

### metadataBuilder
Function that builds metadata for the notification. This data is stored with the notification and sent to clients.

```javascript
metadataBuilder: ({ employee, action }) => {
  return {
    employeeId: employee._id,
    employeeName: employee.name,
    action,
    timestamp: new Date()
  };
}
```

### isBroadcast
Set to `true` for events that should be sent to all users (e.g., announcements, holidays). Broadcast events don't use recipientResolver.

## Backward Compatibility

The centralized notification system maintains full backward compatibility:

- **Existing notification functions** in `notificationService.js` are still available
- **Database schema** remains unchanged
- **Push notification implementation** is reused
- **WebSocket delivery** is reused
- **Notification settings** are respected

All existing notification flows continue to work exactly as before, but now use the centralized manager internally.

## Benefits

1. **Single Entry Point**: All notifications go through one function
2. **Consistency**: Uniform error handling, logging, and validation
3. **Scalability**: Easy to add new events without touching core logic
4. **Maintainability**: Notification logic is centralized, not scattered across controllers
5. **Testability**: Easier to test notification flows
6. **Flexibility**: Easy to add new notification channels (email, SMS, etc.)
7. **No Dependencies**: Events are independent - no sequence or dependency between them

## Error Handling

The notification manager handles errors gracefully:

- Invalid event types throw errors
- Missing organizationId throws errors
- Individual notification failures are logged but don't fail the entire operation
- Push notification failures don't block in-app notifications
- All errors are logged with context for debugging

## Logging

All notification operations are logged:

- Event processing start/end
- Recipient resolution
- Notification creation
- Push notification delivery
- Errors with full context

## Future Enhancements

The architecture supports easy addition of:

- **Email notifications**: Add email channel to notification manager
- **SMS notifications**: Add SMS channel to notification manager
- **Notification templates**: Add template system for messages
- **Notification preferences**: More granular user preferences
- **Notification scheduling**: Delayed or scheduled notifications
- **Notification analytics**: Track delivery and engagement

## Migration Guide

To migrate existing notification code:

1. **Import the manager**:
```javascript
import { notify } from '../helpers/notificationManager.js';
import '../helpers/notificationEventRegistry.js';
```

2. **Replace notification calls**:
```javascript
// Old
await sendLeaveNotification(leave, employee);

// New
await notify({
  type: 'leave_applied',
  organizationId: employee.organizationId,
  data: { leave, employee }
});
```

3. **Remove old imports**:
```javascript
// Remove
import { sendLeaveNotification } from '../helpers/notificationService.js';
```

## Support

For questions or issues with the notification system, check:
- This documentation
- Event registry for available events
- Notification manager implementation
- Existing event examples in the registry
