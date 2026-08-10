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

if(!self.define){let s,e={};const l=(l,i)=>(l=new URL(l+".js",i).href,e[l]||new Promise((e=>{if("document"in self){const s=document.createElement("script");s.src=l,s.onload=e,document.head.appendChild(s)}else s=l,importScripts(l),e()})).then((()=>{let s=e[l];if(!s)throw new Error(`Module ${l} didn’t register its module`);return s})));self.define=(i,n)=>{const r=s||("document"in self?document.currentScript.src:"")||location.href;if(e[r])return;let a={};const u=s=>l(s,r),o={module:{uri:r},exports:a,require:u};e[r]=Promise.all(i.map((s=>o[s]||u(s)))).then((s=>(n(...s),a)))}}define(["./workbox-7faf082e"],(function(s){"use strict";self.skipWaiting(),s.clientsClaim(),s.precacheAndRoute([{url:"assets/css/index-DiLnjHVb.css",revision:null},{url:"assets/css/toastify-GNLSjkBZ.css",revision:null},{url:"assets/js/AddEmployee-C6kr_1Oh.js",revision:null},{url:"assets/js/AddPayroll-MrhqAli1.js",revision:null},{url:"assets/js/AddProject-CBBMNPv1.js",revision:null},{url:"assets/js/AdminEmployeePayroll-C0GXuIzG.js",revision:null},{url:"assets/js/AdminPayroll-D5KZl8Rb.js",revision:null},{url:"assets/js/AdminSettings-CKF7sEgD.js",revision:null},{url:"assets/js/AllAttendanceStatsComponent-D5vUXNHJ.js",revision:null},{url:"assets/js/ApplicationSelfServicePortal-C4Nsq2z7.js",revision:null},{url:"assets/js/AttendanceDashboard-LdGe7lBx.js",revision:null},{url:"assets/js/AttendanceRules-BtCjqyE6.js",revision:null},{url:"assets/js/axios-B9ygI19o.js",revision:null},{url:"assets/js/BenefitsRouteWrapper-CiL4dtRF.js",revision:null},{url:"assets/js/CalendarManagement-BV5Jt5W3.js",revision:null},{url:"assets/js/capacitor-Df-ZfVU1.js",revision:null},{url:"assets/js/CareerJobApply-BX3RreCi.js",revision:null},{url:"assets/js/CareerPortal-Dhl2sb7P.js",revision:null},{url:"assets/js/chartjs-B2Hn1TUv.js",revision:null},{url:"assets/js/CreatePolicy-DZM-Z-57.js",revision:null},{url:"assets/js/DailyReport-BE0Fx0gh.js",revision:null},{url:"assets/js/dashboard-D6g38Qi4.js",revision:null},{url:"assets/js/DashboardAdmin-DCfArqGX.js",revision:null},{url:"assets/js/date-utils-C2_etgnR.js",revision:null},{url:"assets/js/document-processing-BKebk7rB.js",revision:null},{url:"assets/js/DomainVerification-Bhq8MFuA.js",revision:null},{url:"assets/js/EditPolicy-DBAQJX10.js",revision:null},{url:"assets/js/employee-Doj1qVqo.js",revision:null},{url:"assets/js/EmployeeDetailsPage-BlR1_WVs.js",revision:null},{url:"assets/js/EmployeeLeaveBalanceViewer-CvvyjY5-.js",revision:null},{url:"assets/js/EmployeesPage-DqdC-y_y.js",revision:null},{url:"assets/js/ForgotPasswordEmail-CAJvCqfh.js",revision:null},{url:"assets/js/hr-CP73wAIr.js",revision:null},{url:"assets/js/IdCardGenerator-CaVnWAU9.js",revision:null},{url:"assets/js/index-CBUVoTfl.js",revision:null},{url:"assets/js/LearningRouteWrapper-BqxaOTZY.js",revision:null},{url:"assets/js/LeaveManagement-CIDkfRUi.js",revision:null},{url:"assets/js/LeaveReportsPage-2_AuZpnq.js",revision:null},{url:"assets/js/Login-Bh4sn54a.js",revision:null},{url:"assets/js/ManagerHiringRequestsPage-DkGfu0kL.js",revision:null},{url:"assets/js/mui-core-psaz6ef7.js",revision:null},{url:"assets/js/mui-material-Dq4rrm7C.js",revision:null},{url:"assets/js/NotFound-BVEY8JkQ.js",revision:null},{url:"assets/js/Notifications-Bhkb2hB2.js",revision:null},{url:"assets/js/NotificationSender-BRe_ISBS.js",revision:null},{url:"assets/js/OfferCandidatePortal-BCwT2t82.js",revision:null},{url:"assets/js/OnboardingRouteWrapper-B032rsIw.js",revision:null},{url:"assets/js/OneOnOnePage-B83UGHPK.js",revision:null},{url:"assets/js/OneOnOneRouteWrapper-GfyXi4SS.js",revision:null},{url:"assets/js/OrganizationAnalytics-BRX1uc8j.js",revision:null},{url:"assets/js/OrganizationDashboard-DqwTHDB0.js",revision:null},{url:"assets/js/OrganizationLogin-BN8Zy0Zy.js",revision:null},{url:"assets/js/OrganizationOnboarding-A2HE94aI.js",revision:null},{url:"assets/js/OrganizationProfile-ri1YSW62.js",revision:null},{url:"assets/js/OrganizationRegister-D2LB9bPu.js",revision:null},{url:"assets/js/OrganizationSettings-D88OrPIg.js",revision:null},{url:"assets/js/OrganizationVerification-4yABgjc6.js",revision:null},{url:"assets/js/PendingApprovals-ClLPXu7u.js",revision:null},{url:"assets/js/PolicyManager-Bi8VKdiI.js",revision:null},{url:"assets/js/ProjectDetailPage-DO6bQNuQ.js",revision:null},{url:"assets/js/projectFinancialsHelper-BYDOWjvo.js",revision:null},{url:"assets/js/ProjectPage-DdLgxUVw.js",revision:null},{url:"assets/js/push-DP0QoSdN.js",revision:null},{url:"assets/js/react-chartjs-CvHKHACM.js",revision:null},{url:"assets/js/recharts-B8RcenrN.js",revision:null},{url:"assets/js/redux-persist-BH8EmQP3.js",revision:null},{url:"assets/js/redux-toolkit-BaCHW2za.js",revision:null},{url:"assets/js/ReferralProgram-BEbYXTQB.js",revision:null},{url:"assets/js/Register-DqPxSTZ4.js",revision:null},{url:"assets/js/RegularizationRequests-DC_3p4WA.js",revision:null},{url:"assets/js/ResetPassword-DyFdinro.js",revision:null},{url:"assets/js/RoleBasedDashboard-hYG_MMmH.js",revision:null},{url:"assets/js/RoleHierarchy-LxQfmlQk.js",revision:null},{url:"assets/js/SalaryStructureManager-KalHPFXC.js",revision:null},{url:"assets/js/SentAnnouncementsPage-C1Kxg_pP.js",revision:null},{url:"assets/js/SubscriptionManagement-BhtcPU7b.js",revision:null},{url:"assets/js/TeamLearningPage-CzhQYdKI.js",revision:null},{url:"assets/js/TimezoneSelect-Dl0IxK-X.js",revision:null},{url:"assets/js/toastify-BDljimj4.js",revision:null},{url:"assets/js/TodayStatusComponent-DLTakuGw.js",revision:null},{url:"assets/js/UpdatePayroll-cJVGPeNx.js",revision:null},{url:"assets/js/useGetAllProjects-DdCaqZFU.js",revision:null},{url:"assets/js/usePushNotification-fitvHXol.js",revision:null},{url:"assets/js/UsersRolesPage-BYD29XaL.js",revision:null},{url:"assets/js/vendor-DRKdbJZS.js",revision:null},{url:"assets/js/ViewPolicy-M1T7NJe0.js",revision:null},{url:"assets/js/WorkflowManager-fuJfFxvb.js",revision:null},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"index.html",revision:"d440e7ce9bde77dfbcac0d5867caedc3"},{url:"Logo.png",revision:"ef235a282358c9371de5c5e80ec35da8"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"media/paarsiv_main (1).png",revision:"90e8eaa2d46370e89cd7731ef65530eb"},{url:"media/paarsiv-white-png-web.png",revision:"5f3579886a9a2a63e31f0f763f7bd89c"},{url:"media/Untitled-2 (2).png",revision:"666d7f0293bbf3c8523022e6d5ade1c8"},{url:"push-handler.js",revision:"ef54cf7d291d149164412d4dd72a9572"},{url:"registerSW.js",revision:"1872c500de691dce40960bb85481de07"},{url:"vite.svg",revision:"8e3a10e157f75ada21ab742c022d5430"},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"push-handler.js",revision:"ef54cf7d291d149164412d4dd72a9572"},{url:"manifest.webmanifest",revision:"51baf594b457dd90324df1cf3aeaf231"}],{}),s.cleanupOutdatedCaches(),s.registerRoute(new s.NavigationRoute(s.createHandlerBoundToURL("/index.html"),{denylist:[/^\/api/,/^\/_/,/\/[^/?]+\.[^/]+$/]})),s.registerRoute(/^https:\/\/api\./i,new s.NetworkFirst({cacheName:"api-cache",networkTimeoutSeconds:10,plugins:[new s.ExpirationPlugin({maxEntries:50,maxAgeSeconds:86400})]}),"GET"),s.registerRoute(/\.(?:png|jpg|jpeg|svg|gif|webp)$/,new s.CacheFirst({cacheName:"image-cache",plugins:[new s.ExpirationPlugin({maxEntries:100,maxAgeSeconds:2592e3})]}),"GET")}));
