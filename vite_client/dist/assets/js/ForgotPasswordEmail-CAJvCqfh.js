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

import{r as n,u as x,p as h,h as f,j as e}from"./dashboard-D6g38Qi4.js";import{G as g,H as b}from"./employee-Doj1qVqo.js";import{y as l}from"./toastify-BDljimj4.js";import"./vendor-DRKdbJZS.js";import"./date-utils-C2_etgnR.js";import"./axios-B9ygI19o.js";import"./redux-toolkit-BaCHW2za.js";import"./redux-persist-BH8EmQP3.js";import"./hr-CP73wAIr.js";import"./recharts-B8RcenrN.js";import"./capacitor-Df-ZfVU1.js";import"./react-chartjs-CvHKHACM.js";import"./chartjs-B2Hn1TUv.js";const D=()=>{const[d,m]=n.useState(""),a=x(),u=h(),{loading:c,success:i,error:s,message:o,emailSent:r}=f(t=>t.forgotPassword);n.useEffect(()=>{a(g())},[a]),n.useEffect(()=>{i&&(r?l.success(o||"Password reset link sent. Check your inbox."):l.info(o||"Request received. Check your inbox if an account exists for this email.")),s&&l.error(s)},[i,s,o,r]);const p=t=>{t.preventDefault(),a(b(d.trim()))};return e.jsx("div",{className:"min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8",children:e.jsxs("div",{className:"max-w-md w-full space-y-8 bg-white p-5 sm:p-8 rounded-lg shadow-lg",children:[e.jsxs("div",{className:"text-center",children:[e.jsx("h2",{className:"text-3xl font-bold text-gray-900",children:"Forgot Password?"}),e.jsx("p",{className:"mt-2 text-sm text-gray-600",children:"Enter your email address and we'll send you a link to reset your password."})]}),i&&e.jsxs("div",{className:r?"bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded relative":"bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded relative",role:"alert",children:[e.jsx("strong",{className:"font-bold",children:r?"Email sent — ":"Request received — "}),e.jsx("span",{className:"block sm:inline",children:o}),!r&&e.jsx("p",{className:"mt-2 text-sm opacity-90",children:"Use the same email you use to log in. If you do not receive a message within a few minutes, contact your administrator."})]}),s&&e.jsxs("div",{className:"bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative",role:"alert",children:[e.jsx("strong",{className:"font-bold",children:"Error! "}),e.jsx("span",{className:"block sm:inline",children:s})]}),e.jsxs("form",{onSubmit:p,className:"mt-8 space-y-6",children:[e.jsxs("div",{children:[e.jsx("label",{htmlFor:"email",className:"block text-sm font-medium text-gray-700",children:"Email Address"}),e.jsx("input",{id:"email",name:"email",type:"email",required:!0,className:"mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary focus:z-10 sm:text-sm",placeholder:"Enter your email address",value:d,onChange:t=>m(t.target.value)})]}),e.jsx("div",{children:e.jsx("button",{type:"submit",disabled:c,className:"w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-theme-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed",children:c?"Sending...":"Send Reset Link"})}),e.jsx("div",{className:"text-center",children:e.jsx("button",{type:"button",onClick:()=>u("/login"),className:"text-sm text-theme-secondary hover:text-theme-secondary",children:"Back to Login"})})]})]})})};export{D as default};
