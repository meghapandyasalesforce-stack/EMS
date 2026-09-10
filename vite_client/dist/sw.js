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

if(!self.define){let s,e={};const l=(l,n)=>(l=new URL(l+".js",n).href,e[l]||new Promise((e=>{if("document"in self){const s=document.createElement("script");s.src=l,s.onload=e,document.head.appendChild(s)}else s=l,importScripts(l),e()})).then((()=>{let s=e[l];if(!s)throw new Error(`Module ${l} didn’t register its module`);return s})));self.define=(n,r)=>{const i=s||("document"in self?document.currentScript.src:"")||location.href;if(e[i])return;let a={};const o=s=>l(s,i),u={module:{uri:i},exports:a,require:o};e[i]=Promise.all(n.map((s=>u[s]||o(s)))).then((s=>(r(...s),a)))}}define(["./workbox-7faf082e"],(function(s){"use strict";self.skipWaiting(),s.clientsClaim(),s.precacheAndRoute([{url:"assets/css/CareerJobApply-dEODsenR.css",revision:null},{url:"assets/css/employee-eJxIUqR5.css",revision:null},{url:"assets/css/index-BOKKA0UW.css",revision:null},{url:"assets/css/toastify-GNLSjkBZ.css",revision:null},{url:"assets/js/AddEmployee-BI8VcJ-S.js",revision:null},{url:"assets/js/AddPayroll--LMqI5pI.js",revision:null},{url:"assets/js/AddProject-UGJOs00X.js",revision:null},{url:"assets/js/AdminEmployeeDocumentRequests-PmnLrg1I.js",revision:null},{url:"assets/js/AdminEmployeePayroll-W01EBJyA.js",revision:null},{url:"assets/js/AdminPayroll-D34IpbqY.js",revision:null},{url:"assets/js/AdminSettings-BL1tWJyV.js",revision:null},{url:"assets/js/AllAttendanceStatsComponent-BLZAy9hl.js",revision:null},{url:"assets/js/ApplicationSelfServicePortal-DaZppXYL.js",revision:null},{url:"assets/js/AttendanceDashboard-I6rgiaMp.js",revision:null},{url:"assets/js/AttendanceRules-DySJ72Lg.js",revision:null},{url:"assets/js/axios-B9ygI19o.js",revision:null},{url:"assets/js/BenefitsRouteWrapper-CiLMmFWM.js",revision:null},{url:"assets/js/CalendarManagement-CXOTktLm.js",revision:null},{url:"assets/js/capacitor-Df-ZfVU1.js",revision:null},{url:"assets/js/CareerJobApply-CqZjcXlA.js",revision:null},{url:"assets/js/CareerPortal-DKPaocOi.js",revision:null},{url:"assets/js/CelebrationEventPage-qEgUrHjv.js",revision:null},{url:"assets/js/chartjs-DTmz5f4G.js",revision:null},{url:"assets/js/CreatePolicy-If-fm_cx.js",revision:null},{url:"assets/js/DailyReport-CKwUAsyg.js",revision:null},{url:"assets/js/dashboard-Cjybfbvc.js",revision:null},{url:"assets/js/DashboardAdmin-Brbv03ca.js",revision:null},{url:"assets/js/date-utils-C2_etgnR.js",revision:null},{url:"assets/js/document-processing-qDoCrxJN.js",revision:null},{url:"assets/js/DocumentManagement-MnWg3Mky.js",revision:null},{url:"assets/js/DocumentTemplateManager-CsK5MCrg.js",revision:null},{url:"assets/js/DomainVerification-C20aAIJC.js",revision:null},{url:"assets/js/EditPolicy-CoYLGvJ0.js",revision:null},{url:"assets/js/employee-BcBmkXVr.js",revision:null},{url:"assets/js/EmployeeDetailsPage-0bJ9Votb.js",revision:null},{url:"assets/js/EmployeeLeaveBalanceViewer-BZIgZMOA.js",revision:null},{url:"assets/js/EmployeesPage-djm9rWZg.js",revision:null},{url:"assets/js/ForgotPasswordEmail-CLXwmp9I.js",revision:null},{url:"assets/js/hr-CtjaXSED.js",revision:null},{url:"assets/js/IdCardGenerator-BenSDTzW.js",revision:null},{url:"assets/js/index-xovDOM-Y.js",revision:null},{url:"assets/js/LearningRouteWrapper-Byrx86vX.js",revision:null},{url:"assets/js/LeaveManagement-D0OzdwsT.js",revision:null},{url:"assets/js/LeaveReportsPage-ozw6o-PT.js",revision:null},{url:"assets/js/Login-DeneaOz2.js",revision:null},{url:"assets/js/ManagerHiringRequestsPage-DBDXIBeV.js",revision:null},{url:"assets/js/mui-core-eF2zpvnW.js",revision:null},{url:"assets/js/mui-material-46Gn3zfQ.js",revision:null},{url:"assets/js/NotFound-D0_3XmeN.js",revision:null},{url:"assets/js/Notifications-DD2firP_.js",revision:null},{url:"assets/js/OfferCandidatePortal-BrPkU5WQ.js",revision:null},{url:"assets/js/OnboardingRouteWrapper-DkHJWU5I.js",revision:null},{url:"assets/js/OneOnOnePage-BZGdxryE.js",revision:null},{url:"assets/js/OneOnOneRouteWrapper-Defv-t0G.js",revision:null},{url:"assets/js/OrganizationAnalytics-DuzrRMoM.js",revision:null},{url:"assets/js/OrganizationDashboard-ifYrmu6s.js",revision:null},{url:"assets/js/OrganizationLogin-CyKDoupM.js",revision:null},{url:"assets/js/OrganizationOnboarding-BL8z6LTq.js",revision:null},{url:"assets/js/OrganizationProfile-CnAfhNf0.js",revision:null},{url:"assets/js/OrganizationRegister-CCa8Vm6D.js",revision:null},{url:"assets/js/OrganizationSettings-BG_fPttQ.js",revision:null},{url:"assets/js/OrganizationVerification-B6CWslYW.js",revision:null},{url:"assets/js/PendingApprovals-BHK7JizR.js",revision:null},{url:"assets/js/PolicyManager-8XRsnzz-.js",revision:null},{url:"assets/js/ProjectDetailPage-BZf9R66z.js",revision:null},{url:"assets/js/projectFinancialsHelper-BYDOWjvo.js",revision:null},{url:"assets/js/ProjectPage-DZEDJpGD.js",revision:null},{url:"assets/js/push-DZ20wkVi.js",revision:null},{url:"assets/js/react-chartjs-B-2X_r5h.js",revision:null},{url:"assets/js/recharts-CBnbd-RM.js",revision:null},{url:"assets/js/redux-persist-BtZUmteG.js",revision:null},{url:"assets/js/redux-toolkit-BA8zrGEu.js",revision:null},{url:"assets/js/ReferralProgram-C-5dGDJA.js",revision:null},{url:"assets/js/Register-BxbYozW0.js",revision:null},{url:"assets/js/RegularizationRequests-0UtV4bOA.js",revision:null},{url:"assets/js/ResetPassword-tQEjcIJu.js",revision:null},{url:"assets/js/RoleBasedDashboard-DTlmtq-p.js",revision:null},{url:"assets/js/RoleHierarchy-B4cJ-ePR.js",revision:null},{url:"assets/js/SalaryStructureManager-CG6vcn9S.js",revision:null},{url:"assets/js/SentAnnouncementsPage-D1LQcEXn.js",revision:null},{url:"assets/js/SubscriptionManagement-CGfN8vfC.js",revision:null},{url:"assets/js/TeamLearningPage-C-KAj6vo.js",revision:null},{url:"assets/js/TimezoneSelect-BaKbT_xz.js",revision:null},{url:"assets/js/toastify-D-yMIcPM.js",revision:null},{url:"assets/js/TodayStatusComponent-BoxGkFJq.js",revision:null},{url:"assets/js/UpdatePayroll-C_b7__yH.js",revision:null},{url:"assets/js/useGetAllProjects-BxHEKOPY.js",revision:null},{url:"assets/js/usePushNotification-BN76Yza7.js",revision:null},{url:"assets/js/UsersRolesPage-rRUrgR7z.js",revision:null},{url:"assets/js/vendor-DA80U8Km.js",revision:null},{url:"assets/js/ViewPolicy-BlkDmKxH.js",revision:null},{url:"assets/js/WorkflowManager-C5T5WgMr.js",revision:null},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"index.html",revision:"aa82572ffa435e688f696e78d2d4ca6f"},{url:"Logo.png",revision:"ef235a282358c9371de5c5e80ec35da8"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"media/paarsiv_main (1).png",revision:"90e8eaa2d46370e89cd7731ef65530eb"},{url:"media/paarsiv-white-png-web.png",revision:"5f3579886a9a2a63e31f0f763f7bd89c"},{url:"media/Untitled-2 (2).png",revision:"666d7f0293bbf3c8523022e6d5ade1c8"},{url:"push-handler.js",revision:"ef54cf7d291d149164412d4dd72a9572"},{url:"registerSW.js",revision:"1872c500de691dce40960bb85481de07"},{url:"vite.svg",revision:"8e3a10e157f75ada21ab742c022d5430"},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"push-handler.js",revision:"ef54cf7d291d149164412d4dd72a9572"},{url:"manifest.webmanifest",revision:"51baf594b457dd90324df1cf3aeaf231"}],{}),s.cleanupOutdatedCaches(),s.registerRoute(new s.NavigationRoute(s.createHandlerBoundToURL("/index.html"),{denylist:[/^\/api/,/^\/_/,/\/[^/?]+\.[^/]+$/]})),s.registerRoute(/^https:\/\/api\./i,new s.NetworkFirst({cacheName:"api-cache",networkTimeoutSeconds:10,plugins:[new s.ExpirationPlugin({maxEntries:50,maxAgeSeconds:86400})]}),"GET"),s.registerRoute(/\.(?:png|jpg|jpeg|svg|gif|webp)$/,new s.CacheFirst({cacheName:"image-cache",plugins:[new s.ExpirationPlugin({maxEntries:100,maxAgeSeconds:2592e3})]}),"GET")}));
