# Your Email OAuth Callback URL - Step by Step

## ✅ Your Setup
- **App is running on:** Your computer
- **Server port:** 4000 (default)
- **You need:** A public HTTPS URL (use ngrok)
- **Callback path:** `/api/oauth/callback`

---

## 🚀 Step-by-Step to Get Your Email OAuth Callback URL

### **Step 1: Download ngrok (if not already installed)**

1. Go to: https://ngrok.com/download
2. Download ngrok for Windows
3. Extract the ZIP file
4. Note where you extracted it (e.g., `C:\Users\Asus\Downloads\ngrok.exe`)

---

### **Step 2: Make Sure Your App is Running**

1. Open your Electron app
2. Make sure it's fully started (server should be running on port 4000)
3. Keep it running while you set up ngrok

---

### **Step 3: Start ngrok**

1. **Open Command Prompt or PowerShell**
   - Press `Win + R`
   - Type `cmd` and press Enter
   - OR press `Win + X` and select "Windows PowerShell"

2. **Navigate to where ngrok is:**
   ```bash
   cd C:\Users\Asus\Downloads
   ```
   (Adjust path to where you extracted ngrok)

3. **Start ngrok:**
   ```bash
   ngrok http 4000
   ```
   (Replace `4000` with your actual server port if different)

4. **ngrok will start and show something like:**
   ```
   Session Status                online
   Account                       Your Email (Plan: Free)
   Version                       3.x.x
   Region                        United States (us)
   Forwarding                    https://abc123-def456.ngrok.io -> http://localhost:4000
   
   Connections                   ttl     opn     rt1     rt5     p50     p90
                                 0       0       0.00    0.00    0.00    0.00
   ```

5. **Copy the HTTPS URL** from the "Forwarding" line:
   - Example: `https://abc123-def456.ngrok.io`
   - This is your public URL!

---

### **Step 4: Build Your Email OAuth Callback URL**

Take your ngrok URL and add `/api/oauth/callback` to the end.

**Example:**
- ngrok URL: `https://abc123-def456.ngrok.io`
- Your Email OAuth Callback URL: `https://abc123-def456.ngrok.io/api/oauth/callback`

**⚠️ Important:** This is different from WhatsApp webhook which uses `/webhooks/whatsapp`

---

### **Step 5: Use in Azure Portal**

1. Go to: https://portal.azure.com
2. Navigate to **Azure Active Directory** → **App registrations**
3. Select your app registration (or create a new one)
4. Click **"Authentication"** in the left menu
5. Under **"Platform configurations"**, click **"+ Add a platform"**
6. Select **"Web"** (NOT "Single-page application")
7. In **"Redirect URIs"** field, enter EXACTLY:
   ```
   https://your-ngrok-url.ngrok.io/api/oauth/callback
   ```
   (Replace `your-ngrok-url.ngrok.io` with your actual ngrok URL)
8. Click **"Configure"**
9. Click **"Save"** at the top

---

## 📋 Complete Example

**If ngrok gives you:**
```
Forwarding   https://abc123-xyz789.ngrok.io -> http://localhost:4000
```

**Then your Email OAuth Callback URL is:**
```
https://abc123-xyz789.ngrok.io/api/oauth/callback
```

**Enter this in Azure Portal:**
- Platform: **Web**
- Redirect URI: `https://abc123-xyz789.ngrok.io/api/oauth/callback`

---

## ⚠️ Important Notes

1. **Keep ngrok running:** Don't close the ngrok window while using email OAuth
2. **URL changes:** Free ngrok URLs change each time you restart ngrok
3. **Update Azure:** If you restart ngrok, update the redirect URI in Azure Portal
4. **HTTPS required:** ngrok automatically provides HTTPS (that's why it works!)
5. **Use "Web" platform:** Make sure the redirect URI is in the "Web" platform section, NOT "Single-page application"

---

## 🧪 Test Your URL

Before entering in Azure Portal, test if your callback URL is accessible:

1. Open browser
2. Go to: `https://your-ngrok-url.ngrok.io/api/oauth/callback`
3. You should see an error page (400/403) - this is GOOD! It means the endpoint exists
4. If you see "connection refused" - check:
   - Is your app running?
   - Is ngrok running?
   - Did you use the correct URL?

---

## 🎯 Quick Command Reference

**To start ngrok:**
```bash
ngrok http 4000
```
(Replace `4000` with your actual server port)

**Your email callback URL format:**
```
https://[ngrok-url]/api/oauth/callback
```

**Keep both running:**
- ✅ Your Electron app (port 4000)
- ✅ ngrok (forwarding to port 4000)

---

## ✅ Checklist

Before entering in Azure Portal:

- [ ] ngrok is installed
- [ ] Your app is running on port 4000
- [ ] ngrok is running (`ngrok http 4000`)
- [ ] Copied the HTTPS URL from ngrok
- [ ] Added `/api/oauth/callback` to the end
- [ ] Tested the URL in browser (should show error, not connection error)

---

## 💡 Pro Tip

**Keep ngrok running in a separate window** so you can see:
- Incoming OAuth callback requests
- Connection status
- Your public URL (if you forget it)

You can also access ngrok dashboard at: http://localhost:4040

---

## 🔄 Getting Your Current ngrok URL

If ngrok is already running, you can get your URL in 3 ways:

### **Option 1: Check ngrok Dashboard (Easiest)**
1. Open your browser
2. Go to: http://localhost:4040
3. You'll see the ngrok dashboard showing your public HTTPS URL

### **Option 2: Check ngrok Output**
Look at your terminal/command prompt where ngrok is running and find the "Forwarding" line.

### **Option 3: Use PowerShell**
Run this command in a new terminal:
```powershell
$response = Invoke-RestMethod http://localhost:4040/api/tunnels; $httpsTunnel = $response.tunnels | Where-Object { $_.proto -eq 'https' }; $httpsTunnel.public_url
```

---

**That's it! Your email OAuth callback URL will be:**
```
https://your-ngrok-url.ngrok.io/api/oauth/callback
```

Replace `your-ngrok-url.ngrok.io` with your actual ngrok URL!

---

## 📝 Quick Reference

**Current Status:**
- ngrok Status: ⚠️ **Not currently running** (as of last check)
- To get your URL: Start ngrok using `ngrok http 4000` and follow the steps above

**Once ngrok is running, your callback URL will be:**
```
https://[your-ngrok-url]/api/oauth/callback
```


















