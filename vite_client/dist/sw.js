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

if(!self.define){let s,e={};const i=(i,l)=>(i=new URL(i+".js",l).href,e[i]||new Promise((e=>{if("document"in self){const s=document.createElement("script");s.src=i,s.onload=e,document.head.appendChild(s)}else s=i,importScripts(i),e()})).then((()=>{let s=e[i];if(!s)throw new Error(`Module ${i} didn’t register its module`);return s})));self.define=(l,n)=>{const r=s||("document"in self?document.currentScript.src:"")||location.href;if(e[r])return;let a={};const o=s=>i(s,r),u={module:{uri:r},exports:a,require:o};e[r]=Promise.all(l.map((s=>u[s]||o(s)))).then((s=>(n(...s),a)))}}define(["./workbox-7faf082e"],(function(s){"use strict";self.skipWaiting(),s.clientsClaim(),s.precacheAndRoute([{url:"assets/css/index-ChMAJq-Z.css",revision:null},{url:"assets/css/toastify-GNLSjkBZ.css",revision:null},{url:"assets/js/AddEmployee-xag38-sv.js",revision:null},{url:"assets/js/AddPayroll-CX5Sy6Dp.js",revision:null},{url:"assets/js/AddProject-BjwqnQ4p.js",revision:null},{url:"assets/js/AdminEmployeePayroll-CFrNrfCD.js",revision:null},{url:"assets/js/AdminPayroll-D6GKOkYt.js",revision:null},{url:"assets/js/AdminSettings-DDuOp_xY.js",revision:null},{url:"assets/js/AllAttendanceStatsComponent-znHWk9af.js",revision:null},{url:"assets/js/AttendanceDashboard-DQ9JGsp7.js",revision:null},{url:"assets/js/AttendanceRules-CxcNU8Ht.js",revision:null},{url:"assets/js/axios-B9ygI19o.js",revision:null},{url:"assets/js/BenefitsRouteWrapper-D-tQt4vB.js",revision:null},{url:"assets/js/CalendarManagement-CGJ1MXM0.js",revision:null},{url:"assets/js/capacitor-Df-ZfVU1.js",revision:null},{url:"assets/js/chartjs-C_wfouOF.js",revision:null},{url:"assets/js/CreatePolicy-Cgt9Z-mV.js",revision:null},{url:"assets/js/DailyReport-D6tWE5yf.js",revision:null},{url:"assets/js/dashboard-CyQ4rKja.js",revision:null},{url:"assets/js/DashboardAdmin-B8IZs7pO.js",revision:null},{url:"assets/js/date-utils-n4nFNyQ0.js",revision:null},{url:"assets/js/document-processing-D7UMUD9Z.js",revision:null},{url:"assets/js/DomainVerification-CS0Y9QR4.js",revision:null},{url:"assets/js/EditPolicy-4rBS6vRM.js",revision:null},{url:"assets/js/employee-DoY_T1iA.js",revision:null},{url:"assets/js/EmployeeDetailsPage-GjykHb30.js",revision:null},{url:"assets/js/EmployeeLeaveBalanceViewer-D-9VPxCW.js",revision:null},{url:"assets/js/EmployeesPage-BLfg65us.js",revision:null},{url:"assets/js/ForgotPasswordEmail-bgW4RMFx.js",revision:null},{url:"assets/js/hr-CF_pwWoI.js",revision:null},{url:"assets/js/IdCardGenerator-CaR2JiSc.js",revision:null},{url:"assets/js/index-CzsR3sk_.js",revision:null},{url:"assets/js/LearningRouteWrapper-DVMBs0AT.js",revision:null},{url:"assets/js/LeaveManagement-DpvPZEE1.js",revision:null},{url:"assets/js/LeaveReportsPage-D8HUjb8D.js",revision:null},{url:"assets/js/Login-C9SP89sJ.js",revision:null},{url:"assets/js/mui-core-D6gFWS6S.js",revision:null},{url:"assets/js/mui-material-jVos4AxG.js",revision:null},{url:"assets/js/NotFound-sfJ0NjDD.js",revision:null},{url:"assets/js/Notifications-BA2zLRX_.js",revision:null},{url:"assets/js/NotificationSender-D-AO0ICb.js",revision:null},{url:"assets/js/OfferCandidatePortal-DPqyqxWy.js",revision:null},{url:"assets/js/OnboardingRouteWrapper-CNfJv21s.js",revision:null},{url:"assets/js/OneOnOnePage-B94BQON2.js",revision:null},{url:"assets/js/OneOnOneRouteWrapper-D_crXGzd.js",revision:null},{url:"assets/js/OrganizationAnalytics-CyYhliQY.js",revision:null},{url:"assets/js/OrganizationDashboard-D1P8B9Bb.js",revision:null},{url:"assets/js/OrganizationLogin-B5RsgudM.js",revision:null},{url:"assets/js/OrganizationOnboarding-OJTUn-NF.js",revision:null},{url:"assets/js/OrganizationProfile-BsriDMyd.js",revision:null},{url:"assets/js/OrganizationRegister-DkPBnkpO.js",revision:null},{url:"assets/js/OrganizationSettings-MRDuL0NM.js",revision:null},{url:"assets/js/OrganizationVerification-BiuvY9xK.js",revision:null},{url:"assets/js/PendingApprovals-CmvtZ6Ep.js",revision:null},{url:"assets/js/PolicyManager-MA80hPgw.js",revision:null},{url:"assets/js/ProjectDetailPage-CqXclKM8.js",revision:null},{url:"assets/js/projectFinancialsHelper-BYDOWjvo.js",revision:null},{url:"assets/js/ProjectPage-spFdpi6b.js",revision:null},{url:"assets/js/push-D49-Kp83.js",revision:null},{url:"assets/js/react-chartjs-CgcpOnW5.js",revision:null},{url:"assets/js/recharts-DQA5Ok4J.js",revision:null},{url:"assets/js/redux-persist-C5htUIM5.js",revision:null},{url:"assets/js/redux-toolkit-Bj1cO2XB.js",revision:null},{url:"assets/js/ReferralProgram-iJIlYfyF.js",revision:null},{url:"assets/js/Register-aMMqpJLQ.js",revision:null},{url:"assets/js/RegularizationRequests-BvBAQQr2.js",revision:null},{url:"assets/js/ResetPassword-CAP1-9TP.js",revision:null},{url:"assets/js/RoleBasedDashboard-D4LAYIok.js",revision:null},{url:"assets/js/RoleHierarchy-CaEl1nKc.js",revision:null},{url:"assets/js/SalaryStructureManager-CzmqiJ4x.js",revision:null},{url:"assets/js/SentAnnouncementsPage-CgzEDpKw.js",revision:null},{url:"assets/js/SubscriptionManagement-suz0dRUP.js",revision:null},{url:"assets/js/TeamLearningPage-vYMdkp_S.js",revision:null},{url:"assets/js/TimezoneSelect-DKaNDwx2.js",revision:null},{url:"assets/js/toastify-D3KJ36u4.js",revision:null},{url:"assets/js/TodayStatusComponent-xt51h6Cn.js",revision:null},{url:"assets/js/UpdatePayroll-CwAG2DJb.js",revision:null},{url:"assets/js/useGetAllProjects-DK7Hn_5q.js",revision:null},{url:"assets/js/usePushNotification-C_udszGt.js",revision:null},{url:"assets/js/UsersRolesPage-CUF-Z3VN.js",revision:null},{url:"assets/js/vendor-DyzNwxiR.js",revision:null},{url:"assets/js/ViewPolicy-wntnyH6S.js",revision:null},{url:"assets/js/WorkflowManager-Df2ApIiG.js",revision:null},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"index.html",revision:"4dcab832dfd89bbada44817889f61926"},{url:"Logo.png",revision:"ef235a282358c9371de5c5e80ec35da8"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"media/paarsiv_main (1).png",revision:"90e8eaa2d46370e89cd7731ef65530eb"},{url:"media/paarsiv-white-png-web.png",revision:"5f3579886a9a2a63e31f0f763f7bd89c"},{url:"media/Untitled-2 (2).png",revision:"666d7f0293bbf3c8523022e6d5ade1c8"},{url:"push-handler.js",revision:"ef54cf7d291d149164412d4dd72a9572"},{url:"registerSW.js",revision:"1872c500de691dce40960bb85481de07"},{url:"vite.svg",revision:"8e3a10e157f75ada21ab742c022d5430"},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"push-handler.js",revision:"ef54cf7d291d149164412d4dd72a9572"},{url:"manifest.webmanifest",revision:"51baf594b457dd90324df1cf3aeaf231"}],{}),s.cleanupOutdatedCaches(),s.registerRoute(new s.NavigationRoute(s.createHandlerBoundToURL("/index.html"),{denylist:[/^\/api/,/^\/_/,/\/[^/?]+\.[^/]+$/]})),s.registerRoute(/^https:\/\/api\./i,new s.NetworkFirst({cacheName:"api-cache",networkTimeoutSeconds:10,plugins:[new s.ExpirationPlugin({maxEntries:50,maxAgeSeconds:86400})]}),"GET"),s.registerRoute(/\.(?:png|jpg|jpeg|svg|gif|webp)$/,new s.CacheFirst({cacheName:"image-cache",plugins:[new s.ExpirationPlugin({maxEntries:100,maxAgeSeconds:2592e3})]}),"GET")}));
