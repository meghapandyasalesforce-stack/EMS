const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/js/dashboard-Bg0svFiS.js","assets/js/vendor-BHquvGaM.js","assets/js/toastify-C59K9mqW.js","assets/css/toastify-GNLSjkBZ.css","assets/js/employee-5-FhFgn9.js","assets/js/redux-toolkit-DdPItsuz.js","assets/js/date-utils-DiuZsUq7.js","assets/js/redux-persist-DM0sCMMF.js","assets/js/hr-CYSIjf6N.js","assets/js/recharts-DBb9ykh0.js","assets/js/capacitor-Df-ZfVU1.js","assets/js/react-chartjs-DcpXGFa9.js","assets/js/chartjs-Dhzpdc5G.js","assets/js/axios-B9ygI19o.js"])))=>i.map(i=>d[i]);
self.addEventListener('push', (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = {
        title: 'New Notification',
        body: event.data.text() || 'You have a new notification',
      };
    }
  } else {
    data = {
      title: 'New Notification',
      body: 'You have a new notification',
    };
  }

  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    tag: data.tag || 'notification',
    data: data.data || {},
    requireInteraction: Boolean(data.requireInteraction),
    vibrate: data.vibrate || [200],
    timestamp: Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'New Notification', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';
  const fullUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === fullUrl && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});

import{_ as N}from"./capacitor-Df-ZfVU1.js";import{r as o,u as P,p as k,z as S,h as E,s as C,j as e}from"./dashboard-Bg0svFiS.js";import{g as d,p as _,j as I}from"./employee-5-FhFgn9.js";import{y as f}from"./toastify-C59K9mqW.js";import"./vendor-BHquvGaM.js";import"./axios-B9ygI19o.js";import"./redux-toolkit-DdPItsuz.js";import"./date-utils-DiuZsUq7.js";import"./redux-persist-DM0sCMMF.js";import"./hr-CYSIjf6N.js";import"./recharts-DBb9ykh0.js";import"./react-chartjs-DcpXGFa9.js";import"./chartjs-Dhzpdc5G.js";const G=()=>{const[a,x]=o.useState(""),[m,h]=o.useState(""),[u,c]=o.useState(""),r=P(),g=k(),{token:w}=S(),{loading:p,success:n,error:t,message:i}=E(s=>s.forgotPassword);o.useEffect(()=>{r(d())},[r]),o.useEffect(()=>{n&&(f.success(i||"Password reset successful!"),r(C(null)),localStorage.removeItem("csrfToken"),localStorage.removeItem("role"),localStorage.removeItem("email"),_.purge().catch(()=>{}),(async()=>{try{const{default:l}=await N(async()=>{const{default:v}=await import("./dashboard-Bg0svFiS.js").then(j=>j.aV);return{default:v}},__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13]));try{await l.post("/v1/admin/auth/logout",{},{withCredentials:!0})}catch{await l.post("/v1/employee/auth/logout",{},{withCredentials:!0})}}catch{}})(),r(d()),setTimeout(()=>{window.location.href="/login"},2e3)),t&&f.error(t)},[n,t,i,r]);const y=s=>{if(s.preventDefault(),a!==m){c("Passwords do not match");return}if(a.length<8){c("Password must be at least 8 characters");return}c(""),r(I({token:w,password:a}))},b=()=>{r(d()),g("/login")};return e.jsx("div",{className:"min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8",children:e.jsxs("div",{className:"max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg",children:[e.jsxs("div",{className:"text-center",children:[e.jsx("h2",{className:"text-3xl font-bold text-gray-900",children:"Reset Your Password"}),e.jsx("p",{className:"mt-2 text-sm text-gray-600",children:"Please enter your new password below"})]}),n&&e.jsxs("div",{className:"bg-theme-primary/10 border border-theme-primary text-theme-primary px-4 py-3 rounded relative",role:"alert",children:[e.jsx("strong",{className:"font-bold",children:"Success! "}),e.jsx("span",{className:"block sm:inline",children:i||"Password reset successful!"})]}),t&&e.jsxs("div",{className:"bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative",role:"alert",children:[e.jsx("strong",{className:"font-bold",children:"Error! "}),e.jsx("span",{className:"block sm:inline",children:t})]}),n?e.jsx("div",{className:"mt-8",children:e.jsx("button",{onClick:b,className:"w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-theme-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-2 focus:ring-[var(--color-primary)]",children:"Back to Login"})}):e.jsxs("form",{onSubmit:y,className:"mt-8 space-y-6",children:[e.jsxs("div",{children:[e.jsx("label",{htmlFor:"password",className:"block text-sm font-medium text-gray-700",children:"New Password"}),e.jsx("input",{id:"password",name:"password",type:"password",required:!0,className:"mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary focus:z-10 sm:text-sm",placeholder:"Enter new password",value:a,onChange:s=>x(s.target.value)})]}),e.jsxs("div",{children:[e.jsx("label",{htmlFor:"confirmPassword",className:"block text-sm font-medium text-gray-700",children:"Confirm New Password"}),e.jsx("input",{id:"confirmPassword",name:"confirmPassword",type:"password",required:!0,className:"mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary focus:z-10 sm:text-sm",placeholder:"Confirm new password",value:m,onChange:s=>h(s.target.value)}),u&&e.jsx("p",{className:"mt-2 text-sm text-red-600",children:u})]}),e.jsx("div",{children:e.jsx("button",{type:"submit",disabled:p,className:"w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-theme-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed",children:p?"Resetting...":"Reset Password"})})]})]})})};export{G as default};
