/**
 * ============================================================================
 * ADS AI MANAGER — APPLICATION CONTROLLER & UI BINDERS
 * Integrates: UnifiedDataEngine + AIAssistantEngine + ExportEngine + Chart.js
 * Controls all 18 Screens, Real-time Filters, Search, Modals & Live API Sync
 * ============================================================================
 */

(function (window) {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. STATE STORE (Persistence via LocalStorage)
  // --------------------------------------------------------------------------
  class StateStore {
    constructor() {
      this.STORAGE_KEY = 'ads_ai_manager_prefs_v1';
      this.state = this.loadState();
    }

    loadState() {
      try {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }
      return {
        selectedWorkspace: 'ws_default',
        workspaceName: 'Kstudy E-commerce Group',
        currency: 'VND',
        timezone: 'Asia/Ho_Chi_Minh',
        dateRange: '7d',
        platform: 'all',
        chartMetric: 'spend',
        chartGranularity: 'daily',
        pivotDimension: 'campaign',
        pivotMetrics: ['spend', 'revenue', 'roas', 'cpa', 'ctr', 'conversions'],
        activeScreen: 'screen-dashboard',
        isLiveMode: false,
        metaAccountId: 'act_1029384756',
        tiktokAdvId: '7298374829103'
      };
    }

    saveState(updates = {}) {
      this.state = { ...this.state, ...updates };
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {
        console.warn('LocalStorage write error:', e);
      }
    }

    get(key, fallback = null) {
      return this.state[key] !== undefined ? this.state[key] : fallback;
    }

    set(key, val) {
      this.state[key] = val;
      this.saveState();
    }
  }

  // --------------------------------------------------------------------------
  // 2. CHART MANAGER (Chart.js Controller)
  // --------------------------------------------------------------------------
  class ChartManager {
    constructor() {
      this.instances = {};
    }

    destroy(key) {
      if (this.instances[key]) {
        this.instances[key].destroy();
        delete this.instances[key];
      }
    }

    /**
     * Render or update Main Dashboard Performance Chart
     */
    renderDashboardChart(canvasId, timeSeriesData, metricName = 'Spend') {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;

      this.destroy('dashboardChart');
      const ctx = canvas.getContext('2d');

      const isCurrency = ['spend', 'revenue', 'cpa', 'cpc', 'cpm'].includes(metricName.toLowerCase());
      const isPercent = metricName.toLowerCase() === 'ctr';

      this.instances.dashboardChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: timeSeriesData.labels,
          datasets: [
            {
              label: 'Meta Ads',
              data: timeSeriesData.metaData,
              borderColor: '#1877F2',
              backgroundColor: 'rgba(24, 119, 242, 0.08)',
              borderWidth: 2.5,
              tension: 0.35,
              fill: true,
              pointBackgroundColor: '#1877F2',
              pointRadius: 3,
              pointHoverRadius: 6
            },
            {
              label: 'TikTok Ads',
              data: timeSeriesData.tiktokData,
              borderColor: '#FE2C55',
              backgroundColor: 'rgba(254, 44, 85, 0.05)',
              borderWidth: 2.5,
              borderDash: [4, 4],
              tension: 0.35,
              fill: true,
              pointBackgroundColor: '#FE2C55',
              pointRadius: 3,
              pointHoverRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0f172a',
              titleFont: { size: 12, weight: 'bold' },
              bodyFont: { size: 11 },
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: function (ctx) {
                  const val = ctx.raw || 0;
                  const label = ctx.dataset.label || '';
                  if (isCurrency) return `${label}: ${window.AdsAI.MetricsCalc.formatVND(val)}`;
                  if (isPercent) return `${label}: ${val}%`;
                  return `${label}: ${window.AdsAI.MetricsCalc.formatNumber(val)}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 10 }, color: '#64748b' }
            },
            y: {
              grid: { color: '#f1f5f9' },
              ticks: {
                font: { size: 10 },
                color: '#64748b',
                callback: function (val) {
                  if (isCurrency) return window.AdsAI.MetricsCalc.formatVND(val);
                  if (isPercent) return val + '%';
                  return window.AdsAI.MetricsCalc.formatNumber(val);
                }
              }
            }
          }
        }
      });
    }

    /**
     * Render Platform Share Donut Chart
     */
    renderPlatformShareChart(canvasId, metaSpend, tiktokSpend) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;

      this.destroy('platformShareChart');
      const ctx = canvas.getContext('2d');

      this.instances.platformShareChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Meta Ads', 'TikTok Ads'],
          datasets: [{
            data: [metaSpend, tiktokSpend],
            backgroundColor: ['#1877F2', '#FE2C55'],
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  const val = ctx.raw || 0;
                  return `${ctx.label}: ${window.AdsAI.MetricsCalc.formatVND(val)}`;
                }
              }
            }
          },
          cutout: '72%'
        }
      });
    }

    /**
     * Render Campaign Detail Performance Chart
     */
    renderCampaignDetailChart(canvasId, labels, dataPoints, metricLabel = 'Spend') {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;

      this.destroy('campaignDetailChart');
      const ctx = canvas.getContext('2d');

      this.instances.campaignDetailChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: metricLabel,
            data: dataPoints,
            borderColor: '#4F46E5',
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            borderWidth: 2.5,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: '#4F46E5',
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: { grid: { color: '#f8fafc' } }
          }
        }
      });
    }

    /**
     * Render Side-by-Side Comparison Bar Chart
     */
    renderComparisonBarChart(canvasId, metaMetrics, tiktokMetrics) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;

      this.destroy('comparisonBarChart');
      const ctx = canvas.getContext('2d');

      this.instances.comparisonBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['ROAS', 'CTR (%)', 'CVR Đơn / 10K', 'Health Index'],
          datasets: [
            {
              label: 'Meta Ads',
              data: [metaMetrics.roas, metaMetrics.ctr, Math.round((metaMetrics.conversions / (metaMetrics.impressions || 1)) * 10000), 84],
              backgroundColor: '#1877F2',
              borderRadius: 6
            },
            {
              label: 'TikTok Ads',
              data: [tiktokMetrics.roas, tiktokMetrics.ctr, Math.round((tiktokMetrics.conversions / (tiktokMetrics.impressions || 1)) * 10000), 79],
              backgroundColor: '#FE2C55',
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' }
          },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, grid: { color: '#f1f5f9' } }
          }
        }
      });
    }
  }

  // --------------------------------------------------------------------------
  // 3. MAIN APPLICATION ORCHESTRATOR
  // --------------------------------------------------------------------------
  class AdsAIApp {
    constructor() {
      this.stateStore = new StateStore();
      this.dataEngine = new window.AdsAI.UnifiedDataEngine();
      this.aiEngine = new window.AdsAI.AIAssistantEngine(this.dataEngine);
      this.exportEngine = window.AdsAI.ExportEngine;
      this.chartManager = new ChartManager();

      this.currentScreenId = this.stateStore.get('activeScreen', 'screen-dashboard');
      this.activeCampaignId = null;
      this.activeCreativeId = null;

      this.campaignPagination = { page: 1, pageSize: 8 };

      // Initialize filter from stored preferences
      this.dataEngine.activeFilters.platform = this.stateStore.get('platform', 'all');
      this.dataEngine.activeFilters.dateRange = this.stateStore.get('dateRange', '7d');

      if (this.stateStore.get('isLiveMode', false)) {
        this.dataEngine.setMode('live');
      }
      window.app = this;
    }

    async init() {
      console.log('🚀 Initializing ADS AI MANAGER...');

      // Setup router and event listeners
      this.setupGlobalEvents();
      this.setupFilterEvents();

      // Listen to data engine changes
      this.dataEngine.subscribe(() => {
        this.refreshCurrentScreen();
      });

      // Initial navigation
      this.navigateTo(this.currentScreenId);

      // Render workspace info
      this.updateWorkspaceHeader();
    }

    updateWorkspaceHeader() {
      const wsName = this.stateStore.get('workspaceName', 'Kstudy E-commerce Group');
      const wsBadge = document.getElementById('currentWorkspaceName');
      if (wsBadge) wsBadge.textContent = wsName;
    }

    // ------------------------------------------------------------------------
    // NAVIGATION ROUTER (Across all 18 Screens)
    // ------------------------------------------------------------------------
    navigateTo(screenId) {
      const screens = document.querySelectorAll('.app-screen');
      screens.forEach(s => s.classList.add('hidden'));

      const target = document.getElementById(screenId);
      if (!target) {
        console.warn(`Screen ${screenId} not found, falling back to dashboard.`);
        screenId = 'screen-dashboard';
      }

      const activeEl = document.getElementById(screenId);
      if (activeEl) activeEl.classList.remove('hidden');

      this.currentScreenId = screenId;
      this.stateStore.set('activeScreen', screenId);

      this.updateSidebarUI(screenId);
      this.updateHeaderBreadcrumb(screenId);
      this.refreshCurrentScreen();

      // Close quick switcher dropdown if open
      const menu = document.getElementById('quickNavMenu');
      if (menu) menu.classList.add('hidden');

      window.scrollTo(0, 0);
    }

    updateSidebarUI(screenId) {
      const navLinks = document.querySelectorAll('.sidebar-nav-item');
      navLinks.forEach(link => {
        link.classList.remove('bg-indigo-50', 'text-indigo-600', 'font-bold');
        link.classList.add('text-slate-600', 'font-medium');
      });

      const activeNav = document.getElementById(`nav-${screenId}`);
      if (activeNav) {
        activeNav.classList.add('bg-indigo-50', 'text-indigo-600', 'font-bold');
        activeNav.classList.remove('text-slate-600', 'font-medium');
      }
    }

    updateHeaderBreadcrumb(screenId) {
      const titleMap = {
        'screen-login': ['Tài khoản', 'Đăng nhập vào hệ thống'],
        'screen-workspace': ['Workspace', 'Quản lý Không gian làm việc'],
        'screen-dashboard': ['Tổng quan', 'Bảng điều khiển hiệu suất quảng cáo'],
        'screen-campaigns': ['Chiến dịch', 'Quản lý danh sách Chiến dịch'],
        'screen-campaign-detail': ['Chiến dịch', 'Phân tích chuyên sâu Chiến dịch'],
        'screen-ad-sets': ['Ad Sets', 'Nhóm Quảng cáo Chuẩn hóa'],
        'screen-ads': ['Ads', 'Thực thể Quảng cáo'],
        'screen-creatives': ['Creatives', 'Kho Tư liệu & Chẩn đoán Mệt mỏi'],
        'screen-creative-detail': ['Creatives', 'Chi tiết Tư liệu & Phân tích Hook'],
        'screen-comparison': ['So sánh', 'Đối chiếu Hiệu quả Meta Ads vs TikTok Ads'],
        'screen-performance': ['Phân tích', 'Biểu đồ Hiệu suất Tương tác'],
        'screen-pivot': ['Pivot', 'Phân tích Đa chiều Trực quan'],
        'screen-ai-analyst': ['AI Analyst', 'Tổng quan Sức khỏe & Cảnh báo'],
        'screen-ask-data': ['AI Copilot', 'Hỏi đáp Dữ liệu Quảng cáo (Guardrails)'],
        'screen-reports': ['Báo cáo', 'Khởi tạo Báo cáo Định kỳ'],
        'screen-report-preview': ['Báo cáo', 'Xem trước & Xuất bản Báo cáo A4'],
        'screen-connections': ['Kết nối', 'Quản lý Tài khoản Meta & TikTok API'],
        'screen-settings': ['Cài đặt', 'Cấu hình Hệ thống & Quy tắc AI']
      };

      const topHeader = document.getElementById('globalTopHeader');
      if (topHeader) {
        if (screenId === 'screen-login') topHeader.classList.add('hidden');
        else topHeader.classList.remove('hidden');
      }

      const breadcrumbEl = document.getElementById('headerBreadcrumb');
      const mainTitleEl = document.getElementById('headerMainTitle');
      if (titleMap[screenId]) {
        if (breadcrumbEl) breadcrumbEl.textContent = titleMap[screenId][0];
        if (mainTitleEl) mainTitleEl.textContent = titleMap[screenId][1];
      }
    }

    // ------------------------------------------------------------------------
    // REFRESH ACTIVE SCREEN
    // ------------------------------------------------------------------------
    async refreshCurrentScreen() {
      switch (this.currentScreenId) {
        case 'screen-dashboard':
          await this.renderDashboard();
          break;
        case 'screen-campaigns':
          await this.renderCampaigns();
          break;
        case 'screen-campaign-detail':
          await this.renderCampaignDetail(this.activeCampaignId);
          break;
        case 'screen-ad-sets':
          await this.renderAdSets();
          break;
        case 'screen-ads':
          await this.renderAds();
          break;
        case 'screen-creatives':
          await this.renderCreatives();
          break;
        case 'screen-creative-detail':
          await this.renderCreativeDetail(this.activeCreativeId);
          break;
        case 'screen-comparison':
          await this.renderComparison();
          break;
        case 'screen-performance':
          await this.renderPerformanceAnalytics();
          break;
        case 'screen-pivot':
          await this.renderPivot();
          break;
        case 'screen-ai-analyst':
          await this.renderAIAnalyst();
          break;
        case 'screen-ask-data':
          // Keep chat history intact
          break;
        case 'screen-reports':
          await this.renderReports();
          break;
        case 'screen-report-preview':
          await this.renderReportPreview();
          break;
        case 'screen-connections':
          await this.renderConnections();
          break;
        case 'screen-settings':
          await this.renderSettings();
          break;
      }
    }

    // ------------------------------------------------------------------------
    // SCREEN 03: DASHBOARD
    // ------------------------------------------------------------------------
    async renderDashboard() {
      const kpiData = await this.dataEngine.getExecutiveKPIs();
      const cur = kpiData.current;
      const trends = kpiData.trends;

      // Update KPI Cards
      const setCard = (id, val, trend) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };

      setCard('dash-kpi-spend', window.AdsAI.MetricsCalc.formatVND(cur.spend));
      setCard('dash-kpi-revenue', window.AdsAI.MetricsCalc.formatVND(cur.revenue));
      setCard('dash-kpi-roas', cur.roas.toFixed(2));
      setCard('dash-kpi-cpa', window.AdsAI.MetricsCalc.formatVND(cur.cpa));
      setCard('dash-kpi-ctr', cur.ctr.toFixed(2) + '%');
      setCard('dash-kpi-cpc', window.AdsAI.MetricsCalc.formatVND(cur.cpc));
      setCard('dash-kpi-cpm', window.AdsAI.MetricsCalc.formatVND(cur.cpm));
      setCard('dash-kpi-conv', window.AdsAI.MetricsCalc.formatNumber(cur.conversions));

      // Render Main Chart
      const metric = this.stateStore.get('chartMetric', 'spend');
      const timeSeries = await this.dataEngine.getTimeSeries(metric);
      this.chartManager.renderDashboardChart('dashboardPerformanceChart', timeSeries, metric);

      // Render Platform Share Donut
      const comparison = await this.dataEngine.getPlatformComparison();
      this.chartManager.renderPlatformShareChart('dashboardPlatformShareChart', comparison.meta.spend, comparison.tiktok.spend);

      // Render Platform Distribution badges
      const metaShareEl = document.getElementById('dash-share-meta');
      const ttShareEl = document.getElementById('dash-share-tiktok');
      const totalSpend = (comparison.meta.spend + comparison.tiktok.spend) || 1;
      const metaPct = Math.round((comparison.meta.spend / totalSpend) * 100);
      const ttPct = 100 - metaPct;

      if (metaShareEl) metaShareEl.textContent = `Meta: ${window.AdsAI.MetricsCalc.formatVND(comparison.meta.spend)} (${metaPct}%)`;
      if (ttShareEl) ttShareEl.textContent = `TikTok: ${window.AdsAI.MetricsCalc.formatVND(comparison.tiktok.spend)} (${ttPct}%)`;
    }

    // ------------------------------------------------------------------------
    // SCREEN 04: CAMPAIGNS TABLE
    // ------------------------------------------------------------------------
    async renderCampaigns() {
      const campaigns = await this.dataEngine.getCampaignsWithMetrics();
      const tbody = document.getElementById('campaignsTableBody');
      if (!tbody) return;

      if (campaigns.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" class="py-12 text-center text-slate-400">
              <svg class="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <p class="font-semibold text-slate-600">Không tìm thấy chiến dịch nào</p>
              <p class="text-xs text-slate-400 mt-1">Thử thay đổi bộ lọc tìm kiếm hoặc phạm vi ngày.</p>
            </td>
          </tr>
        `;
        return;
      }

      // Pagination
      const page = this.campaignPagination.page;
      const pageSize = this.campaignPagination.pageSize;
      const start = (page - 1) * pageSize;
      const paginated = campaigns.slice(start, start + pageSize);

      tbody.innerHTML = paginated.map(c => {
        const platBadge = c.platform === 'meta'
          ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800"><span class="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Meta Ads</span>`
          : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800"><span class="w-1.5 h-1.5 rounded-full bg-rose-600"></span>TikTok Ads</span>`;

        const statusBadge = c.status === 'ACTIVE'
          ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">Active</span>`
          : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">Paused</span>`;

        return `
          <tr class="hover:bg-slate-50/80 transition cursor-pointer border-b border-slate-100" onclick="window.app.openCampaignDetail('${c.id}')">
            <td class="py-3 px-4">
              <div class="font-bold text-slate-900 hover:text-indigo-600 transition flex items-center gap-2">
                <span>${c.name}</span>
                <span class="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">${c.id}</span>
              </div>
              <div class="text-[11px] text-slate-400 mt-0.5">Mục tiêu: <span class="font-medium text-slate-600">${c.objective}</span> • Ngân sách: ${window.AdsAI.MetricsCalc.formatVND(c.budget)}/ngày</div>
            </td>
            <td class="py-3 px-3">${platBadge}</td>
            <td class="py-3 px-3">${statusBadge}</td>
            <td class="py-3 px-3 text-right font-bold text-slate-900">${window.AdsAI.MetricsCalc.formatVND(c.metrics.spend)}</td>
            <td class="py-3 px-3 text-right font-bold text-slate-900">${window.AdsAI.MetricsCalc.formatVND(c.metrics.revenue)}</td>
            <td class="py-3 px-3 text-right font-extrabold ${c.metrics.roas >= 3.0 ? 'text-indigo-600' : 'text-slate-700'}">${c.metrics.roas.toFixed(2)}</td>
            <td class="py-3 px-3 text-right font-bold text-emerald-600">${window.AdsAI.MetricsCalc.formatVND(c.metrics.cpa)}</td>
            <td class="py-3 px-3 text-right text-slate-600 font-medium">${c.metrics.ctr.toFixed(2)}%</td>
            <td class="py-3 px-3 text-right font-bold text-slate-800">${window.AdsAI.MetricsCalc.formatNumber(c.metrics.conversions)}</td>
            <td class="py-3 px-3 text-center">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${c.healthScore >= 80 ? 'bg-emerald-100 text-emerald-800' : c.healthScore >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}">
                ${c.healthScore}
              </span>
            </td>
          </tr>
        `;
      }).join('');

      // Update Pagination info
      const pageInfoEl = document.getElementById('campaignPageInfo');
      if (pageInfoEl) pageInfoEl.textContent = `Hiển thị ${start + 1} - ${Math.min(start + pageSize, campaigns.length)} trong số ${campaigns.length} chiến dịch`;
    }

    // ------------------------------------------------------------------------
    // SCREEN 05: CAMPAIGN DETAIL
    // ------------------------------------------------------------------------
    async openCampaignDetail(campaignId) {
      this.activeCampaignId = campaignId;
      this.navigateTo('screen-campaign-detail');
    }

    async renderCampaignDetail(campaignId) {
      const allCampaigns = await this.dataEngine.getCampaignsWithMetrics();
      const campaign = allCampaigns.find(c => c.id === campaignId) || allCampaigns[0];
      if (!campaign) return;

      this.activeCampaignId = campaign.id;

      // Update Header
      const titleEl = document.getElementById('cmpDetailTitle');
      const platEl = document.getElementById('cmpDetailPlatform');
      const objEl = document.getElementById('cmpDetailObjective');
      const budgetEl = document.getElementById('cmpDetailBudget');
      const healthBadge = document.getElementById('cmpDetailHealthScore');

      if (titleEl) titleEl.textContent = campaign.name;
      if (platEl) platEl.textContent = campaign.platform === 'meta' ? 'Meta Ads' : 'TikTok Ads';
      if (objEl) objEl.textContent = campaign.objective;
      if (budgetEl) budgetEl.textContent = window.AdsAI.MetricsCalc.formatVND(campaign.budget) + '/ngày';
      if (healthBadge) healthBadge.textContent = `${campaign.healthScore}/100`;

      // Update KPI
      const setCard = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      setCard('cmp-kpi-spend', window.AdsAI.MetricsCalc.formatVND(campaign.metrics.spend));
      setCard('cmp-kpi-revenue', window.AdsAI.MetricsCalc.formatVND(campaign.metrics.revenue));
      setCard('cmp-kpi-roas', campaign.metrics.roas.toFixed(2));
      setCard('cmp-kpi-cpa', window.AdsAI.MetricsCalc.formatVND(campaign.metrics.cpa));
      setCard('cmp-kpi-ctr', campaign.metrics.ctr.toFixed(2) + '%');
      setCard('cmp-kpi-conv', window.AdsAI.MetricsCalc.formatNumber(campaign.metrics.conversions));

      // Performance trend for this campaign
      const allDaily = await this.dataEngine.getAllRawDailyMetrics();
      const cmpDaily = allDaily.filter(d => d.campaign.id === campaign.id).sort((a, b) => a.date.localeCompare(b.date));
      const labels = cmpDaily.map(d => d.date.slice(5));
      const spendPoints = cmpDaily.map(d => d.metrics.spend);
      this.chartManager.renderCampaignDetailChart('campaignDetailChart', labels, spendPoints, 'Chi tiêu theo ngày (VND)');

      // AI Diagnosis Box
      const aiDiagBox = document.getElementById('cmpAiDiagnosisBox');
      if (aiDiagBox) {
        aiDiagBox.innerHTML = `
          <div class="space-y-2 text-xs">
            <div class="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
              <strong class="text-indigo-700 block mb-1 uppercase text-[10px]">1. [FACT] SỐ LIỆU ĐO LƯỜNG</strong>
              <p class="text-slate-800">Chiến dịch đạt ROAS ${campaign.metrics.roas} với ${campaign.metrics.conversions} chuyển đổi trên chi tiêu ${window.AdsAI.MetricsCalc.formatVND(campaign.metrics.spend)}. CPA đạt ${window.AdsAI.MetricsCalc.formatVND(campaign.metrics.cpa)}.</p>
            </div>
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <strong class="text-slate-600 block mb-1 uppercase text-[10px]">2. [HYPOTHESIS] NGUYÊN NHÂN</strong>
              <p class="text-slate-700">Tỷ lệ tương tác giữ chân tốt (CTR ${campaign.metrics.ctr}%), luồng mua hàng trên trang đích hoạt động mượt mà.</p>
            </div>
            <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              <strong class="text-emerald-700 block mb-1 uppercase text-[10px]">3. [RECOMMENDATION] KHUYẾN NGHỊ HÀNH ĐỘNG</strong>
              <p class="text-emerald-900 font-medium">Chiến dịch đang vận hành rất tốt. Đề xuất tăng 15% ngân sách hàng ngày và chuẩn bị thêm 2 creative tương đồng.</p>
            </div>
          </div>
        `;
      }
    }

    // ------------------------------------------------------------------------
    // SCREEN 06: AD SETS
    // ------------------------------------------------------------------------
    async renderAdSets() {
      const adSets = await this.dataEngine.getAdSetsWithMetrics();
      const tbody = document.getElementById('adSetsTableBody');
      if (!tbody) return;

      tbody.innerHTML = adSets.map(s => `
        <tr class="hover:bg-slate-50/80 transition border-b border-slate-100">
          <td class="py-3 px-4">
            <div class="font-bold text-slate-900">${s.name}</div>
            <div class="text-[11px] text-slate-400">Khán giả: <span class="text-slate-600 font-medium">${s.audience}</span></div>
          </td>
          <td class="py-3 px-3">
            <span class="inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${s.platform === 'meta' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}">
              ${s.platform.toUpperCase()}
            </span>
          </td>
          <td class="py-3 px-3 text-right font-medium text-slate-800">${window.AdsAI.MetricsCalc.formatVND(s.budget)}</td>
          <td class="py-3 px-3 text-right font-bold text-slate-900">${window.AdsAI.MetricsCalc.formatVND(s.metrics.spend)}</td>
          <td class="py-3 px-3 text-right font-bold text-emerald-600">${window.AdsAI.MetricsCalc.formatVND(s.metrics.cpa)}</td>
          <td class="py-3 px-3 text-right font-bold text-indigo-600">${s.metrics.roas.toFixed(2)}</td>
          <td class="py-3 px-3 text-right text-slate-600">${s.metrics.ctr.toFixed(2)}%</td>
          <td class="py-3 px-3 text-right font-bold">${window.AdsAI.MetricsCalc.formatNumber(s.metrics.conversions)}</td>
          <td class="py-3 px-3 text-center">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">
              ${s.status}
            </span>
          </td>
        </tr>
      `).join('');
    }

    // ------------------------------------------------------------------------
    // SCREEN 07: ADS MANAGEMENT
    // ------------------------------------------------------------------------
    async renderAds() {
      const ads = await this.dataEngine.getAdsWithMetrics();
      const tbody = document.getElementById('adsTableBody');
      if (!tbody) return;

      tbody.innerHTML = ads.map(a => `
        <tr class="hover:bg-slate-50/80 transition border-b border-slate-100">
          <td class="py-3 px-4">
            <div class="font-bold text-slate-900">${a.name}</div>
            <div class="text-[11px] text-slate-400">ID: ${a.id} • AdSet: ${a.adSetId}</div>
          </td>
          <td class="py-3 px-3">
            <span class="inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${a.platform === 'meta' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}">
              ${a.platform.toUpperCase()}
            </span>
          </td>
          <td class="py-3 px-3 text-right font-bold text-slate-900">${window.AdsAI.MetricsCalc.formatVND(a.metrics.spend)}</td>
          <td class="py-3 px-3 text-right text-slate-600">${a.metrics.ctr.toFixed(2)}%</td>
          <td class="py-3 px-3 text-right text-slate-600">${window.AdsAI.MetricsCalc.formatVND(a.metrics.cpc)}</td>
          <td class="py-3 px-3 text-right font-bold text-emerald-600">${window.AdsAI.MetricsCalc.formatVND(a.metrics.cpa)}</td>
          <td class="py-3 px-3 text-right font-bold text-indigo-600">${a.metrics.roas.toFixed(2)}</td>
          <td class="py-3 px-3 text-right font-bold">${window.AdsAI.MetricsCalc.formatNumber(a.metrics.conversions)}</td>
          <td class="py-3 px-3 text-center">
            <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${a.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">
              ${a.status}
            </span>
          </td>
        </tr>
      `).join('');
    }

    // ------------------------------------------------------------------------
    // SCREEN 08: CREATIVES LIBRARY
    // ------------------------------------------------------------------------
    async renderCreatives() {
      const creatives = await this.dataEngine.getAllCreatives();
      const grid = document.getElementById('creativesGridContainer');
      if (!grid) return;

      grid.innerHTML = creatives.map(cr => {
        let badgeColor = 'bg-slate-100 text-slate-700';
        if (cr.status === 'WINNER') badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
        else if (cr.status === 'FATIGUE') badgeColor = 'bg-rose-100 text-rose-800 border-rose-200 animate-pulse';
        else if (cr.status === 'WATCH') badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';

        return `
          <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between cursor-pointer" onclick="window.app.openCreativeDetail('${cr.id}')">
            <div>
              <div class="relative h-44 bg-slate-900 overflow-hidden">
                <img src="${cr.url}" alt="${cr.name}" class="w-full h-full object-cover opacity-90 hover:scale-105 transition duration-300" />
                <div class="absolute top-3 left-3 flex gap-2">
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${cr.platform === 'meta' ? 'bg-blue-600 text-white' : 'bg-rose-600 text-white'}">${cr.platform.toUpperCase()}</span>
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${badgeColor}">${cr.status}</span>
                </div>
                <div class="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-0.5 rounded text-[10px] font-mono">${cr.format}</div>
              </div>
              <div class="p-4 space-y-2">
                <h4 class="font-bold text-xs text-slate-900 line-clamp-2">${cr.name}</h4>
                <p class="text-[11px] text-slate-500 italic">"${cr.headline}"</p>
                <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <span class="text-[10px] text-slate-400 block">Hook Rate (3s)</span>
                    <strong class="font-bold text-slate-800">${cr.hookRate}%</strong>
                  </div>
                  <div>
                    <span class="text-[10px] text-slate-400 block">Tần suất (Freq)</span>
                    <strong class="font-bold ${cr.frequency >= 2.5 ? 'text-rose-600' : 'text-slate-800'}">${cr.frequency.toFixed(1)}</strong>
                  </div>
                </div>
              </div>
            </div>
            <div class="bg-slate-50 px-4 py-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
              <span class="text-slate-600">ROAS: <strong class="text-indigo-600">${cr.roas}</strong></span>
              <span class="text-indigo-600 hover:underline">Chi tiết →</span>
            </div>
          </div>
        `;
      }).join('');
    }

    // ------------------------------------------------------------------------
    // SCREEN 09: CREATIVE DETAIL
    // ------------------------------------------------------------------------
    async openCreativeDetail(creativeId) {
      this.activeCreativeId = creativeId;
      this.navigateTo('screen-creative-detail');
    }

    async renderCreativeDetail(creativeId) {
      const creatives = await this.dataEngine.getAllCreatives();
      const cr = creatives.find(c => c.id === creativeId) || creatives[0];
      if (!cr) return;

      this.activeCreativeId = cr.id;

      const titleEl = document.getElementById('crDetailTitle');
      const headlineEl = document.getElementById('crDetailHeadline');
      const imgEl = document.getElementById('crDetailImg');
      const statusBadge = document.getElementById('crDetailStatusBadge');

      if (titleEl) titleEl.textContent = cr.name;
      if (headlineEl) headlineEl.textContent = cr.headline;
      if (imgEl) imgEl.src = cr.url;
      if (statusBadge) {
        statusBadge.textContent = cr.status;
        statusBadge.className = `px-3 py-1 rounded-full text-xs font-bold ${cr.status === 'WINNER' ? 'bg-emerald-100 text-emerald-800' : cr.status === 'FATIGUE' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'}`;
      }

      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      setVal('cr-stat-spend', window.AdsAI.MetricsCalc.formatVND(cr.spend));
      setVal('cr-stat-roas', cr.roas.toFixed(2));
      setVal('cr-stat-cpa', window.AdsAI.MetricsCalc.formatVND(cr.cpa));
      setVal('cr-stat-hook', cr.hookRate + '%');
      setVal('cr-stat-hold', cr.holdRate + '%');
      setVal('cr-stat-freq', cr.frequency.toFixed(1));

      // AI recommendation for this creative
      const recEl = document.getElementById('crDetailAiAdvice');
      if (recEl) {
        if (cr.status === 'FATIGUE') {
          recEl.innerHTML = `
            <div class="bg-rose-50 p-4 rounded-xl border border-rose-200 text-rose-900 text-xs space-y-2">
              <strong class="font-bold block uppercase text-[11px] text-rose-700">🚨 CẢNH BÁO CREATIVE FATIGUE</strong>
              <p>Creative này đã bị bão hòa tần suất hiển thị (${cr.frequency.toFixed(1)} lần/người). Tỷ lệ Hook 3s sụt giảm và CPA bắt đầu tăng cao.</p>
              <p class="font-semibold">Đề xuất: Thay đổi Hook 3 giây đầu tiên với góc nhìn mới hoặc tắt creative để phân bổ ngân sách sang video WINNER.</p>
            </div>
          `;
        } else {
          recEl.innerHTML = `
            <div class="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-emerald-900 text-xs space-y-2">
              <strong class="font-bold block uppercase text-[11px] text-emerald-700">✅ CREATIVE ĐẠT CHUẨN HIỆU QUẢ</strong>
              <p>Mẫu nội dung này đang giữ chân khách hàng tốt với Hook Rate ${cr.hookRate}% và ROAS ${cr.roas}. Tần suất hiển thị an toàn.</p>
              <p class="font-semibold">Đề xuất: Tận dụng nội dung này để mở rộng sang các tệp đối tượng tương đồng hoặc test trên kênh đối trọng (${cr.platform === 'meta' ? 'TikTok' : 'Meta'}).</p>
            </div>
          `;
        }
      }
    }

    // ------------------------------------------------------------------------
    // SCREEN 10: COMPARISON (Meta vs TikTok)
    // ------------------------------------------------------------------------
    async renderComparison() {
      const comp = await this.dataEngine.getPlatformComparison();
      const meta = comp.meta;
      const tt = comp.tiktok;

      const setRow = (idMeta, idTT, valM, valT) => {
        const elM = document.getElementById(idMeta);
        const elT = document.getElementById(idTT);
        if (elM) elM.textContent = valM;
        if (elT) elT.textContent = valT;
      };

      setRow('cmp-val-spend-meta', 'cmp-val-spend-tt', window.AdsAI.MetricsCalc.formatVND(meta.spend), window.AdsAI.MetricsCalc.formatVND(tt.spend));
      setRow('cmp-val-rev-meta', 'cmp-val-rev-tt', window.AdsAI.MetricsCalc.formatVND(meta.revenue), window.AdsAI.MetricsCalc.formatVND(tt.revenue));
      setRow('cmp-val-roas-meta', 'cmp-val-roas-tt', meta.roas.toFixed(2), tt.roas.toFixed(2));
      setRow('cmp-val-cpa-meta', 'cmp-val-cpa-tt', window.AdsAI.MetricsCalc.formatVND(meta.cpa), window.AdsAI.MetricsCalc.formatVND(tt.cpa));
      setRow('cmp-val-ctr-meta', 'cmp-val-ctr-tt', meta.ctr.toFixed(2) + '%', tt.ctr.toFixed(2) + '%');
      setRow('cmp-val-cpc-meta', 'cmp-val-cpc-tt', window.AdsAI.MetricsCalc.formatVND(meta.cpc), window.AdsAI.MetricsCalc.formatVND(tt.cpc));
      setRow('cmp-val-cpm-meta', 'cmp-val-cpm-tt', window.AdsAI.MetricsCalc.formatVND(meta.cpm), window.AdsAI.MetricsCalc.formatVND(tt.cpm));
      setRow('cmp-val-conv-meta', 'cmp-val-conv-tt', window.AdsAI.MetricsCalc.formatNumber(meta.conversions), window.AdsAI.MetricsCalc.formatNumber(tt.conversions));

      // Render Comparison Bar Chart
      this.chartManager.renderComparisonBarChart('comparisonBarCanvas', meta, tt);
    }

    // ------------------------------------------------------------------------
    // SCREEN 11: PERFORMANCE ANALYTICS
    // ------------------------------------------------------------------------
    async renderPerformanceAnalytics() {
      const metric = this.stateStore.get('chartMetric', 'spend');
      const timeSeries = await this.dataEngine.getTimeSeries(metric);
      this.chartManager.renderDashboardChart('performanceAnalyticsCanvas', timeSeries, metric);
    }

    // ------------------------------------------------------------------------
    // SCREEN 12: PIVOT ANALYTICS
    // ------------------------------------------------------------------------
    async renderPivot() {
      const dim = this.stateStore.get('pivotDimension', 'campaign');
      const pivotList = await this.dataEngine.getPivotData(dim);
      const tbody = document.getElementById('pivotTableBody');
      if (!tbody) return;

      tbody.innerHTML = pivotList.map(p => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="py-3 px-4 font-bold text-slate-900">
            <div>${p.dimensionValue}</div>
            ${p.subText ? `<span class="text-[10px] text-slate-400 font-mono">${p.subText}</span>` : ''}
          </td>
          <td class="py-3 px-3 text-right font-bold text-slate-900">${window.AdsAI.MetricsCalc.formatVND(p.metrics.spend)}</td>
          <td class="py-3 px-3 text-right font-bold text-slate-900">${window.AdsAI.MetricsCalc.formatVND(p.metrics.revenue)}</td>
          <td class="py-3 px-3 text-right font-bold text-indigo-600">${p.metrics.roas.toFixed(2)}</td>
          <td class="py-3 px-3 text-right font-bold text-emerald-600">${window.AdsAI.MetricsCalc.formatVND(p.metrics.cpa)}</td>
          <td class="py-3 px-3 text-right text-slate-600">${p.metrics.ctr.toFixed(2)}%</td>
          <td class="py-3 px-3 text-right text-slate-600">${window.AdsAI.MetricsCalc.formatVND(p.metrics.cpc)}</td>
          <td class="py-3 px-3 text-right text-slate-600">${window.AdsAI.MetricsCalc.formatVND(p.metrics.cpm)}</td>
          <td class="py-3 px-3 text-right font-bold">${window.AdsAI.MetricsCalc.formatNumber(p.metrics.conversions)}</td>
        </tr>
      `).join('');
    }

    // ------------------------------------------------------------------------
    // SCREEN 13: AI ANALYST DASHBOARD
    // ------------------------------------------------------------------------
    async renderAIAnalyst() {
      const ctx = await this.aiEngine.buildContext();

      const healthEl = document.getElementById('aiAnalystHealthScore');
      if (healthEl) healthEl.textContent = `${ctx.healthScore}/100`;

      // Render Issues
      const issuesContainer = document.getElementById('aiAnalystIssuesList');
      if (issuesContainer) {
        if (ctx.issues.length === 0) {
          issuesContainer.innerHTML = `<div class="p-4 bg-emerald-50 rounded-xl text-emerald-800 text-xs">🎉 Không ghi nhận bất thường nào! Tất cả các chiến dịch đều an toàn.</div>`;
        } else {
          issuesContainer.innerHTML = ctx.issues.map(iss => `
            <div class="p-4 rounded-xl border border-rose-200 bg-rose-50/60 space-y-2 text-xs">
              <div class="flex items-center justify-between">
                <span class="font-bold text-rose-800 uppercase tracking-wider text-[10px]">${iss.type}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-900">${iss.platform.toUpperCase()}</span>
              </div>
              <h4 class="font-bold text-slate-900">${iss.title}</h4>
              <p class="text-slate-700">${iss.description}</p>
              <div class="p-2.5 bg-white rounded-lg border border-rose-100 text-[11px] text-slate-800">
                <strong>[Khuyến nghị]:</strong> ${iss.recommendation}
              </div>
            </div>
          `).join('');
        }
      }

      // Render Opportunities
      const oppContainer = document.getElementById('aiAnalystOpportunitiesList');
      if (oppContainer) {
        if (ctx.opportunities.length === 0) {
          oppContainer.innerHTML = `<div class="p-4 bg-slate-50 rounded-xl text-slate-500 text-xs">Chưa có cơ hội scale mới. Tiếp tục theo dõi dữ liệu.</div>`;
        } else {
          oppContainer.innerHTML = ctx.opportunities.map(opp => `
            <div class="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2 text-xs">
              <div class="flex items-center justify-between">
                <span class="font-bold text-indigo-700 uppercase tracking-wider text-[10px]">${opp.type}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-200 text-indigo-900">${opp.platform.toUpperCase()}</span>
              </div>
              <h4 class="font-bold text-slate-900">${opp.title}</h4>
              <p class="text-slate-700">${opp.description}</p>
              <div class="p-2.5 bg-white rounded-lg border border-indigo-100 text-[11px] text-slate-800">
                <strong>[Khuyến nghị]:</strong> ${opp.recommendation}
              </div>
            </div>
          `).join('');
        }
      }
    }

    // ------------------------------------------------------------------------
    // SCREEN 14: ASK YOUR DATA (Interactive AI Chat with Guardrails)
    // ------------------------------------------------------------------------
    async handleAskUserQuestion(questionText) {
      const feed = document.getElementById('askDataChatFeed');
      const input = document.getElementById('askDataInput');
      const q = (questionText || (input ? input.value : '')).trim();
      if (!q) return;

      if (input) input.value = '';

      // User Bubble
      const userBubble = document.createElement('div');
      userBubble.className = 'flex justify-end';
      userBubble.innerHTML = `
        <div class="max-w-xl bg-indigo-600 text-white rounded-2xl rounded-tr-none px-4 py-3 text-xs shadow-sm">
          <p class="font-medium">${q}</p>
          <span class="text-[9px] text-indigo-200 block text-right mt-1">${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      `;
      feed.appendChild(userBubble);
      feed.scrollTop = feed.scrollHeight;

      // Thinking Bubble
      const thinkBubble = document.createElement('div');
      thinkBubble.className = 'flex justify-start';
      thinkBubble.innerHTML = `
        <div class="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 text-xs text-slate-500 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
          <span>Đang truy vấn Context & áp dụng AI Guardrails...</span>
        </div>
      `;
      feed.appendChild(thinkBubble);
      feed.scrollTop = feed.scrollHeight;

      // Run AI logic
      setTimeout(async () => {
        feed.removeChild(thinkBubble);
        const ans = await this.aiEngine.ask(q);

        const aiBubble = document.createElement('div');
        aiBubble.className = 'flex justify-start animate-fade-in';
        aiBubble.innerHTML = `
          <div class="max-w-2xl bg-white border border-slate-200 rounded-2xl rounded-tl-none p-5 shadow-sm space-y-3 text-xs">
            <div class="flex items-center justify-between pb-2 border-b border-slate-100">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-bold text-[10px]">AI</span>
                <span class="font-bold text-slate-900">Ads AI Copilot</span>
              </div>
              <div class="flex items-center gap-2 text-[10px]">
                <span class="px-2 py-0.5 rounded-full font-bold ${ans.confidence === 'High' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">Độ tin cậy: ${ans.confidence}</span>
                <span class="text-slate-400">${ans.timestamp}</span>
              </div>
            </div>

            <div class="space-y-2.5 leading-relaxed">
              <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">1. [FACT] DỮ LIỆU ĐO LƯỜNG</span>
                <p class="text-slate-800 font-medium">${ans.fact}</p>
              </div>

              <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">2. [HYPOTHESIS] NGUYÊN NHÂN GIẢ ĐỊNH</span>
                <p class="text-slate-700">${ans.hypothesis}</p>
              </div>

              <div class="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 text-emerald-950">
                <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">3. [RECOMMENDATION] KHUYẾN NGHỊ</span>
                <ul class="list-disc list-inside space-y-1 font-medium text-emerald-900">
                  ${ans.recommendations.map(r => `<li>${r}</li>`).join('')}
                </ul>
              </div>
            </div>
          </div>
        `;
        feed.appendChild(aiBubble);
        feed.scrollTop = feed.scrollHeight;
      }, 400);
    }

    // ------------------------------------------------------------------------
    // SCREEN 15 & 16: REPORTS & EXPORT PREVIEW
    // ------------------------------------------------------------------------
    async renderReports() {
      // Standard static/dynamic reports list
    }

    async renderReportPreview() {
      const kpis = await this.dataEngine.getExecutiveKPIs();
      const campaigns = await this.dataEngine.getCampaignsWithMetrics();
      const comp = await this.dataEngine.getPlatformComparison();

      const dateStrEl = document.getElementById('reportPreviewDateStr');
      if (dateStrEl) dateStrEl.textContent = `Chu kỳ: 7 Ngày gần nhất (01/10/2026 — 08/10/2026) • Chuẩn hóa Meta & TikTok`;

      const kpiRow = document.getElementById('reportPreviewKpiSummary');
      if (kpiRow) {
        kpiRow.innerHTML = `
          <div class="p-3 bg-slate-50 rounded-xl">
            <span class="text-slate-400 block text-[10px]">TỔNG CHI TIÊU</span>
            <strong class="text-base text-slate-900">${window.AdsAI.MetricsCalc.formatVND(kpis.current.spend)}</strong>
          </div>
          <div class="p-3 bg-slate-50 rounded-xl">
            <span class="text-slate-400 block text-[10px]">DOANH THU</span>
            <strong class="text-base text-slate-900">${window.AdsAI.MetricsCalc.formatVND(kpis.current.revenue)}</strong>
          </div>
          <div class="p-3 bg-slate-50 rounded-xl">
            <span class="text-slate-400 block text-[10px]">ROAS</span>
            <strong class="text-base text-indigo-600">${kpis.current.roas.toFixed(2)}</strong>
          </div>
          <div class="p-3 bg-slate-50 rounded-xl">
            <span class="text-slate-400 block text-[10px]">CPA TRUNG BÌNH</span>
            <strong class="text-base text-emerald-600">${window.AdsAI.MetricsCalc.formatVND(kpis.current.cpa)}</strong>
          </div>
        `;
      }
    }

    // ------------------------------------------------------------------------
    // SCREEN 17: CONNECTIONS (Meta & TikTok Real API)
    // ------------------------------------------------------------------------
    async renderConnections() {
      const isLive = this.dataEngine.mode === 'live';
      const modeIndicator = document.getElementById('connActiveModeBadge');
      if (modeIndicator) {
        modeIndicator.textContent = isLive ? 'CHẾ ĐỘ TÀI KHOẢN THẬT (LIVE MODE)' : 'CHẾ ĐỘ MÔ PHỎNG (DEMO MODE)';
        modeIndicator.className = isLive ? 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800' : 'px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800';
      }

      const metaStatus = document.getElementById('connMetaStatus');
      const ttStatus = document.getElementById('connTikTokStatus');

      if (metaStatus) {
        metaStatus.textContent = isLive ? 'ĐÃ KẾT NỐI (GRAPH API v19.0)' : 'DEMO MOCK VERIFIED';
        metaStatus.className = isLive ? 'text-emerald-600 font-bold' : 'text-slate-500 font-medium';
      }

      if (ttStatus) {
        ttStatus.textContent = isLive ? 'ĐÃ KẾT NỐI (BUSINESS API v1.3)' : 'DEMO MOCK VERIFIED';
        ttStatus.className = isLive ? 'text-emerald-600 font-bold' : 'text-slate-500 font-medium';
      }
    }

    // ------------------------------------------------------------------------
    // SCREEN 18: SETTINGS
    // ------------------------------------------------------------------------
    async renderSettings() {
      const wsInput = document.getElementById('settingWorkspaceNameInput');
      if (wsInput) wsInput.value = this.stateStore.get('workspaceName', 'Kstudy E-commerce Group');
    }

    // ------------------------------------------------------------------------
    // GLOBAL MODALS & EVENTS
    // ------------------------------------------------------------------------
    setupGlobalEvents() {
      // Expose app instance globally for HTML onclick handlers
      window.app = this;
    }

    setupFilterEvents() {
      // Real-time Search input debounce
      const searchInputs = document.querySelectorAll('.global-search-input');
      searchInputs.forEach(input => {
        input.addEventListener('input', (e) => {
          this.dataEngine.setFilter('searchQuery', e.target.value.trim());
        });
      });
    }

    // Export Helpers
    async triggerExportCSV() {
      const campaigns = await this.dataEngine.getCampaignsWithMetrics();
      this.exportEngine.exportCampaignsToCSV(campaigns);
    }

    async triggerExportExcel() {
      const kpis = (await this.dataEngine.getExecutiveKPIs()).current;
      const campaigns = await this.dataEngine.getCampaignsWithMetrics();
      const adSets = await this.dataEngine.getAdSetsWithMetrics();
      const ads = await this.dataEngine.getAdsWithMetrics();
      const creatives = await this.dataEngine.getAllCreatives();
      this.exportEngine.exportFullExcelWorkbook(kpis, campaigns, adSets, ads, creatives);
    }

    triggerPrintPDF() {
      this.exportEngine.printReport();
    }
  }

  // Auto-boot on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    window.AdsAIApp = new AdsAIApp();
    window.AdsAIApp.init();
  });

})(window);
