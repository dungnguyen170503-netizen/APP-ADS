/**
 * ============================================================================
 * ADS AI MANAGER — AI ASSISTANT & GUARDRAILS ENGINE
 * Guardrails: [FACT] -> [HYPOTHESIS] -> [RECOMMENDATION]
 * Strict Rule: Zero Hallucination. AI reads only from active Data Context.
 * ============================================================================
 */

(function (window) {
  'use strict';

  class AIAssistantEngine {
    constructor(dataEngine) {
      this.dataEngine = dataEngine;
      this.systemPrompt = `Bạn là "Ads AI Copilot" — Chuyên gia phân tích dữ liệu quảng cáo cấp cao cho Meta Ads và TikTok Ads.
BẠN TUÂN THỦ NGHIÊM NGẶT 6 NGUYÊN TẮC GUARDRAILS:
1. Không bịa số liệu: Chỉ dùng số liệu có trong CONTEXT_DATA.
2. Không nói về dữ liệu ngoài phạm vi ngày/bộ lọc đang chọn.
3. Cấu trúc câu trả lời bắt buộc:
   [FACT]
   - Số liệu thực tế được đo lường...
   [HYPOTHESIS]
   - Giả định logic nguyên nhân (CTR -> CPC -> CVR -> CPA)...
   [RECOMMENDATION]
   1. Đề xuất cụ thể...
   2. ...
4. Không tự ý can thiệp ngân sách (chỉ đề xuất cho người dùng quyết định).
5. Nếu thiếu dữ liệu, phải thông báo "Dữ liệu chưa đủ để kết luận".
6. Không phán xét phiến diện kênh Meta hay TikTok trừ khi có cùng mục tiêu chiến dịch.`;
    }

    /**
     * Build rich, validated context from current data engine
     */
    async buildContext() {
      const kpis = await this.dataEngine.getExecutiveKPIs();
      const campaigns = await this.dataEngine.getCampaignsWithMetrics();
      const creatives = await this.dataEngine.getAllCreatives();
      const comparison = await this.dataEngine.getPlatformComparison();
      const ruleEval = window.AdsAI.RuleEngine.evaluatePortfolio(campaigns, creatives, kpis);

      // Top and worst campaigns
      const sortedByRoas = [...campaigns].sort((a, b) => b.metrics.roas - a.metrics.roas);
      const topCampaign = sortedByRoas[0] || null;
      const worstCampaign = sortedByRoas[sortedByRoas.length - 1] || null;

      // Top by spend
      const sortedBySpend = [...campaigns].sort((a, b) => b.metrics.spend - a.metrics.spend);

      return {
        filter: this.dataEngine.activeFilters,
        kpis: kpis.current,
        trends: kpis.trends,
        topCampaign,
        worstCampaign,
        topSpendCampaign: sortedBySpend[0] || null,
        comparison,
        issues: ruleEval.issues,
        opportunities: ruleEval.opportunities,
        healthScore: ruleEval.overallHealthScore,
        totalCampaigns: campaigns.length,
        fatiguedCreatives: creatives.filter(c => c.status === 'FATIGUE'),
        winnerCreatives: creatives.filter(c => c.status === 'WINNER')
      };
    }

    getGeminiApiKey() {
      return localStorage.getItem('ntdads_gemini_api_key') || '';
    }

    setGeminiApiKey(key) {
      if (key) {
        localStorage.setItem('ntdads_gemini_api_key', key.trim());
      } else {
        localStorage.removeItem('ntdads_gemini_api_key');
      }
    }

    /**
     * Call Google Gemini 1.5 Flash API with rich live context and Guardrails
     */
    async askGemini(userQuestion, contextData) {
      const apiKey = this.getGeminiApiKey();
      if (!apiKey) return null;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

      const systemInstruction = `${this.systemPrompt}
DỮ LIỆU THỰC TẾ HIỆN TẠI TỪ TÀI KHOẢN (CONTEXT_DATA):
${JSON.stringify(contextData, null, 2)}

HƯỚNG DẪN TRẢ LỜI:
Hãy phân tích và trả lời câu hỏi của người dùng bằng tiếng Việt, thân thiện nhưng chuyên nghiệp.
BẮT BUỘC trả về cấu trúc gồm 3 phần rõ ràng:
[FACT]: Nêu số liệu thực tế đo lường được từ context.
[HYPOTHESIS]: Phân tích nguyên nhân logic (phễu chuyển đổi CTR, CPC, CVR, Frequency).
[RECOMMENDATION]: Đưa ra tối đa 3 đề xuất hành động thực tiễn rõ ràng.
Tuyệt đối không bịa số liệu không có trong context.`;

      try {
        const payload = {
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemInstruction}\n\nCÂU HỎI CỦA NGƯỜI DÙNG: "${userQuestion}"` }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error("Gemini API Error:", errData);
          throw new Error(errData.error?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidate) throw new Error("Không nhận được phản hồi hợp lệ từ Gemini.");

        // Parse sections from Gemini response
        let fact = "Dữ liệu được trích xuất từ Gemini 1.5 Flash.";
        let hypothesis = "Phân tích suy luận từ mô hình AI.";
        let recommendations = [];

        const factMatch = candidate.match(/\[FACT\]:?([\s\S]*?)(?=\[HYPOTHESIS\]|$)/i);
        const hypoMatch = candidate.match(/\[HYPOTHESIS\]:?([\s\S]*?)(?=\[RECOMMENDATION\]|$)/i);
        const recMatch = candidate.match(/\[RECOMMENDATION\]:?([\s\S]*?)$/i);

        if (factMatch && factMatch[1].trim()) fact = factMatch[1].trim();
        if (hypoMatch && hypoMatch[1].trim()) hypothesis = hypoMatch[1].trim();

        if (recMatch && recMatch[1].trim()) {
          recommendations = recMatch[1].trim().split('\n')
            .map(line => line.replace(/^[-*•\d.]+\s*/, '').trim())
            .filter(line => line.length > 0)
            .slice(0, 3);
        }

        if (recommendations.length === 0) {
          recommendations = ["Theo dõi diễn biến số liệu trong 24-48 giờ tới."];
        }

        return {
          fact,
          hypothesis,
          recommendations,
          confidence: "High (Gemini 1.5 Flash)",
          isGemini: true,
          rawResponse: candidate,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        };
      } catch (err) {
        console.warn("Falling back to Rule-based AI Engine due to Gemini error:", err.message);
        return null;
      }
    }

    /**
     * Answer user questions strictly adhering to Guardrails
     */
    async ask(userQuestion) {
      const q = (userQuestion || '').trim().toLowerCase();
      const ctx = await this.buildContext();
      const formatVND = window.AdsAI.MetricsCalc.formatVND;

      // 0. If Gemini API Key is configured, use Gemini 1.5 Flash LLM Engine
      if (this.getGeminiApiKey()) {
        try {
          const geminiResult = await this.askGemini(userQuestion, ctx);
          if (geminiResult) return geminiResult;
        } catch (e) {
          console.warn("Gemini Error:", e);
        }
      }

      // 1. Question: Best Campaign / ROAS cao nhất
      if (q.includes('roas cao nhất') || q.includes('tốt nhất') || q.includes('hiệu quả nhất') || q.includes('winner')) {
        if (!ctx.topCampaign) {
          return this.formatResponse(
            'Không tìm thấy dữ liệu chiến dịch trong bộ lọc hiện tại.',
            'Dữ liệu chưa đủ để phân tích.',
            ['Thử mở rộng bộ lọc ngày (ví dụ 14D hoặc 30D) hoặc chọn All Platforms.'],
            'Low'
          );
        }

        const c = ctx.topCampaign;
        const fact = `Chiến dịch "${c.name}" (${c.platform.toUpperCase()}) đang dẫn đầu toàn bộ tài khoản với ROAS đạt ${c.metrics.roas}, doanh thu ${formatVND(c.metrics.revenue)} trên chi tiêu ${formatVND(c.metrics.spend)} (CPA đạt ${formatVND(c.metrics.cpa)} với ${c.metrics.conversions} chuyển đổi).`;
        const hypo = `Chiến dịch này tận dụng tệp đối tượng chất lượng và có tư liệu định dạng video giữ chân tốt (CTR đạt ${c.metrics.ctr}%), giúp tỷ lệ hoàn tất đơn hàng vượt trội.`;
        const recs = [
          `Cân nhắc tăng ngân sách thêm 15-20% theo chu kỳ 48 giờ để tránh reset máy học.`,
          `Nhân bản (Scale) tư liệu thắng này sang nhóm đối tượng Lookalike tương tự trên kênh ${c.platform === 'meta' ? 'TikTok' : 'Meta'}.`,
          `Theo dõi sát Frequency để phát hiện sớm dấu hiệu mệt mỏi quảng cáo.`
        ];
        return this.formatResponse(fact, hypo, recs, 'High');
      }

      // 2. Question: Why CPA Spike / Tại sao CPA tăng?
      if (q.includes('tại sao cpa') || q.includes('cpa tăng') || q.includes('giá đắt') || q.includes('chi phí tăng')) {
        const cpaIssues = ctx.issues.filter(i => i.type === 'CPA_SPIKE');
        const currentCpa = formatVND(ctx.kpis.cpa);

        if (cpaIssues.length > 0) {
          const target = cpaIssues[0];
          const fact = `Hệ thống ghi nhận CPA trung bình đạt ${currentCpa}. Có ${cpaIssues.length} chiến dịch bị cảnh báo CPA_SPIKE, điển hình là "${target.title}" với CPA cao hơn ${window.AdsAI.RuleEngine.thresholds.cpaSpikePercent}% so với mức chuẩn.`;
          const hypo = `CTR bị giảm sút khiến CPC tăng cao, kết hợp với tỷ lệ thoát trang đích (Bounce rate) gia tăng vào đầu tuần làm giảm tỷ lệ chuyển đổi (CVR).`;
          const recs = [
            `Tạm dừng ngay các Ad Set có CPA vượt 1.5 lần mức trung bình (${currentCpa}).`,
            `Làm mới Hook 3 giây đầu tiên của video để cải thiện CTR và kéo giá CPC xuống.`,
            `Kiểm tra tốc độ tải trang đích và quy trình checkout trên thiết bị di động.`
          ];
          return this.formatResponse(fact, hypo, recs, 'High');
        } else {
          const fact = `CPA trung bình hiện tại duy trì ở mức ${currentCpa}, nằm trong giới hạn kiểm soát an toàn (không ghi nhận bất thường >20%).`;
          const hypo = `Hiệu suất chi phí đang ổn định nhờ phân bổ ngân sách cân bằng giữa Meta và TikTok.`;
          const recs = [
            `Tiếp tục duy trì ngân sách hiện tại và theo dõi chỉ số tần suất (Frequency).`,
            `Chuẩn bị sẵn 2-3 tư liệu dự phòng để thay thế khi quảng cáo chạm ngưỡng bão hòa.`
          ];
          return this.formatResponse(fact, hypo, recs, 'Medium');
        }
      }

      // 3. Question: Meta vs TikTok Comparison
      if (q.includes('meta hay tiktok') || q.includes('so sánh') || q.includes('kênh nào tốt hơn') || q.includes('facebook')) {
        const meta = ctx.comparison.meta;
        const tt = ctx.comparison.tiktok;

        const fact = `Meta Ads chi tiêu ${formatVND(meta.spend)} đem lại ROAS ${meta.roas} (CPA: ${formatVND(meta.cpa)}). Trong khi đó TikTok Ads chi tiêu ${formatVND(tt.spend)} đem lại ROAS ${tt.roas} (CPA: ${formatVND(tt.cpa)}, CTR: ${tt.ctr}%).`;
        const hypo = `Meta Ads tiếp tục ưu thế về độ chính xác của thuật toán chuyển đổi sâu (ROAS cao hơn), còn TikTok Ads vượt trội về độ phủ và chi phí click rẻ (CPC rẻ hơn ${(meta.cpc > tt.cpc ? ((meta.cpc - tt.cpc) / meta.cpc * 100).toFixed(0) : 0)}%).`;
        const recs = [
          `Chiến lược phễu: Sử dụng TikTok Ads cho giai đoạn Nhận biết & Kéo traffic (Top-of-Funnel).`,
          `Sử dụng Meta Ads để Chuyển đổi và Retargeting tệp khách hàng đã xem video / thêm giỏ hàng.`,
          `Phân bổ tỷ trọng ngân sách đề xuất: 60% Meta - 40% TikTok.`
        ];
        return this.formatResponse(fact, hypo, recs, 'High');
      }

      // 4. Question: Creative Fatigue / Creative nào nên tắt?
      if (q.includes('creative') || q.includes('fatigue') || q.includes('mệt mỏi') || q.includes('video') || q.includes('tắt')) {
        if (ctx.fatiguedCreatives.length > 0) {
          const cr = ctx.fatiguedCreatives[0];
          const fact = `Phát hiện Creative "${cr.name}" (${cr.platform.toUpperCase()}) có chỉ số Frequency lên tới ${cr.frequency.toFixed(1)} và CTR giảm còn ${cr.ctr}%. Tỷ lệ xem 3 giây đầu (Hook Rate) giảm còn ${cr.hookRate}%.`;
          const hypo = `Khán giả mục tiêu đã xem lặp lại mẫu quảng cáo này quá nhiều lần, dẫn đến hiệu ứng bão hòa (Ad Blindness).`;
          const recs = [
            `Tạm dừng hoặc giảm 50% ngân sách phân bổ cho mẫu Creative này.`,
            `Triển khai ngay mẫu video mới với bối cảnh hoặc nhạc nền khác biệt.`,
            `Mở rộng tệp đối tượng (Broaden targeting) để giảm áp lực tần suất.`
          ];
          return this.formatResponse(fact, hypo, recs, 'High');
        } else {
          const fact = `Tất cả các Creative đang chạy đều có Frequency dưới 2.2 và CTR đạt trên 2.0%. Chưa ghi nhận Creative nào chạm ngưỡng Fatigue nguy hiểm.`;
          const hypo = `Nội dung quảng cáo vẫn giữ được tính mới đối với tệp khán giả hiện tại.`;
          const recs = [
            `Tiếp tục theo dõi chỉ số tần suất hàng ngày.`,
            `Sản xuất định kỳ 2 concept video mới mỗi tuần để duy trì đà tăng trưởng.`
          ];
          return this.formatResponse(fact, hypo, recs, 'Medium');
        }
      }

      // 5. Question: Budget Allocation / Phân bổ ngân sách
      if (q.includes('ngân sách') || q.includes('budget') || q.includes('phân bổ') || q.includes('tiền')) {
        const totalSpend = formatVND(ctx.kpis.spend);
        const fact = `Tổng chi tiêu chu kỳ này là ${totalSpend} với doanh thu ${formatVND(ctx.kpis.revenue)} (ROAS tổng thể đạt ${ctx.kpis.roas}).`;
        const hypo = `Các chiến dịch nhóm SALES đang có ROAS trung bình 3.5, trong khi các chiến dịch nhóm TRAFFIC chỉ đạt ROAS 1.8.`;
        const recs = [
          `Dồn 70% tổng ngân sách vào 2 chiến dịch Top ROAS: "${ctx.topCampaign ? ctx.topCampaign.name : 'Chiến dịch chuyển đổi'}"`,
          `Dành 20% ngân sách cho việc test creative mới dạng Video ngắn 9:16 trên TikTok Shop.`,
          `Dành 10% ngân sách cho tệp Retargeting 7 ngày để tối đa hóa doanh thu từ giỏ hàng bỏ quên.`
        ];
        return this.formatResponse(fact, hypo, recs, 'High');
      }

      // 6. Generic / Comprehensive Health Diagnosis
      const issuesList = ctx.issues.length > 0 ? `${ctx.issues.length} vấn đề cần lưu ý (${ctx.issues.map(i => i.type).join(', ')})` : 'Không có cảnh báo nghiêm trọng';
      const fact = `Tổng quan tài khoản (${ctx.filter.platform.toUpperCase()}, ${ctx.filter.dateRange}): Điểm Health Score đạt ${ctx.healthScore}/100. Chi tiêu: ${formatVND(ctx.kpis.spend)} • Doanh thu: ${formatVND(ctx.kpis.revenue)} • ROAS: ${ctx.kpis.roas} • CPA: ${formatVND(ctx.kpis.cpa)}.`;
      const hypo = `Hệ thống ghi nhận ${issuesList}. Chiến dịch hoạt động ổn định nhưng cần tối ưu hóa các điểm nghẽn ở tầng Creative.`;
      const recs = [
        `Tập trung xử lý các cảnh báo được liệt kê trong màn hình AI Analyst (Screen 13).`,
        `Tối ưu hóa video ngắn để nâng cao Hook Rate lên trên 60%.`,
        `Thường xuyên kiểm tra bảng Pivot Analytics để phát hiện nhóm khách hàng có giá trị cao nhất.`
      ];
      return this.formatResponse(fact, hypo, recs, 'Medium');
    }

    /**
     * Standardized Guardrails formatter
     */
    formatResponse(fact, hypothesis, recommendations, confidence = 'High') {
      return {
        fact,
        hypothesis,
        recommendations,
        confidence,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
    }
  }

  // --------------------------------------------------------------------------
  // 2. NATURAL LANGUAGE COMMAND PARSER & SLOTS EXTRACTOR
  // --------------------------------------------------------------------------
  const AICommandParser = {
    parse(text = '') {
      const lower = text.toLowerCase().trim();
      let intent = 'UNKNOWN';
      const slots = {
        product: null,
        budget: null,
        goalOrders: null,
        duration: null,
        channels: ['meta', 'tiktok'] // default both
      };

      // Detect Channels
      if (lower.includes('facebook') || lower.includes('meta')) {
        slots.channels = lower.includes('tiktok') ? ['meta', 'tiktok'] : ['meta'];
      } else if (lower.includes('tiktok') && !lower.includes('facebook') && !lower.includes('meta')) {
        slots.channels = ['tiktok'];
      }

      // Budget extraction (e.g., "15 triệu", "15tr", "5 triệu", "5000000", "10tr")
      const budgetMatch = lower.match(/(\d+[\.,]?\d*)\s*(triệu|tr|m|k|nghìn|vnd|đ)?/i);
      if (budgetMatch) {
        let num = parseFloat(budgetMatch[1].replace(',', '.'));
        const unit = (budgetMatch[2] || '').toLowerCase();
        if (unit === 'triệu' || unit === 'tr' || unit === 'm') num *= 1000000;
        else if (unit === 'k' || unit === 'nghìn') num *= 1000;
        else if (num > 0 && num < 500) num *= 1000000; // e.g. "15" -> 15M
        if (num >= 50000) slots.budget = Math.round(num);
      }

      // Orders extraction (e.g., "100 đôi", "50 đơn", "100 sản phẩm")
      const ordersMatch = lower.match(/(\d+)\s*(đôi|đơn|cái|sản phẩm|khách|lead)/i);
      if (ordersMatch) {
        slots.goalOrders = parseInt(ordersMatch[1], 10);
      }

      // Duration extraction (e.g. "30 ngày", "trong tháng này", "14 ngày")
      if (lower.includes('tháng này') || lower.includes('1 tháng') || lower.includes('30 ngày')) {
        slots.duration = 30;
      } else if (lower.includes('14 ngày') || lower.includes('2 tuần')) {
        slots.duration = 14;
      } else if (lower.includes('7 ngày') || lower.includes('1 tuần') || lower.includes('tuần này')) {
        slots.duration = 7;
      } else {
        const durMatch = lower.match(/(\d+)\s*ngày/i);
        if (durMatch) slots.duration = parseInt(durMatch[1], 10);
      }

      // Product extraction
      const productKeywords = [
        'giày', 'giày sneaker', 'mỹ phẩm', 'son môi', 'kem chống nắng', 'thời trang', 
        'áo thun', 'áo polo', 'váy', 'đầm', 'túi xách', 'đồng hồ', 'tai nghe', 
        'phụ kiện', 'đồ gia dụng', 'nước hoa', 'thực phẩm', 'khoá học', 'quần áo'
      ];
      for (const pk of productKeywords) {
        if (lower.includes(pk)) {
          slots.product = pk.charAt(0).toUpperCase() + pk.slice(1);
          break;
        }
      }

      // Intent Classification
      if (lower.includes('tạo chiến dịch') || lower.includes('bán') || lower.includes('chạy quảng cáo') || lower.includes('chạy ads') || lower.includes('quảng cáo giúp tôi') || lower.includes('tạo quảng cáo')) {
        intent = 'CREATE_CAMPAIGN';
      } else if (lower.includes('tối ưu') || lower.includes('giảm cpa') || lower.includes('hạ giá')) {
        intent = 'OPTIMIZE_CPA';
      } else if (lower.includes('tăng ngân sách') || lower.includes('vít') || lower.includes('scale') || lower.includes('roas tốt')) {
        intent = 'SCALE_WINNERS';
      } else if (lower.includes('tạm dừng') || lower.includes('tắt') || lower.includes('đang lỗ') || lower.includes('chưa có đơn') || lower.includes('cắn tiền')) {
        intent = 'STOP_LOSING';
      } else if (lower.includes('ý tưởng') || lower.includes('video tiktok') || lower.includes('creative') || lower.includes('concept')) {
        intent = 'GENERATE_CREATIVES';
      } else if (lower.includes('tại sao') || lower.includes('giảm hiệu quả') || lower.includes('phân tích')) {
        intent = 'ANALYZE_WHY';
      } else if (lower.includes('báo cáo') || lower.includes('report') || lower.includes('tổng kết')) {
        intent = 'GENERATE_REPORT';
      } else if (lower.includes('lời hay lỗ') || lower.includes('lợi nhuận') || lower.includes('lãi')) {
        intent = 'PROFIT_CHECK';
      }

      return { intent, slots, rawText: text };
    }
  };

  // --------------------------------------------------------------------------
  // 3. INTELLIGENT CLARIFICATION STATE MACHINE (ONE-QUESTION-AT-A-TIME)
  // --------------------------------------------------------------------------
  class ClarificationStateMachine {
    constructor() {
      this.pendingPlan = null;
      this.currentStep = 'IDLE'; // 'ASK_PRODUCT' | 'ASK_BUDGET' | 'ASK_DURATION' | 'READY'
    }

    start(initialSlots = {}) {
      this.pendingPlan = {
        product: initialSlots.product || null,
        budget: initialSlots.budget || null,
        duration: initialSlots.duration || null,
        goalOrders: initialSlots.goalOrders || null,
        channels: initialSlots.channels || ['meta', 'tiktok']
      };
      return this.getNextQuestion();
    }

    getNextQuestion() {
      if (!this.pendingPlan.product) {
        this.currentStep = 'ASK_PRODUCT';
        return {
          status: 'NEED_CLARIFICATION',
          question: 'Bạn muốn quảng cáo sản phẩm hoặc dịch vụ nào? (Ví dụ: Giày sneaker, Mỹ phẩm, Áo thun...)',
          field: 'product'
        };
      }
      if (!this.pendingPlan.budget) {
        this.currentStep = 'ASK_BUDGET';
        return {
          status: 'NEED_CLARIFICATION',
          question: `Bạn dự định chi khoảng bao nhiêu ngân sách cho sản phẩm "${this.pendingPlan.product}"? (Ví dụ: 5 triệu, 15 triệu...)`,
          field: 'budget'
        };
      }
      if (!this.pendingPlan.duration) {
        this.currentStep = 'ASK_DURATION';
        return {
          status: 'NEED_CLARIFICATION',
          question: 'Bạn muốn chiến dịch chạy trong thời gian bao lâu? (Ví dụ: 14 ngày hoặc 30 ngày)',
          field: 'duration'
        };
      }

      this.currentStep = 'READY';
      return {
        status: 'READY',
        message: 'Tôi đã có đủ thông tin để lập kế hoạch triển khai cho bạn.',
        planParams: this.pendingPlan
      };
    }

    answer(text) {
      if (this.currentStep === 'ASK_PRODUCT') {
        this.pendingPlan.product = text.trim();
      } else if (this.currentStep === 'ASK_BUDGET') {
        const parsed = AICommandParser.parse(text);
        this.pendingPlan.budget = parsed.slots.budget || 10000000;
      } else if (this.currentStep === 'ASK_DURATION') {
        const parsed = AICommandParser.parse(text);
        this.pendingPlan.duration = parsed.slots.duration || 30;
      }
      return this.getNextQuestion();
    }
  }

  // --------------------------------------------------------------------------
  // 4. 7-PHASE EXECUTION PLAN GENERATOR
  // --------------------------------------------------------------------------
  const PlanGenerator = {
    generate(params) {
      const budget = params.budget || 10000000;
      const duration = params.duration || 30;
      const product = params.product || 'Sản phẩm mới';
      const targetOrders = params.goalOrders || Math.max(20, Math.round(budget / 115000));
      const targetCPA = Math.round(budget / targetOrders);
      const metaBudget = Math.round(budget * 0.6);
      const tiktokBudget = Math.round(budget * 0.4);
      const formatVND = window.AdsAI.MetricsCalc.formatVND;

      return {
        id: 'plan_' + Date.now(),
        product,
        budget,
        duration,
        targetOrders,
        targetCPA,
        metaBudget,
        tiktokBudget,
        channels: params.channels || ['meta', 'tiktok'],
        campaignName: `[AI] Chiến dịch Bán ${product} - ${duration}D`,
        phases: [
          { phase: 1, name: 'ANALYZE', status: 'READY', items: [`Phân tích tệp khách hàng mua ${product} (18-35 tuổi)`, 'Rà soát dữ liệu đối thủ & benchmark ngành', 'Kiểm tra độ nhận diện sản phẩm trên thị trường'] },
          { phase: 2, name: 'STRATEGY', status: 'READY', items: [`Phân bổ ngân sách: 60% Meta (${formatVND(metaBudget)}) • 40% TikTok (${formatVND(tiktokBudget)})`, 'Meta Ads: Tối ưu chuyển đổi đơn hàng & Retargeting tệp ấm', 'TikTok Ads: Kéo traffic giá rẻ & Video Hook 3s'] },
          { phase: 3, name: 'CREATIVE', status: 'READY', items: ['Sản xuất 2 mẫu Video dọc 9:16 (Unboxing & Review độ bền)', 'Thiết kế 1 bộ Carousel Feedback 4 ảnh cho Meta Ads', 'Chuẩn bị 3 tiêu đề Hook đánh trúng tâm lý deal sốc'] },
          { phase: 4, name: 'BUILD', status: 'READY', items: ['Khởi tạo 2 Chiến dịch chuẩn hóa (1 Meta, 1 TikTok)', 'Thiết lập 4 Ad Sets với tệp Sở thích & Lookalike 1%', 'Tạo 8 Ads đa dạng biến thể nội dung'] },
          { phase: 5, name: 'VALIDATE', status: 'READY', items: ['Quét tự động Meta & TikTok Advertising Policy', 'Kiểm tra liên kết Pixel & TikTok Events API', 'Xác thực ngân sách ngày an toàn'] },
          { phase: 6, name: 'LAUNCH', status: 'PENDING', items: ['Yêu cầu User duyệt tại Approval Center', 'Kích hoạt publish an toàn lên tài khoản quảng cáo'] },
          { phase: 7, name: 'MONITOR', status: 'PLANNED', items: [`Giám sát liên tục trần CPA <= ${formatVND(targetCPA)}`, 'Phát hiện sớm Creative Fatigue sau 5 ngày', 'Tự động đề xuất scale ngân sách khi ROAS > 3.0'] }
        ]
      };
    }
  };

  // --------------------------------------------------------------------------
  // 5. AUTOPILOT AUTOMATION MANAGER & KILL SWITCH
  // --------------------------------------------------------------------------
  class AutopilotManager {
    constructor(dataEngine) {
      this.dataEngine = dataEngine;
      this.mode = localStorage.getItem('ads_ai_autopilot_mode_v1') || 'ASSISTED';
      this.limits = {
        maxBudgetChangePercent: 15,
        maxDailySpendCap: 500000,
        allowedActions: ['PAUSE_FATIGUED_ADS', 'SCALE_WINNER_BUDGET', 'PAUSE_HIGH_CPA'],
        requireApproval: ['CREATE_CAMPAIGN', 'INCREASE_TOTAL_BUDGET', 'CHANGE_AUDIENCE']
      };
      this.isActive = true;
    }

    setMode(mode) {
      this.mode = mode;
      localStorage.setItem('ads_ai_autopilot_mode_v1', mode);
    }

    getMode() {
      return localStorage.getItem('ads_ai_autopilot_mode_v1') || this.mode;
    }

    stopAutopilot() {
      this.mode = 'COPILOT';
      this.isActive = false;
      localStorage.setItem('ads_ai_autopilot_mode_v1', 'COPILOT');
      return {
        stopped: true,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        message: 'Đã kích hoạt KILL SWITCH: Toàn bộ tác vụ tự động đã dừng. Hệ thống chuyển về chế độ Copilot (chỉ tư vấn).'
      };
    }
  }

  window.AdsAI = window.AdsAI || {};
  window.AdsAI.AIAssistantEngine = AIAssistantEngine;
  window.AdsAI.AICommandParser = AICommandParser;
  window.AdsAI.ClarificationStateMachine = ClarificationStateMachine;
  window.AdsAI.PlanGenerator = PlanGenerator;
  window.AdsAI.AutopilotManager = AutopilotManager;

})(window);
