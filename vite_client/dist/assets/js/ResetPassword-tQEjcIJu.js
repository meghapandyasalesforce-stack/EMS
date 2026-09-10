const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/js/dashboard-Cjybfbvc.js","assets/js/vendor-DA80U8Km.js","assets/js/toastify-D-yMIcPM.js","assets/css/toastify-GNLSjkBZ.css","assets/js/employee-BcBmkXVr.js","assets/js/redux-toolkit-BA8zrGEu.js","assets/js/date-utils-C2_etgnR.js","assets/js/redux-persist-BtZUmteG.js","assets/js/hr-CtjaXSED.js","assets/js/recharts-CBnbd-RM.js","assets/js/capacitor-Df-ZfVU1.js","assets/js/react-chartjs-B-2X_r5h.js","assets/js/chartjs-DTmz5f4G.js","assets/css/employee-eJxIUqR5.css","assets/js/axios-B9ygI19o.js"])))=>i.map(i=>d[i]);
self.addEventListener('push', (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = {
        title: 'Paarsiv',
        body: event.data.text() || 'You have a new notification',
      };
    }
  } else {
    data = {
      title: 'Paarsiv',
      body: 'You have a new notification',
    };
  }

  const origin = self.location.origin;
  const defaultIcon = `${origin}/logo192.png`;
  const title = data.title && data.title !== 'Notification' ? data.title : 'Paarsiv';

  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || defaultIcon,
    badge: data.badge || defaultIcon,
    tag: data.tag || `notification-${Date.now()}`,
    renotify: data.renotify !== false,
    data: {
      ...(data.data || {}),
      url: data.data?.url || data.url || '/notifications',
    },
    requireInteraction: false,
    vibrate: data.vibrate || [200, 100, 200],
    timestamp: Date.now(),
  };

  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(title, options);
      } catch (err) {
        await self.registration.showNotification(title, {
          body: options.body,
          tag: options.tag,
          data: options.data,
          renotify: true,
        });
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url || '/notifications';
  let fullUrl;
  try {
    // Always resolve on current origin so leave/task/etc. open the right page
    let path = rawUrl;
    if (/^https?:\/\//i.test(rawUrl)) {
      const parsed = new URL(rawUrl);
      path = `${parsed.pathname}${parsed.search}` || '/notifications';
    } else if (!path.startsWith('/')) {
      path = `/${path}`;
    }
    fullUrl = new URL(path, self.location.origin).href;
  } catch {
    fullUrl = `${self.location.origin}/notifications`;
  }

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client && client.url.startsWith(self.location.origin)) {
            client.focus();
            if (client.navigate) {
              return client.navigate(fullUrl);
            }
            return client;
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});

import{_ as N}from"./capacitor-Df-ZfVU1.js";import{r as o,u as P,n as k,G as S,o as E,s as _,j as e}from"./dashboard-Cjybfbvc.js";import{_ as d,V as C,a0 as I}from"./employee-BcBmkXVr.js";import{y as f}from"./toastify-D-yMIcPM.js";import"./vendor-DA80U8Km.js";import"./date-utils-C2_etgnR.js";import"./axios-B9ygI19o.js";import"./redux-toolkit-BA8zrGEu.js";import"./redux-persist-BtZUmteG.js";import"./hr-CtjaXSED.js";import"./recharts-CBnbd-RM.js";import"./react-chartjs-B-2X_r5h.js";import"./chartjs-DTmz5f4G.js";const Y=()=>{const[a,x]=o.useState(""),[m,h]=o.useState(""),[u,c]=o.useState(""),r=P(),g=k(),{token:w}=S(),{loading:p,success:n,error:t,message:i}=E(s=>s.forgotPassword);o.useEffect(()=>{r(d())},[r]),o.useEffect(()=>{n&&(f.success(i||"Password reset successful!"),r(_(null)),localStorage.removeItem("csrfToken"),localStorage.removeItem("role"),localStorage.removeItem("email"),C.purge().catch(()=>{}),(async()=>{try{const{default:l}=await N(async()=>{const{default:v}=await import("./dashboard-Cjybfbvc.js").then(j=>j.bA);return{default:v}},__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14]));try{await l.post("/v1/admin/auth/logout",{},{withCredentials:!0})}catch{await l.post("/v1/employee/auth/logout",{},{withCredentials:!0})}}catch{}})(),r(d()),setTimeout(()=>{window.location.href="/login"},2e3)),t&&f.error(t)},[n,t,i,r]);const y=s=>{if(s.preventDefault(),a!==m){c("Passwords do not match");return}if(a.length<8){c("Password must be at least 8 characters");return}c(""),r(I({token:w,password:a}))},b=()=>{r(d()),g("/login")};return e.jsx("div",{className:"min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8",children:e.jsxs("div",{className:"max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg",children:[e.jsxs("div",{className:"text-center",children:[e.jsx("h2",{className:"text-3xl font-bold text-gray-900",children:"Reset Your Password"}),e.jsx("p",{className:"mt-2 text-sm text-gray-600",children:"Please enter your new password below"})]}),n&&e.jsxs("div",{className:"bg-theme-primary/10 border border-theme-primary text-theme-primary px-4 py-3 rounded relative",role:"alert",children:[e.jsx("strong",{className:"font-bold",children:"Success! "}),e.jsx("span",{className:"block sm:inline",children:i||"Password reset successful!"})]}),t&&e.jsxs("div",{className:"bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative",role:"alert",children:[e.jsx("strong",{className:"font-bold",children:"Error! "}),e.jsx("span",{className:"block sm:inline",children:t})]}),n?e.jsx("div",{className:"mt-8",children:e.jsx("button",{onClick:b,className:"w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-theme-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-2 focus:ring-[var(--color-primary)]",children:"Back to Login"})}):e.jsxs("form",{onSubmit:y,className:"mt-8 space-y-6",children:[e.jsxs("div",{children:[e.jsx("label",{htmlFor:"password",className:"block text-sm font-medium text-gray-700",children:"New Password"}),e.jsx("input",{id:"password",name:"password",type:"password",required:!0,className:"mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary focus:z-10 sm:text-sm",placeholder:"Enter new password",value:a,onChange:s=>x(s.target.value)})]}),e.jsxs("div",{children:[e.jsx("label",{htmlFor:"confirmPassword",className:"block text-sm font-medium text-gray-700",children:"Confirm New Password"}),e.jsx("input",{id:"confirmPassword",name:"confirmPassword",type:"password",required:!0,className:"mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary focus:z-10 sm:text-sm",placeholder:"Confirm new password",value:m,onChange:s=>h(s.target.value)}),u&&e.jsx("p",{className:"mt-2 text-sm text-red-600",children:u})]}),e.jsx("div",{children:e.jsx("button",{type:"submit",disabled:p,className:"w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-theme-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed",children:p?"Resetting...":"Reset Password"})})]})]})})};export{Y as default};
