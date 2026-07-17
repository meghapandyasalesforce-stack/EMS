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

if(!self.define){let s,e={};const l=(l,i)=>(l=new URL(l+".js",i).href,e[l]||new Promise((e=>{if("document"in self){const s=document.createElement("script");s.src=l,s.onload=e,document.head.appendChild(s)}else s=l,importScripts(l),e()})).then((()=>{let s=e[l];if(!s)throw new Error(`Module ${l} didn’t register its module`);return s})));self.define=(i,n)=>{const r=s||("document"in self?document.currentScript.src:"")||location.href;if(e[r])return;let a={};const o=s=>l(s,r),u={module:{uri:r},exports:a,require:o};e[r]=Promise.all(i.map((s=>u[s]||o(s)))).then((s=>(n(...s),a)))}}define(["./workbox-7faf082e"],(function(s){"use strict";self.skipWaiting(),s.clientsClaim(),s.precacheAndRoute([{url:"assets/css/index-D8lWlZf8.css",revision:null},{url:"assets/css/toastify-GNLSjkBZ.css",revision:null},{url:"assets/js/AddEmployee-BAdiPKj4.js",revision:null},{url:"assets/js/AddPayroll-sOM9tv1r.js",revision:null},{url:"assets/js/AddProject-CjB37lAr.js",revision:null},{url:"assets/js/AdminEmployeePayroll-uFceAf7E.js",revision:null},{url:"assets/js/AdminPayroll-BQgIUVCa.js",revision:null},{url:"assets/js/AdminSettings-BVrC-Csz.js",revision:null},{url:"assets/js/AllAttendanceStatsComponent-OV8XCkIR.js",revision:null},{url:"assets/js/AttendanceDashboard-BUWySx97.js",revision:null},{url:"assets/js/AttendanceRules-gQgn2In3.js",revision:null},{url:"assets/js/axios-B9ygI19o.js",revision:null},{url:"assets/js/BenefitsRouteWrapper-zRCOjtUw.js",revision:null},{url:"assets/js/CalendarManagement-CrCb5TKG.js",revision:null},{url:"assets/js/capacitor-Df-ZfVU1.js",revision:null},{url:"assets/js/chartjs-DYaT6Ftx.js",revision:null},{url:"assets/js/CreatePolicy-gH8bCzTV.js",revision:null},{url:"assets/js/DailyReport-CEilzlk8.js",revision:null},{url:"assets/js/dashboard-JVWFRPmw.js",revision:null},{url:"assets/js/DashboardAdmin-CJnP7Go_.js",revision:null},{url:"assets/js/date-utils-DiuZsUq7.js",revision:null},{url:"assets/js/document-processing-DjfUS9gl.js",revision:null},{url:"assets/js/DomainVerification-C_5BShes.js",revision:null},{url:"assets/js/EditPolicy-Bygngfwq.js",revision:null},{url:"assets/js/employee-kOphQr3p.js",revision:null},{url:"assets/js/EmployeeDetailsPage-D7_cKd-P.js",revision:null},{url:"assets/js/EmployeeLeaveBalanceViewer-CZCgrcik.js",revision:null},{url:"assets/js/EmployeesPage-6VeYboNc.js",revision:null},{url:"assets/js/ForgotPasswordEmail-B8LHVOg3.js",revision:null},{url:"assets/js/hr-qNJy617X.js",revision:null},{url:"assets/js/IdCardGenerator-D6bp3R_M.js",revision:null},{url:"assets/js/index-DpYemKOf.js",revision:null},{url:"assets/js/LearningRouteWrapper-yiVGRKdM.js",revision:null},{url:"assets/js/LeaveManagement-CXVB2xdH.js",revision:null},{url:"assets/js/LeaveReportsPage-BNzj0eL5.js",revision:null},{url:"assets/js/Login-DWv2BXGx.js",revision:null},{url:"assets/js/mui-core-CCYFHTZP.js",revision:null},{url:"assets/js/mui-material-u5mXGH38.js",revision:null},{url:"assets/js/NotFound-CFL4Akdx.js",revision:null},{url:"assets/js/Notifications-DvzU-4OV.js",revision:null},{url:"assets/js/NotificationSender-DWchU8_j.js",revision:null},{url:"assets/js/OnboardingRouteWrapper-CA3F7lYQ.js",revision:null},{url:"assets/js/OneOnOnePage-Cfo3sKsB.js",revision:null},{url:"assets/js/OneOnOneRouteWrapper-C3Soeydu.js",revision:null},{url:"assets/js/OrganizationAnalytics-1kTouXQb.js",revision:null},{url:"assets/js/OrganizationDashboard-DIFbXwnE.js",revision:null},{url:"assets/js/OrganizationLogin-BAVbQP4w.js",revision:null},{url:"assets/js/OrganizationOnboarding-BZvP-WOS.js",revision:null},{url:"assets/js/OrganizationProfile-Ds-QFr0X.js",revision:null},{url:"assets/js/OrganizationRegister-Df8CNHf3.js",revision:null},{url:"assets/js/OrganizationSettings-DwSPhNcg.js",revision:null},{url:"assets/js/OrganizationVerification-C_KH561_.js",revision:null},{url:"assets/js/PendingApprovals-HctWz-sT.js",revision:null},{url:"assets/js/PolicyManager-o3XXz6H1.js",revision:null},{url:"assets/js/ProjectDetailPage-BgaLfPK7.js",revision:null},{url:"assets/js/projectFinancialsHelper-BYDOWjvo.js",revision:null},{url:"assets/js/ProjectPage-B3Kn689w.js",revision:null},{url:"assets/js/push-CegUKVac.js",revision:null},{url:"assets/js/react-chartjs-DQXdMDi8.js",revision:null},{url:"assets/js/recharts-k2nI4HC8.js",revision:null},{url:"assets/js/redux-persist-DzTrCmFf.js",revision:null},{url:"assets/js/redux-toolkit-DL-vyN84.js",revision:null},{url:"assets/js/ReferralProgram-DGGBu4oi.js",revision:null},{url:"assets/js/Register-DaUwbYKk.js",revision:null},{url:"assets/js/RegularizationRequests-BiAw65AE.js",revision:null},{url:"assets/js/ResetPassword-ouQGxmRL.js",revision:null},{url:"assets/js/RoleBasedDashboard-CUtTmMvd.js",revision:null},{url:"assets/js/RoleHierarchy-CpLzvy_C.js",revision:null},{url:"assets/js/SalaryStructureManager-C6Qk-5r0.js",revision:null},{url:"assets/js/SentAnnouncementsPage-Pgi-u9gY.js",revision:null},{url:"assets/js/SubscriptionManagement-CBnU4s79.js",revision:null},{url:"assets/js/TeamLearningPage-CEpPCbmZ.js",revision:null},{url:"assets/js/TimezoneSelect-o60hgd8x.js",revision:null},{url:"assets/js/toastify-DLkO57C6.js",revision:null},{url:"assets/js/TodayStatusComponent-ty8lSktP.js",revision:null},{url:"assets/js/UpdatePayroll-CKfbjilx.js",revision:null},{url:"assets/js/useGetAllProjects-BZG9v37J.js",revision:null},{url:"assets/js/usePushNotification-sYeDiASd.js",revision:null},{url:"assets/js/UsersRolesPage-CW-c_2U5.js",revision:null},{url:"assets/js/vendor-CiY69v0f.js",revision:null},{url:"assets/js/ViewPolicy-Bu4mY8uJ.js",revision:null},{url:"assets/js/WorkflowManager-CDEcXz0p.js",revision:null},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"index.html",revision:"ac9c2945633dbeb00ec08457ff40f4eb"},{url:"Logo.png",revision:"ef235a282358c9371de5c5e80ec35da8"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"media/paarsiv_main (1).png",revision:"90e8eaa2d46370e89cd7731ef65530eb"},{url:"media/paarsiv-white-png-web.png",revision:"5f3579886a9a2a63e31f0f763f7bd89c"},{url:"media/Untitled-2 (2).png",revision:"666d7f0293bbf3c8523022e6d5ade1c8"},{url:"push-handler.js",revision:"ef54cf7d291d149164412d4dd72a9572"},{url:"registerSW.js",revision:"1872c500de691dce40960bb85481de07"},{url:"vite.svg",revision:"8e3a10e157f75ada21ab742c022d5430"},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"push-handler.js",revision:"ef54cf7d291d149164412d4dd72a9572"},{url:"manifest.webmanifest",revision:"51baf594b457dd90324df1cf3aeaf231"}],{}),s.cleanupOutdatedCaches(),s.registerRoute(new s.NavigationRoute(s.createHandlerBoundToURL("/index.html"),{denylist:[/^\/api/,/^\/_/,/\/[^/?]+\.[^/]+$/]})),s.registerRoute(/^https:\/\/api\./i,new s.NetworkFirst({cacheName:"api-cache",networkTimeoutSeconds:10,plugins:[new s.ExpirationPlugin({maxEntries:50,maxAgeSeconds:86400})]}),"GET"),s.registerRoute(/\.(?:png|jpg|jpeg|svg|gif|webp)$/,new s.CacheFirst({cacheName:"image-cache",plugins:[new s.ExpirationPlugin({maxEntries:100,maxAgeSeconds:2592e3})]}),"GET")}));
