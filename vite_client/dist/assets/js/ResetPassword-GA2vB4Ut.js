const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/js/dashboard-xF8DDQB1.js","assets/js/vendor-BIWlejrC.js","assets/js/toastify-BgxXg6iv.js","assets/css/toastify-GNLSjkBZ.css","assets/js/employee-SOCDYwi5.js","assets/js/redux-toolkit-jXpaN-k3.js","assets/js/date-utils-n4nFNyQ0.js","assets/js/redux-persist-CXA1zBfz.js","assets/js/hr-DrFLULdL.js","assets/js/recharts-Bnvr-N-U.js","assets/js/capacitor-Df-ZfVU1.js","assets/js/react-chartjs-B7Gv8Yzo.js","assets/js/chartjs-BM0BK1fT.js","assets/js/axios-B9ygI19o.js"])))=>i.map(i=>d[i]);
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

import{_ as N}from"./capacitor-Df-ZfVU1.js";import{r as o,u as P,p as k,z as S,h as E,s as C,j as e}from"./dashboard-xF8DDQB1.js";import{j as d,p as _,l as I}from"./employee-SOCDYwi5.js";import{y as f}from"./toastify-BgxXg6iv.js";import"./vendor-BIWlejrC.js";import"./date-utils-n4nFNyQ0.js";import"./axios-B9ygI19o.js";import"./redux-toolkit-jXpaN-k3.js";import"./redux-persist-CXA1zBfz.js";import"./hr-DrFLULdL.js";import"./recharts-Bnvr-N-U.js";import"./react-chartjs-B7Gv8Yzo.js";import"./chartjs-BM0BK1fT.js";const $=()=>{const[a,x]=o.useState(""),[m,h]=o.useState(""),[u,l]=o.useState(""),r=P(),g=k(),{token:w}=S(),{loading:p,success:n,error:t,message:c}=E(s=>s.forgotPassword);o.useEffect(()=>{r(d())},[r]),o.useEffect(()=>{n&&(f.success(c||"Password reset successful!"),r(C(null)),localStorage.removeItem("csrfToken"),localStorage.removeItem("role"),localStorage.removeItem("email"),_.purge().catch(()=>{}),(async()=>{try{const{default:i}=await N(async()=>{const{default:v}=await import("./dashboard-xF8DDQB1.js").then(j=>j.a$);return{default:v}},__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13]));try{await i.post("/v1/admin/auth/logout",{},{withCredentials:!0})}catch{await i.post("/v1/employee/auth/logout",{},{withCredentials:!0})}}catch{}})(),r(d()),setTimeout(()=>{window.location.href="/login"},2e3)),t&&f.error(t)},[n,t,c,r]);const y=s=>{if(s.preventDefault(),a!==m){l("Passwords do not match");return}if(a.length<8){l("Password must be at least 8 characters");return}l(""),r(I({token:w,password:a}))},b=()=>{r(d()),g("/login")};return e.jsx("div",{className:"min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8",children:e.jsxs("div",{className:"max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg",children:[e.jsxs("div",{className:"text-center",children:[e.jsx("h2",{className:"text-3xl font-bold text-gray-900",children:"Reset Your Password"}),e.jsx("p",{className:"mt-2 text-sm text-gray-600",children:"Please enter your new password below"})]}),n&&e.jsxs("div",{className:"bg-theme-primary/10 border border-theme-primary text-theme-primary px-4 py-3 rounded relative",role:"alert",children:[e.jsx("strong",{className:"font-bold",children:"Success! "}),e.jsx("span",{className:"block sm:inline",children:c||"Password reset successful!"})]}),t&&e.jsxs("div",{className:"bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative",role:"alert",children:[e.jsx("strong",{className:"font-bold",children:"Error! "}),e.jsx("span",{className:"block sm:inline",children:t})]}),n?e.jsx("div",{className:"mt-8",children:e.jsx("button",{onClick:b,className:"w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-theme-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-2 focus:ring-[var(--color-primary)]",children:"Back to Login"})}):e.jsxs("form",{onSubmit:y,className:"mt-8 space-y-6",children:[e.jsxs("div",{children:[e.jsx("label",{htmlFor:"password",className:"block text-sm font-medium text-gray-700",children:"New Password"}),e.jsx("input",{id:"password",name:"password",type:"password",required:!0,className:"mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary focus:z-10 sm:text-sm",placeholder:"Enter new password",value:a,onChange:s=>x(s.target.value)})]}),e.jsxs("div",{children:[e.jsx("label",{htmlFor:"confirmPassword",className:"block text-sm font-medium text-gray-700",children:"Confirm New Password"}),e.jsx("input",{id:"confirmPassword",name:"confirmPassword",type:"password",required:!0,className:"mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary focus:z-10 sm:text-sm",placeholder:"Confirm new password",value:m,onChange:s=>h(s.target.value)}),u&&e.jsx("p",{className:"mt-2 text-sm text-red-600",children:u})]}),e.jsx("div",{children:e.jsx("button",{type:"submit",disabled:p,className:"w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-theme-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed",children:p?"Resetting...":"Reset Password"})})]})]})})};export{$ as default};
