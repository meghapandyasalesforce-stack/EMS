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

if(!self.define){let s,e={};const l=(l,r)=>(l=new URL(l+".js",r).href,e[l]||new Promise((e=>{if("document"in self){const s=document.createElement("script");s.src=l,s.onload=e,document.head.appendChild(s)}else s=l,importScripts(l),e()})).then((()=>{let s=e[l];if(!s)throw new Error(`Module ${l} didn’t register its module`);return s})));self.define=(r,n)=>{const i=s||("document"in self?document.currentScript.src:"")||location.href;if(e[i])return;let a={};const u=s=>l(s,i),o={module:{uri:i},exports:a,require:u};e[i]=Promise.all(r.map((s=>o[s]||u(s)))).then((s=>(n(...s),a)))}}define(["./workbox-dd18b404"],(function(s){"use strict";self.skipWaiting(),s.clientsClaim(),s.precacheAndRoute([{url:"vite.svg",revision:"8e3a10e157f75ada21ab742c022d5430"},{url:"registerSW.js",revision:"1872c500de691dce40960bb85481de07"},{url:"push-handler.js",revision:"b0e8c5b4ad91bb0471081e35b93803e1"},{url:"paarsiv-id-card-reference.png",revision:"6c7b8b9f05bcd69500d336fae1293c3d"},{url:"paarsiv-corner-ref.png",revision:"e4d84e5ce26c1bb17ad653d5d5242c87"},{url:"paarsiv-corner-pattern.png",revision:"2c8057cc0dda0d309384907a493a6ed3"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"Logo.png",revision:"ef235a282358c9371de5c5e80ec35da8"},{url:"index.html",revision:"0f71ec8b784175b63965760c0a0f005c"},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"media/Untitled-2 (2).png",revision:"666d7f0293bbf3c8523022e6d5ade1c8"},{url:"media/paarsiv_main (1).png",revision:"90e8eaa2d46370e89cd7731ef65530eb"},{url:"media/paarsiv-white-png-web.png",revision:"5f3579886a9a2a63e31f0f763f7bd89c"},{url:"assets/js/WorkflowManager-C2AHa5If.js",revision:null},{url:"assets/js/ViewPolicy-di1KOKD4.js",revision:null},{url:"assets/js/vendor-CADksLYz.js",revision:null},{url:"assets/js/UsersRolesPage-S66fgzpn.js",revision:null},{url:"assets/js/usePushNotification-BjbtaT3_.js",revision:null},{url:"assets/js/useOrgStructureCatalog-DsEE-UqO.js",revision:null},{url:"assets/js/useGetAllProjects-D6Mb3lkt.js",revision:null},{url:"assets/js/UpdatePayroll-CSCN4ye0.js",revision:null},{url:"assets/js/TodayStatusComponent-B0hLRuI_.js",revision:null},{url:"assets/js/toastify-XbdUicdp.js",revision:null},{url:"assets/js/TimezoneSelect-DC4cJIIJ.js",revision:null},{url:"assets/js/TeamLearningPage-CloH8VWR.js",revision:null},{url:"assets/js/systemRoleHome-B9PoKEoQ.js",revision:null},{url:"assets/js/SubscriptionManagement-CrlGufA5.js",revision:null},{url:"assets/js/SentAnnouncementsPage-DWbjwocH.js",revision:null},{url:"assets/js/SalaryStructureManager-BdwHInFA.js",revision:null},{url:"assets/js/RoleHierarchy-Ds0o8VZj.js",revision:null},{url:"assets/js/RoleBasedDashboard-B2ANXKG_.js",revision:null},{url:"assets/js/ResetPassword-WcwI1It7.js",revision:null},{url:"assets/js/ResetPassword-ByaPGkF0.js",revision:null},{url:"assets/js/RegularizationRequests-BqaEUAND.js",revision:null},{url:"assets/js/Register-BMYO4_kr.js",revision:null},{url:"assets/js/ReferralProgram-CuBYkOMg.js",revision:null},{url:"assets/js/redux-toolkit-CDvesDPA.js",revision:null},{url:"assets/js/redux-persist-BPSpvfkk.js",revision:null},{url:"assets/js/recharts-CN6DvRMX.js",revision:null},{url:"assets/js/react-chartjs-BfyfI4aR.js",revision:null},{url:"assets/js/ProjectPage-D2Dz-pJP.js",revision:null},{url:"assets/js/projectFinancialsHelper-BYDOWjvo.js",revision:null},{url:"assets/js/ProjectDetailPage-BJJsd4CK.js",revision:null},{url:"assets/js/PolicyManager-CSUQn7Vc.js",revision:null},{url:"assets/js/PlatformShell-DAHcux-j.js",revision:null},{url:"assets/js/PlansPage-DH5_nstg.js",revision:null},{url:"assets/js/PendingApprovals--8roZJ5B.js",revision:null},{url:"assets/js/OrgStructurePage-C2GxpJ_9.js",revision:null},{url:"assets/js/orgPositionLevels-D2aSFlQt.js",revision:null},{url:"assets/js/OrganizationVerification-BE76qG-n.js",revision:null},{url:"assets/js/OrganizationsList-DXuGeIo8.js",revision:null},{url:"assets/js/OrganizationSettings-FWRMwk6F.js",revision:null},{url:"assets/js/OrganizationRegister-CiCX0x7q.js",revision:null},{url:"assets/js/OrganizationProfile-cxRoOhvV.js",revision:null},{url:"assets/js/OrganizationOnboarding-9lylMXZZ.js",revision:null},{url:"assets/js/OrganizationLogin-buRXXjUc.js",revision:null},{url:"assets/js/OrganizationDetail-NPD3Umxu.js",revision:null},{url:"assets/js/OrganizationDashboard-A1Agac9s.js",revision:null},{url:"assets/js/OrganizationChartPage-D1kfxH1E.js",revision:null},{url:"assets/js/OrganizationAnalytics-D61Ckmtj.js",revision:null},{url:"assets/js/OperatorsPage-pZfjvb2p.js",revision:null},{url:"assets/js/OneOnOneRouteWrapper-BRHNqAfp.js",revision:null},{url:"assets/js/OneOnOnePage-CS4Ulizr.js",revision:null},{url:"assets/js/OnboardingRouteWrapper-BNiZbt6I.js",revision:null},{url:"assets/js/OfferCandidatePortal-B8qES0Ov.js",revision:null},{url:"assets/js/Notifications-Dt3soIuT.js",revision:null},{url:"assets/js/NotFound-BA-1Uyz9.js",revision:null},{url:"assets/js/MyOneOnOneRoute-e68ZyTaD.js",revision:null},{url:"assets/js/mui-material-CVq4kiGp.js",revision:null},{url:"assets/js/mui-core-DHOEP0b9.js",revision:null},{url:"assets/js/ManagerHiringRequestsPage-C5rqF8pY.js",revision:null},{url:"assets/js/Login-D928NpsY.js",revision:null},{url:"assets/js/Login-BFjhVXVF.js",revision:null},{url:"assets/js/LeaveReportsPage-CB2Gnh1x.js",revision:null},{url:"assets/js/LeaveManagement-UvQOKzLA.js",revision:null},{url:"assets/js/LearningRouteWrapper-Xt_Bt2dC.js",revision:null},{url:"assets/js/index-DGWz3R1C.js",revision:null},{url:"assets/js/IdCardGenerator-CQzc8GKz.js",revision:null},{url:"assets/js/hr-BR1Uf1jM.js",revision:null},{url:"assets/js/ForgotPasswordEmail-8Tm1V2fQ.js",revision:null},{url:"assets/js/ForgotPassword-BExivoMF.js",revision:null},{url:"assets/js/FeatureCatalogPage-BDXOPxjh.js",revision:null},{url:"assets/js/EmployeesPage-OZn7jHYV.js",revision:null},{url:"assets/js/EmployeeMemberAvatar-CnglqwgS.js",revision:null},{url:"assets/js/EmployeeLeaveBalanceViewer-u2P8zLRJ.js",revision:null},{url:"assets/js/EmployeeDetailsPage-DcCbocUh.js",revision:null},{url:"assets/js/employee-B1iB2kpp.js",revision:null},{url:"assets/js/EditPolicy-DxT7BCF1.js",revision:null},{url:"assets/js/DomainVerification-Cd2xdCKb.js",revision:null},{url:"assets/js/DocumentTemplateManager-DeqoK-vw.js",revision:null},{url:"assets/js/DocumentManagement-pOw4OW1n.js",revision:null},{url:"assets/js/document-processing-Dg0DAuGc.js",revision:null},{url:"assets/js/date-utils-DuPThoRb.js",revision:null},{url:"assets/js/DashboardAdmin-CcIKLJc8.js",revision:null},{url:"assets/js/dashboard-DmYKT4u6.js",revision:null},{url:"assets/js/DailyReport-DIYxpZ53.js",revision:null},{url:"assets/js/CreatePolicy-9LEY7fIG.js",revision:null},{url:"assets/js/CreateOrganization-vEbpOTXv.js",revision:null},{url:"assets/js/CheckoutPaymentPage-DrLq04it.js",revision:null},{url:"assets/js/chartjs-MdYiwJE1.js",revision:null},{url:"assets/js/CelebrationEventPage-Dr0zWY-i.js",revision:null},{url:"assets/js/CareerPortal-Dn00mEQJ.js",revision:null},{url:"assets/js/CareerJobApply-DZd0Xw1X.js",revision:null},{url:"assets/js/capacitor-Df-ZfVU1.js",revision:null},{url:"assets/js/CalendarManagement-BX1S2AW8.js",revision:null},{url:"assets/js/BenefitsRouteWrapper-CEeWwKCY.js",revision:null},{url:"assets/js/axios-BCn5QfZZ.js",revision:null},{url:"assets/js/AuditLogsPage-CZBpuWVd.js",revision:null},{url:"assets/js/AttendanceRules-GnMRYujr.js",revision:null},{url:"assets/js/AttendanceDashboard-BJJK46_K.js",revision:null},{url:"assets/js/ApplicationSelfServicePortal-DnukKLlH.js",revision:null},{url:"assets/js/AllAttendanceStatsComponent-9zR3zFNR.js",revision:null},{url:"assets/js/AdminSettings-CwCUdTJO.js",revision:null},{url:"assets/js/AdminPayroll-CzAfUivX.js",revision:null},{url:"assets/js/AdminEmployeePayroll-DDKtV3Hq.js",revision:null},{url:"assets/js/AdminEmployeeDocumentRequests-vjJ42hYd.js",revision:null},{url:"assets/js/AddProject-D-n4NQ9f.js",revision:null},{url:"assets/js/AddPayroll-5OFW_jo4.js",revision:null},{url:"assets/js/AddEmployee-Br_8KRpN.js",revision:null},{url:"assets/css/toastify-GNLSjkBZ.css",revision:null},{url:"assets/css/PlatformShell-DoqXY0ab.css",revision:null},{url:"assets/css/PlansPage-Dm4_G618.css",revision:null},{url:"assets/css/OrganizationsList-BKTmA5M2.css",revision:null},{url:"assets/css/OrganizationDetail-qH1cdNCZ.css",revision:null},{url:"assets/css/OrganizationChartPage-B-bPjgXE.css",revision:null},{url:"assets/css/OperatorsPage-DRDzPSxW.css",revision:null},{url:"assets/css/index-CwWucdtG.css",revision:null},{url:"assets/css/IdCardGenerator-BpRFQrXx.css",revision:null},{url:"assets/css/hr-DjyMtpAP.css",revision:null},{url:"assets/css/FeatureCatalogPage-DqWur-Wd.css",revision:null},{url:"assets/css/EmployeeDetailsPage-BaCpB39C.css",revision:null},{url:"assets/css/employee-CN-75wVf.css",revision:null},{url:"assets/css/directoryUI-BgHns6zG.css",revision:null},{url:"assets/css/dashboard-M5_d99kJ.css",revision:null},{url:"assets/css/CreateOrganization-CZeDIwn4.css",revision:null},{url:"assets/css/CareerJobApply-dEODsenR.css",revision:null},{url:"assets/css/CalendarManagement-C0pOoqJv.css",revision:null},{url:"assets/css/AuditLogsPage-q-lfqStd.css",revision:null},{url:"favicon.ico",revision:"fde8a766ea075b591010940b87fe5e47"},{url:"logo192.png",revision:"d85543071fdb23bfce2ec8cda21d3837"},{url:"logo512.png",revision:"3e3249237624b535141256fee616a703"},{url:"push-handler.js",revision:"b0e8c5b4ad91bb0471081e35b93803e1"},{url:"manifest.webmanifest",revision:"51baf594b457dd90324df1cf3aeaf231"}],{}),s.cleanupOutdatedCaches(),s.registerRoute(new s.NavigationRoute(s.createHandlerBoundToURL("/index.html"),{denylist:[/^\/api/,/^\/_/,/\/[^/?]+\.[^/]+$/]})),s.registerRoute(/^https:\/\/api\./i,new s.NetworkFirst({cacheName:"api-cache",networkTimeoutSeconds:10,plugins:[new s.ExpirationPlugin({maxEntries:50,maxAgeSeconds:86400})]}),"GET"),s.registerRoute(/\.(?:png|jpg|jpeg|svg|gif|webp)$/,new s.CacheFirst({cacheName:"image-cache",plugins:[new s.ExpirationPlugin({maxEntries:100,maxAgeSeconds:2592e3})]}),"GET")}));
