import express from 'express';
import webpush from 'web-push';
import Subscription from '../models/Subscription.js';

const router = express.Router();

let vapidConfigured = false;
function ensureVapidConfigured() {
  if (!vapidConfigured) {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    vapidConfigured = true;
  }
}

router.post('/subscribe', async (req, res) => {
  const { userId, subscription } = req.body;
  try {
    await Subscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      { userId, endpoint: subscription.endpoint, keys: subscription.keys },
      { upsert: true, new: true }
    );
    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export async function notifyUser(userId, payload) {
  ensureVapidConfigured();
  const subs = await Subscription.find({ userId });
  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(payload)
      ).catch(async (err) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await Subscription.deleteOne({ _id: sub._id });
        }
      })
    )
  );
}

router.post('/send-test/:userId', async (req, res) => {
  ensureVapidConfigured();
  await notifyUser(req.params.userId, {
    title: 'Hello 👋',
    body: 'Yeh ek test notification hai'
  });
  res.json({ message: 'Notification sent' });
});

export default router;