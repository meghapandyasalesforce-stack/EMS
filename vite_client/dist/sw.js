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

if(!self.define){let s,e={};const l=(l,i)=>(l=new URL(l+".js",i).href,e[l]||new Promise((e=>{if("document"in self){const s=document.createElement("script");s.src=l,s.onload=e,document.head.appendChild(s)}else s=l,importScripts(l),e()})).then((()=>{let s=e[l];if(!s)throw new Error(`Module ${l} didn’t register its module`);return s})));self.define=(i,n)=>{const r=s||("document"in self?document.currentScript.src:"")||location.href;if(e[r])return;let a={};const o=s=>l(s,r),u={module:{uri:r},exports:a,require:o};e[r]=Promise.all(i.map((s=>u[s]||o(s)))).then((s=>(n(...s),a)))}}define(["./workbox-7faf082e"],(function(s){"use strict";self.skipWaiting(),s.clientsClaim(),s.precacheAndRoute([{url:"assets/css/index-CvkD3pEW.css",revision:null},{url:"assets/css/toastify-GNLSjkBZ.css",revision:null},{url:"assets/js/AddEmployee-BIUWPTSs.js",revision:null},{url:"assets/js/AddPayroll-Dgnl2La0.js",revision:null},{url:"assets/js/AddProject-Yzz4wZX8.js",revision:null},{url:"assets/js/AdminEmployeePayroll-DzQnLSJk.js",revision:null},{url:"assets/js/AdminPayroll-Co9XeJoG.js",revision:null},{url:"assets/js/AdminSettings-DnyF7Vve.js",revision:null},{url:"assets/js/AllAttendanceStatsComponent-B95iP4K4.js",revision:null},{url:"assets/js/AttendanceDashboard-_AgUDLzE.js",revision:null},{url:"assets/js/AttendanceRules-tjUOPmMu.js",revision:null},{url:"assets/js/axios-B9ygI19o.js",revision:null},{url:"assets/js/BenefitsRouteWrapper-DRTKVafo.js",revision:null},{url:"assets/js/CalendarManagement-BfqMiV0R.js",revision:null},{url:"assets/js/capacitor-Df-ZfVU1.js",revision:null},{url:"assets/js/chartjs-BM0BK1fT.js",revision:null},{url:"assets/js/CreatePolicy-glF4rkZd.js",revision:null},{url:"assets/js/DailyReport-DRVxjmmx.js",revision:null},{url:"assets/js/dashboard-xF8DDQB1.js",revision:null},{url:"assets/js/DashboardAdmin-BABJEJz7.js",revision:null},{url:"assets/js/date-utils-n4nFNyQ0.js",revision:null},{url:"assets/js/document-processing-DALlrI6p.js",revision:null},{url:"assets/js/DomainVerification-CKVieGmZ.js",revision:null},{url:"assets/js/EditPolicy-DgAWoNBw.js",revision:null},{url:"assets/js/employee-SOCDYwi5.js",revision:null},{url:"assets/js/EmployeeDetailsPage-B20_Uweq.js",revision:null},{url:"assets/js/EmployeeLeaveBalanceViewer-Bry25Jl0.js",revision:null},{url:"assets/js/EmployeesPage-CRFG0Ips.js",revision:null},{url:"assets/js/ForgotPasswordEmail-Co_3wYiO.js",revision:null},{url:"assets/js/hr-DrFLULdL.js",revision:null},{url:"assets/js/IdCardGenerator-D4UZGO8S.js",revision:null},{url:"assets/js/index-CP88RgWo.js",revision:null},{url:"assets/js/LearningRouteWrapper-DaG_26ne.js",revision:null},{url:"assets/js/LeaveManagement-C6NsclyD.js",revision:null},{url:"assets/js/LeaveReportsPage-ChcBWe_p.js",revision:null},{url:"assets/js/Login-DH4HzfHu.js",revision:null},{url:"assets/js/mui-core-BD8QkJ3L.js",revision:null},{url:"assets/js/mui-material-BnAo3PQY.js",revision:null},{url:"assets/js/NotFound-9GO65xBC.js",revision:null},{url:"assets/js/Notifications-Bms0Sv6j.js",revision:null},{url:"assets/js/NotificationSender-Cc01phUl.js",revision:null},{url:"assets/js/OfferCandidatePortal-G1cpwPbF.js",revision:null},{url:"assets/js/OnboardingRouteWrapper-YxczwV1I.js",revision:null},{url:"assets/js/OneOnOnePage-CuonCXVH.js",revision:null},{url:"assets/js/OneOnOneRouteWrapper-BQHw6bQ3.js",revision:null},{url:"assets/js/OrganizationAnalytics-D9WbYvSS.js",revision:null},{url:"assets/js/OrganizationDashboard-Dm2_7JXa.js",revision:null},{url:"assets/js/OrganizationLogin-CFPvd5dj.js",revision:null},{url:"assets/js/OrganizationOnboarding-Cm0ozpVc.js",revision:null},{url:"assets/js/OrganizationProfile-CwRGZgGW.js",revision:null},{url:"assets/js/OrganizationRegister-C9gkG-pF.js",revision:null},{url:"assets/js/OrganizationSettings-TFngBAvv.js",revision:null},{url:"assets/js/OrganizationVerification-DWe7k2OA.js",revision:null},{url:"assets/js/PendingApprovals-BkXfpXJQ.js",revision:null},{url:"assets/js/PolicyManager-DoYlBXa3.js",revision:null},{url:"assets/js/ProjectDetailPage-B0StnYfP.js",revision:null},{url:"assets/js/projectFinancialsHelper-BYDOWjvo.js",revision:null},{url:"assets/js/ProjectPage-C86iLVoB.js",revision:null},{url:"assets/js/push-Z4pwiAhS.js",revision:null},{url:"assets/js/react-chartjs-B7Gv8Yzo.js",revision:null},{url:"assets/js/recharts-Bnvr-N-U.js",revision:null},{url:"assets/js/redux-persist-CXA1zBfz.js",revision:null},{url:"assets/js/redux-toolkit-jXpaN-k3.js",revision:null},{url:"assets/js/ReferralProgram-DW2B4ZKc.js",revision:null},{url:"assets/js/Register-DwXtI3rr.js",revision:null},{url:"assets/js/RegularizationRequests-B0LzCzwQ.js",revision:null},{url:"assets/js/ResetPassword-GA2vB4Ut.js",revision:null},{url:"assets/js/RoleBasedDashboard-DqI3aV1T.js",revision:null},{url:"assets/js/RoleHierarchy-C8gjBe98.js",revision:null},{url:"assets/js/SalaryStructureManager-ZGyZiUes.js",revision:null},{url:"assets/js/SentAnnouncementsPage-B86-DCaw.js",revision:null},{url:"assets/js/SubscriptionManagement-CjkolCDW.js",revision:null},{url:"assets/js/TeamLearningPage-DLwcyJ0u.js",revision:null},{url:"assets/js/TimezoneSelect-_j4rM2Dt.js",revision:null},{url:"assets/js/toastify-BgxXg6iv.js",revision:null},{url:"assets/js/TodayStatusComponent-B9pFCorA.js",revision:null},{url:"assets/js/UpdatePayroll-8n_AYynX.js",revision:null},{url:"assets/js/useGetAllProjects-CpfKf0nl.js",revision:null},{url:"assets/js/usePushNotification-toCeC3wF.js",revision:null},{url:"assets/js/UsersRolesPage-D8H1vseP.js",revision:null},{url:"assets/js/vendor-BIWlejrC.js",revision:null},{url:"assets/js/ViewPolicy-DBtKuJWy.js",revision:null},{url:"assets/js/WorkflowManager-Brw2qXTk.js",revision:null},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"index.html",revision:"f05f425d119f485a9aa4f4fbca055563"},{url:"Logo.png",revision:"ef235a282358c9371de5c5e80ec35da8"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"media/paarsiv_main (1).png",revision:"90e8eaa2d46370e89cd7731ef65530eb"},{url:"media/paarsiv-white-png-web.png",revision:"5f3579886a9a2a63e31f0f763f7bd89c"},{url:"media/Untitled-2 (2).png",revision:"666d7f0293bbf3c8523022e6d5ade1c8"},{url:"push-handler.js",revision:"ef54cf7d291d149164412d4dd72a9572"},{url:"registerSW.js",revision:"1872c500de691dce40960bb85481de07"},{url:"vite.svg",revision:"8e3a10e157f75ada21ab742c022d5430"},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"push-handler.js",revision:"ef54cf7d291d149164412d4dd72a9572"},{url:"manifest.webmanifest",revision:"51baf594b457dd90324df1cf3aeaf231"}],{}),s.cleanupOutdatedCaches(),s.registerRoute(new s.NavigationRoute(s.createHandlerBoundToURL("/index.html"),{denylist:[/^\/api/,/^\/_/,/\/[^/?]+\.[^/]+$/]})),s.registerRoute(/^https:\/\/api\./i,new s.NetworkFirst({cacheName:"api-cache",networkTimeoutSeconds:10,plugins:[new s.ExpirationPlugin({maxEntries:50,maxAgeSeconds:86400})]}),"GET"),s.registerRoute(/\.(?:png|jpg|jpeg|svg|gif|webp)$/,new s.CacheFirst({cacheName:"image-cache",plugins:[new s.ExpirationPlugin({maxEntries:100,maxAgeSeconds:2592e3})]}),"GET")}));
