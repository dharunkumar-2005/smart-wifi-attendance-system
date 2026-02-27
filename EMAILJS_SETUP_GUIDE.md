# EmailJS Setup Guide for Absence Alerts

## Overview
This guide will help you configure EmailJS to send automated absence notification emails to students. The system will automatically send emails to all absent students when staff clicks the "SEND ABSENCE ALERTS" button.

---

## What Gets Sent

### Email Content
When a student is marked absent, they receive an email with the following message:

```
Subject: Absence Notification - KNCET Portal

Dear Student,

You have been marked ABSENT for today's session in the KNCET Portal.

If this is a mistake, contact your staff immediately.

Best regards,
KNCET Attendance System
```

### Recipients
- Emails are sent to students' registered email addresses
- Only absent students (those not in today's attendance) receive emails
- Bulk sending: All eligible students receive emails in one action

---

## Step 1: Create EmailJS Account

1. **Go to EmailJS Website**
   - Visit: https://www.emailjs.com/
   - Click "Sign Up" button

2. **Create Free Account**
   - Email: Use your admin email
   - Password: Create a secure password
   - Verify your email

3. **Login to Dashboard**
   - You'll see the EmailJS dashboard

---

## Step 2: Create Email Service

1. **Navigate to "Email Services"**
   - In left sidebar, click "Email Services"
   - Or go to: https://dashboard.emailjs.com/admin/services

2. **Click "Create New Service"**
   - Select your preferred email provider
   - **Recommended Options:**
     - **Gmail**: Easiest for college email
     - **Outlook/Office365**: For institutional accounts
     - **SendGrid**: Professional SMTP
     - **Custom SMTP**: For your own mail server

### For Gmail (Recommended):

1. **Select Gmail**
2. **Connect Gmail Account**
   - Click "Create Gmail Service"
   - You'll be prompted to authenticate
   - Follow Google's authorization steps
3. **Name the Service**
   - Service Name: `service_attendance_system`
   - ⚠️ **IMPORTANT**: Remember this name!
4. **Click "Create Service"**

### For Custom SMTP (Enterprise):

1. **Select Custom SMTP**
2. **Enter SMTP Details**
   - SMTP Server Address
   - SMTP Port
   - Username & Password
3. **Service Name**: `service_attendance_system`
4. **Click "Create Service"**

---

## Step 3: Create Email Template

1. **Navigate to "Email Templates"**
   - In left sidebar, click "Email Templates"
   - Or go to: https://dashboard.emailjs.com/admin/templates

2. **Click "Create New Template"**

3. **Template Details**
   - **Template Name**: `template_absent_alert`
   - **Subject**: `Absence Notification - KNCET Portal`
   - **Service**: Select the service you created (e.g., `service_attendance_system`)

4. **Template Content**
   Copy and paste this HTML template:

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        font-family: Arial, sans-serif;
        color: #333;
        line-height: 1.6;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background: #f9f9f9;
        border-radius: 8px;
      }
      .header {
        background: linear-gradient(135deg, #ff007a, #ff1493);
        color: white;
        padding: 20px;
        text-align: center;
        border-radius: 8px 8px 0 0;
      }
      .content {
        background: white;
        padding: 25px;
        border-left: 4px solid #ff007a;
      }
      .footer {
        text-align: center;
        font-size: 12px;
        color: #999;
        margin-top: 20px;
      }
      .highlight {
        background: #fff3cd;
        padding: 10px;
        border-left: 4px solid #ffc107;
        margin: 15px 0;
      }
      table {
        width: 100%;
        margin: 15px 0;
        border-collapse: collapse;
      }
      table td {
        padding: 8px;
        border-bottom: 1px solid #eee;
      }
      table td:first-child {
        font-weight: bold;
        color: #ff007a;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>⚠️ Attendance Alert</h1>
      </div>
      
      <div class="content">
        <p>Dear Student,</p>
        
        <p>You have been marked <strong>ABSENT</strong> for today's session in the KNCET Portal.</p>
        
        <table>
          <tr>
            <td>Registration Number:</td>
            <td>{{registration_number}}</td>
          </tr>
          <tr>
            <td>Date:</td>
            <td>{{attendance_date}}</td>
          </tr>
        </table>
        
        <div class="highlight">
          <strong>⚠️ Important:</strong> If this is a mistake, contact your staff immediately.
        </div>
        
        <p>Best regards,<br><strong>KNCET Attendance System</strong></p>
      </div>
      
      <div class="footer">
        <p>This is an automated message from the attendance system. Please do not reply to this email.</p>
      </div>
    </div>
  </body>
</html>
```

5. **Template Variables (Important!)**
   - The template uses these variables:
     - `{{student_name}}` - Student's full name
     - `{{registration_number}}` - Registration number
     - `{{attendance_date}}` - Date of absence
     - `{{to_email}}` - Recipient email address

6. **Save Template**
   - Click "Save"
   - Copy the Template ID shown (format: `template_absent_alert`)

---

## Step 4: Get Your Public Key

1. **Go to Account Settings**
   - Click your profile icon (top right)
   - Click "Account"
   - Or go to: https://dashboard.emailjs.com/admin/account

2. **Find Public Key**
   - Look for "Public Key" section
   - Copy the key (starts with something like `abc123def456...`)
   - Keep this safe!

---

## Step 5: Update Your App Configuration

Now update the `services/emailService.ts` file with your credentials:

```typescript
// BEFORE (Lines 3-6):
const SERVICE_ID = 'service_attendance_system';
const TEMPLATE_ID = 'template_absent_alert';
const OTP_TEMPLATE_ID = 'template_otp_verification';
const PUBLIC_KEY = 'your_emailjs_public_key';

// AFTER (Replace with your actual IDs):
const SERVICE_ID = 'service_xxxxxxxxxxxxxxxx';        // Your Service ID from EmailJS
const TEMPLATE_ID = 'template_xxxxxxxxxxxxxxxx';       // Your Template ID from EmailJS
const OTP_TEMPLATE_ID = 'template_xxxxxxxxxxxxxxxx';   // For OTP (optional)
const PUBLIC_KEY = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // Your Public Key from EmailJS
```

### Where to Find These Values:

| Value | Location |
|-------|----------|
| **Service ID** | Email Services → Click your service → Service ID (top of page) |
| **Template ID** | Email Templates → Click your template → Template ID (top of page) |
| **Public Key** | Account Settings → Public Key section |

---

## Step 6: Test the Configuration

### Test Email in EmailJS Dashboard:

1. **Go to Email Templates**
2. **Click your template** (`template_absent_alert`)
3. **Click "Test it" button** (sometimes shows as "Send test email")
4. **Fill test data:**
   ```
   student_name: Test Student
   registration_number: TEST001
   attendance_date: 2/27/2026
   to_email: your-email@example.com
   ```
5. **Click "Send Test Email"**
6. **Check your inbox** for the test email

### Test in Your App:

1. **Add some students** to the system with valid email addresses
2. **Mark one student as present** (they'll be in attendance list)
3. **Don't mark others as present** (they'll be absent)
4. **Go to Staff Dashboard → Reports tab**
5. **Click "SEND ABSENCE ALERTS" button**
6. **Check for success message** at the bottom
7. **Verify emails received** in student mailboxes

---

## Step 7: Set Student Email Addresses

Students must have valid email addresses registered for emails to be sent.

### In Staff Dashboard:

1. **Go to Students Tab**
2. **Click "Add New Student"**
3. **Fill in:**
   - Name: Student Name
   - Reg No: REG001
   - **Email: student@example.com** ← Required for emails
4. **Click "Add Student"**

### Bulk Update (if using database):

Ensure every student record in Firebase has an `email` field:
```json
{
  "students": {
    "REG001": {
      "name": "Student Name",
      "email": "student@example.com",
      "deviceId": "..."
    }
  }
}
```

---

## How It Works - Step by Step

### Flow:

```
Staff Clicks "SEND ABSENCE ALERTS"
           ↓
System identifies absent students
           ↓
For each absent student with email:
           ↓
Prepare email with student data
           ↓
Send via EmailJS service
           ↓
Student receives email ✉️
           ↓
Show "Mail Sent" status next to student name
```

### On Dashboard:

**Before sending:**
```
┌─────────────────────────────┐
│ Absent List (2)             │
├─────────────────────────────┤
│ John Doe (REG001)   ABSENT  │
│ Jane Smith (REG002) ABSENT  │
└─────────────────────────────┘
```

**After sending:**
```
┌──────────────────────────────────────┐
│ Absent List (2)                      │
├──────────────────────────────────────┤
│ John Doe (REG001)   ✉️ MAIL SENT ABSENT │
│ Jane Smith (REG002) ✉️ MAIL SENT ABSENT │
└──────────────────────────────────────┘
```

---

## Troubleshooting

### "EmailJS not configured" Error

**Problem:** `❌ EmailJS not configured. Check services/emailService.ts`

**Solution:**
1. Verify you updated `services/emailService.ts` with correct IDs
2. Check that PUBLIC_KEY is not still `'your_emailjs_public_key'`
3. Verify SERVICE_ID and TEMPLATE_ID are not empty
4. Restart your app (Ctrl+C and npm run dev)

### Emails Not Sending

**Problem:** Button works but no emails received

**Causes & Solutions:**

| Issue | Solution |
|-------|----------|
| Wrong email address | Check student email in database - must be valid SMTP format |
| Invalid template | Verify template ID matches exactly (case-sensitive) |
| Service not authenticated | Re-authenticate email service in EmailJS dashboard |
| Rate limiting | Wait a few minutes and try again (free plan has limits) |
| Spam folder | Check student's spam/junk folder |
| Email service disabled | Check EmailJS dashboard - service might be disabled |

### Email Service Shows as Failed

1. **Check EmailJS Dashboard Status**
   - Go to: https://dashboard.emailjs.com/admin/services
   - Verify your service shows as "Connected"

2. **For Gmail:**
   - Google may revoke access - click "Reconnect" button
   - You may need to allow "Less secure apps"
   - Update your Gmail app password if 2FA enabled

3. **For Custom SMTP:**
   - Verify SMTP credentials are correct
   - Check firewall allows outbound port 587/465
   - Test credentials in another email client

### Emails Sent But With Wrong Content

1. **Check Template Variables**
   - Verify `{{student_name}}` in template
   - Verify `{{registration_number}}` in template
   - Verify `{{attendance_date}}` in template

2. **Check EmailService Code**
   - Ensure `sendAbsenceAlert()` passes all required parameters
   - Look for typos in parameter names

---

## Production Checklist

Before deploying to production:

- [ ] **EmailJS account created** and verified
- [ ] **Email service configured** and authenticated
- [ ] **Email template created** with correct variables
- [ ] **Credentials updated** in `services/emailService.ts`
- [ ] **Test email sent successfully** from dashboard
- [ ] **All students have email addresses** in database
- [ ] **No sensitive data** in email template (passwords, etc.)
- [ ] **Email logs reviewed** in EmailJS dashboard
- [ ] **Error handling tested** (missing emails, invalid addresses)
- [ ] **Bulk sending tested** with multiple students

---

## API Limits & Pricing

### Free Plan:
- **Limit**: 200 emails per month
- **Perfect for**: Testing, small deployments
- **Supported**: Basic HTML templates

### Paid Plans:
- **Starter**: 5,000 emails/month (~$10-15/month)
- **Professional**: Unlimited emails
- **Enterprise**: Custom pricing

### For KNCET System:
- ~25 school days/month
- If 30% absent daily = 7-8 emails/day
- Expected usage: 175-200 emails/month
- **Recommendation**: Free plan adequate; upgrade to paid if class size > 60

---

## Security Best Practices

### Never Share:
- ❌ Public Key in GitHub (add to .env or .gitignore)
- ❌ Service credentials in commits
- ❌ Template IDs in public documentation

### Protect Your Keys:
1. **Use Environment Variables**
   ```typescript
   const PUBLIC_KEY = process.env.REACT_APP_EMAILJS_PUBLIC_KEY;
   const SERVICE_ID = process.env.REACT_APP_EMAILJS_SERVICE_ID;
   ```

2. **Add to .env file**
   ```
   REACT_APP_EMAILJS_PUBLIC_KEY=your_public_key_here
   REACT_APP_EMAILJS_SERVICE_ID=your_service_id_here
   REACT_APP_EMAILJS_TEMPLATE_ID=your_template_id_here
   ```

3. **Add .env to .gitignore**
   ```
   .env
   .env.local
   .env.*.local
   ```

---

## Where Emails Go (Common Issues)

### Gmail/Google Workspace:
- **Inbox**: Standard
- **Check**: Promotions, Updates, Social tabs
- **Spam trigger**: Large images, multiple links, poor formatting

### Outlook/Office365:
- **Inbox**: Standard
- **Check**: Junk folder
- **Spam trigger**: External email services sometimes flagged

### Corporate Email:
- **Firewall**: May block external email services
- **Solution**: Set up enterprise SMTP instead of EmailJS
- **Contact**: Your IT department for SMTP credentials

---

## FAQ

**Q: Will my students' passwords be sent in the email?**
A: No. The email only contains name, registration number, and date. No sensitive data is included.

**Q: Can I customize the email message?**
A: Yes! Edit the template in EmailJS dashboard. Use variables like `{{student_name}}` and `{{registration_number}}`.

**Q: What happens if a student doesn't have an email?**
A: They don't receive an email (system skips them). Staff will see an error message if trying to send.

**Q: Can I send to parents instead of students?**
A: Yes! Change the recipient to `parent_email` and update template. Update database structure to include parent emails.

**Q: How do I test emails without actually sending?**
A: Use EmailJS's "Test it" feature in the template editor before deploying.

**Q: Do I need to pay for EmailJS?**
A: Free plan includes 200 emails/month. Adequate for most schools. Paid plans available for larger deployments.

**Q: Can I schedule emails to send automatically at a specific time?**
A: Not with free EmailJS. Use a server-side scheduler or upgrade to premium services.

---

## Support & Resources

### EmailJS Documentation:
- [EmailJS Official Docs](https://www.emailjs.com/docs/)
- [EmailJS Dashboard](https://dashboard.emailjs.com/)
- [Contact EmailJS Support](https://www.emailjs.com/contact/)

### Troubleshooting Email Delivery:
- [Email Standards](https://www.emailonacid.com/)
- [SPF/DKIM/DMARC Setup](https://mxtoolbox.com/)

### When to Reach Out to Support:
- EmailJS service consistently failing
- Email authentication issues
- Enterprise SMTP configuration
- High-volume sending (>10,000/month)

---

**Setup Status**: Ready for Configuration ✅
**Last Updated**: February 27, 2026
**Next Step**: Go to https://www.emailjs.com and create your account!
