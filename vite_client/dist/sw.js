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

if(!self.define){let s,e={};const l=(l,i)=>(l=new URL(l+".js",i).href,e[l]||new Promise((e=>{if("document"in self){const s=document.createElement("script");s.src=l,s.onload=e,document.head.appendChild(s)}else s=l,importScripts(l),e()})).then((()=>{let s=e[l];if(!s)throw new Error(`Module ${l} didn’t register its module`);return s})));self.define=(i,n)=>{const r=s||("document"in self?document.currentScript.src:"")||location.href;if(e[r])return;let a={};const o=s=>l(s,r),u={module:{uri:r},exports:a,require:o};e[r]=Promise.all(i.map((s=>u[s]||o(s)))).then((s=>(n(...s),a)))}}define(["./workbox-7faf082e"],(function(s){"use strict";self.skipWaiting(),s.clientsClaim(),s.precacheAndRoute([{url:"assets/css/CareerJobApply-dEODsenR.css",revision:null},{url:"assets/css/index-BZ39P09u.css",revision:null},{url:"assets/css/toastify-GNLSjkBZ.css",revision:null},{url:"assets/js/AddEmployee-SnxOqgwq.js",revision:null},{url:"assets/js/AddPayroll-CxsNWxAL.js",revision:null},{url:"assets/js/AddProject-UqTtQ4tO.js",revision:null},{url:"assets/js/AdminEmployeePayroll-CBlrfeAt.js",revision:null},{url:"assets/js/AdminPayroll-Dh3_QtGd.js",revision:null},{url:"assets/js/AdminSettings-dH6JsEkF.js",revision:null},{url:"assets/js/AllAttendanceStatsComponent-C4_eLk3C.js",revision:null},{url:"assets/js/ApplicationSelfServicePortal-uItJZwrR.js",revision:null},{url:"assets/js/AttendanceDashboard-BGaUWH9f.js",revision:null},{url:"assets/js/AttendanceRules-CbwCAmIU.js",revision:null},{url:"assets/js/axios-B9ygI19o.js",revision:null},{url:"assets/js/BenefitsRouteWrapper-CSVNGR4a.js",revision:null},{url:"assets/js/CalendarManagement-_5S2vGeX.js",revision:null},{url:"assets/js/capacitor-Df-ZfVU1.js",revision:null},{url:"assets/js/CareerJobApply-CcriOn4i.js",revision:null},{url:"assets/js/CareerPortal-B8d2IbfU.js",revision:null},{url:"assets/js/chartjs-De9X9Rgw.js",revision:null},{url:"assets/js/CreatePolicy-CIB3ZD99.js",revision:null},{url:"assets/js/DailyReport-GEVHtNs4.js",revision:null},{url:"assets/js/dashboard-BKcvHaId.js",revision:null},{url:"assets/js/DashboardAdmin-CORHBFfJ.js",revision:null},{url:"assets/js/date-utils-C2_etgnR.js",revision:null},{url:"assets/js/document-processing-BkBmVSSk.js",revision:null},{url:"assets/js/DomainVerification-DJ5ZqQgB.js",revision:null},{url:"assets/js/EditPolicy-DEQd54-a.js",revision:null},{url:"assets/js/employee-BPiJ1rzs.js",revision:null},{url:"assets/js/EmployeeDetailsPage-DQQZ5dyg.js",revision:null},{url:"assets/js/EmployeeLeaveBalanceViewer-Cwl9fo0t.js",revision:null},{url:"assets/js/EmployeesPage-Derd1ysl.js",revision:null},{url:"assets/js/ForgotPasswordEmail-Bz9wBm7A.js",revision:null},{url:"assets/js/hr-TxRnyzld.js",revision:null},{url:"assets/js/IdCardGenerator-C9j8FUjP.js",revision:null},{url:"assets/js/index-Ob2xJhjk.js",revision:null},{url:"assets/js/LearningRouteWrapper-Bwt3knrI.js",revision:null},{url:"assets/js/LeaveManagement-DhQvDDzU.js",revision:null},{url:"assets/js/LeaveReportsPage-DmHmzyuS.js",revision:null},{url:"assets/js/Login-Dchb5Cuy.js",revision:null},{url:"assets/js/ManagerHiringRequestsPage-_FnZ7vXc.js",revision:null},{url:"assets/js/mui-core-Bkyp_STx.js",revision:null},{url:"assets/js/mui-material-TS5jTVkk.js",revision:null},{url:"assets/js/NotFound-C8zSGLUS.js",revision:null},{url:"assets/js/Notifications-CVGiAqnz.js",revision:null},{url:"assets/js/OfferCandidatePortal-BqtquwAO.js",revision:null},{url:"assets/js/OnboardingRouteWrapper-DJwP46c-.js",revision:null},{url:"assets/js/OneOnOnePage-BfiShuC4.js",revision:null},{url:"assets/js/OneOnOneRouteWrapper-DUhxVe-u.js",revision:null},{url:"assets/js/OrganizationAnalytics-B57cSiaK.js",revision:null},{url:"assets/js/OrganizationDashboard-Bgag7Wgd.js",revision:null},{url:"assets/js/OrganizationLogin-nnPt4N-_.js",revision:null},{url:"assets/js/OrganizationOnboarding-DwxRfqaS.js",revision:null},{url:"assets/js/OrganizationProfile-BUFHcc0d.js",revision:null},{url:"assets/js/OrganizationRegister-YYFi85VL.js",revision:null},{url:"assets/js/OrganizationSettings-9ICfw_Ba.js",revision:null},{url:"assets/js/OrganizationVerification-BfYa2z_w.js",revision:null},{url:"assets/js/PendingApprovals-DHqgvosK.js",revision:null},{url:"assets/js/PolicyManager-Bmz6go4H.js",revision:null},{url:"assets/js/ProjectDetailPage-D1dSqJ8A.js",revision:null},{url:"assets/js/projectFinancialsHelper-BYDOWjvo.js",revision:null},{url:"assets/js/ProjectPage-l2YlR2yR.js",revision:null},{url:"assets/js/push-CRqgMU6N.js",revision:null},{url:"assets/js/react-chartjs-DUYxGYbR.js",revision:null},{url:"assets/js/recharts-CkTefkhj.js",revision:null},{url:"assets/js/redux-persist-o3nAi3lu.js",revision:null},{url:"assets/js/redux-toolkit-CTJjaa2o.js",revision:null},{url:"assets/js/ReferralProgram-Bqkv6icc.js",revision:null},{url:"assets/js/Register-xJiBoNxM.js",revision:null},{url:"assets/js/RegularizationRequests-BHYAYu1Z.js",revision:null},{url:"assets/js/ResetPassword-0LwDp-HG.js",revision:null},{url:"assets/js/RoleBasedDashboard-B0XUb2qx.js",revision:null},{url:"assets/js/RoleHierarchy-DA2dwg-m.js",revision:null},{url:"assets/js/SalaryStructureManager-CLhXAgwq.js",revision:null},{url:"assets/js/SentAnnouncementsPage-KhfSwElj.js",revision:null},{url:"assets/js/SubscriptionManagement-C-GPJ-6R.js",revision:null},{url:"assets/js/TeamLearningPage-DBq4bYqe.js",revision:null},{url:"assets/js/TimezoneSelect-D9TGYEPR.js",revision:null},{url:"assets/js/toastify-BLESMFaH.js",revision:null},{url:"assets/js/TodayStatusComponent-vyDIaN-p.js",revision:null},{url:"assets/js/UpdatePayroll-c1sUddis.js",revision:null},{url:"assets/js/useGetAllProjects-DxkGOID_.js",revision:null},{url:"assets/js/usePushNotification-Be-_icmw.js",revision:null},{url:"assets/js/UsersRolesPage-B9gPybAJ.js",revision:null},{url:"assets/js/vendor-DDf2sUNv.js",revision:null},{url:"assets/js/ViewPolicy-C7id7SYY.js",revision:null},{url:"assets/js/WorkflowManager-DddWAwl1.js",revision:null},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"index.html",revision:"aebba0842ffb702b8c732af060b6ee57"},{url:"Logo.png",revision:"ef235a282358c9371de5c5e80ec35da8"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"media/paarsiv_main (1).png",revision:"90e8eaa2d46370e89cd7731ef65530eb"},{url:"media/paarsiv-white-png-web.png",revision:"5f3579886a9a2a63e31f0f763f7bd89c"},{url:"media/Untitled-2 (2).png",revision:"666d7f0293bbf3c8523022e6d5ade1c8"},{url:"push-handler.js",revision:"ef54cf7d291d149164412d4dd72a9572"},{url:"registerSW.js",revision:"1872c500de691dce40960bb85481de07"},{url:"vite.svg",revision:"8e3a10e157f75ada21ab742c022d5430"},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"push-handler.js",revision:"ef54cf7d291d149164412d4dd72a9572"},{url:"manifest.webmanifest",revision:"51baf594b457dd90324df1cf3aeaf231"}],{}),s.cleanupOutdatedCaches(),s.registerRoute(new s.NavigationRoute(s.createHandlerBoundToURL("/index.html"),{denylist:[/^\/api/,/^\/_/,/\/[^/?]+\.[^/]+$/]})),s.registerRoute(/^https:\/\/api\./i,new s.NetworkFirst({cacheName:"api-cache",networkTimeoutSeconds:10,plugins:[new s.ExpirationPlugin({maxEntries:50,maxAgeSeconds:86400})]}),"GET"),s.registerRoute(/\.(?:png|jpg|jpeg|svg|gif|webp)$/,new s.CacheFirst({cacheName:"image-cache",plugins:[new s.ExpirationPlugin({maxEntries:100,maxAgeSeconds:2592e3})]}),"GET")}));
