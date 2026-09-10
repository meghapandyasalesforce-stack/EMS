const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ems')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const notifications = db.collection('notifications');
    const users = db.collection('users');
    const employees = db.collection('employees');
    
    // Get the current user (assuming there's a user in the system)
    const user = await users.findOne({ email: 'admin@paarsiv.com' });
    console.log('Current user:', user ? user._id : 'Not found');
    
    if (!user) {
      // List all users
      const allUsers = await users.find({}).limit(5).toArray();
      console.log('Available users:', allUsers.map(u => ({ email: u.email, _id: u._id, organizationId: u.organizationId })));
      return;
    }
    
    if (user) {
      // Find linked employee
      const employee = await employees.findOne({ userId: user._id.toString() });
      console.log('Linked employee:', employee ? employee._id : 'Not found');
      
      const recipientIds = [user._id.toString()];
      if (employee) {
        recipientIds.push(employee._id.toString());
      }
      console.log('Recipient IDs:', recipientIds);
      console.log('Organization ID:', user.organizationId);
      
      // Test the filter used by getUserNotifications
      const filter = {
        organizationId: user.organizationId,
        $and: [
          {
            $or: [
              { recipient: { $in: recipientIds }, isBroadcast: { $ne: true } },
              { isBroadcast: true },
            ],
          },
          {
            $or: [
              { isBroadcast: { $ne: true } },
              { 'hiddenBy.userId': { $nin: recipientIds } },
            ],
          },
        ],
      };
      
      const userNotifications = await notifications.find(filter).limit(10).toArray();
      console.log('User notifications count:', await notifications.countDocuments(filter));
      console.log('User notifications sample:', JSON.stringify(userNotifications, null, 2));
      
      // Test the filter used by getUnreadCount
      const unreadFilter = {
        organizationId: user.organizationId,
        $and: [
          {
            $or: [
              { recipient: { $in: recipientIds }, isBroadcast: { $ne: true }, isRead: false },
              {
                isBroadcast: true,
                'readReceipts.userId': { $nin: recipientIds },
              },
            ],
          },
          {
            $or: [
              { isBroadcast: { $ne: true } },
              { 'hiddenBy.userId': { $nin: recipientIds } },
            ],
          },
        ],
      };
      
      const unreadCount = await notifications.countDocuments(unreadFilter);
      console.log('Unread count using filter:', unreadCount);
    }
    
    await mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
