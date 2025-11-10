# Gmail Email Setup Guide

## Step-by-Step Instructions

### Step 1: Enable 2-Step Verification

1. Go to your Google Account: https://myaccount.google.com/security
2. Find "2-Step Verification" and click on it
3. Click "Get Started" and follow the prompts
4. You'll need to verify your phone number
5. Complete the setup process

### Step 2: Generate App Password

1. Go to App Passwords: https://myaccount.google.com/apppasswords
   - Or navigate: Google Account → Security → 2-Step Verification → App passwords
2. Select "Mail" as the app
3. Select "Other (Custom name)" as the device
4. Enter a name like "Paarsiv HR System" or "Employee Management"
5. Click "Generate"
6. **Copy the 16-character password** (it will look like: `abcd efgh ijkl mnop`)
   - ⚠️ **Important**: You can only see this password once! Copy it immediately.

### Step 3: Update Your .env File

Open your `.env` file in the `server` directory and update it:

```env
# Gmail Configuration
EMAIL_USER=yourname@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop  # Your 16-character App Password (spaces optional)

# IMPORTANT: Remove or comment out EMAIL_HOST for Gmail
# EMAIL_HOST=smtp.office365.com  # Comment this out or remove it
# EMAIL_PORT=587  # Not needed for Gmail
```

**Example:**
```env
EMAIL_USER=john.doe@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
# EMAIL_HOST is not needed - system auto-detects Gmail
```

### Step 4: Restart Your Server

After updating the `.env` file:
1. Stop your server (Ctrl+C)
2. Start it again: `npm start` or `npm run dev`

### Step 5: Test Your Configuration

Run the email validation script:
```bash
cd server
npm run check-email
```

You should see:
```
✅ Email configuration is valid!
   Provider: Gmail
   Host: gmail (service)
   Port: N/A
```

## Troubleshooting

### "Invalid login" or "Authentication failed"
- **Problem**: You're using your regular Gmail password instead of an App Password
- **Solution**: Generate an App Password and use that instead

### "2-Step Verification not enabled"
- **Problem**: You need to enable 2-Step Verification first
- **Solution**: Go to https://myaccount.google.com/security and enable it

### "App Password not working"
- **Problem**: The App Password might have spaces or be incorrect
- **Solution**: 
  - Copy the App Password exactly as shown (spaces are optional)
  - Make sure it's 16 characters (spaces don't count)
  - Generate a new one if needed

### "Less secure app access" error
- **Problem**: This shouldn't happen with App Passwords
- **Solution**: Make sure you're using an App Password, not your regular password

## Important Notes

✅ **Do use:**
- Your Gmail email address
- A 16-character App Password
- No EMAIL_HOST setting (system auto-detects)

❌ **Don't use:**
- Your regular Gmail password
- EMAIL_HOST=smtp.gmail.com (not needed)
- EMAIL_PORT (not needed)

## Security Best Practices

1. **Never share your App Password** - treat it like your regular password
2. **Use a descriptive name** when generating the App Password (e.g., "Paarsiv Production Server")
3. **Revoke old App Passwords** if you suspect they're compromised
4. **Keep your .env file secure** - never commit it to version control

## Quick Reference

- **Enable 2-Step Verification**: https://myaccount.google.com/security
- **Generate App Password**: https://myaccount.google.com/apppasswords
- **Test Configuration**: `npm run check-email` (in server directory)

