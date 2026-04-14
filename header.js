(function() {
  const path = window.location.pathname;
  const isStocks     = path.includes('stocks');
  const isRnP        = path.includes('rnp');
  const isWarehouses = path.includes('warehouses');
  const isAds        = path.includes('ads');
  const isLogistics  = path.includes('logistics');
  const isRegions    = path.includes('regions');
  const isAnalysis   = path.includes('analysis');
  const isIndex      = !isStocks && !isRnP && !isWarehouses && !isAds && !isLogistics && !isRegions && !isAnalysis;

  const css = `
    .site-header { background: #0d1117; border-bottom: 1px solid #1a2333; padding: 14px 28px 0; font-family: 'Geologica', system-ui, sans-serif; }
    .site-header-top { display: flex; align-items: center; gap: 14px; padding-bottom: 12px; }
    .sh-logo { width: 44px; height: 44px; background: #cb11ab; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 900; color: #fff; box-shadow: 0 0 24px rgba(203,17,171,0.3); flex-shrink: 0; }
    .sh-name { font-size: 22px; font-weight: 800; letter-spacing: 2px; color: #dde4ee; line-height: 1.1; text-transform: uppercase; }
    .sh-sub  { font-size: 11px; color: #4a5568; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px; }
    .sh-meta { display: flex; align-items: center; gap: 10px; margin-left: auto; }
    .site-nav { display: flex; gap: 2px; }
    .site-nav a { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px 8px 0 0; font-size: 13px; font-weight: 700; letter-spacing: 0.4px; color: rgba(255,255,255,0.35); text-decoration: none; transition: all .2s; position: relative; top: 1px; border: 1px solid transparent; border-bottom: none; }
    .site-nav a:hover  { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.05); }
    .site-nav a.active { background: #080c10; color: #fff; border-color: #1a2333; border-bottom-color: #080c10; }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const header = document.createElement('div');
  header.className = 'site-header';
  header.innerHTML = `
    <div class="site-header-top">
      <div class="sh-logo">WB</div>
      <div>
        <div class="sh-name">WB Analytics</div>
        <div class="sh-sub">Trenz</div>
      </div>
    </div>
    <nav class="site-nav">
      <a href="/wb-dashboard/rnp.html"        ${isRnP        ? 'class="active"' : ''}>📈 РнП</a>
      <a href="/wb-dashboard/stocks.html"     ${isStocks     ? 'class="active"' : ''}>📦 Остатки</a>
      <a href="/wb-dashboard/warehouses.html" ${isWarehouses ? 'class="active"' : ''}>🏭 Склады</a>
      <a href="/wb-dashboard/ads.html"        ${isAds        ? 'class="active"' : ''}>📣 Реклама</a>
      <a href="/wb-dashboard/logistics.html"  ${isLogistics  ? 'class="active"' : ''}>🚚 Логистика</a>
      <a href="/wb-dashboard/regions.html"    ${isRegions    ? 'class="active"' : ''}>🗺️ Регионы</a>
      <a href="/wb-dashboard/analysis.html"   ${isAnalysis   ? 'class="active"' : ''}>🔬 Анализ</a>
      <a href="/wb-dashboard/"               ${isIndex      ? 'class="active"' : ''}>📊 Сводка</a>
    </nav>`;

  function doInsert() {
    if (document.body) {
      document.body.insertBefore(header, document.body.firstChild);
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        document.body.insertBefore(header, document.body.firstChild);
      });
    }
  }
  doInsert();
})();
