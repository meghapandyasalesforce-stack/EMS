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

if(!self.define){let s,e={};const l=(l,i)=>(l=new URL(l+".js",i).href,e[l]||new Promise((e=>{if("document"in self){const s=document.createElement("script");s.src=l,s.onload=e,document.head.appendChild(s)}else s=l,importScripts(l),e()})).then((()=>{let s=e[l];if(!s)throw new Error(`Module ${l} didn’t register its module`);return s})));self.define=(i,n)=>{const r=s||("document"in self?document.currentScript.src:"")||location.href;if(e[r])return;let a={};const o=s=>l(s,r),u={module:{uri:r},exports:a,require:o};e[r]=Promise.all(i.map((s=>u[s]||o(s)))).then((s=>(n(...s),a)))}}define(["./workbox-7faf082e"],(function(s){"use strict";self.skipWaiting(),s.clientsClaim(),s.precacheAndRoute([{url:"assets/css/index-Blr22jwF.css",revision:null},{url:"assets/css/toastify-GNLSjkBZ.css",revision:null},{url:"assets/js/AddEmployee-BvtBkSj4.js",revision:null},{url:"assets/js/AddPayroll-CMtgOOwP.js",revision:null},{url:"assets/js/AddProject-BlYlsIsW.js",revision:null},{url:"assets/js/AdminEmployeePayroll-D0hll_dQ.js",revision:null},{url:"assets/js/AdminPayroll-SHpiX4Nk.js",revision:null},{url:"assets/js/AdminSettings-BhhTRxov.js",revision:null},{url:"assets/js/AllAttendanceStatsComponent-Yod4BtYP.js",revision:null},{url:"assets/js/AttendanceDashboard-Dy0eEQQB.js",revision:null},{url:"assets/js/AttendanceRules-D56zouA5.js",revision:null},{url:"assets/js/axios-B9ygI19o.js",revision:null},{url:"assets/js/BenefitsRouteWrapper-HirZwnWn.js",revision:null},{url:"assets/js/CalendarManagement-uxJzUOIZ.js",revision:null},{url:"assets/js/capacitor-Df-ZfVU1.js",revision:null},{url:"assets/js/chartjs-Dhzpdc5G.js",revision:null},{url:"assets/js/CreatePolicy-Ct2eYltm.js",revision:null},{url:"assets/js/DailyReport-DMPs5uUV.js",revision:null},{url:"assets/js/dashboard-Bg0svFiS.js",revision:null},{url:"assets/js/DashboardAdmin-JvNE5ZSc.js",revision:null},{url:"assets/js/date-utils-DiuZsUq7.js",revision:null},{url:"assets/js/document-processing-EaZoD6zR.js",revision:null},{url:"assets/js/DomainVerification-CqqBR1Bw.js",revision:null},{url:"assets/js/EditPolicy-Dg-jezi5.js",revision:null},{url:"assets/js/employee-5-FhFgn9.js",revision:null},{url:"assets/js/EmployeeDetailsPage-Bu6eeCyO.js",revision:null},{url:"assets/js/EmployeeLeaveBalanceViewer-HRkcCjjU.js",revision:null},{url:"assets/js/EmployeesPage-BJJVH0oM.js",revision:null},{url:"assets/js/ForgotPasswordEmail-Bh-qRizW.js",revision:null},{url:"assets/js/hr-CYSIjf6N.js",revision:null},{url:"assets/js/IdCardGenerator-Dz1zpxEp.js",revision:null},{url:"assets/js/index-DK4nIRKj.js",revision:null},{url:"assets/js/LearningRouteWrapper-B36JhY62.js",revision:null},{url:"assets/js/LeaveManagement-q91kLals.js",revision:null},{url:"assets/js/LeaveReportsPage-BdZRsrRc.js",revision:null},{url:"assets/js/Login-DGqoReCC.js",revision:null},{url:"assets/js/mui-core-DcaHLrYk.js",revision:null},{url:"assets/js/mui-material-_YwNK83l.js",revision:null},{url:"assets/js/NotFound-DQCDYFot.js",revision:null},{url:"assets/js/Notifications-B0nI5Ln5.js",revision:null},{url:"assets/js/NotificationSender-BNZc4-qN.js",revision:null},{url:"assets/js/OnboardingRouteWrapper-BK04IHVo.js",revision:null},{url:"assets/js/OneOnOnePage-CFzrHFOK.js",revision:null},{url:"assets/js/OneOnOneRouteWrapper-BBwmWOPg.js",revision:null},{url:"assets/js/OrganizationAnalytics-D_bJS21m.js",revision:null},{url:"assets/js/OrganizationDashboard-CMGQVcfV.js",revision:null},{url:"assets/js/OrganizationLogin-Cw-90Pa5.js",revision:null},{url:"assets/js/OrganizationOnboarding-xRrdBpzn.js",revision:null},{url:"assets/js/OrganizationProfile-Pn3FV4Vo.js",revision:null},{url:"assets/js/OrganizationRegister-CUB6AY1_.js",revision:null},{url:"assets/js/OrganizationSettings-B88XWCXd.js",revision:null},{url:"assets/js/OrganizationVerification-DuOo4LvH.js",revision:null},{url:"assets/js/PendingApprovals-NwwUZ4U7.js",revision:null},{url:"assets/js/PolicyManager-BgLYopt_.js",revision:null},{url:"assets/js/ProjectDetailPage-B58RsCU8.js",revision:null},{url:"assets/js/projectFinancialsHelper-BYDOWjvo.js",revision:null},{url:"assets/js/ProjectPage-C02PNRMA.js",revision:null},{url:"assets/js/react-chartjs-DcpXGFa9.js",revision:null},{url:"assets/js/recharts-DBb9ykh0.js",revision:null},{url:"assets/js/redux-persist-DM0sCMMF.js",revision:null},{url:"assets/js/redux-toolkit-DdPItsuz.js",revision:null},{url:"assets/js/ReferralProgram-ByjSLgKv.js",revision:null},{url:"assets/js/Register-Bj_FNF9Z.js",revision:null},{url:"assets/js/RegularizationRequests-C44FKlti.js",revision:null},{url:"assets/js/ResetPassword-BtZ9woXZ.js",revision:null},{url:"assets/js/RoleBasedDashboard-DRWZU5gQ.js",revision:null},{url:"assets/js/RoleHierarchy-Bdudqce2.js",revision:null},{url:"assets/js/SalaryStructureManager-D70Ligq5.js",revision:null},{url:"assets/js/SentAnnouncementsPage-CA112EtZ.js",revision:null},{url:"assets/js/SubscriptionManagement-D5nKdnsW.js",revision:null},{url:"assets/js/SystemRolePicker-EVSF0vsO.js",revision:null},{url:"assets/js/TeamLearningPage-DNffI_5v.js",revision:null},{url:"assets/js/TimezoneSelect-B3Ldmc0O.js",revision:null},{url:"assets/js/toastify-C59K9mqW.js",revision:null},{url:"assets/js/TodayStatusComponent-BdQ4CNNz.js",revision:null},{url:"assets/js/UpdatePayroll-FOKQ9ZQv.js",revision:null},{url:"assets/js/useGetAllProjects-C3h02nHz.js",revision:null},{url:"assets/js/UsersRolesPage-hUe76q9K.js",revision:null},{url:"assets/js/useSuggestedSystemRole-DGc2H8rP.js",revision:null},{url:"assets/js/vendor-BHquvGaM.js",revision:null},{url:"assets/js/ViewPolicy-Cs7wZ3PI.js",revision:null},{url:"assets/js/WorkflowManager-n1TPmj52.js",revision:null},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"index.html",revision:"75d6b049e972577ab06299ae55c7c094"},{url:"Logo.png",revision:"ef235a282358c9371de5c5e80ec35da8"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"media/paarsiv_main (1).png",revision:"90e8eaa2d46370e89cd7731ef65530eb"},{url:"media/paarsiv-white-png-web.png",revision:"5f3579886a9a2a63e31f0f763f7bd89c"},{url:"media/Untitled-2 (2).png",revision:"666d7f0293bbf3c8523022e6d5ade1c8"},{url:"push-handler.js",revision:"0df3a877f1404be2694dc61abc6b4ae9"},{url:"registerSW.js",revision:"1872c500de691dce40960bb85481de07"},{url:"vite.svg",revision:"8e3a10e157f75ada21ab742c022d5430"},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"push-handler.js",revision:"0df3a877f1404be2694dc61abc6b4ae9"},{url:"manifest.webmanifest",revision:"51baf594b457dd90324df1cf3aeaf231"}],{}),s.cleanupOutdatedCaches(),s.registerRoute(new s.NavigationRoute(s.createHandlerBoundToURL("/index.html"),{denylist:[/^\/api/,/^\/_/,/\/[^/?]+\.[^/]+$/]})),s.registerRoute(/^https:\/\/api\./i,new s.NetworkFirst({cacheName:"api-cache",networkTimeoutSeconds:10,plugins:[new s.ExpirationPlugin({maxEntries:50,maxAgeSeconds:86400})]}),"GET"),s.registerRoute(/\.(?:png|jpg|jpeg|svg|gif|webp)$/,new s.CacheFirst({cacheName:"image-cache",plugins:[new s.ExpirationPlugin({maxEntries:100,maxAgeSeconds:2592e3})]}),"GET")}));
