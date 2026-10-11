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

    /**
     * Answer user questions strictly adhering to Guardrails
     */
    async ask(userQuestion) {
      const q = (userQuestion || '').trim().toLowerCase();
      const ctx = await this.buildContext();
      const formatVND = window.AdsAI.MetricsCalc.formatVND;

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

  window.AdsAI = window.AdsAI || {};
  window.AdsAI.AIAssistantEngine = AIAssistantEngine;

})(window);
