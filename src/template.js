/**
 * ===================================================
 * 📈 Google アナリティクス (GA4) の設定
 * ===================================================
 */
const GA_TRACKING_ID = 'G-1Z5RQ06GCN'; 

function getAnalyticsTag() {
    if (!GA_TRACKING_ID) return '';
    return `
    <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${GA_TRACKING_ID}');
    </script>
    `;
}

/**
 * 🔒 【超強力アドブロック対策】
 * ブロッカーの文字列スキャンを回避するため、URLを一時的にBase64で暗号化（隠蔽）する関数
 */
 /*
function encryptStr(str) {
	return str;　//難読化しなくてもアフィリ表示されたため平文とする
    //if (!str) return '';
    //return Buffer.from(str).toString('base64');
}
*/
/**
 * 🚀 【全ページ共通】
 * 暗号化された画像とURLを、ブラウザ上でアドブロックをすり抜けて復元・注入するスクリプト
 */
 /*
function getBypassScript() {
    return `
    <script>
    document.addEventListener("DOMContentLoaded", function() {
        // Base64を復元するヘルパー
        function decode(b64) {
        	return b64; //難読化しなくてもアフィリ表示されたため平文とする
    		//try { return decodeURIComponent(escape(atob(b64))); } catch(e) { return ""; }
        }
        
        // 1. すべての隠蔽リンク（クラス: er-safe-lnk）を復元
        document.querySelectorAll(".er-safe-lnk").forEach(function(el) {
            var rawLurl = decode(el.getAttribute("data-enc-lurl") || "");
            var afId = el.getAttribute("data-enc-af") || "132815-990";
            if (rawLurl) {
                var perfectUrl = "https://al.fanza.co.jp/?lurl=" + encodeURIComponent(rawLurl) + "&af_id=" + afId + "&ch=api";
                el.setAttribute("href", perfectUrl);
            }
        });

        // 2. すべての隠蔽画像（クラス: er-safe-img）を復元
        document.querySelectorAll(".er-safe-img").forEach(function(el) {
            var srcUrl = decode(el.getAttribute("data-enc-src") || "");
            if (srcUrl) {
                el.setAttribute("src", srcUrl);
            }
        });
    });
    </script>
    `;
}
*/
	
function makeStarString(rating) {
    const score = parseFloat(rating) || 0;
    const fullStars = Math.floor(score);
    const hasHalf = score % 1 >= 0.4;
    let stars = '⭐'.repeat(fullStars);
    if (hasHalf && fullStars < 5) stars += '🌟';
    return stars || '⭐';
}

/**
 * 📖 個別レビュー詳細ページの生成（レコメンド ＆ OGP強化版）
 */
function generateSinglePostHTML(article, siteTitle, recommendArticles = []) {
    const allTags = article.pageGenres || [];
    const mainVisibleBadges = allTags.slice(0, 5).map(t => 
        `<a href="../tags/${t}.html" class="bg-rose-600 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-sm hover:bg-rose-700 transition-all"># ${t}</a>`
    ).join(' ');

    const officialBadgesHtml = allTags.length > 0
        ? allTags.map(g => `<a href="../tags/${g}.html" class="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-xs font-medium hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors">#${g}</a>`).join(' ')
        : '<span class="text-xs text-slate-400">なし</span>';

    // 👤 購入者の口コミを吹き出し風に変換
    let reviewsHtml = '';
    if (article.reviews && article.reviews !== '（ネタバレなしレビューなし）') {
        const reviewList = article.reviews.split('---');
        reviewsHtml = reviewList.map((rev, idx) => {
            const cleanRev = rev.trim();
            if (!cleanRev) return '';
            return `
            <div class="flex items-start gap-3 my-4">
                <div class="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 border border-rose-200 shadow-sm">
                    <svg class="w-4 h-4 text-rose-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5-4-8-4z"/>
                    </svg>
                </div>
                <div class="relative bg-rose-50/60 border border-rose-100/70 rounded-2xl p-3 text-xs sm:text-sm text-slate-700 leading-relaxed max-w-[85%] shadow-sm">
                    <div class="absolute top-3 -left-1.5 w-3 h-3 bg-rose-50 border-l border-b border-rose-100/70 rotate-45"></div>
                    ${cleanRev}
                </div>
            </div>
            `;
        }).join('\n');
    } else {
        reviewsHtml = '<p class="text-xs text-slate-400 italic pl-1">現在、この作品に購入者レビューはありません。</p>';
    }

    // 💖 関連記事（レコメンド）の組み立て
    let recommendHtml = '';
	if (recommendArticles.length > 0) {
        const recCards = recommendArticles.map(rec => {
            // ✨ 変更：画像の暗号化処理（encryptStr）を完全に廃止し、生のURLをそのまま使用します
            return `
            <a href="${rec.id}.html" class="group bg-slate-50 border border-slate-100 rounded-2xl p-3 flex gap-4 items-center hover:bg-rose-50/30 hover:border-rose-100 transition-all shadow-sm">
                
                <div class="w-20 h-28 bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                    <img class="w-full h-full object-cover" src="${rec.imgUrl}" alt="関連表紙" loading="lazy">
                </div>
                
                <div class="min-w-0 flex-1 h-28 flex flex-col justify-center py-1">
                    <h4 class="text-sm sm:text-base font-black text-slate-800 line-clamp-2 group-hover:text-rose-600 transition-colors leading-snug mb-1">
                        ${rec.title || rec.originalTitle}
                    </h4>
                    <div class="text-xs text-amber-500 font-bold">⭐ ${rec.reviewRating || '4.0'}<span class="text-[11px] text-slate-400 font-normal ml-1">(${rec.reviewCount || '0'}件)</span></div>
                </div>
            </a>
            `;
        }).join('\n');

        recommendHtml = `
        <div class="mt-8 pt-6 border-t border-dashed border-slate-200">
            <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <span>🍑 こちらの羞恥作品も絶対にオススメ！</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                ${recCards}
            </div>
        </div>
        `;
    }

    const starIcons = makeStarString(article.reviewRating);
    const googleAnalyticsCode = getAnalyticsTag();
    //const bypassScript = getBypassScript();

    let rawLurl = '';
    try {
        const u = new URL(article.link);
        rawLurl = u.searchParams.get('lurl') || article.link;
    } catch(e) {
        rawLurl = article.link;
    }

    //const encLurl = encryptStr(rawLurl);
    //const encImg = encryptStr(article.imgUrl);
	const rawDateStr = article.createdAt || '不明';
    let formattedDate = '不明';
    if (rawDateStr !== '不明') {
        // 🔍 正規表現で日本語や余計な時間を無視し、「数字4桁-2桁-2桁」だけを抜き出す
        const match = String(rawDateStr).match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
        if (match) {
            // 「2024/11/11」の形に綺麗に整形！
            formattedDate = `${match[1]}/${match[2]}/${match[3]}`;
        } else {
            // 万が一パースできなかった時の安全策
            formattedDate = rawDateStr;
        }
    }
    
    const afId = "132815-990";
    const perfectAflink = "https://al.fanza.co.jp/?lurl=" + encodeURIComponent(rawLurl) + "&af_id=" + afId + "&ch=api";
    
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.originalTitle} - レビュー | ${siteTitle}</title>
    
    <meta property="og:site_name" content="${siteTitle}">
    <meta property="og:title" content="【⭐${article.reviewRating || '4.0'}絶賛】${article.originalTitle} の狂おしい魅力を徹底レビュー！">
    <meta property="og:description" content="言葉責め・公開羞恥の興奮ポイントをエロ同人ソムリエが熱量MAXで解説。購入者のリアルな口コミも掲載中！">
    <meta property="og:image" content="${article.imgUrl}">
    <meta property="og:type" content="article">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="【⭐${article.reviewRating || '4.0'}絶賛】${article.originalTitle} のレビュー">
    <meta name="twitter:description" content="エロ同人ソムリエによるガチ執筆レビュー。サクサク読めるスマホ最適化済み！">
    <meta name="twitter:image" content="${article.imgUrl}">

    <script src="https://cdn.tailwindcss.com"></script>
    ${googleAnalyticsCode}
</head>
<body class="bg-[#fffbfb] text-slate-900 antialiased min-h-screen overflow-x-hidden">
    <header class="bg-slate-950 text-white py-6 px-4 border-b border-rose-950">
        <div class="max-w-4xl mx-auto flex justify-between items-center">
            <a href="../index.html" class="text-sm font-bold text-rose-400 hover:text-rose-300">← ${siteTitle} トップへ</a>
            <span class="text-xs font-bold text-rose-500 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30">18+ ONLY</span>
        </div>
    </header>
	<main class="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <article class="bg-white rounded-2xl shadow-sm border border-rose-100 p-5 sm:p-10 flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
            
            <div class="md:w-2/5 self-start space-y-4 shrink-0 w-full block">
                
                <a href="${perfectAflink}" rel="sponsored nofollow noopener" target="_blank" class="w-full block bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden p-2 text-center shadow-md transition-transform active:scale-[0.99]">
                    <img src="${article.imgUrl}" alt="表紙" class="w-full h-auto max-h-[500px] object-contain mx-auto rounded-xl" loading="lazy">
                </a>
                
                <div class="bg-rose-50/50 border border-rose-100 p-3 rounded-xl text-center w-full block">
                    <div class="text-xs font-bold text-rose-900 mb-1">ユーザー評価</div>
                    <div class="flex items-center justify-center gap-1">
                        <span class="text-lg">${starIcons}</span>
                        <span class="text-base font-extrabold text-slate-800 ml-1">${article.reviewRating || '0.0'}</span>
                        <span class="text-xs text-slate-400">(${article.reviewCount || 0}件)</span>
                    </div>
                </div>

                <div class="block w-full space-y-2.5 pt-2">
                    <a href="${perfectAflink}" rel="sponsored nofollow noopener" target="_blank" class="flex items-center justify-center bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 color-[#fff] text-white py-3.5 px-6 rounded-full font-black text-sm text-center shadow-lg transition-all active:scale-95 w-full">
                        FANZAで見る →
                    </a>
                    <a href="${perfectAflink}" rel="sponsored nofollow noopener" target="_blank" class="flex items-center justify-center bg-white text-rose-500 border-2 border-rose-400 hover:bg-rose-50/50 py-3 px-6 rounded-full font-bold text-sm text-center transition-all active:scale-95 w-full">
                        無料の試し読みはこちら
                    </a>
                </div>
            </div>
            
            <div class="md:w-2/3 flex flex-col min-w-0 w-full mt-2 md:mt-0">
                <h1 class="text-lg sm:text-xl font-extrabold text-slate-900 mb-3 leading-snug">${article.originalTitle}</h1>
                
                <div class="mb-4 space-y-1 text-xs border-b border-dashed border-rose-100 pb-3">
                    ${article.series ? `<div class="text-slate-500"><span class="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded mr-1.5">シリーズ名</span>${article.series}</div>` : ''}
                    <div class="text-slate-500"><span class="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded mr-1.5">作家</span>${article.author || '不明'}</div>
                    ${article.label ? `<div class="text-slate-500"><span class="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded mr-1.5">レーベル</span>${article.label}</div>` : ''}
                    <div class="text-slate-500"><span class="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded mr-1.5">出版社</span>${article.publisher || '不明'}</div>
                    <div class="text-slate-500"><span class="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded mr-1.5">カテゴリー</span>${article.category || 'アダルトマンガ'}</div>
                    <div class="text-slate-500"><span class="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded mr-1.5">配信日</span>${formattedDate}</div>
                </div>

                <div class="mb-4">
                    <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">主要属性</div>
                    <div class="flex flex-wrap gap-1.5">${mainVisibleBadges}</div>
                </div>

                <div class="text-slate-700 text-sm border-t border-rose-50 pt-4 mb-6">
                    ${article.summary ? article.summary.replace(/<\/b([^>])/g, '</b>$1') : ''}
                </div>

                <div class="mb-6 border-t border-dashed border-slate-100 pt-4">
                    <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">購入者のリアルな口コミ</div>
                    <div class="space-y-1">
                        ${reviewsHtml}
                    </div>
                </div>

                ${recommendHtml}

                <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 group cursor-pointer transition-all duration-300 hover:bg-rose-50/20 hover:border-rose-100 mt-6">
                    <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex justify-between items-center">
                        <span>公式タグ一覧 (${allTags.length}個)</span>
                        <span class="text-[10px] text-rose-500 font-semibold group-hover:hidden">⏳ タップ・ホバーで全表示</span>
                        <span class="text-[10px] text-slate-400 font-normal hidden group-hover:inline">すべてのタグを展開中...</span>
                    </div>
                    <div class="flex flex-wrap gap-1 max-h-7 overflow-hidden group-hover:max-h-[600px] transition-all duration-500 ease-in-out">
                        ${officialBadgesHtml}
                    </div>
                </div>

            </div>
        </article>
    </main>
</body>
</html>`;
}

/**
 * 🏷️ タグ別一覧ページの生成
 */
function generateTagPageHTML(tagName, articles) {
    const cards = articles.map(article => {
        let rawLurl = '';
        try { const u = new URL(article.link); rawLurl = u.searchParams.get('lurl') || article.link; } catch(e) { rawLurl = article.link; }
        //const encLurl = encryptStr(rawLurl);
        //const encImg = encryptStr(article.imgUrl);
		const rawDateStr = article.createdAt || '不明';
    	let formattedDate = '不明';
    	if (rawDateStr !== '不明') {
    	    // 🔍 正規表現で日本語や余計な時間を無視し、「数字4桁-2桁-2桁」だけを抜き出す
    	    const match = String(rawDateStr).match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
    	    if (match) {
    	        // 「2024/11/11」の形に綺麗に整形！
    	        formattedDate = `${match[1]}/${match[2]}/${match[3]}`;
    	    } else {
    	        // 万が一パースできなかった時の安全策
    	        formattedDate = rawDateStr;
    	    }
    	}
    	const afId = "132815-990";
        const perfectAflink = "https://al.fanza.co.jp/?lurl=" + encodeURIComponent(rawLurl) + "&af_id=" + afId + "&ch=api";
        return `
        <article class="bg-white rounded-xl shadow-sm border border-rose-100 p-2.5 flex gap-2.5 items-center">
			<div class="w-36 h-48 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                <a href="${perfectAflink}" rel="sponsored nofollow noopener" target="_blank" class="w-full h-full block">
                    <img src="${article.imgUrl}" alt="${article.originalTitle}の表紙" class="w-full h-full object-cover" loading="lazy">
                </a>
            </div>
            <div class="min-w-0 flex-1 flex flex-col justify-between self-stretch py-0.5">
                <div class="space-y-1.5">
                    <h3 class="text-[13px] sm:text-sm font-bold text-slate-900 leading-snug overflow-hidden" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${article.originalTitle}</h3>
                    <div class="text-[11px] text-amber-500 font-bold">⭐ ${article.reviewRating || '4.0'}(${article.reviewCount || '0'}件)</div>
                    <div class="flex flex-wrap gap-0.5">
                        ${(article.tags || []).slice(0, 2).map(t => `<span class="text-[9px] bg-slate-50 text-slate-500 px-1 py-0.2 rounded border border-slate-100 truncate max-w-[55px]">#${t}</span>`).join('')}
                    </div>
                    <div class="text-[11px] text-slate-500 space-y-0.5 pt-0.5 leading-normal border-l-2 border-rose-100 pl-1.5">
                        <div class="truncate"><span class="font-bold text-slate-700">作家:</span> ${article.author || '不明'}</div>
                        <div class="truncate"><span class="font-bold text-slate-700">出版社:</span> ${article.publisher || '不明'}</div>
                        <div class="truncate"><span class="font-bold text-slate-700">カテゴリ:</span> ${article.category || 'アダルトマンガ'}</div>
                        <div class="truncate"><span class="font-bold text-slate-700">配信日:</span> ${formattedDate}</div>
                    </div>
                </div>
				<div class="flex gap-2 w-full pt-1.5">
                    <a href="../posts/${article.id}.html" class="py-1.5 bg-rose-50 text-rose-600 font-bold rounded-full text-[11px] border border-rose-100 hover:bg-rose-100 text-center flex-1 transition-colors">🔎 レビュー</a>
                    <a href="${perfectAflink}" rel="sponsored nofollow noopener" target="_blank" class="py-1.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black rounded-full text-[11px] text-center flex-1 shadow-sm transition-transform active:scale-95">FANZA</a>
                </div>
            </div>
        </article>
        `;
    }).join('\n');

    const googleAnalyticsCode = getAnalyticsTag();
    //const bypassScript = getBypassScript();

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>タグ: ${tagName} のおすすめコミック一覧</title>
    <script src="https://cdn.tailwindcss.com"></script>
    ${googleAnalyticsCode}
</head>
<body class="bg-[#fffbfb] text-slate-900 antialiased min-h-screen overflow-x-hidden">
    <main class="max-w-3xl mx-auto px-4 py-12">
        <a href="../index.html" class="text-xs font-bold text-rose-500 hover:underline">← 総合トップに戻る</a>
        <h1 class="text-xl font-extrabold text-slate-900 mt-4 mb-8 flex items-center gap-2">
            <span class="px-3 py-1 bg-rose-600 text-white rounded-lg text-sm">#</span>
            <span>タグ: 「${tagName}」 の一覧（${articles.length}件）</span>
        </h1>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${cards}</div>
    </main>
</body>
</html>`;
}

// 💡検索結果ページ生成（あなたのデータ構造に100%最適化 ＆ アドブロック完全回避版）
function generateSearchPageHTML(SITE_TITLE) {
    return `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>検索結果 | ${SITE_TITLE}</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-50 text-slate-900 overflow-x-hidden">
        
        <header class="bg-slate-950 text-white py-6 px-4 border-b border-rose-950">
            <div class="max-w-4xl mx-auto flex justify-between items-center">
                <a href="index.html" class="text-sm font-bold text-rose-400 hover:text-rose-300">← ${SITE_TITLE} トップへ</a>
                <span class="text-xs font-bold text-rose-500 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30">18+ ONLY</span>
            </div>
        </header>

        <main class="max-w-4xl mx-auto px-4 py-8">
            <h1 class="text-base font-black border-l-4 border-rose-500 pl-2 mb-6 text-slate-800">
                「<span id="target-keyword" class="text-rose-600">...</span>」の検索結果
            </h1>
            
            <p id="search-meta" class="text-xs text-slate-400 mb-4">該当件数: <span id="search-count" class="font-bold text-slate-700">0</span>件</p>

            <div id="search-results-target" class="flex flex-col gap-3">
            </div>
        </main>

        <script>
        	/*
            // 🔒 アドブロック回避用の暗号化・復元関数
            function encryptStr(str) {
                if (!str) return '';
                return btoa(unescape(encodeURIComponent(str)));
            }

            function decode(b64) {
                try { return decodeURIComponent(escape(atob(b64))); } catch(e) { return ""; }
            }
*/
            document.addEventListener('DOMContentLoaded', async () => {
                // 先に画面の描画先（ターゲット要素）を確実に取得
                const targetEl = document.getElementById('search-results-target');

                // ① URLから「?q=キーワード」を取得
                const params = new URLSearchParams(window.location.search);
                const query = params.get('q')?.trim().toLowerCase() || '';
                
                if (!query) {
                    document.getElementById('target-keyword').textContent = '未入力';
                    if (targetEl) targetEl.innerHTML = '<p class="text-xs text-slate-400 py-12 text-center">検索キーワードを入力してください。</p>';
                    return;
                }
                
                document.getElementById('target-keyword').textContent = query;

                try {
                    // ② データベース「db.json」を読み込む
                    const response = await fetch('db.json');
                    if (!response.ok) throw new Error('db.json の読み込みに失敗しました');
                    const articles = await response.json();

                    // ③ キーワード絞り込み（あなたのdb.jsonのプロパティ構造に100%適合）
                    const filtered = articles.filter(art => {
                        // タイトルで探す
                        const title = art.title ? art.title.toLowerCase() : '';
                        const originalTitle = art.originalTitle ? art.originalTitle.toLowerCase() : '';
                        
                        // タグ配列（tags, pageGenres）を結合して探す
                        const tagsStr = art.tags && Array.isArray(art.tags) ? art.tags.join(' ').toLowerCase() : '';
                        const genresStr = art.pageGenres && Array.isArray(art.pageGenres) ? art.pageGenres.join(' ').toLowerCase() : '';
                        
                        // 口コミ本文（reviews）や作家名（author）からも探せるように補強
                        const reviewsStr = art.reviews ? art.reviews.toLowerCase() : '';
                        const author = art.author ? art.author.toLowerCase() : '';

                        return title.includes(query) || 
                               originalTitle.includes(query) || 
                               tagsStr.includes(query) || 
                               genresStr.includes(query) || 
                               reviewsStr.includes(query) ||
                               author.includes(query);
                    });

                    // ④ 画面に件数を描画
                    document.getElementById('search-count').textContent = filtered.length;

                    if (!targetEl) return;

                    if (filtered.length === 0) {
                        targetEl.innerHTML = '<p class="text-xs text-slate-400 py-12 text-center">一致する作品が見つかりませんでした。</p>';
                        return;
                    }

                    // ⑤ ランキング等と同じ「大迫力の画像＆レスポンシブ対応カードUI」で出力
                    targetEl.innerHTML = filtered.map(art => {
                        // 表示用タグバッジの作成
                        const currentTags = art.pageGenres || art.tags || [];
                        const tagBadges = currentTags.slice(0, 4).map(t => 
                            \`<span class="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-medium">#\${t}</span>\`
                        ).join(' ');

                        // アフィリエイトリンクの安全な暗号化
                        let rawLurl = '';
                        try {
                            const u = new URL(art.link);
                            rawLurl = u.searchParams.get('lurl') || art.link;
                        } catch(e) {
                            rawLurl = art.link;
                        }
						const afId = "132815-990";
        				const perfectAflink = "https://al.fanza.co.jp/?lurl=" + encodeURIComponent(rawLurl) + "&af_id=" + afId + "&ch=api";
						return \`
							<div class="flex flex-row gap-3 sm:gap-5 p-3 sm:p-5 bg-white rounded-2xl border border-slate-100 hover:bg-rose-50/20 transition-all shadow-sm">
							    
							    <div class="w-32 h-44 sm:w-56 sm:h-80 bg-white border border-slate-200 rounded-xl sm:rounded-2xl overflow-hidden shrink-0 flex items-center justify-center shadow-md">
							        <a href="\${perfectAflink}" rel="sponsored nofollow noopener" target="_blank" class="w-full h-full block">
							            <img src="\${art.imgUrl}" class="w-full h-full object-cover" alt="表紙" loading="lazy">
							        </a>
							    </div>
							    
							    <div class="min-w-0 flex-1 h-44 sm:h-80 flex flex-col justify-between py-0.5 sm:py-2">
							        <div>
							            <a href="posts/\${art.id}.html" class="text-sm sm:text-xl font-black text-slate-800 hover:text-rose-600 line-clamp-2 sm:line-clamp-3 block transition-colors leading-snug mb-1.5 sm:mb-3">
							                \${art.title || art.originalTitle}
							            </a>
							            <div class="flex flex-wrap gap-1 sm:gap-1.5 overflow-hidden max-h-[24px] sm:max-h-[64px] mb-2">
							                \${tagBadges}
							            </div>
							        </div>
							        
							        <div class="flex flex-col xs:flex-row xs:justify-between xs:items-end gap-1.5 sm:gap-3 mt-auto w-full min-w-0 border-t border-slate-50 pt-2 sm:pt-3">
							            <div class="flex flex-col gap-0.5">
							                <span class="text-xs sm:text-base text-rose-600 font-extrabold whitespace-nowrap">⭐ \${art.reviewRating || '0.0'} <span class="text-[10px] sm:text-xs text-slate-400 font-normal">(\${art.reviewCount || 0}件)</span></span>
							            </div>
							            <a href="posts/\${art.id}.html" class="text-[11px] sm:text-sm text-white bg-rose-500 px-4 sm:px-8 py-1.5 sm:py-2.5 rounded-full font-black shadow-md hover:bg-rose-600 transition-transform active:scale-95 whitespace-nowrap text-center w-full xs:w-auto">詳細を読む ➔</a>
							        </div>
							    </div>
							</div>
						\`;
                   	}).join('\\n');

/*
                    // 🚀 その場でアドブロック回避スクリプトを即時実行して画像を復元
                    document.querySelectorAll(".er-safe-lnk").forEach(function(el) {
                        var rawLurl = decode(el.getAttribute("data-enc-lurl") || "");
                        var afId = el.getAttribute("data-enc-af") || "132815-990";
                        if (rawLurl) {
                            var perfectUrl = "https://al.fanza.co.jp/?lurl=" + encodeURIComponent(rawLurl) + "&af_id=" + afId + "&ch=api";
                            el.setAttribute("href", perfectUrl);
                        }
                    });
                    document.querySelectorAll(".er-safe-img").forEach(function(el) {
                        var srcUrl = decode(el.getAttribute("data-enc-src") || "");
                        if (srcUrl) { el.setAttribute("src", srcUrl); }
                    });
*/
                } catch (err) {
                    console.error('データ取得エラー:', err);
                    if (targetEl) targetEl.innerHTML = '<p class="text-xs text-rose-500 py-12 text-center">データの読み込みに失敗しました。</p>';
                }
            });
        </script>
    </body>
    </html>
    `;
}

/**
 * 🏠 総合トップページの生成（読者絶賛ランキング＆ページネーション搭載版）
 * @param {Array} articles - そのページに表示する20件の記事
 * @param {String} displayDate - 最終更新日
 * @param {Array} allTags - 全タグの配列
 * @param {String} siteTitle - サイトタイトル
 * @param {Number} currentPage - 現在のページ番号（1から始まる）
 * @param {Number} totalPages - 全体のページ数
				allArticles 全ページ
 */
 
 function generateTopPageHTML(articles, displayDate, allTags, siteTitle, currentPage = 1, totalPages = 1, allArticles = []) {
    // 💡 もし古い呼び出し方で全データが送られてこなかった時のために、セーフティを貼る
    const baseArticlesForRanking = allArticles.length > 0 ? allArticles : articles;
    
    const cards = articles.map(article => {
        // 🔗 最初から直接代入用のアフィリエイトURLを組み立てる
        let rawLurl = '';
        try { 
            const u = new URL(article.link); 
            rawLurl = u.searchParams.get('lurl') || article.link; 
        } catch(e) { 
            rawLurl = article.link; 
        }
        const afId = "132815-990";
        const perfectAflink = "https://al.fanza.co.jp/?lurl=" + encodeURIComponent(rawLurl) + "&af_id=" + afId + "&ch=api";

        // 📅 日付の整形処理
        const rawDateStr = article.createdAt || '不明';
        let formattedDate = '不明';
        if (rawDateStr !== '不明') {
            const match = String(rawDateStr).match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
            if (match) {
                formattedDate = `${match[1]}/${match[2]}/${match[3]}`;
            } else {
                formattedDate = rawDateStr;
            }
        }

        // ✨ 修正後：後出し属性を完全排除し、最初からhref/srcを直書きした美しいレスポンシブカード
        return `
        <article class="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 hover:bg-rose-50/20 transition-all shadow-sm">
            <div class="w-44 h-60 bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0 flex items-center justify-center shadow-md">
                <a href="${perfectAflink}" rel="sponsored nofollow noopener" target="_blank" class="w-full h-full block">
                    <img src="${article.imgUrl}" class="w-full h-full object-cover" alt="表紙" loading="lazy">
                </a>
            </div>
            
            <div class="flex flex-col min-w-0 flex-1 justify-between self-stretch py-0.5">
                <div class="article-card space-y-1.5">
                    <h3 class="search-title text-[13px] sm:text-base font-bold text-slate-900 leading-snug overflow-hidden" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${article.originalTitle}</h3>
                    <div class="text-[11px] text-slate-500 flex items-center gap-1">
                        <span class="text-amber-500 font-bold">⭐ ${article.reviewRating || '4.2'}</span>
                        <span class="inline">(${article.reviewCount || '0'}件)</span>
                    </div>
                    <div class="search-tags flex flex-wrap gap-0.5">
                        <span class="sm:hidden flex flex-wrap gap-0.5">
                            ${(article.tags || []).slice(0, 2).map(t => `<span class="text-[9px] bg-slate-50 text-slate-500 px-1 py-0.2 rounded border border-slate-100 truncate max-w-[55px]">#${t}</span>`).join('')}
                        </span>
                        <span class="hidden sm:flex flex-wrap gap-0.5">
                            ${(article.tags || []).slice(0, 4).map(t => `<span class="text-[9px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded border border-slate-100">#${t}</span>`).join('')}
                        </span>
                    </div>
                    <div class="text-[11px] sm:text-xs text-slate-500 space-y-0.5 pt-0.5 leading-normal border-l-2 border-rose-100 pl-1.5">
                        <div class="truncate"><span class="font-bold text-slate-700">作家:</span> ${article.author || '不明'}</div>
                        <div class="truncate"><span class="font-bold text-slate-700">出版社:</span> ${article.publisher || '不明'}</div>
                        <div class="truncate"><span class="font-bold text-slate-700">カテゴリ:</span> ${article.category || 'アダルトマンガ'}</div>
                        <div class="truncate"><span class="font-bold text-slate-700">配信日:</span> ${formattedDate}</div>
                    </div>
                </div>
                <div class="flex flex-col sm:flex-row gap-1.5 items-stretch w-full pt-2">
                    <a href="posts/${article.id}.html" class="py-1.5 bg-rose-50 text-rose-600 font-bold rounded-lg text-[10px] sm:text-xs border border-rose-200 hover:bg-rose-100 text-center flex-1">🔎 レビュー</a>
                    <a href="${perfectAflink}" rel="sponsored nofollow noopener" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#e84393,#fd79a8);color:#fff;padding:6px 12px;border-radius:25px;font-size:10px;font-weight:bold;text-decoration:none;text-align:center;line-height:16px;cursor:pointer;" class="flex-1">FANZAで見る</a>
                </div>
            </div>
        </article>
        `;
    }).join('\n');

	// ✨ [新設] 点数×件数の総合スコアが高い順ランキング（上位5件）
    const rankingArticles = [...baseArticlesForRanking]
        .sort((a, b) => {
            const scoreA = parseFloat(a.reviewRating || 0) * parseInt(a.reviewCount || 0, 10);
            const scoreB = parseFloat(b.reviewRating || 0) * parseInt(b.reviewCount || 0, 10);
            return scoreB - scoreA; // スコアが高い順
        })
        .slice(0, 5);
    const rankingCards = rankingArticles.map((article, index) => {
        let rawLurl = '';
        try { const u = new URL(article.link); rawLurl = u.searchParams.get('lurl') || article.link; } catch(e) { rawLurl = article.link; }
        //const encLurl = encryptStr(rawLurl);
        //const encImg = encryptStr(article.imgUrl);
        const rankMedals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        const afId = "132815-990";
        const perfectAflink = "https://al.fanza.co.jp/?lurl=" + encodeURIComponent(rawLurl) + "&af_id=" + afId + "&ch=api";
		return `
        <div class="flex items-center gap-3.5 p-3 bg-rose-50/30 rounded-2xl border border-rose-100/50 hover:bg-rose-50 transition-all shadow-sm">
            <span class="text-xl font-black w-6 text-center shrink-0">${rankMedals[index]}</span>
            
			<div class="w-28 h-36 bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0 flex items-center justify-center shadow-md">
                <a href="${perfectAflink}" rel="sponsored nofollow noopener" target="_blank" class="w-full h-full block">
                    <img class="w-full h-full object-cover" src="${article.imgUrl}" alt="順位表紙" loading="lazy">
                </a>
            </div>
            
            <div class="min-w-0 flex-1 h-28 flex flex-col justify-between py-1">
                <div>
                    <a href="posts/${article.id}.html" class="text-sm font-bold text-slate-800 hover:text-rose-600 line-clamp-2 block transition-colors leading-tight mb-1.5">${article.originalTitle}</a>
                </div>
                <div class="flex items-center gap-1.5 whitespace-nowrap">
                    <span class="text-xs text-amber-500 font-bold">⭐ ${article.reviewRating || '4.5'}</span>
                    <span class="text-[11px] text-slate-400 font-medium">(${article.reviewCount || 0}件)</span>
                </div>
                <a class="text-[11px] text-white bg-rose-500 px-4 py-1.5 rounded-full font-black shadow-sm text-center w-full sm:w-auto shrink-0 transition-transform active:scale-95 hover:bg-rose-600" 
                       href="${perfectAflink}" 
                       rel="sponsored nofollow noopener" 
                       target="_blank">詳細へ</a>
            </div>
        </div>
        `;
    }).join('\n');

	// 🔥 【追加】レビュー件数が多い順ランキング（上位5件）のカードアセンブリ
    const commentRankingArticles = [...baseArticlesForRanking]
        .sort((a, b) => parseInt(b.reviewCount || 0) - parseInt(a.reviewCount || 0))
        .slice(0, 5);
    const commentRankingCards = commentRankingArticles.map((article, index) => {
        let rawLurl = '';
        try { const u = new URL(article.link); rawLurl = u.searchParams.get('lurl') || article.link; } catch(e) { rawLurl = article.link; }
        //const encLurl = encryptStr(rawLurl);
        //const encImg = encryptStr(article.imgUrl);
        const rankMedals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        const afId = "132815-990";
        const perfectAflink = "https://al.fanza.co.jp/?lurl=" + encodeURIComponent(rawLurl) + "&af_id=" + afId + "&ch=api";
		return `
        <div class="flex items-center gap-3.5 p-3 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-rose-50/20 transition-all shadow-sm">
            <span class="text-xl font-black w-6 text-center shrink-0">${rankMedals[index]}</span>
            
			<div class="w-28 h-36 bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0 flex items-center justify-center shadow-md">
                <a href="${perfectAflink}" rel="sponsored nofollow noopener" target="_blank" class="w-full h-full block">
                    <img class="w-full h-full object-cover" src="${article.imgUrl}" alt="順位表紙" loading="lazy">
                </a>
            </div>
            	
            <div class="min-w-0 flex-1 h-28 flex flex-col justify-between py-1">
                <div>
                    <a href="posts/${article.id}.html" class="text-sm font-bold text-slate-800 hover:text-rose-600 line-clamp-2 block transition-colors leading-tight mb-1.5">${article.originalTitle}</a>
                </div>
                
                <span class="text-[11px] text-slate-500 whitespace-nowrap">
                    💬 口コミ <span class="font-bold text-rose-600 text-xs">${article.reviewCount || '0'}</span> 件
                </span>
				<a class="text-[11px] text-white bg-slate-800 px-4 py-1.5 rounded-full font-black shadow-sm text-center w-full sm:w-auto shrink-0 transition-transform active:scale-95 hover:bg-slate-900" 
                       href="${perfectAflink}" 
                       rel="sponsored nofollow noopener" 
                       target="_blank">詳細へ</a>
            </div>
        </div>
        `;
    }).join('\n');

	// 🆕 3. 【新設】新着レビュー順ランキング（新しく追加された順・上位5件）
    // DB（db.json）の仕様上、新しいものが配列の前方、またはdateプロパティを持っているので、降順でソート
    const newRankingArticles = [...baseArticlesForRanking]
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, 5);
    const newRankingCards = newRankingArticles.map((article, index) => {
        let rawLurl = ''; 
        try { 
            const u = new URL(article.link); 
            rawLurl = u.searchParams.get('lurl') || article.link; 
        } catch(e) { 
            rawLurl = article.link; 
        }
        //const encLurl = encryptStr(rawLurl); 
        //const encImg = encryptStr(article.imgUrl);
        const rankMedals = ['⭐', '⭐', '⭐', '⭐', '⭐'];
        const rawDateStr = article.date || new Date().toISOString();
        const safeDateStr = typeof rawDateStr === 'string' ? rawDateStr.replace(/\s+/, 'T') : rawDateStr;
        let d = new Date(safeDateStr);
        if (isNaN(d.getTime())) {
            d = new Date();
        }
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const formattedDate = `${yyyy}/${mm}/${dd}`;
        const afId = "132815-990";
        const perfectAflink = "https://al.fanza.co.jp/?lurl=" + encodeURIComponent(rawLurl) + "&af_id=" + afId + "&ch=api";
		return `
        <div class="flex items-center gap-3.5 p-3 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-rose-50/20 transition-all shadow-sm">
            <span class="text-xl font-black w-6 text-center shrink-0">${rankMedals[index]}</span>
            
			<div class="w-28 h-36 bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0 flex items-center justify-center shadow-md">
                <a href="${perfectAflink}" rel="sponsored nofollow noopener" target="_blank" class="w-full h-full block">
                    <img class="w-full h-full object-cover" src="${article.imgUrl}" alt="順位表紙" loading="lazy">
                </a>
            </div>
            
            <div class="min-w-0 flex-1 h-28 flex flex-col justify-between py-1">
                <div>
                    <a href="posts/${article.id}.html" class="text-sm font-bold text-slate-800 hover:text-rose-600 line-clamp-2 block transition-colors leading-tight mb-1.5">${article.originalTitle}</a>
                </div>
                
                <span class="text-[11px] text-slate-400 whitespace-nowrap">
                    レビュー日: ${formattedDate}
                </span>
                <a class="text-[11px] text-white bg-slate-800 px-4 py-1.5 rounded-full font-black shadow-sm text-center w-full sm:w-auto shrink-0 transition-transform active:scale-95 hover:bg-slate-900" 
                       href="${perfectAflink}" 
                       rel="sponsored nofollow noopener" 
                       target="_blank">詳細へ</a>
            </div>
        </div>
        `;
    }).join('\n');

	// 🔥 【新設】今週の超大作ランキング（紹介文の文字数＝熱量順・上位5件）
    const megaArticles = [...baseArticlesForRanking]
        .sort((a, b) => parseInt(b.summary ? b.summary.length : 0) - parseInt(a.summary ? a.summary.length : 0))
        .slice(0, 5);
    const megaCards = megaArticles.map((article, index) => {
        let rawLurl = ''; try { const u = new URL(article.link); rawLurl = u.searchParams.get('lurl') || article.link; } catch(e) { rawLurl = article.link; }
        //const encLurl = encryptStr(rawLurl); const encImg = encryptStr(article.imgUrl);
        const rankMedals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        // 文字数のカウント（バッジ用）
        const textCount = article.summary ? article.summary.length : 0;
        const afId = "132815-990";
        const perfectAflink = "https://al.fanza.co.jp/?lurl=" + encodeURIComponent(rawLurl) + "&af_id=" + afId + "&ch=api";
		return `
        <div class="flex items-center gap-3.5 p-3 bg-rose-50/20 rounded-2xl border border-rose-100 hover:bg-rose-50 transition-all shadow-sm">
            <span class="text-xl font-black w-6 text-center shrink-0">${rankMedals[index]}</span>
            
			<div class="w-28 h-36 bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0 flex items-center justify-center shadow-md">
                <a href="${perfectAflink}" rel="sponsored nofollow noopener" target="_blank" class="w-full h-full block">
                    <img class="w-full h-full object-cover" src="${article.imgUrl}" alt="順位表紙" loading="lazy">
                </a>
            </div>
            
            <div class="min-w-0 flex-1 h-28 flex flex-col justify-between py-1">
                <div>
                    <a href="posts/${article.id}.html" class="text-sm font-bold text-slate-800 hover:text-rose-600 line-clamp-2 block transition-colors leading-tight mb-1.5">${article.originalTitle}</a>
                </div>
                
                <span class="text-[11px] text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100/70 animate-pulse inline-block whitespace-nowrap">
                    熱量 🔥 ${textCount}文字
                </span>
                <a class="text-[11px] text-white bg-rose-500 px-4 py-1.5 rounded-full font-black shadow-sm text-center w-full sm:w-auto shrink-0 transition-transform active:scale-95 hover:bg-rose-600" 
                       href="${perfectAflink}" 
                       rel="sponsored nofollow noopener" 
                       target="_blank">詳細へ</a>
            </div>
        </div>
        `;
    }).join('\n');

	// 💡 作品新着順！
    const newRankingArticlesForCreatedAt = [...baseArticlesForRanking]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 5);
    const newRankingCardsForCreatedAt = newRankingArticlesForCreatedAt.map((article, index) => {
        let rawLurl = ''; 
        try { 
            const u = new URL(article.link); 
            rawLurl = u.searchParams.get('lurl') || article.link; 
        } catch(e) { 
            rawLurl = article.link; 
        }
        //const encLurl = encryptStr(rawLurl); 
        //const encImg = encryptStr(article.imgUrl);
        const rankMedals = ['⭐', '⭐', '⭐', '⭐', '⭐'];
        // 💡 セーフティ：表示用データ（date か createdAt のあるほうを使う。最悪現在時刻）
        const displayDateStr = article.createdAt || article.date || new Date().toISOString();
		const d = new Date(displayDateStr);
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, '0'); // 月は0スタートなので+1して、2桁0埋め
		const dd = String(d.getDate()).padStart(2, '0');     // 日を2桁0埋め
		const formattedDate = `${yyyy}/${mm}/${dd}`; // 確実に「2026/06/12」になる
		const afId = "132815-990";
        const perfectAflink = "https://al.fanza.co.jp/?lurl=" + encodeURIComponent(rawLurl) + "&af_id=" + afId + "&ch=api";
		return `
        <div class="flex items-center gap-3.5 p-3 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-rose-50/20 transition-all shadow-sm">
            <span class="text-xl font-black w-6 text-center shrink-0">${rankMedals[index]}</span>
            
			<div class="w-28 h-36 bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0 flex items-center justify-center shadow-md">
                <a href="${perfectAflink}" rel="sponsored nofollow noopener" target="_blank" class="w-full h-full block">
                    <img class="w-full h-full object-cover" src="${article.imgUrl}" alt="順位表紙" loading="lazy">
                </a>
            </div>
            
            <div class="min-w-0 flex-1 h-28 flex flex-col justify-between py-1">
                <div>
                    <a href="posts/${article.id}.html" class="text-sm font-bold text-slate-800 hover:text-rose-600 line-clamp-2 block transition-colors leading-tight mb-1.5">${article.originalTitle}</a>
                </div>
                
                <span class="text-[11px] text-slate-400 whitespace-nowrap">
                        配信日: ${formattedDate}
                </span>
                <a class="text-[11px] text-white bg-slate-800 px-4 py-1.5 rounded-full font-black shadow-sm text-center w-full sm:w-auto shrink-0 transition-transform active:scale-95 hover:bg-slate-900" 
                       href="${perfectAflink}" 
                       rel="sponsored nofollow noopener" 
                       target="_blank">詳細へ</a>
            </div>
        </div>
        `;
    }).join('\n');

    const tagCloudLinks = allTags.map(tag => `
        <li>
            <a href="tags/${tag}.html" class="inline-block m-1 px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition-all rounded-lg text-xs font-medium border border-rose-100">
                🏷️ ${tag}
            </a>
        </li>
    `).join('\n');

    const googleAnalyticsCode = getAnalyticsTag();
    //const bypassScript = getBypassScript();

		// ─────────────── 🛠️ ページネーションHTMLの組み立て ───────────────
        let paginationHtml = '';
        if (totalPages > 1) {
            let itemsHtml = [];

            // 【前へ】ボタン
            if (currentPage > 1) {
                const prevLink = currentPage === 2 ? 'index.html' : `index${currentPage - 1}.html`;
                // 💡 px-2 sm:px-3 にしてスマホ時は横幅をコンパクトに
                itemsHtml.push(`<a href="${currentPage === 2 ? '' : '../'}${prevLink}" class="px-2 sm:px-3 py-2 rounded-xl bg-white border border-rose-200 text-rose-600 font-bold hover:bg-rose-50 text-xs sm:text-sm transition-all shrink-0">← 前へ</a>`);
            }

            // 【ページ番号】ボタン (例: 1 2 3 ...)
            for (let i = 1; i <= totalPages; i++) {
                const isCurrent = i === currentPage;
                let finalLink = i === 1 ? 'index.html' : `index${i}.html`;
                
                // 💡 px-2.5 sm:px-3.5 にしてスマホ時のボタンの膨らみを抑える
                if (isCurrent) {
                    itemsHtml.push(`<span class="px-2.5 sm:px-3.5 py-2 rounded-xl bg-rose-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-rose-200 shrink-0">${i}</span>`);
                } else {
                    itemsHtml.push(`<a href="${finalLink}" class="px-2.5 sm:px-3.5 py-2 rounded-xl bg-white border border-rose-200 text-slate-700 font-medium hover:bg-rose-50 hover:text-rose-600 text-xs sm:text-sm transition-all shrink-0">${i}</a>`);
                }
            }

            // 【次へ】ボタン
            if (currentPage < totalPages) {
                const nextLink = `index${currentPage + 1}.html`;
                // 💡 px-2 sm:px-3 に修正
                itemsHtml.push(`<a href="${nextLink}" class="px-2 sm:px-3 py-2 rounded-xl bg-white border border-rose-200 text-rose-600 font-bold hover:bg-rose-50 text-xs sm:text-sm transition-all shrink-0">次へ →</a>`);
            }

            // ⭕ 外枠の div クラスを大修正！
            paginationHtml = `
            <div class="flex flex-wrap justify-center items-center gap-1 sm:gap-1.5 max-w-full px-4 mt-12 pt-6 border-t border-dashed border-rose-100 mx-auto">
                ${itemsHtml.join('\n')}
            </div>
            `;
        }
		// ─────────────── 🛠️ ページネーションHTMLの組み立て ───────────────
	
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${siteTitle} - 羞恥専門成人向けレビューまとめ</title>
    <script src="https://cdn.tailwindcss.com"></script>
    ${googleAnalyticsCode}
</head>
<body class="bg-[#fffbfb] text-slate-900 antialiased min-h-screen overflow-x-hidden">
    <header class="bg-slate-950 text-white py-10 px-4 text-center relative border-b border-rose-950/40">
    
		<p class="text-xs font-bold text-rose-500 tracking-widest uppercase mb-1">
    	    ーー その羞恥は、最高の快楽へ。
    	</p>
    	<h1 class="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-pink-300">
    	    ${siteTitle} <span class="text-rose-600">EC-Finder</span>
    	</h1>
    	<p class="mt-2 text-xs text-rose-300 font-light">
    	    公開羞恥・洗脳・催眠・露出・調教シチュエーションに特化し、ガチレビューを詰め込んだ大容量データベース型メディア。
    	</p>
    
        <div class="mt-1 text-[10px] text-rose-400">最終更新: ${displayDate}</div>
        <div class="mt-5 max-w-md mx-auto px-4">
            <button id="toggle-header-tags" class="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-rose-950/50 transition-all flex items-center justify-center gap-1.5 border border-rose-500/20">
                <span>🏷️ タグから作品を探す</span>
                <span id="header-arrow" class="transition-transform duration-300 transform inline-block">▼</span>
            </button>
            <div id="header-tags-container" class="max-h-0 overflow-hidden transition-all duration-300 ease-in-out text-left mt-3 bg-slate-900 rounded-xl border border-slate-800 shadow-inner">
                <div class="p-4">
                    <ul class="flex flex-wrap -m-0.5">
                        ${tagCloudLinks.length > 0 ? tagCloudLinks : '<li class="text-xs text-slate-500 py-1 pl-1">タグはまだありません。</li>'}
                    </ul>
                </div>
            </div>
        </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 space-y-4">
        
<form action="search.html" method="GET" class="max-w-md mx-auto my-6 px-4 w-full box-border">
    <div class="relative flex items-center">
        <input 
            type="text" 
            name="q"
            id="site-search-input" 
            placeholder="キーワードで作品を検索...（例：催眠、露出）" 
            class="w-full text-xs px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent shadow-sm transition-all text-slate-800"
        />
        <button type="submit" class="absolute right-3 text-slate-400 text-xs hover:text-rose-500 transition-colors">
            🔍
        </button>
    </div>
</form>
        
                <h2 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span class="w-2 h-5 bg-rose-500 rounded-full"></span>🔥 【新着】本日の注目作品 (${currentPage}/${totalPages})
                </h2>
                ${cards}
                
                <div class="space-y-2">
	    			${paginationHtml}
				</div>
            </div>
            	
            <div class="lg:col-span-1 space-y-6">
            	
				<div class="bg-white p-4 rounded-2xl shadow-sm border border-rose-100 shadow-rose-100/40">
					<h2 class="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-rose-100 flex items-center gap-1.5">
						<span>⚡️ 鮮度MAX！新着レビュー作品</span>
					</h2>
					<div class="space-y-2">
				    	${newRankingCards}
					</div>
				</div>
            	
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-rose-100 shadow-rose-100/40">
                    <h2 class="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-rose-100 flex items-center gap-1.5">
                        <span>🌟 読者が絶賛した神作品ランキング</span>
                    </h2>
                    <div class="space-y-2">
                        ${rankingCards}
                    </div>
                </div>

				<div class="bg-white p-4 rounded-2xl shadow-sm border border-rose-100 shadow-rose-100/40">
                    <h2 class="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-rose-100 flex items-center gap-1.5">
                        <span>💬 みんなが注目！口コミ話題作ランキング</span>
                    </h2>
                    <div class="space-y-2">
                        ${commentRankingCards}
                    </div>
                </div>

				<div class="bg-white p-4 rounded-2xl shadow-sm border border-rose-100 shadow-rose-100/40">
                    <h2 class="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-rose-100 flex items-center gap-1.5">
                        <span>🔥 ソムリエ激推し！今週の超大作ランキング</span>
                    </h2>
                    <div class="space-y-2">
                        ${megaCards}
                    </div>
                </div>

				<div class="bg-white p-4 rounded-2xl shadow-sm border border-rose-100 shadow-rose-100/40">
                    <h2 class="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-rose-100 flex items-center gap-1.5">
                        <span>📢 業界最前線！今月の最新入荷作</span>
                    </h2>
                    <div class="space-y-2">
                        ${newRankingCardsForCreatedAt}
                    </div>
                </div>

                <div class="bg-white p-6 rounded-2xl shadow-sm border border-rose-50 sticky top-6">
                    <h2 class="text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-rose-100">タグ一覧</h2>
                    <ul class="flex flex-wrap -m-1">${tagCloudLinks.length > 0 ? tagCloudLinks : '<li class="text-xs text-slate-400 py-2">タグはまだありません。</li>'}</ul>
                </div>
            </div>
        </div>
    </main>

    <script>
    document.getElementById('toggle-header-tags').addEventListener('click', function() {
        var container = document.getElementById('header-tags-container');
        var arrow = document.getElementById('header-arrow');
        if (container.style.maxHeight === '0px' || !container.style.maxHeight) {
            container.style.maxHeight = container.scrollHeight + 'px';
            arrow.style.transform = 'rotate(180deg)';
        } else {
            container.style.maxHeight = '0px';
            arrow.style.transform = 'rotate(0deg)';
        }
    });
    </script>
    	
	<footer class="bg-slate-900 text-slate-400 py-8 text-center text-xs mt-12 w-full">
        <div class="max-w-4xl mx-auto px-4">
            <p class="text-slate-500 mb-2">Powered by <a href="https://affiliate.dmm.com/api/">DMM.com Webサービス</a></p>
            <p>&copy; 2026 ${siteTitle}. All Rights Reserved.</p>
        </div>
    </footer>
</body>
</html>`;
}

module.exports = { generateSinglePostHTML, generateTagPageHTML, generateTopPageHTML, generateSearchPageHTML};