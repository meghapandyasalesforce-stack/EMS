function isUnreachableIconUrl(url) {
  if (!url || typeof url !== 'string') return true;
  return (
    /^http:\/\//i.test(url) ||
    /localhost|127\.0\.0\.1/i.test(url)
  );
}

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
  const body = data.body || 'You have a new notification';
  const tag = data.tag || `notification-${Date.now()}`;
  const notificationData = {
    ...(data.data || {}),
    url: data.data?.url || data.url || '/notifications',
  };

  // Prefer same-origin icons — unreachable localhost icons break Android display
  const icon = isUnreachableIconUrl(data.icon) ? defaultIcon : data.icon;
  const badge = isUnreachableIconUrl(data.badge) ? defaultIcon : data.badge;

  event.waitUntil(
    (async () => {
      // Try full options first, then progressively simpler — Android is picky
      const attempts = [
        {
          body,
          icon,
          badge,
          tag,
          renotify: data.renotify !== false,
          data: notificationData,
          requireInteraction: false,
          vibrate: Array.isArray(data.vibrate) ? data.vibrate : [200, 100, 200],
          timestamp: Date.now(),
        },
        {
          body,
          icon: defaultIcon,
          tag,
          data: notificationData,
          renotify: true,
        },
        {
          body,
          tag,
          data: notificationData,
        },
      ];

      let lastError;
      for (const options of attempts) {
        try {
          await self.registration.showNotification(title, options);
          return;
        } catch (err) {
          lastError = err;
        }
      }
      // Last resort — empty options still surface a tray entry on most Androids
      try {
        await self.registration.showNotification(title || 'Paarsiv', { body, tag });
      } catch (err) {
        console.error('Push showNotification failed', lastError || err);
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

if(!self.define){let s,e={};const l=(l,r)=>(l=new URL(l+".js",r).href,e[l]||new Promise((e=>{if("document"in self){const s=document.createElement("script");s.src=l,s.onload=e,document.head.appendChild(s)}else s=l,importScripts(l),e()})).then((()=>{let s=e[l];if(!s)throw new Error(`Module ${l} didn’t register its module`);return s})));self.define=(r,n)=>{const i=s||("document"in self?document.currentScript.src:"")||location.href;if(e[i])return;let a={};const u=s=>l(s,i),o={module:{uri:i},exports:a,require:u};e[i]=Promise.all(r.map((s=>o[s]||u(s)))).then((s=>(n(...s),a)))}}define(["./workbox-dd18b404"],(function(s){"use strict";self.skipWaiting(),s.clientsClaim(),s.precacheAndRoute([{url:"vite.svg",revision:"8e3a10e157f75ada21ab742c022d5430"},{url:"registerSW.js",revision:"1872c500de691dce40960bb85481de07"},{url:"push-handler.js",revision:"b0e8c5b4ad91bb0471081e35b93803e1"},{url:"paarsiv-id-card-reference.png",revision:"6c7b8b9f05bcd69500d336fae1293c3d"},{url:"paarsiv-corner-ref.png",revision:"e4d84e5ce26c1bb17ad653d5d5242c87"},{url:"paarsiv-corner-pattern.png",revision:"2c8057cc0dda0d309384907a493a6ed3"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"Logo.png",revision:"ef235a282358c9371de5c5e80ec35da8"},{url:"index.html",revision:"31ded2e726083a5edf66ff012325cf21"},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"media/Untitled-2 (2).png",revision:"666d7f0293bbf3c8523022e6d5ade1c8"},{url:"media/paarsiv_main (1).png",revision:"90e8eaa2d46370e89cd7731ef65530eb"},{url:"media/paarsiv-white-png-web.png",revision:"5f3579886a9a2a63e31f0f763f7bd89c"},{url:"assets/js/WorkflowManager-unDQju81.js",revision:null},{url:"assets/js/ViewPolicy-CRVh5vmk.js",revision:null},{url:"assets/js/vendor-Dn_NhiTT.js",revision:null},{url:"assets/js/UsersRolesPage-DSy1nXR4.js",revision:null},{url:"assets/js/usePushNotification-Y01oLwJi.js",revision:null},{url:"assets/js/useOrgStructureCatalog-C9TXcH1-.js",revision:null},{url:"assets/js/useGetAllProjects-DmN3DpUx.js",revision:null},{url:"assets/js/UpdatePayroll-BwtnRTaq.js",revision:null},{url:"assets/js/TodayStatusComponent-DZl0YiOP.js",revision:null},{url:"assets/js/toastify-COd61nBJ.js",revision:null},{url:"assets/js/TimezoneSelect-gMJ8jzXu.js",revision:null},{url:"assets/js/TeamLearningPage-67DexDqb.js",revision:null},{url:"assets/js/systemRoleHome-CrEOXSnp.js",revision:null},{url:"assets/js/SubscriptionManagement-CTjfBDdM.js",revision:null},{url:"assets/js/SentAnnouncementsPage-Dq5IEHFF.js",revision:null},{url:"assets/js/SalaryStructureManager-Tt6xl0WT.js",revision:null},{url:"assets/js/RoleHierarchy-DZeoT4oU.js",revision:null},{url:"assets/js/RoleBasedDashboard-DAcymcVx.js",revision:null},{url:"assets/js/ResetPassword-CKCH57VQ.js",revision:null},{url:"assets/js/ResetPassword-CAq77EUC.js",revision:null},{url:"assets/js/RegularizationRequests-Dzzd7c1h.js",revision:null},{url:"assets/js/Register-CrAu3z8P.js",revision:null},{url:"assets/js/ReferralProgram-D27yrb0x.js",revision:null},{url:"assets/js/redux-toolkit-y6UGQOFE.js",revision:null},{url:"assets/js/redux-persist-DDTnOb80.js",revision:null},{url:"assets/js/recharts-CJ3gaX_F.js",revision:null},{url:"assets/js/react-chartjs-ClbaPQAq.js",revision:null},{url:"assets/js/ProjectPage-uIdGJ4t2.js",revision:null},{url:"assets/js/projectFinancialsHelper-BYDOWjvo.js",revision:null},{url:"assets/js/ProjectDetailPage-fnXQUG8B.js",revision:null},{url:"assets/js/PolicyManager-QO7q-OUh.js",revision:null},{url:"assets/js/PlatformShell-BaMkheos.js",revision:null},{url:"assets/js/PlansPage-Ca9XUvV7.js",revision:null},{url:"assets/js/PendingApprovals-DE4Y8i46.js",revision:null},{url:"assets/js/OrgStructurePage-CtvPBuhE.js",revision:null},{url:"assets/js/orgPositionLevels-D2aSFlQt.js",revision:null},{url:"assets/js/OrganizationVerification-C1FkECFP.js",revision:null},{url:"assets/js/OrganizationsList-CjqX8GbD.js",revision:null},{url:"assets/js/OrganizationSettings-DaRTyrmE.js",revision:null},{url:"assets/js/OrganizationRegister-C9Qy7wTb.js",revision:null},{url:"assets/js/OrganizationProfile-DHPW8Cqa.js",revision:null},{url:"assets/js/OrganizationOnboarding-BVsabq0c.js",revision:null},{url:"assets/js/OrganizationLogin-BAPIQSjz.js",revision:null},{url:"assets/js/OrganizationDetail-CagBtQO5.js",revision:null},{url:"assets/js/OrganizationDashboard-C0cUT-An.js",revision:null},{url:"assets/js/OrganizationChartPage-Kqn_CWP2.js",revision:null},{url:"assets/js/OrganizationAnalytics-C-0oZR34.js",revision:null},{url:"assets/js/OperatorsPage-BkxXvWnC.js",revision:null},{url:"assets/js/OneOnOneRouteWrapper-CuijeJwb.js",revision:null},{url:"assets/js/OneOnOnePage-DFhBOrfS.js",revision:null},{url:"assets/js/OnboardingRouteWrapper-CKDGVXSL.js",revision:null},{url:"assets/js/OfferCandidatePortal-Cy6socDU.js",revision:null},{url:"assets/js/Notifications-B7Lf7CKh.js",revision:null},{url:"assets/js/NotFound-B9oOv0-P.js",revision:null},{url:"assets/js/MyOneOnOneRoute-DEFAirtl.js",revision:null},{url:"assets/js/mui-material-BYG4Ff7k.js",revision:null},{url:"assets/js/mui-core-CCnujJje.js",revision:null},{url:"assets/js/ManagerHiringRequestsPage-iSO_Qqoo.js",revision:null},{url:"assets/js/Login-DVg0FE7y.js",revision:null},{url:"assets/js/Login-CiUZYSl9.js",revision:null},{url:"assets/js/LeaveReportsPage-BK9WQ12b.js",revision:null},{url:"assets/js/LeaveManagement-O7427J80.js",revision:null},{url:"assets/js/LearningRouteWrapper-vy6ACLCX.js",revision:null},{url:"assets/js/index-BceZnUoT.js",revision:null},{url:"assets/js/IdCardGenerator-DUIHqz9L.js",revision:null},{url:"assets/js/hr-B0pAmY4f.js",revision:null},{url:"assets/js/ForgotPasswordEmail-BQTfxr75.js",revision:null},{url:"assets/js/ForgotPassword-CMn4d5tq.js",revision:null},{url:"assets/js/FeatureCatalogPage-TJ4JKqaW.js",revision:null},{url:"assets/js/EmployeesPage-CwEd_AcJ.js",revision:null},{url:"assets/js/EmployeeMemberAvatar-DjOpXkgI.js",revision:null},{url:"assets/js/EmployeeLeaveBalanceViewer-BNkR0PK1.js",revision:null},{url:"assets/js/EmployeeDetailsPage-DFAA9PZ6.js",revision:null},{url:"assets/js/employee-DimK66Ur.js",revision:null},{url:"assets/js/EditPolicy-DiuNIUvx.js",revision:null},{url:"assets/js/DomainVerification-PerKaN-y.js",revision:null},{url:"assets/js/DocumentTemplateManager-Bb6nk_NI.js",revision:null},{url:"assets/js/DocumentManagement-CEgUUSHd.js",revision:null},{url:"assets/js/document-processing-vQMFXSpK.js",revision:null},{url:"assets/js/date-utils-DuPThoRb.js",revision:null},{url:"assets/js/DashboardAdmin-BbuIT99t.js",revision:null},{url:"assets/js/dashboard-DBdqEwZU.js",revision:null},{url:"assets/js/DailyReport-CHKZvqi8.js",revision:null},{url:"assets/js/CreatePolicy-Coo_B-LP.js",revision:null},{url:"assets/js/CreateOrganization-4yLXgZ3y.js",revision:null},{url:"assets/js/CheckoutPaymentPage-58dVggBo.js",revision:null},{url:"assets/js/chartjs-C0PP4vd_.js",revision:null},{url:"assets/js/CelebrationEventPage-BFK3of7N.js",revision:null},{url:"assets/js/CareerPortal-DfrDNztx.js",revision:null},{url:"assets/js/CareerJobApply-BzHzxlP2.js",revision:null},{url:"assets/js/capacitor-Df-ZfVU1.js",revision:null},{url:"assets/js/CalendarManagement-3bsiQPae.js",revision:null},{url:"assets/js/BenefitsRouteWrapper-BG5LLePp.js",revision:null},{url:"assets/js/axios-BCn5QfZZ.js",revision:null},{url:"assets/js/AuditLogsPage-CTLEALjD.js",revision:null},{url:"assets/js/AttendanceRules-B1v2n3Jb.js",revision:null},{url:"assets/js/AttendanceDashboard-DKBM9j7g.js",revision:null},{url:"assets/js/ApplicationSelfServicePortal-BqifrJ2b.js",revision:null},{url:"assets/js/AllAttendanceStatsComponent-DMuUzjqy.js",revision:null},{url:"assets/js/AdminSettings-DpzFM3MD.js",revision:null},{url:"assets/js/AdminPayroll-B1RSNYer.js",revision:null},{url:"assets/js/AdminEmployeePayroll-C3_aYeez.js",revision:null},{url:"assets/js/AdminEmployeeDocumentRequests-DxRY3pFh.js",revision:null},{url:"assets/js/AddProject-DdlSJAHC.js",revision:null},{url:"assets/js/AddPayroll-Dvy4SCGc.js",revision:null},{url:"assets/js/AddEmployee-RbPk8Wh7.js",revision:null},{url:"assets/css/toastify-GNLSjkBZ.css",revision:null},{url:"assets/css/PlatformShell-DoqXY0ab.css",revision:null},{url:"assets/css/PlansPage-Dm4_G618.css",revision:null},{url:"assets/css/OrganizationsList-BKTmA5M2.css",revision:null},{url:"assets/css/OrganizationDetail-qH1cdNCZ.css",revision:null},{url:"assets/css/OrganizationChartPage-BKIG-Uib.css",revision:null},{url:"assets/css/OperatorsPage-DRDzPSxW.css",revision:null},{url:"assets/css/index-D8y5vtZa.css",revision:null},{url:"assets/css/IdCardGenerator-BpRFQrXx.css",revision:null},{url:"assets/css/hr-2YVjGhLR.css",revision:null},{url:"assets/css/FeatureCatalogPage-DmhGTwvU.css",revision:null},{url:"assets/css/EmployeeDetailsPage-BaCpB39C.css",revision:null},{url:"assets/css/employee-CN-75wVf.css",revision:null},{url:"assets/css/directoryUI-Bc7y1bzl.css",revision:null},{url:"assets/css/dashboard-DEEI7Y5f.css",revision:null},{url:"assets/css/CreateOrganization-CZeDIwn4.css",revision:null},{url:"assets/css/CareerJobApply-dEODsenR.css",revision:null},{url:"assets/css/CalendarManagement-C0pOoqJv.css",revision:null},{url:"assets/css/AuditLogsPage-q-lfqStd.css",revision:null},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"push-handler.js",revision:"b0e8c5b4ad91bb0471081e35b93803e1"},{url:"manifest.webmanifest",revision:"51baf594b457dd90324df1cf3aeaf231"}],{}),s.cleanupOutdatedCaches(),s.registerRoute(new s.NavigationRoute(s.createHandlerBoundToURL("/index.html"),{denylist:[/^\/api/,/^\/_/,/\/[^/?]+\.[^/]+$/]})),s.registerRoute(/^https:\/\/api\./i,new s.NetworkFirst({cacheName:"api-cache",networkTimeoutSeconds:10,plugins:[new s.ExpirationPlugin({maxEntries:50,maxAgeSeconds:86400})]}),"GET"),s.registerRoute(/\.(?:png|jpg|jpeg|svg|gif|webp)$/,new s.CacheFirst({cacheName:"image-cache",plugins:[new s.ExpirationPlugin({maxEntries:100,maxAgeSeconds:2592e3})]}),"GET")}));
