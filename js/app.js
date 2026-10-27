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
        activeScreen: 'screen-command-center',
        uiMode: 'simple',
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

      this.currentScreenId = this.stateStore.get('activeScreen', 'screen-command-center');
      this.uiMode = this.stateStore.get('uiMode', 'simple');
      this.autopilotManager = new window.AdsAI.AutopilotManager(this.dataEngine);
      this.clarificationMachine = new window.AdsAI.ClarificationStateMachine();
      this.creativeStudioEngine = new window.AdsAI.CreativeStudioEngine(this.aiEngine);
      this.rulesEngine = new window.AdsAI.AIRulesEngine(this.dataEngine, this.aiEngine);
      this.activeCreativeTab = 'studio';
      this.currentGeneratedScripts = null;
      this.currentPlan = null;
      this.isVoiceListening = false;

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
      console.log('🚀 Initializing NTDAds AI Marketing Agent...');

      // Setup router and event listeners
      this.setupGlobalEvents();
      this.setupFilterEvents();

      // Apply initial UI mode (Simple vs Pro)
      this.applyUIMode(this.uiMode);

      // Listen to data engine changes
      this.dataEngine.subscribe(() => {
        this.refreshCurrentScreen();
      });

      // Initial navigation
      this.navigateTo(this.currentScreenId);

      // Render workspace info & Autopilot tier banner
      this.updateWorkspaceHeader();
      this.updateAutopilotTierUI(this.autopilotManager.getMode());
    }

    applyUIMode(mode) {
      this.uiMode = mode;
      this.stateStore.set('uiMode', mode);

      const simpleBtn = document.getElementById('toggleSimpleModeBtn');
      const proBtn = document.getElementById('toggleProModeBtn');
      const proSidebar = document.getElementById('proSidebarSection');

      // Command Center Elements
      const healthCard = document.getElementById('cmd-card-health');
      const creativeSpotlight = document.getElementById('cmdCreativeSpotlight');
      const exportExcelBtn = document.getElementById('headerExportExcelBtn');
      const kpiGrid = document.getElementById('cmdKpiGrid');
      
      const labelRev = document.getElementById('label-kpi-revenue');
      const subRev = document.getElementById('sub-kpi-revenue');
      const labelSpend = document.getElementById('label-kpi-spend');
      const subSpend = document.getElementById('sub-kpi-spend');
      const labelProfit = document.getElementById('label-kpi-profit');
      const subProfit = document.getElementById('sub-kpi-profit');

      if (mode === 'pro') {
        if (proSidebar) proSidebar.classList.remove('hidden');
        if (simpleBtn) {
          simpleBtn.className = "px-3 py-1 font-semibold rounded-lg text-slate-600 hover:text-slate-900 transition";
        }
        if (proBtn) {
          proBtn.className = "px-3 py-1 font-bold rounded-lg transition bg-indigo-600 text-white shadow-xs";
        }

        // Pro Mode: Hiện đầy đủ tính năng & thuật ngữ chuyên sâu
        if (healthCard) healthCard.classList.remove('hidden');
        if (creativeSpotlight) creativeSpotlight.classList.remove('hidden');
        if (exportExcelBtn) exportExcelBtn.classList.remove('hidden');
        if (kpiGrid) kpiGrid.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs";

        if (labelRev) labelRev.textContent = "Doanh thu (Revenue)";
        if (subRev) subRev.textContent = "Conversion Value từ Pixel & CAPI";
        if (labelSpend) labelSpend.textContent = "Ads Spend";
        if (subSpend) subSpend.textContent = "Phân bổ đều theo phễu chuyển đổi";
        if (labelProfit) labelProfit.textContent = "Lãi ước tính sau Ads";
        if (subProfit) subProfit.textContent = "Đã trừ giá vốn 45% & phí sàn";

      } else {
        if (proSidebar) proSidebar.classList.add('hidden');
        if (simpleBtn) {
          simpleBtn.className = "px-3 py-1 font-bold rounded-lg transition bg-white text-indigo-700 shadow-xs";
        }
        if (proBtn) {
          proBtn.className = "px-3 py-1 font-semibold rounded-lg text-slate-600 hover:text-slate-900 transition";
        }

        // Simple Mode: Ẩn các yếu tố phức tạp, chỉ tập trung vào 3 số cốt lõi: Tiền bán - Tiền chi - Tiền lời
        if (healthCard) healthCard.classList.add('hidden');
        if (creativeSpotlight) creativeSpotlight.classList.add('hidden');
        if (exportExcelBtn) exportExcelBtn.classList.add('hidden');
        if (kpiGrid) kpiGrid.className = "grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs";

        if (labelRev) labelRev.textContent = "💰 Tiền bán được";
        if (subRev) subRev.textContent = "Tổng tiền hàng bán ra từ quảng cáo";
        if (labelSpend) labelSpend.textContent = "💸 Tiền quảng cáo đã chi";
        if (subSpend) subSpend.textContent = "Tiền đã trả cho Facebook & TikTok";
        if (labelProfit) labelProfit.textContent = "✨ Tiền lời thực tế";
        if (subProfit) subProfit.textContent = "Đã trừ vốn nhập 45% & phí ship/sàn";
      }
    }

    updateWorkspaceHeader() {
      const wsName = this.stateStore.get('workspaceName', 'Kstudy E-commerce Group');
      const wsBadge = document.getElementById('currentWorkspaceName');
      if (wsBadge) wsBadge.textContent = wsName;
    }

    // ------------------------------------------------------------------------
    // NAVIGATION ROUTER (Across all Screens)
    // ------------------------------------------------------------------------
    navigateTo(screenId) {
      const screens = document.querySelectorAll('.app-screen');
      screens.forEach(s => s.classList.add('hidden'));

      const target = document.getElementById(screenId);
      if (!target) {
        console.warn(`Screen ${screenId} not found, falling back to command center.`);
        screenId = 'screen-command-center';
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
        'screen-command-center': ['Command Center', 'AI Command Center — Quản trị Quảng cáo Bằng Mục tiêu'],
        'screen-agent': ['AI Agent', 'NTDAds AI Marketing Agent — Planner & Lịch sử Thực thi'],
        'screen-dashboard': ['Tổng quan', 'Bảng điều khiển hiệu suất quảng cáo (Pro Hub)'],
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
        case 'screen-command-center':
          await this.renderCommandCenter();
          break;
        case 'screen-agent':
          await this.renderAgentWorkspace();
          break;
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
    // SCREEN: AI COMMAND CENTER (HERO SCREEN)
    // ------------------------------------------------------------------------
    async renderCommandCenter() {
      const kpiData = await this.dataEngine.getExecutiveKPIs();
      const cur = kpiData.current;

      const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };

      setEl('cmd-kpi-revenue', window.AdsAI.MetricsCalc.formatVND(cur.revenue));
      setEl('cmd-kpi-spend', window.AdsAI.MetricsCalc.formatVND(cur.spend));
      setEl('cmd-kpi-profit', window.AdsAI.MetricsCalc.formatProfit(cur.estimatedProfit));

      // Health Score Calculation
      const campaigns = await this.dataEngine.getCampaignsWithMetrics();
      const creatives = await this.dataEngine.getAllCreatives();
      const ruleEval = window.AdsAI.RuleEngine.evaluatePortfolio(campaigns, creatives, kpiData);
      const score = ruleEval.overallHealthScore || 84;

      setEl('cmd-kpi-health', score);
      const bar = document.getElementById('cmd-kpi-health-bar');
      if (bar) {
        bar.style.width = `${score}%`;
        if (score >= 75) bar.className = "bg-gradient-to-r from-emerald-500 to-indigo-600 h-2 rounded-full";
        else if (score >= 50) bar.className = "bg-gradient-to-r from-amber-500 to-amber-600 h-2 rounded-full";
        else bar.className = "bg-gradient-to-r from-rose-500 to-rose-600 h-2 rounded-full";
      }
    }

    // ------------------------------------------------------------------------
    // SCREEN: AI MARKETING AGENT WORKSPACE
    // ------------------------------------------------------------------------
    async renderAgentWorkspace() {
      this.renderActivityLogTable();
      this.updateAutopilotTierUI(this.autopilotManager.getMode());

      // Update Chat Engine Indicator
      const dot = document.getElementById('chatEngineIndicatorDot');
      const text = document.getElementById('chatEngineIndicatorText');
      const hasGemini = !!this.aiEngine.getGeminiApiKey();

      if (dot && text) {
        if (hasGemini) {
          dot.className = "w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse";
          text.textContent = "✨ Đang dùng: Google Gemini 1.5 Flash (Trí tuệ nhân tạo thế hệ mới)";
          text.className = "text-xs font-bold text-purple-700";
        } else {
          dot.className = "w-2.5 h-2.5 rounded-full bg-slate-400";
          text.textContent = "Đang dùng: AI Guardrails Mặc định (Offline Rule-based)";
          text.className = "text-xs font-bold text-slate-700";
        }
      }

      this.renderRulesTab();
    }

    renderRulesTab() {
      const container = document.getElementById('rulesListContainer');
      const countEl = document.getElementById('activeRulesCount');
      if (!container || !this.rulesEngine) return;

      const rules = this.rulesEngine.getRules();
      if (countEl) countEl.textContent = rules.filter(r => r.enabled).length;

      container.innerHTML = rules.map(rule => {
        let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
        if (rule.color === 'rose') badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
        else if (rule.color === 'indigo') badgeColor = 'bg-indigo-100 text-indigo-800 border-indigo-200';
        else if (rule.color === 'emerald') badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
        else if (rule.color === 'amber') badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
        else if (rule.color === 'purple') badgeColor = 'bg-purple-100 text-purple-800 border-purple-200';

        return `
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="flex items-start sm:items-center gap-3">
                <span class="px-2.5 py-1 rounded-xl text-xs font-bold border ${badgeColor} shrink-0">${rule.badge}</span>
                <div>
                  <h5 class="font-bold text-sm text-slate-900">${rule.name}</h5>
                  <p class="text-xs text-slate-500 italic">“${rule.naturalText}”</p>
                </div>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <span class="text-[11px] text-slate-400 font-mono">Chu kỳ: ${rule.checkFrequency}</span>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" ${rule.enabled ? 'checked' : ''} onchange="window.toggleAutomationRule('${rule.id}')" class="sr-only peer">
                  <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>

            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-slate-400 font-bold uppercase text-[10px]">ĐIỀU KIỆN:</span>
                <span class="text-indigo-700 font-semibold">${rule.conditions.map(c => c.label).join(' VÀ ')}</span>
                <span class="text-slate-400">➔</span>
                <span class="text-slate-400 font-bold uppercase text-[10px]">HÀNH ĐỘNG:</span>
                <span class="text-rose-600 font-bold">${rule.actionLabel}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button onclick="window.dryRunSingleRule('${rule.id}')" class="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold text-[11px] transition">
                  🔍 Quét thử
                </button>
                <button onclick="window.deleteAutomationRule('${rule.id}')" class="text-slate-400 hover:text-rose-600 text-[11px] font-bold transition px-2 py-1">
                  Xóa
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    renderActivityLogTable() {
      const tbody = document.getElementById('activityLogTableBody');
      if (!tbody) return;

      const logs = this.dataEngine.getActivityLog();
      if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">Chưa có hành động nào được ghi nhận.</td></tr>`;
        return;
      }

      tbody.innerHTML = logs.map(l => `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">${l.timestamp}</td>
          <td class="py-3 px-4">
            <span class="inline-flex items-center gap-1 font-bold ${l.agent.includes('Autopilot') ? 'text-purple-600' : 'text-indigo-600'}">
              <span>🤖</span> <span>${l.agent}</span>
            </span>
          </td>
          <td class="py-3 px-4 font-bold text-slate-900">${l.title}</td>
          <td class="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate" title="${l.description}">${l.description}</td>
          <td class="py-3 px-4 whitespace-nowrap">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${l.userApproved ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}">
              ${l.userApproved ? '✓ Đã duyệt' : 'Tự động'}
            </span>
          </td>
          <td class="py-3 px-4 text-center whitespace-nowrap">
            ${l.canUndo ? `
              <button onclick="window.undoAction('${l.id}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition border border-slate-200">
                ↩️ Hoàn tác
              </button>
            ` : `
              <span class="text-[10px] text-slate-400 font-medium">${l.status === 'REVERTED' ? 'Đã hoàn tác' : 'Không khả dụng'}</span>
            `}
          </td>
        </tr>
      `).join('');
    }

    updateAutopilotTierUI(tier) {
      ['COPILOT', 'ASSISTED', 'AUTOPILOT'].forEach(t => {
        const card = document.getElementById(`tierCard-${t}`);
        if (!card) return;
        if (t === tier) {
          card.className = "p-5 rounded-2xl border-2 border-indigo-600 bg-indigo-50/30 cursor-pointer transition space-y-2";
        } else {
          card.className = "p-5 rounded-2xl border-2 border-slate-200 hover:border-indigo-300 cursor-pointer transition space-y-2";
        }
      });
      const badge = document.getElementById('agentActiveBadge');
      if (badge) badge.textContent = `${tier} MODE`;

      // Cập nhật Banner trên cùng & nút Kill Switch tương ứng
      const killBtn = document.getElementById('bannerKillSwitchBtn');
      const bannerBadgeText = document.getElementById('bannerBadgeText');
      const bannerModeText = document.getElementById('bannerModeText');
      const liveBanner = document.getElementById('liveStatusBanner');

      if (tier === 'AUTOPILOT') {
        if (killBtn) {
          killBtn.classList.remove('hidden');
          killBtn.classList.add('inline-flex');
        }
        if (bannerBadgeText) bannerBadgeText.textContent = "⚡ FULL AUTOPILOT ACTIVE";
        if (bannerModeText) bannerModeText.textContent = "AI đang tự động tối ưu quảng cáo trong trần an toàn (≤ 500k/ngày, ±15% ngân sách).";
        if (liveBanner) liveBanner.className = "bg-rose-500/10 text-rose-900 border-b border-rose-200 px-4 py-2 text-xs flex items-center justify-between shrink-0 no-print transition-colors";
      } else if (tier === 'ASSISTED') {
        if (killBtn) {
          killBtn.classList.remove('hidden');
          killBtn.classList.add('inline-flex');
        }
        if (bannerBadgeText) bannerBadgeText.textContent = "🛡️ ASSISTED AUTOPILOT";
        if (bannerModeText) bannerModeText.textContent = "AI đề xuất các hành động tối ưu — Bạn bấm 1 chạm để duyệt.";
        if (liveBanner) liveBanner.className = "bg-indigo-500/10 text-indigo-900 border-b border-indigo-200 px-4 py-2 text-xs flex items-center justify-between shrink-0 no-print transition-colors";
      } else {
        // COPILOT / DEMO Mode
        if (killBtn) {
          killBtn.classList.add('hidden');
          killBtn.classList.remove('inline-flex');
        }
        if (bannerBadgeText) bannerBadgeText.textContent = "CHẾ ĐỘ AN TOÀN (COPILOT)";
        if (bannerModeText) bannerModeText.textContent = "AI chỉ đóng vai trò cố vấn, không tự ý can thiệp ngân sách. Hoàn toàn an toàn cho người mới.";
        if (liveBanner) liveBanner.className = "bg-amber-500/10 text-amber-900 border-b border-amber-200 px-4 py-2 text-xs flex items-center justify-between shrink-0 no-print transition-colors";
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
    // SCREEN 08: CREATIVES LIBRARY & AI HOOK STUDIO
    // ------------------------------------------------------------------------
    async renderCreatives() {
      // 1. Render Library Grid
      const creatives = await this.dataEngine.getAllCreatives();
      const grid = document.getElementById('creativesGridContainer');
      if (grid) {
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

      // 2. If Studio Results area is empty, generate initial default scripts so it looks active immediately
      const resultsArea = document.getElementById('studioResultsArea');
      if (resultsArea && (!resultsArea.children.length || !this.currentGeneratedScripts)) {
        await this.generateStudioScripts();
      }
    }

    async generateStudioScripts(overrideProduct = null, overrideCategory = null) {
      const prodInput = document.getElementById('studioInputProduct');
      const catInput = document.getElementById('studioInputCategory');
      const audInput = document.getElementById('studioInputAudience');
      const uspInput = document.getElementById('studioInputUsp');
      const platformRadio = document.querySelector('input[name="studioPlatformRadio"]:checked');

      if (overrideProduct && prodInput) prodInput.value = overrideProduct;
      if (overrideCategory && catInput) catInput.value = overrideCategory;

      const product = prodInput ? prodInput.value.trim() : 'Giày thể thao ProMax siêu êm chân';
      const category = catInput ? catInput.value : 'Thời trang & Phụ kiện';
      const targetAudience = audInput ? audInput.value.trim() : 'Nam nữ 18-35 tuổi, dân văn phòng hoặc thích thể thao';
      const usp = uspInput ? uspInput.value.trim() : 'Đệm khí giảm chấn 95%, bảo hành 12 tháng, giảm 35% duy nhất hôm nay';
      const platform = platformRadio ? platformRadio.value : 'tiktok';

      const resultsArea = document.getElementById('studioResultsArea');
      const btn = document.getElementById('studioGenerateBtn');
      const btnIcon = document.getElementById('studioGenerateBtnIcon');
      const btnText = document.getElementById('studioGenerateBtnText');

      if (btn) btn.disabled = true;
      if (btnIcon) btnIcon.textContent = '⏳';
      if (btnText) btnText.textContent = 'ĐANG PHÂN TÍCH & VIẾT KỊCH BẢN...';

      if (resultsArea) {
        resultsArea.innerHTML = `
          <div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center space-y-4 animate-pulse">
            <div class="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center text-xl font-bold">🪄</div>
            <div>
              <h4 class="font-bold text-slate-800 text-sm">AI đang bóc tách góc nhìn & chấm điểm Hook cho "${product}"</h4>
              <p class="text-xs text-slate-500 max-w-md mx-auto mt-1">Đang áp dụng công thức 3 giây đầu giữ chân người xem và cấu trúc chuyển đổi cao...</p>
            </div>
          </div>
        `;
      }

      try {
        const data = await this.creativeStudioEngine.generateScripts({
          product,
          category,
          targetAudience,
          usp,
          platform
        });

        this.currentGeneratedScripts = data;
        this.renderStudioResults(data);
      } catch (err) {
        console.error('Error generating scripts:', err);
        if (resultsArea) {
          resultsArea.innerHTML = `
            <div class="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs">
              ⚠️ Không thể tạo kịch bản lúc này: ${err.message}. Vui lòng thử lại.
            </div>
          `;
        }
      } finally {
        if (btn) btn.disabled = false;
        if (btnIcon) btnIcon.textContent = '🪄';
        if (btnText) btnText.textContent = 'SINH 3 KỊCH BẢN & ĐÁNH GIÁ HOOK NGAY';
      }
    }

    renderStudioResults(data) {
      const resultsArea = document.getElementById('studioResultsArea');
      if (!resultsArea || !data || !data.scripts) return;

      const isTikTok = data.platform === 'tiktok';

      const scriptsHtml = data.scripts.map((sc, idx) => {
        let scoreBg = 'bg-emerald-100 text-emerald-800 border-emerald-300';
        if (sc.hookScore < 85) scoreBg = 'bg-amber-100 text-amber-800 border-amber-300';

        return `
          <div class="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4">
            <div class="space-y-3">
              <!-- Card Header -->
              <div class="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <span class="text-[10px] font-black uppercase tracking-wider text-indigo-600">Kịch bản #${idx + 1}</span>
                  <h4 class="font-black text-sm text-slate-900">${sc.angle}</h4>
                </div>
                <div class="text-right shrink-0">
                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border ${scoreBg}">
                    <span>🎯 Hook:</span>
                    <span>${sc.hookScore}/100</span>
                  </span>
                  <span class="block text-[9px] text-slate-400 font-bold uppercase mt-0.5">${sc.hookGrade || 'Rất tốt'}</span>
                </div>
              </div>

              <!-- 0-3s Hook Box -->
              <div class="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-100 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-extrabold uppercase text-indigo-900 tracking-wider">🎣 0-3 GIÂY ĐẦU (HOOK)</span>
                  <span class="text-[10px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-full shadow-xs">Giây quyết định</span>
                </div>
                <div class="text-xs font-black text-indigo-950 italic">
                  "${sc.hookText}"
                </div>
                <div class="text-[11px] text-slate-600 space-y-1 pt-1 border-t border-indigo-100/70">
                  <p><strong class="text-slate-800">🎬 Hình ảnh / Hành động:</strong> ${sc.visualAction}</p>
                  <p><strong class="text-slate-800">🎙️ Lời thoại:</strong> ${sc.audioVoiceover}</p>
                </div>
              </div>

              <!-- Body / USP -->
              <div class="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span class="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">💡 THÂN BÀI (${isTikTok ? '4-15 GIÂY' : 'NỘI DUNG CHÍNH'})</span>
                <p class="text-xs text-slate-700 leading-relaxed">${sc.bodyContent}</p>
              </div>

              <!-- CTA -->
              <div class="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-1">
                <span class="text-[10px] font-extrabold uppercase text-emerald-800 tracking-wider">🛒 KÊU GỌI HÀNH ĐỘNG (CTA)</span>
                <p class="text-xs font-semibold text-emerald-950">${sc.cta}</p>
              </div>

              <!-- Psychological Rationale -->
              <div class="p-2.5 rounded-xl bg-purple-50/50 border border-purple-100 text-[11px] text-purple-900 flex items-start gap-1.5">
                <span class="text-xs">🧠</span>
                <div>
                  <strong class="font-bold">Lý do giữ chân:</strong> ${sc.psychologicalTrigger || 'Tập trung kích thích cảm xúc tức thì.'}
                </div>
              </div>
            </div>

            <!-- Footer Actions -->
            <div class="pt-3 border-t border-slate-100 flex items-center gap-2">
              <button id="copyBtn_${idx}" onclick="window.copyScriptToClipboard(${idx})" class="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5">
                <span>📋 Sao chép</span>
              </button>
              <button onclick="window.applyScriptToCampaign(${idx})" title="Đưa kịch bản này vào tạo chiến dịch mới" class="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5">
                <span>🚀 Dùng chạy Ads</span>
              </button>
            </div>
          </div>
        `;
      }).join('');

      resultsArea.innerHTML = `
        <div class="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-5 rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-[10px] bg-white/20 text-purple-200 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                ${data.isGemini ? '✨ Gemini 1.5 Flash' : '⚡ Smart Creative OS'}
              </span>
              <span class="text-xs text-purple-200">Đã tạo cho: <strong>${data.product}</strong> (${isTikTok ? 'TikTok Ads' : 'Meta Ads'})</span>
            </div>
            <p class="text-xs text-purple-100 max-w-2xl">${data.summaryAdvice}</p>
          </div>
          <div class="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 text-center shrink-0">
            <span class="text-[10px] font-bold text-purple-200 uppercase tracking-wider block">Hook Score trung bình</span>
            <div class="text-2xl font-black text-emerald-400">${data.averageHookScore}/100</div>
            <span class="text-[9px] text-emerald-200 font-bold">Tỷ lệ xem tiếp > 40%</span>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          ${scriptsHtml}
        </div>
      `;
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

      // Update Gemini API Key display
      const geminiInput = document.getElementById('inputGeminiApiKey');
      const geminiBadge = document.getElementById('geminiStatusBadge');
      const savedKey = this.aiEngine.getGeminiApiKey();

      if (geminiInput && savedKey) {
        geminiInput.value = savedKey;
      }
      if (geminiBadge) {
        if (savedKey) {
          geminiBadge.textContent = "🟢 Đã kích hoạt (Gemini 1.5 Flash)";
          geminiBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800";
        } else {
          geminiBadge.textContent = "Chưa cấu hình (Dùng Offline)";
          geminiBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700";
        }
      }
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

  // --------------------------------------------------------------------------
  // GLOBAL AI AGENT BRIDGE FUNCTIONS & EVENT HANDLERS
  // --------------------------------------------------------------------------
  
  // 1. UI Mode Switcher (Simple vs Pro)
  window.setUIMode = function(mode) {
    if (window.app) {
      window.app.applyUIMode(mode);
    }
  };

  // Save & Activate Google Gemini API Key
  window.saveGeminiApiKey = function() {
    const input = document.getElementById('inputGeminiApiKey');
    if (!input) return;
    const key = input.value.trim();
    if (!key) {
      if (confirm('Bạn có muốn xóa Gemini API Key và quay về chế độ AI Offline không?')) {
        window.app.aiEngine.setGeminiApiKey('');
        alert('Đã xóa Gemini API Key. Hệ thống chuyển về AI Offline.');
        window.app.refreshCurrentScreen();
      }
      return;
    }

    window.app.aiEngine.setGeminiApiKey(key);
    alert('🎉 Đã kích hoạt thành công Google Gemini 1.5 Flash! Giờ đây Trợ lý AI có thể suy luận thông minh và trả lời mọi câu hỏi tiếp thị của bạn.');
    window.app.refreshCurrentScreen();
  };

  // Toggle KPI Explanation (Tap-to-expand)
  window.toggleKpiExplanation = function(explainId) {
    const box = document.getElementById(explainId);
    if (!box) return;
    const isExpanded = box.classList.contains('expanded');
    // Close other explain boxes first
    document.querySelectorAll('.kpi-explain-box').forEach(b => b.classList.remove('expanded'));
    if (!isExpanded) {
      box.classList.add('expanded');
    }
  };

  // 2. Command Center: Submit Command
  window.submitCommandCenter = function() {
    // Tự động đóng banner hướng dẫn người mới nếu đang mở
    const welcomeCard = document.getElementById('newbieWelcomeCard');
    if (welcomeCard) welcomeCard.classList.add('hidden');

    const input = document.getElementById('cmdInputHero');
    if (!input) return;
    const text = input.value.trim();
    if (!text) {
      alert('Vui lòng nhập mục tiêu hoặc yêu cầu của bạn!');
      input.focus();
      return;
    }

    const parsed = window.AdsAI.AICommandParser.parse(text);
    const MetricsCalc = window.AdsAI.MetricsCalc;

    // Handle Intent: CREATE_CAMPAIGN
    if (parsed.intent === 'CREATE_CAMPAIGN') {
      const slots = parsed.slots;
      // Check if missing critical slots: product, budget, or duration
      if (!slots.product || !slots.budget || !slots.duration) {
        const qRes = window.app.clarificationMachine.start(slots);
        const clarBox = document.getElementById('clarificationContainer');
        const qText = document.getElementById('clarificationQuestionText');
        const ansInput = document.getElementById('clarificationAnswerInput');

        if (clarBox && qText) {
          qText.innerHTML = `<strong>🤖 AI Copilot:</strong> ${qRes.question}`;
          clarBox.classList.remove('hidden');
          if (ansInput) {
            ansInput.value = '';
            ansInput.focus();
          }
          clarBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        return;
      }

      // If all slots are present, generate 7-phase plan immediately
      window.renderGeneratedPlan(slots);
      return;
    }

    // Handle Intent: STOP_LOSING
    if (parsed.intent === 'STOP_LOSING') {
      window.prepareActionApproval({
        title: 'Tạm dừng các Ad Set đang tiêu tiền nhưng hiệu quả thấp',
        actions: [
          'Tạm dừng Ad Set "GenZ Streetwear - Interest Test" (CPA: 74.000₫, 0 đơn trong 48h qua)',
          'Chuyển 500.000₫ ngân sách còn lại về chiến dịch Top ROAS "Lookbook Thu Đông 2026"'
        ],
        budgetLabel: 'Tiết kiệm ước tính: ~500.000₫ / ngày',
        onConfirm: async () => {
          await window.app.dataEngine.pauseEntityDynamic('adSet', 'as_meta_03');
          alert('✅ Đã tạm dừng Ad Set thành công! Đã ghi nhận vào Activity Log.');
          window.app.refreshCurrentScreen();
        }
      });
      return;
    }

    // Handle Intent: SCALE_WINNERS
    if (parsed.intent === 'SCALE_WINNERS') {
      window.prepareActionApproval({
        title: 'Tăng ngân sách cho chiến dịch Winner',
        actions: [
          'Tăng ngân sách chiến dịch "Unboxing Áo Thun Oversize (TikTok)" từ 2.000.000₫ lên 2.300.000₫ (+15%)',
          'Duy trì tần suất Frequency an toàn < 2.0 để bảo vệ hiệu quả'
        ],
        budgetLabel: 'Ngân sách mới: 2.300.000₫ / ngày',
        onConfirm: async () => {
          await window.app.dataEngine.updateBudgetDynamic('campaign', 'cmp_tiktok_01', 2300000);
          alert('✅ Đã tăng 15% ngân sách thành công! Đã ghi nhận vào Activity Log.');
          window.app.refreshCurrentScreen();
        }
      });
      return;
    }

    // Handle Intent: PROFIT_CHECK
    if (parsed.intent === 'PROFIT_CHECK') {
      window.app.navigateTo('screen-agent');
      window.app.handleAskUserQuestion('Hôm nay tài khoản của tôi lời hay lỗ?');
      return;
    }

    // Handle Intent: GENERATE_REPORT
    if (parsed.intent === 'GENERATE_REPORT') {
      window.app.navigateTo('screen-reports');
      return;
    }

    // Handle Intent: GENERATE_CREATIVES
    if (parsed.intent === 'GENERATE_CREATIVES') {
      window.quickOpenCreativeStudio(parsed.slots.product || 'Giày thể thao ProMax siêu êm chân', null);
      return;
    }

    // Default: Forward to AI Assistant
    window.app.navigateTo('screen-agent');
    window.app.handleAskUserQuestion(text);
  };

  // 3. Quick Suggestion Pills Filler
  window.fillAndSubmitCmd = function(text) {
    const input = document.getElementById('cmdInputHero');
    if (input) {
      input.value = text;
      window.submitCommandCenter();
    }
  };

  // 4. Voice Simulation Toggle
  window.toggleVoiceSimulation = function() {
    const btn = document.getElementById('cmdMicBtn');
    const input = document.getElementById('cmdInputHero');
    if (!btn || !input) return;

    if (!window.app.isVoiceListening) {
      window.app.isVoiceListening = true;
      btn.className = "w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center transition animate-pulse";
      input.placeholder = "🎙️ Đang lắng nghe giọng nói của bạn... Hãy nói mục tiêu chạy ads...";
      
      // Simulate voice transcription after 2 seconds
      setTimeout(() => {
        if (window.app.isVoiceListening) {
          input.value = "Tôi muốn bán 100 đôi giày trong tháng này, ngân sách 15 triệu, chạy Facebook và TikTok";
          btn.className = "w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition";
          input.placeholder = "Tôi muốn...";
          window.app.isVoiceListening = false;
        }
      }, 2200);
    } else {
      window.app.isVoiceListening = false;
      btn.className = "w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition";
      input.placeholder = "Tôi muốn...";
    }
  };

  // 5. Submit Clarification Answer
  window.submitClarificationAnswer = function() {
    const ansInput = document.getElementById('clarificationAnswerInput');
    if (!ansInput) return;
    const ans = ansInput.value.trim();
    if (!ans) {
      alert('Vui lòng nhập câu trả lời!');
      return;
    }

    const res = window.app.clarificationMachine.answer(ans);
    const clarBox = document.getElementById('clarificationContainer');
    const qText = document.getElementById('clarificationQuestionText');

    if (res.status === 'NEED_CLARIFICATION') {
      qText.innerHTML = `<strong>🤖 AI Copilot:</strong> ${res.question}`;
      ansInput.value = '';
      ansInput.focus();
    } else if (res.status === 'READY') {
      clarBox.classList.add('hidden');
      window.renderGeneratedPlan(res.planParams);
    }
  };

  // 6. Render Generated 7-Phase Plan
  window.renderGeneratedPlan = function(params) {
    const plan = window.AdsAI.PlanGenerator.generate(params);
    window.app.currentPlan = plan;

    const planBox = document.getElementById('commandPlanBox');
    const titleHdr = document.getElementById('planTitleHeader');
    const subHdr = document.getElementById('planSubtitleHeader');
    const phasesList = document.getElementById('planPhasesList');
    const MetricsCalc = window.AdsAI.MetricsCalc;

    if (titleHdr) titleHdr.textContent = plan.campaignName;
    if (subHdr) {
      subHdr.textContent = `Mục tiêu: ${plan.targetOrders} đơn hàng • Ngân sách: ${MetricsCalc.formatVND(plan.budget)} (${plan.duration} ngày) • Kênh: Meta + TikTok`;
    }

    if (phasesList) {
      phasesList.innerHTML = plan.phases.map(p => `
        <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-extrabold text-[11px] text-indigo-700 uppercase tracking-wider">Giai đoạn ${p.phase} • ${p.name}</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${p.status === 'READY' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}">${p.status}</span>
          </div>
          <ul class="space-y-1 text-slate-600 text-[11px]">
            ${p.items.map(it => `<li class="flex items-start gap-1.5"><span class="text-indigo-500 font-bold">•</span><span>${it}</span></li>`).join('')}
          </ul>
        </div>
      `).join('');
    }

    if (planBox) {
      planBox.classList.remove('hidden');
      planBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  window.editPlanPrompt = function() {
    const input = document.getElementById('cmdInputHero');
    if (input) {
      input.focus();
      alert('Bạn có thể chỉnh sửa lại mục tiêu, sản phẩm hoặc ngân sách trong ô nhập bên trên.');
    }
  };

  // 7. Approval Center Modal Handlers
  window.pendingActionApproval = null;

  window.openApprovalModalFromPlan = function() {
    const plan = window.app.currentPlan;
    if (!plan) return;

    window.prepareActionApproval({
      title: 'Khởi tạo Chiến dịch Quảng cáo Mới',
      actions: [
        `Tạo 2 Chiến dịch chuẩn hóa: ${plan.campaignName}`,
        `Tạo 4 Ad Sets (Phân bổ 60% Meta: ${window.AdsAI.MetricsCalc.formatVND(plan.metaBudget)} • 40% TikTok: ${window.AdsAI.MetricsCalc.formatVND(plan.tiktokBudget)})`,
        `Tạo 8 Ads đa dạng biến thể nội dung Video dọc 9:16 & Carousel`,
        `Thiết lập mục tiêu CPA tối ưu <= ${window.AdsAI.MetricsCalc.formatVND(plan.targetCPA)} / đơn`
      ],
      budgetLabel: `Tổng ngân sách: ${window.AdsAI.MetricsCalc.formatVND(plan.budget)} (${plan.duration} ngày)`,
      onConfirm: async () => {
        window.startActivityCenterExecution(plan);
      }
    });
  };

  window.prepareActionApproval = function({ title, actions, budgetLabel, onConfirm }) {
    window.pendingActionApproval = onConfirm;
    const modal = document.getElementById('approvalModal');
    const list = document.getElementById('approvalModalActionsList');
    const budgetEl = document.getElementById('approvalBudgetLabel');

    if (list) {
      list.innerHTML = actions.map(act => `
        <div class="flex items-center gap-2">
          <span class="text-indigo-600 font-bold">✓</span>
          <span>${act}</span>
        </div>
      `).join('');
    }
    if (budgetEl && budgetLabel) budgetEl.textContent = budgetLabel;
    if (modal) modal.classList.remove('hidden');
  };

  window.closeApprovalModal = function() {
    const modal = document.getElementById('approvalModal');
    if (modal) modal.classList.add('hidden');
  };

  window.confirmApprovalAndExecute = async function() {
    window.closeApprovalModal();
    if (typeof window.pendingActionApproval === 'function') {
      await window.pendingActionApproval();
      window.pendingActionApproval = null;
    }
  };

  // 8. Activity Center Stepper Execution (Phase 3: Section 10)
  window.startActivityCenterExecution = function(plan) {
    const modal = document.getElementById('activityModal');
    const statusText = document.getElementById('activityModalStatusText');
    const banner = document.getElementById('activitySuccessBanner');
    const closeBtn = document.getElementById('activityCloseBtn');

    if (banner) banner.classList.add('hidden');
    if (statusText) statusText.textContent = 'Đang triển khai chiến dịch...';
    if (closeBtn) {
      closeBtn.textContent = 'Đang xử lý (vui lòng chờ)...';
      closeBtn.className = "w-full py-2.5 bg-slate-100 text-slate-400 font-bold rounded-xl cursor-not-allowed";
      closeBtn.onclick = null;
    }

    if (modal) modal.classList.remove('hidden');

    const updateStep = (idx, text, done = false) => {
      const el = document.getElementById(`act-step-${idx}`);
      if (!el) return;
      if (done) {
        el.className = "flex items-center gap-3 text-emerald-600 font-bold transition-all";
        el.children[0].className = "w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black";
        el.children[0].textContent = "✓";
      } else {
        el.className = "flex items-center gap-3 text-indigo-600 font-bold animate-pulse transition-all";
        el.children[0].className = "w-6 h-6 rounded-full border-2 border-indigo-600 text-indigo-600 flex items-center justify-center text-[10px] font-bold";
        el.children[0].textContent = "●";
      }
    };

    // Stepper sequence simulation
    setTimeout(() => updateStep(1, null, true), 300);
    setTimeout(() => updateStep(2, null, true), 800);
    setTimeout(() => updateStep(3, null, true), 1300);
    setTimeout(async () => {
      updateStep(4, null, true);
      // Actually mutate data engine
      if (plan) {
        await window.app.dataEngine.createCampaignDynamic(plan);
      }
    }, 1900);
    setTimeout(() => {
      updateStep(5, null, true);
      if (statusText) statusText.textContent = 'Hoàn tất 100%';
      if (banner) banner.classList.remove('hidden');
      if (closeBtn) {
        closeBtn.textContent = 'Xem Chiến dịch trong Quảng cáo →';
        closeBtn.className = "w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-md transition cursor-pointer";
        closeBtn.onclick = () => {
          modal.classList.add('hidden');
          window.app.navigateTo('screen-campaigns');
        };
      }
    }, 2600);
  };

  window.closeActivityModal = function() {
    const modal = document.getElementById('activityModal');
    if (modal) modal.classList.add('hidden');
  };

  // 9. Quick Actions from Action Center
  window.triggerQuickPauseAdSet = function(adSetId) {
    window.prepareActionApproval({
      title: 'Tạm dừng Ad Set hiệu quả thấp',
      actions: [
        'Tạm dừng ngay Ad Set "GenZ Streetwear - Interest Test" (Meta Ads)',
        'Lý do: CPA tăng 38% và không có chuyển đổi mới trong 48 giờ'
      ],
      budgetLabel: 'Giảm lãng phí: ~350.000₫ / ngày',
      onConfirm: async () => {
        await window.app.dataEngine.pauseEntityDynamic('adSet', adSetId);
        alert('✅ Đã tạm dừng Ad Set thành công!');
        window.app.refreshCurrentScreen();
      }
    });
  };

  window.triggerQuickScale = function(campaignId) {
    window.prepareActionApproval({
      title: 'Tăng ngân sách chiến dịch Tiềm năng (Winner)',
      actions: [
        'Tăng 15% ngân sách cho chiến dịch "Unboxing Áo Thun Oversize" (TikTok Ads)',
        'Lý do: ROAS đạt 3.50x, Hook Rate 71.8% vượt trội'
      ],
      budgetLabel: 'Ngân sách mới: 2.300.000₫ / ngày',
      onConfirm: async () => {
        await window.app.dataEngine.updateBudgetDynamic('campaign', campaignId, 2300000);
        alert('✅ Đã tăng ngân sách thành công!');
        window.app.refreshCurrentScreen();
      }
    });
  };

  window.showCauseModal = function(type) {
    window.app.navigateTo('screen-agent');
    window.app.handleAskUserQuestion('Tại sao CPA tuần này tăng?');
  };

  // 10. Undo Rollback Action
  window.undoAction = async function(logId) {
    const res = await window.app.dataEngine.revertAction(logId);
    if (res.success) {
      alert(`↩️ ${res.message}`);
      window.app.renderAgentWorkspace();
      window.app.refreshCurrentScreen();
    } else {
      alert(`❌ ${res.message}`);
    }
  };

  // 11. Autopilot Kill Switch & Tier Configuration
  window.triggerKillSwitch = function() {
    const res = window.app.autopilotManager.stopAutopilot();
    alert(`🛑 ${res.message}`);
    window.app.updateAutopilotTierUI('COPILOT');
  };

  window.setAutopilotTier = function(tier) {
    window.app.autopilotManager.setMode(tier);
    window.app.updateAutopilotTierUI(tier);
    alert(`✅ Đã thiết lập cấp độ Autopilot sang: ${tier}`);
  };

  window.switchAgentTab = function(tabName) {
    ['chat', 'activity', 'autopilot', 'rules'].forEach(t => {
      const btn = document.getElementById(`agentTabBtn-${t}`);
      const content = document.getElementById(`agentTabContent-${t}`);
      if (btn && content) {
        if (t === tabName) {
          btn.className = "px-3 py-1.5 rounded-xl bg-white text-indigo-700 shadow-xs transition font-bold";
          content.classList.remove('hidden');
        } else {
          btn.className = "px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 transition font-medium";
          content.classList.add('hidden');
        }
      }
    });

    if (tabName === 'activity') {
      window.app.renderActivityLogTable();
    } else if (tabName === 'rules') {
      window.app.renderRulesTab();
    }
  };

  // 12. OAuth 1-Click Connect Handlers
  window.openOAuthModal = function() {
    const modal = document.getElementById('oauthModal');
    if (modal) modal.classList.remove('hidden');
  };

  window.simulateOAuthConnect = function(platform) {
    const pName = platform === 'meta' ? 'Meta Ads' : 'TikTok Ads';
    const accName = platform === 'meta' ? 'Kstudy Fashion Official' : 'Kstudy Shop Vietnam';
    
    // Simulate instantaneous authorization
    alert(`🔐 Đang xác thực OAuth 2.0 với ${pName}...\n✓ Đã cấp quyền: ads_read, ads_management\n✓ Đã liên kết tài khoản: ${accName}\n=> Kết nối thành công 100%!`);
    
    window.app.dataEngine.setOAuthState(platform, { connected: true, accountName: accName, lastSynced: 'Vừa xong' });
    const modal = document.getElementById('oauthModal');
    if (modal) modal.classList.add('hidden');
    window.app.refreshCurrentScreen();
  };

  // 13. Smart Jargon Glossary Modal
  window.openJargonModal = function(term) {
    const modal = document.getElementById('jargonModal');
    if (modal) modal.classList.remove('hidden');
  };

  // 14. AI Creative & Hook Studio Global Handlers
  window.switchCreativeTab = function(tabName) {
    const studioView = document.getElementById('creativeStudioView');
    const libraryView = document.getElementById('creativeLibraryView');
    const studioBtn = document.getElementById('tabBtnCreativeStudio');
    const libraryBtn = document.getElementById('tabBtnCreativeLibrary');

    if (tabName === 'studio') {
      if (studioView) studioView.classList.remove('hidden');
      if (libraryView) libraryView.classList.add('hidden');
      if (studioBtn) {
        studioBtn.className = "px-4 py-2 rounded-xl bg-white text-indigo-700 shadow-xs transition flex items-center gap-1.5 font-bold";
      }
      if (libraryBtn) {
        libraryBtn.className = "px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5 font-bold";
      }
    } else {
      if (studioView) studioView.classList.add('hidden');
      if (libraryView) libraryView.classList.remove('hidden');
      if (studioBtn) {
        studioBtn.className = "px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5 font-bold";
      }
      if (libraryBtn) {
        libraryBtn.className = "px-4 py-2 rounded-xl bg-white text-indigo-700 shadow-xs transition flex items-center gap-1.5 font-bold";
      }
      window.app.renderCreatives();
    }
  };

  window.updateStudioPlatformUI = function() {
    const platformRadio = document.querySelector('input[name="studioPlatformRadio"]:checked');
    const isTikTok = platformRadio && platformRadio.value === 'tiktok';

    const ttLabel = document.getElementById('platformLabelTikTok');
    const metaLabel = document.getElementById('platformLabelMeta');

    if (isTikTok) {
      if (ttLabel) ttLabel.className = "relative flex items-center gap-3 p-3.5 rounded-2xl border-2 border-indigo-600 bg-indigo-50 cursor-pointer transition";
      if (metaLabel) metaLabel.className = "relative flex items-center gap-3 p-3.5 rounded-2xl border-2 border-slate-200 bg-white cursor-pointer transition hover:border-slate-300";
    } else {
      if (ttLabel) ttLabel.className = "relative flex items-center gap-3 p-3.5 rounded-2xl border-2 border-slate-200 bg-white cursor-pointer transition hover:border-slate-300";
      if (metaLabel) metaLabel.className = "relative flex items-center gap-3 p-3.5 rounded-2xl border-2 border-indigo-600 bg-indigo-50 cursor-pointer transition";
    }
  };

  window.quickFillStudioPreset = function(presetKey) {
    const prodInput = document.getElementById('studioInputProduct');
    const catInput = document.getElementById('studioInputCategory');
    const audInput = document.getElementById('studioInputAudience');
    const uspInput = document.getElementById('studioInputUsp');

    const presets = {
      sneaker: {
        product: 'Giày thể thao ProMax siêu êm chân',
        category: 'Thời trang & Phụ kiện',
        audience: 'Nam nữ 18-35 tuổi, dân văn phòng hoặc thích thể thao',
        usp: 'Đệm khí giảm chấn 95%, bảo hành 12 tháng, giảm 35% duy nhất hôm nay'
      },
      lipstick: {
        product: 'Son dưỡng có màu cấp ẩm khóa môi 12H',
        category: 'Mỹ phẩm & Làm đẹp',
        audience: 'Phái đẹp 18-40 tuổi, môi hay khô nứt, thích tự nhiên',
        usp: 'Chiết xuất bơ hạt mỡ hữu cơ, dưỡng môi căng mọng không chì, mua 1 tặng 1'
      },
      tea: {
        product: 'Trà thảo mộc thanh lọc cơ thể & nhẹ bụng',
        category: 'F&B & Thực phẩm dinh dưỡng',
        audience: 'Dân văn phòng ngồi nhiều bụng dưới to, người hay nóng trong',
        usp: '100% thảo mộc tự nhiên, hiệu quả sau 7 ngày, đổi trả miễn phí'
      },
      polo: {
        product: 'Áo thun Polo sợi cafe khử mùi chống nhăn',
        category: 'Thời trang & Phụ kiện',
        audience: 'Nam giới 22-45 tuổi, cần trang phục lịch sự, thoáng mát',
        usp: 'Công nghệ vải cafe co giãn 4 chiều, giặt máy không bai dão, freeship'
      }
    };

    const chosen = presets[presetKey];
    if (!chosen) return;

    if (prodInput) prodInput.value = chosen.product;
    if (catInput) catInput.value = chosen.category;
    if (audInput) audInput.value = chosen.audience;
    if (uspInput) uspInput.value = chosen.usp;

    window.app.generateStudioScripts();
  };

  window.triggerGenerateStudioScripts = function() {
    window.app.generateStudioScripts();
  };

  window.copyScriptToClipboard = async function(scriptIdx) {
    const data = window.app.currentGeneratedScripts;
    if (!data || !data.scripts || !data.scripts[scriptIdx]) return;
    const sc = data.scripts[scriptIdx];

    const copyText = `🎬 KỊCH BẢN QUẢNG CÁO: ${sc.angle} (Hook Score: ${sc.hookScore}/100)
------------------------------------------------
🎣 0-3 GIÂY ĐẦU (HOOK):
- Tiêu đề: "${sc.hookText}"
- Hình ảnh/Hành động: ${sc.visualAction}
- Lời thoại: ${sc.audioVoiceover}

💡 THÂN BÀI:
${sc.bodyContent}

🛒 KÊU GỌI HÀNH ĐỘNG (CTA):
${sc.cta}

🧠 TẠI SAO HOOK NÀY HIỆU QUẢ:
${sc.psychologicalTrigger || 'Tập trung kích thích cảm xúc và giữ chân người xem.'}
------------------------------------------------
(Tạo bởi NTDAds AI Marketing Agent)`;

    try {
      await navigator.clipboard.writeText(copyText);
      const btn = document.getElementById(`copyBtn_${scriptIdx}`);
      if (btn) {
        const oldHtml = btn.innerHTML;
        btn.innerHTML = `<span class="text-emerald-600 font-black">✅ Đã sao chép!</span>`;
        setTimeout(() => { btn.innerHTML = oldHtml; }, 2000);
      } else {
        alert('✅ Đã sao chép kịch bản vào bộ nhớ tạm!');
      }
    } catch (e) {
      alert(`Đã sao chép kịch bản:\n\n${copyText}`);
    }
  };

  window.applyScriptToCampaign = function(scriptIdx) {
    const data = window.app.currentGeneratedScripts;
    if (!data || !data.scripts || !data.scripts[scriptIdx]) return;
    const sc = data.scripts[scriptIdx];

    const cmdText = `Tạo chiến dịch bán ${data.product} với góc nhìn ${sc.angle}, ngân sách 10 triệu trong 30 ngày trên ${data.platform === 'tiktok' ? 'TikTok' : 'Meta'}`;
    
    window.app.navigateTo('screen-command-center');
    window.fillAndSubmitCmd(cmdText);
  };

  window.quickOpenCreativeStudio = function(product, category) {
    window.app.navigateTo('screen-creatives');
    window.switchCreativeTab('studio');
    if (product) {
      const prodInput = document.getElementById('studioInputProduct');
      if (prodInput) prodInput.value = product;
    }
    if (category) {
      const catInput = document.getElementById('studioInputCategory');
      if (catInput) catInput.value = category;
    }
    window.app.generateStudioScripts();
  };

  // 15. No-code AI Rules Global Handlers
  window.fillNlRule = function(text) {
    const input = document.getElementById('nlRuleInput');
    if (input) input.value = text;
  };

  window.createRuleFromInput = async function() {
    const input = document.getElementById('nlRuleInput');
    if (!input || !input.value.trim()) {
      alert('Vui lòng nhập câu lệnh hoặc chọn một câu lệnh mẫu!');
      return;
    }

    const text = input.value.trim();
    const btn = event?.currentTarget;
    if (btn) btn.disabled = true;

    try {
      const newRule = await window.app.rulesEngine.parseFromNaturalLanguage(text);
      window.app.rulesEngine.addRule(newRule);
      input.value = '';
      window.app.renderRulesTab();
      alert(`✅ Đã tạo thành công luật: "${newRule.name}"\nHệ thống sẽ tự động giám sát theo chu kỳ.`);
    } catch (e) {
      alert(`⚠️ Lỗi khi phân tích câu lệnh: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.toggleAutomationRule = function(ruleId) {
    const r = window.app.rulesEngine.toggleRule(ruleId);
    if (r) {
      const statusText = r.enabled ? 'ĐÃ BẬT' : 'ĐÃ TẮT';
      console.log(`Luật ${r.name}: ${statusText}`);
      window.app.renderRulesTab();
    }
  };

  window.deleteAutomationRule = function(ruleId) {
    if (confirm('Bạn có chắc chắn muốn xóa luật tự động này?')) {
      window.app.rulesEngine.deleteRule(ruleId);
      window.app.renderRulesTab();
    }
  };

  window.dryRunSingleRule = async function(ruleId) {
    const rule = window.app.rulesEngine.getRules().find(r => r.id === ruleId);
    if (!rule) return;

    const matches = await window.app.rulesEngine.evaluateSingleRule(rule);
    window.renderRuleEvaluationResults([rule], matches, true);
  };

  window.runDryRunAllRules = async function() {
    const matches = await window.app.rulesEngine.evaluateAllEnabledRules();
    const enabledRules = window.app.rulesEngine.getRules().filter(r => r.enabled);
    window.renderRuleEvaluationResults(enabledRules, matches, true);
  };

  window.executeActiveRulesNow = async function() {
    const matches = await window.app.rulesEngine.evaluateAllEnabledRules();
    if (matches.length === 0) {
      alert('✅ Quét hoàn tất: Hiện tại không có quảng cáo hoặc chiến dịch nào vi phạm điều kiện của các luật đang bật.');
      return;
    }

    const actions = matches.map(m => {
      return `${m.actionLabel} trên [${m.entityType.toUpperCase()}] "${m.entityName}" (${m.platform.toUpperCase()}) — Lý do: Chi tiêu ${window.AdsAI.MetricsCalc.formatVND(m.metrics.spend)}, ${m.metrics.conversions} đơn, ROAS ${m.metrics.roas}`;
    });

    window.prepareActionApproval({
      title: `Thực thi ${matches.length} tác vụ tự động hóa (AI Rules)`,
      actions,
      budgetLabel: `Áp dụng cho ${matches.length} đối tượng quảng cáo`,
      onConfirm: async () => {
        for (const m of matches) {
          if (m.action === 'PAUSE') {
            await window.app.dataEngine.pauseEntityDynamic(m.entityType, m.entityId);
          } else if (m.action === 'INCREASE_BUDGET') {
            const currentB = m.metrics.spend * 1.5;
            await window.app.dataEngine.updateBudgetDynamic(m.entityType, m.entityId, currentB * 1.15);
          } else if (m.action === 'DECREASE_BUDGET') {
            const currentB = m.metrics.spend * 1.5;
            await window.app.dataEngine.updateBudgetDynamic(m.entityType, m.entityId, currentB * 0.8);
          }
        }
        alert(`✅ Đã thực thi thành công ${matches.length} tác vụ tự động!`);
        window.app.refreshCurrentScreen();
        window.renderRuleEvaluationResults([], [], false);
      }
    });
  };

  window.renderRuleEvaluationResults = function(rules, matches, isDryRun = true) {
    const container = document.getElementById('rulesEvaluationResults');
    if (!container) return;

    if (matches.length === 0) {
      container.className = "p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-center justify-between";
      container.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-base">✅</span>
          <span><strong>Quét thử an toàn:</strong> Không có chiến dịch hoặc quảng cáo nào vi phạm điều kiện luật lúc này.</span>
        </div>
        <button onclick="document.getElementById('rulesEvaluationResults').classList.add('hidden')" class="text-emerald-600 hover:text-emerald-900 font-bold">✕ Đóng</button>
      `;
      container.classList.remove('hidden');
      return;
    }

    const itemsHtml = matches.map(m => `
      <div class="p-3 bg-white rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${m.platform === 'meta' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}">${m.platform.toUpperCase()}</span>
            <strong class="text-slate-900">${m.entityName}</strong>
            <span class="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">${m.entityType}</span>
          </div>
          <div class="text-[11px] text-slate-500 mt-1">
            Chỉ số: Chi tiêu ${window.AdsAI.MetricsCalc.formatVND(m.metrics.spend)} • Đơn: ${m.metrics.conversions} • ROAS: ${m.metrics.roas} • CPA: ${window.AdsAI.MetricsCalc.formatVND(m.metrics.cpa)}
          </div>
        </div>
        <div class="text-right shrink-0">
          <span class="inline-flex items-center gap-1 font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
            <span>➔ Dự kiến:</span>
            <span>${m.actionLabel}</span>
          </span>
        </div>
      </div>
    `).join('');

    container.className = "p-5 bg-amber-50/80 border-2 border-amber-300 rounded-3xl space-y-3";
    container.innerHTML = `
      <div class="flex items-center justify-between border-b border-amber-200 pb-2">
        <div class="flex items-center gap-2">
          <span class="text-base">🔍</span>
          <h5 class="font-bold text-xs uppercase tracking-wider text-amber-900">
            Kết quả quét thử: Phát hiện ${matches.length} đối tượng thỏa mãn điều kiện
          </h5>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="window.executeActiveRulesNow()" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition shadow-xs">
            ⚡ Thực thi ngay
          </button>
          <button onclick="document.getElementById('rulesEvaluationResults').classList.add('hidden')" class="text-slate-400 hover:text-slate-700 text-xs px-2">✕</button>
        </div>
      </div>
      <div class="space-y-2">
        ${itemsHtml}
      </div>
    `;
    container.classList.remove('hidden');
  };

  // Auto-boot on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    window.AdsAIApp = new AdsAIApp();
    window.AdsAIApp.init();
  });

})(window);
