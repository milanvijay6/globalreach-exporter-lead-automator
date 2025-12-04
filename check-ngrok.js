const http = require('http');

function getNgrokUrl() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:4040/api/tunnels', (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.tunnels && response.tunnels.length > 0) {
            const httpsTunnel = response.tunnels.find(t => t.proto === 'https');
            if (httpsTunnel) {
              console.log('✅ ngrok is running!');
              console.log('📡 HTTPS URL:', httpsTunnel.public_url);
              console.log('🔗 Email OAuth Callback URL:', httpsTunnel.public_url + '/api/oauth/callback');
              resolve(httpsTunnel.public_url);
            } else {
              console.log('⚠️ ngrok is running but no HTTPS tunnel found');
              resolve('NO_HTTPS_TUNNEL');
            }
          } else {
            console.log('⚠️ ngrok is running but no tunnels found');
            resolve('NO_TUNNELS');
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        console.log('❌ ngrok is NOT running');
        console.log('💡 To start ngrok, run: ngrok http 4000');
        resolve('NGROK_NOT_RUNNING');
      } else {
        reject(err);
      }
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      console.log('⏱️ Timeout waiting for ngrok API');
      resolve('TIMEOUT');
    });
  });
}

getNgrokUrl()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });










