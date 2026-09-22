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

if(!self.define){let s,e={};const l=(l,n)=>(l=new URL(l+".js",n).href,e[l]||new Promise((e=>{if("document"in self){const s=document.createElement("script");s.src=l,s.onload=e,document.head.appendChild(s)}else s=l,importScripts(l),e()})).then((()=>{let s=e[l];if(!s)throw new Error(`Module ${l} didn’t register its module`);return s})));self.define=(n,i)=>{const r=s||("document"in self?document.currentScript.src:"")||location.href;if(e[r])return;let a={};const u=s=>l(s,r),o={module:{uri:r},exports:a,require:u};e[r]=Promise.all(n.map((s=>o[s]||u(s)))).then((s=>(i(...s),a)))}}define(["./workbox-dd18b404"],(function(s){"use strict";self.skipWaiting(),s.clientsClaim(),s.precacheAndRoute([{url:"vite.svg",revision:"8e3a10e157f75ada21ab742c022d5430"},{url:"registerSW.js",revision:"1872c500de691dce40960bb85481de07"},{url:"push-handler.js",revision:"ef54cf7d291d149164412d4dd72a9572"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"Logo.png",revision:"ef235a282358c9371de5c5e80ec35da8"},{url:"index.html",revision:"97dbea3cdc30024bc61009e699c3adcd"},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"media/Untitled-2 (2).png",revision:"666d7f0293bbf3c8523022e6d5ade1c8"},{url:"media/paarsiv_main (1).png",revision:"90e8eaa2d46370e89cd7731ef65530eb"},{url:"media/paarsiv-white-png-web.png",revision:"5f3579886a9a2a63e31f0f763f7bd89c"},{url:"assets/js/WorkflowManager-DApp6u37.js",revision:null},{url:"assets/js/ViewPolicy-B5GXl2oQ.js",revision:null},{url:"assets/js/vendor-BA0LujBF.js",revision:null},{url:"assets/js/UsersRolesPage-DxfIMICE.js",revision:null},{url:"assets/js/usePushNotification-Bi_dTzgl.js",revision:null},{url:"assets/js/useOrgStructureCatalog-CIGDLs7x.js",revision:null},{url:"assets/js/useGetAllProjects-DloF9AKu.js",revision:null},{url:"assets/js/UpdatePayroll-CmMHQbXC.js",revision:null},{url:"assets/js/TodayStatusComponent-D4vM_FS2.js",revision:null},{url:"assets/js/toastify-Cx1ppViY.js",revision:null},{url:"assets/js/TimezoneSelect-C_q1Ixca.js",revision:null},{url:"assets/js/TeamLearningPage-C7csIoXT.js",revision:null},{url:"assets/js/systemRoleHome-C7AvCgTL.js",revision:null},{url:"assets/js/SubscriptionManagement-CEqnDeeW.js",revision:null},{url:"assets/js/SentAnnouncementsPage-kT-CV6hr.js",revision:null},{url:"assets/js/SalaryStructureManager-BWI7Y9wb.js",revision:null},{url:"assets/js/RoleHierarchy-NfPeMCdG.js",revision:null},{url:"assets/js/RoleBasedDashboard-32DmZML_.js",revision:null},{url:"assets/js/ResetPassword-D8RFYYjk.js",revision:null},{url:"assets/js/RegularizationRequests-tLd78s9g.js",revision:null},{url:"assets/js/Register-CkY23mro.js",revision:null},{url:"assets/js/ReferralProgram-DOl7NCNC.js",revision:null},{url:"assets/js/redux-toolkit-BLcVyL4S.js",revision:null},{url:"assets/js/redux-persist-8Ev-MjUu.js",revision:null},{url:"assets/js/recharts-CishfCqI.js",revision:null},{url:"assets/js/react-chartjs-CTO7efw5.js",revision:null},{url:"assets/js/push-IZjFOPFe.js",revision:null},{url:"assets/js/ProjectPage-CFHBCoEg.js",revision:null},{url:"assets/js/projectFinancialsHelper-BYDOWjvo.js",revision:null},{url:"assets/js/ProjectDetailPage-Syvc8yWc.js",revision:null},{url:"assets/js/PolicyManager-BHUsxqpl.js",revision:null},{url:"assets/js/PendingApprovals-BRC4MmB0.js",revision:null},{url:"assets/js/OrgStructurePage-BeoEvF3T.js",revision:null},{url:"assets/js/OrganizationVerification-C8EQm4Jz.js",revision:null},{url:"assets/js/OrganizationSettings-2gn_3t5U.js",revision:null},{url:"assets/js/OrganizationRegister-D7fe50Dm.js",revision:null},{url:"assets/js/OrganizationProfile-BJpa65pW.js",revision:null},{url:"assets/js/OrganizationOnboarding-B6CrJpgA.js",revision:null},{url:"assets/js/OrganizationLogin-BL2zxUOn.js",revision:null},{url:"assets/js/OrganizationDashboard-s0XLNHox.js",revision:null},{url:"assets/js/OrganizationChartPage-D0OazA5c.js",revision:null},{url:"assets/js/OrganizationAnalytics-B6sS_mOd.js",revision:null},{url:"assets/js/OneOnOneRouteWrapper-CkG9aqY4.js",revision:null},{url:"assets/js/OneOnOnePage-BZu929pp.js",revision:null},{url:"assets/js/OnboardingRouteWrapper-Cpy6KIBp.js",revision:null},{url:"assets/js/OfferCandidatePortal-De3nAXA3.js",revision:null},{url:"assets/js/Notifications-BPPTUAdZ.js",revision:null},{url:"assets/js/NotFound-DKo6sE-O.js",revision:null},{url:"assets/js/mui-material-E3ujyl--.js",revision:null},{url:"assets/js/mui-core-CzeQLSGW.js",revision:null},{url:"assets/js/ManagerHiringRequestsPage-0acQGBmk.js",revision:null},{url:"assets/js/Login-rQnbExG6.js",revision:null},{url:"assets/js/LeaveReportsPage-C_geiCB-.js",revision:null},{url:"assets/js/LeaveManagement-B2TuUpCO.js",revision:null},{url:"assets/js/LearningRouteWrapper-ki0lt-8w.js",revision:null},{url:"assets/js/index-BTMkS9qS.js",revision:null},{url:"assets/js/IdCardGenerator-BeFMQ1eE.js",revision:null},{url:"assets/js/hr-l4vqr8U6.js",revision:null},{url:"assets/js/ForgotPasswordEmail-Bk-sFVKS.js",revision:null},{url:"assets/js/EmployeesPage-v-PeWLXf.js",revision:null},{url:"assets/js/EmployeeMemberAvatar-CVNegbKb.js",revision:null},{url:"assets/js/EmployeeLeaveBalanceViewer-DF29vMPj.js",revision:null},{url:"assets/js/EmployeeDetailsPage-DPf1BEvd.js",revision:null},{url:"assets/js/employee-gjwYIleM.js",revision:null},{url:"assets/js/EditPolicy-CehmyK2I.js",revision:null},{url:"assets/js/DomainVerification-BXoCo98S.js",revision:null},{url:"assets/js/DocumentTemplateManager-BNaMQmYQ.js",revision:null},{url:"assets/js/DocumentManagement-EjO9pbnZ.js",revision:null},{url:"assets/js/document-processing-CXmOWWp_.js",revision:null},{url:"assets/js/date-utils-C2_etgnR.js",revision:null},{url:"assets/js/DashboardAdmin-yYTt-3Jj.js",revision:null},{url:"assets/js/dashboard-wUfOteKg.js",revision:null},{url:"assets/js/DailyReport-DKwcTjRv.js",revision:null},{url:"assets/js/CreatePolicy-CeSIpKwH.js",revision:null},{url:"assets/js/chartjs-BbdU23zJ.js",revision:null},{url:"assets/js/CelebrationEventPage-q3bs9L2g.js",revision:null},{url:"assets/js/CareerPortal-CsjekC0T.js",revision:null},{url:"assets/js/CareerJobApply-COVDjxL7.js",revision:null},{url:"assets/js/capacitor-Df-ZfVU1.js",revision:null},{url:"assets/js/CalendarManagement-CsmGzlY5.js",revision:null},{url:"assets/js/BenefitsRouteWrapper-BuN7NlFQ.js",revision:null},{url:"assets/js/axios-BCn5QfZZ.js",revision:null},{url:"assets/js/AttendanceRules-A69bX8uG.js",revision:null},{url:"assets/js/AttendanceDashboard-OeaOgGuN.js",revision:null},{url:"assets/js/ApplicationSelfServicePortal-BLePR-wK.js",revision:null},{url:"assets/js/AllAttendanceStatsComponent-BN53bINP.js",revision:null},{url:"assets/js/AdminSettings-CSpCpFT2.js",revision:null},{url:"assets/js/AdminPayroll-wcbl7S5D.js",revision:null},{url:"assets/js/AdminEmployeePayroll-CZMJaVKF.js",revision:null},{url:"assets/js/AdminEmployeeDocumentRequests-BiJV9Mc6.js",revision:null},{url:"assets/js/AddProject--J8Orqz4.js",revision:null},{url:"assets/js/AddPayroll-DmpUkhan.js",revision:null},{url:"assets/js/AddEmployee-D533hJzt.js",revision:null},{url:"assets/css/toastify-GNLSjkBZ.css",revision:null},{url:"assets/css/OrganizationChartPage-BmtwVwl9.css",revision:null},{url:"assets/css/index-BT3porui.css",revision:null},{url:"assets/css/employee-CMO7k7lD.css",revision:null},{url:"assets/css/CareerJobApply-dEODsenR.css",revision:null},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"push-handler.js",revision:"ef54cf7d291d149164412d4dd72a9572"},{url:"manifest.webmanifest",revision:"51baf594b457dd90324df1cf3aeaf231"}],{}),s.cleanupOutdatedCaches(),s.registerRoute(new s.NavigationRoute(s.createHandlerBoundToURL("/index.html"),{denylist:[/^\/api/,/^\/_/,/\/[^/?]+\.[^/]+$/]})),s.registerRoute(/^https:\/\/api\./i,new s.NetworkFirst({cacheName:"api-cache",networkTimeoutSeconds:10,plugins:[new s.ExpirationPlugin({maxEntries:50,maxAgeSeconds:86400})]}),"GET"),s.registerRoute(/\.(?:png|jpg|jpeg|svg|gif|webp)$/,new s.CacheFirst({cacheName:"image-cache",plugins:[new s.ExpirationPlugin({maxEntries:100,maxAgeSeconds:2592e3})]}),"GET")}));
