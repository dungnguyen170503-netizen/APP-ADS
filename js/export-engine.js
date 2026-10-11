/**
 * ============================================================================
 * ADS AI MANAGER — EXPORT & REPORTING ENGINE
 * Supports: CSV download (BOM UTF-8), Multi-sheet Excel (.xlsx via SheetJS),
 * and A4 Print / PDF Document generation.
 * ============================================================================
 */

(function (window) {
  'use strict';

  const ExportEngine = {
    /**
     * Export active filtered campaigns to clean CSV
     */
    exportCampaignsToCSV(campaigns, filename = 'AdsAI_Campaigns.csv') {
      const headers = ['ID', 'Platform', 'Campaign Name', 'Status', 'Objective', 'Spend (VND)', 'Revenue (VND)', 'ROAS', 'CPA (VND)', 'CTR (%)', 'CPC (VND)', 'CPM (VND)', 'Conversions'];
      
      const rows = campaigns.map(c => [
        c.id,
        c.platform.toUpperCase(),
        `"${c.name.replace(/"/g, '""')}"`,
        c.status,
        c.objective,
        c.metrics.spend,
        c.metrics.revenue,
        c.metrics.roas,
        c.metrics.cpa,
        c.metrics.ctr,
        c.metrics.cpc,
        c.metrics.cpm,
        c.metrics.conversions
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      this.triggerDownload(csvContent, filename, 'text/csv;charset=utf-8;');
    },

    /**
     * Export active Pivot Table to CSV
     */
    exportPivotToCSV(pivotData, dimensionName = 'Dimension', filename = 'AdsAI_Pivot_Report.csv') {
      const headers = [dimensionName, 'Spend (VND)', 'Revenue (VND)', 'ROAS', 'CPA (VND)', 'CTR (%)', 'CPC (VND)', 'CPM (VND)', 'Conversions'];
      const rows = pivotData.map(p => [
        `"${p.dimensionValue.replace(/"/g, '""')}"`,
        p.metrics.spend,
        p.metrics.revenue,
        p.metrics.roas,
        p.metrics.cpa,
        p.metrics.ctr,
        p.metrics.cpc,
        p.metrics.cpm,
        p.metrics.conversions
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      this.triggerDownload(csvContent, filename, 'text/csv;charset=utf-8;');
    },

    /**
     * Export multi-tab Excel Workbook (.xlsx) using SheetJS
     */
    exportFullExcelWorkbook(kpis, campaigns, adSets, ads, creatives, filename = 'AdsAI_Executive_Report.xlsx') {
      if (typeof XLSX === 'undefined') {
        alert('Thư viện SheetJS chưa được tải. Vui lòng kiểm tra kết nối mạng hoặc xuất file CSV.');
        return;
      }

      const wb = XLSX.utils.book_new();

      // 1. Executive Summary Sheet
      const summaryData = [
        ['BÁO CÁO HIỆU SUẤT QUẢNG CÁO TỔNG HỢP — ADS AI MANAGER'],
        ['Ngày xuất báo cáo:', new Date().toLocaleString('vi-VN')],
        ['Phạm vi:', 'Unified Data Model (Meta Ads + TikTok Ads)'],
        [],
        ['CHỈ SỐ KPI CHÍNH', 'GIÁ TRỊ'],
        ['Tổng Chi tiêu (Spend)', kpis.spend],
        ['Tổng Doanh thu (Revenue)', kpis.revenue],
        ['ROAS Trung bình', kpis.roas],
        ['Giá mỗi Chuyển đổi (CPA)', kpis.cpa],
        ['Tỷ lệ nhấp (CTR %)', kpis.ctr],
        ['Giá mỗi lượt nhấp (CPC)', kpis.cpc],
        ['Chi phí 1000 lượt hiển thị (CPM)', kpis.cpm],
        ['Tổng số Chuyển đổi (Conversions)', kpis.conversions],
        ['Lượt hiển thị (Impressions)', kpis.impressions],
        ['Lượt tiếp cận (Reach)', kpis.reach]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // 2. Campaigns Sheet
      const cmpHeader = ['ID', 'Platform', 'Tên Chiến dịch', 'Trạng thái', 'Mục tiêu', 'Chi tiêu', 'Doanh thu', 'ROAS', 'CPA', 'CTR (%)', 'CPC', 'CPM', 'Chuyển đổi', 'Health Score'];
      const cmpRows = campaigns.map(c => [
        c.id, c.platform.toUpperCase(), c.name, c.status, c.objective,
        c.metrics.spend, c.metrics.revenue, c.metrics.roas, c.metrics.cpa,
        c.metrics.ctr, c.metrics.cpc, c.metrics.cpm, c.metrics.conversions, c.healthScore || 80
      ]);
      const wsCmp = XLSX.utils.aoa_to_sheet([cmpHeader, ...cmpRows]);
      XLSX.utils.book_append_sheet(wb, wsCmp, 'Campaigns');

      // 3. Ad Sets Sheet
      const setHeader = ['ID', 'Campaign ID', 'Platform', 'Tên Ad Set / Nhóm', 'Tệp Khán giả', 'Chi tiêu', 'Doanh thu', 'ROAS', 'CPA', 'CTR (%)', 'CPC', 'Chuyển đổi'];
      const setRows = adSets.map(s => [
        s.id, s.campaignId, s.platform.toUpperCase(), s.name, s.audience || '',
        s.metrics.spend, s.metrics.revenue, s.metrics.roas, s.metrics.cpa,
        s.metrics.ctr, s.metrics.cpc, s.metrics.conversions
      ]);
      const wsSet = XLSX.utils.aoa_to_sheet([setHeader, ...setRows]);
      XLSX.utils.book_append_sheet(wb, wsSet, 'Ad_Sets');

      // 4. Ads Sheet
      const adsHeader = ['ID', 'Ad Set ID', 'Campaign ID', 'Platform', 'Tên Mẫu Quảng cáo', 'Chi tiêu', 'CTR (%)', 'CPC', 'CPA', 'ROAS', 'Trạng thái'];
      const adsRows = ads.map(a => [
        a.id, a.adSetId, a.campaignId, a.platform.toUpperCase(), a.name,
        a.metrics.spend, a.metrics.ctr, a.metrics.cpc, a.metrics.cpa, a.metrics.roas, a.status
      ]);
      const wsAds = XLSX.utils.aoa_to_sheet([adsHeader, ...adsRows]);
      XLSX.utils.book_append_sheet(wb, wsAds, 'Ads');

      // 5. Creatives Sheet
      const crHeader = ['ID', 'Platform', 'Tên Creative', 'Định dạng', 'Phân loại', 'Hook Rate (%)', 'Hold Rate (%)', 'CTR (%)', 'ROAS', 'CPA', 'Tần suất (Frequency)'];
      const crRows = creatives.map(cr => [
        cr.id, cr.platform.toUpperCase(), cr.name, cr.format, cr.status,
        cr.hookRate, cr.holdRate, cr.ctr, cr.roas, cr.cpa, cr.frequency
      ]);
      const wsCr = XLSX.utils.aoa_to_sheet([crHeader, ...crRows]);
      XLSX.utils.book_append_sheet(wb, wsCr, 'Creatives');

      // Write file and trigger download
      XLSX.writeFile(wb, filename);
    },

    /**
     * Browser download helper
     */
    triggerDownload(content, filename, mimeType) {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },

    /**
     * Print / Save PDF
     */
    printReport() {
      window.print();
    }
  };

  window.AdsAI = window.AdsAI || {};
  window.AdsAI.ExportEngine = ExportEngine;

})(window);
