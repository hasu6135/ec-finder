const puppeteer = require('puppeteer'); 
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const axios = require('axios'); 
const { JSDOM } = require('jsdom'); 

/**
 * ===================================================
 * ⚙️ 各種設定・定数管理
 * ===================================================
 */
const SITE_TITLE = '羞恥系コミック';
const FETCH_COUNT = 10; // 最初はテスト用に1件
const ARCHIVE_DIR = 'archive';

const DMM_API_ID = 'w3pxtk1rrTgpNCQ7JzcU'; 
const DMM_AFFILIATE_ID = '132815-001'; 

const openai = new OpenAI({
    baseURL: 'http://localhost:1234/v1',
    apiKey: 'lm-studio'
});

/**
 * ===================================================
 * 🔍 DMMの作品個別ページからレビューと作品紹介を抽出・学習する関数
 * ===================================================
 */
async function scrapeDmmProductDetail(affiliateUrl) {
    let browser;
    try {
        const urlObj = new URL(affiliateUrl);
        let rawUrl = urlObj.searchParams.get('lurl') || affiliateUrl;
        rawUrl = decodeURIComponent(rawUrl);
        
        if (rawUrl.includes('published.fanza.co.jp') || rawUrl.includes('book.fanza.co.jp')) {
            rawUrl = rawUrl.replace('published.fanza.co.jp', 'book.dmm.co.jp').replace('book.fanza.co.jp', 'book.dmm.co.jp');
        }

        console.log(`🔍 本物のブラウザ(Puppeteer)で詳細ページを起動中...`);
        
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.setCookie(
            { name: 'age_check_done', value: '1', domain: '.dmm.co.jp', path: '/' },
            { name: 'r18', value: '1', domain: '.dmm.co.jp', path: '/' },
            { name: 'g_device', value: 'pc', domain: '.dmm.co.jp', path: '/' }
        );

        await page.goto(rawUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        
        console.log(` 📜 レビューと作品紹介を読み込むため、ページを自動スクロール中...`);
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 500;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight || totalHeight > 6000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        console.log(` ⏳ スクロール完了。データ生成を3秒間待機します...`);
        await new Promise(resolve => setTimeout(resolve, 3000));

        const rawHtml = await page.content();
        const dom = new JSDOM(rawHtml);
        const doc = dom.window.document;

        let userReviews = [];
        let productDescription = '';
        let realTachiyomiUrl = '';

        // 作品紹介（あらすじ）のハッキング抽出
        const descElem = doc.querySelector('[data-testid="description-text"]') || doc.querySelector('.sc-ef68d909-1');
        if (descElem) {
            productDescription = descElem.innerHTML
                .replace(/<br\s*\/?>/gi, '\n') 
                .replace(/<[^>]+>/g, '')       
                .trim();
        }

        // レビュー抽出
        const nicknames = doc.querySelectorAll('[data-testid="nickname"]');
        nicknames.forEach(nick => {
            const reviewBox = nick.closest('div');
            if (reviewBox && reviewBox.parentElement) {
                const pTxt = reviewBox.parentElement.querySelector('p');
                if (pTxt) {
                    const text = pTxt.textContent.trim().replace(/\s+/g, ' ');
                    if (text && text.length > 5 && !userReviews.includes(text)) {
                        userReviews.push(text);
                    }
                }
            }
        });

        const pElements = doc.querySelectorAll('p[class*="biNCbZ"], p[class*="eFdjNy"], div[data-testid="review-evaluation"] pre');
        pElements.forEach(p => {
            const text = p.textContent.trim().replace(/\s+/g, ' ');
            if (text.length > 10 && text.length < 500 && !userReviews.includes(text)) {
                userReviews.push(text);
            }
        });

        // 試し読みURL
        const tachiyomiLinkElem = doc.querySelector('a[href*="/tachiyomi/"]');
        if (tachiyomiLinkElem) {
            realTachiyomiUrl = tachiyomiLinkElem.getAttribute('href');
            if (!realTachiyomiUrl.startsWith('http')) {
                realTachiyomiUrl = 'https://book.dmm.co.jp' + realTachiyomiUrl;
            }
        }

        await browser.close();

        const filteredReviews = userReviews.filter(r => {
            if (r.includes('作品の内容に関する記述が含まれています')) return false;
            if (r.includes('ネタバレ')) return false;
            if (r.includes('特定商取引法') || r.includes('ご利用規約') || r.includes('ポイント') || r.includes('公式アカウント')) return false;
            if (r.includes('JavaScript') || r.includes('推奨環境') || r.includes('クッキー')) return false;
            if (r.length < 10 || r.length > 400) return false;
            return true;
        });

        console.log(` └ 💬 有効な参考レビュー: ${filteredReviews.length}件`);
        if (filteredReviews.length > 0) {
            console.log(` 📥 --- [厳選されたレビューの中身] ---`);
            filteredReviews.forEach((rev, index) => {
                console.log(`   [${index + 1}] ${rev.substring(0, 60)}${rev.length > 60 ? '...' : ''}`);
            });
            console.log(` -------------------------------------`);
        }

        if (productDescription) {
            console.log(` └ 📝 作品紹介（あらすじ）の取得に成功！(文字数: ${productDescription.length}文字)`);
            console.log(` 📥 --- [あらすじ冒頭スナップ] ---`);
            console.log(`   ${productDescription.substring(0, 120).replace(/\n/g, ' ')}...`);
            console.log(` ---------------------------------`);
        }

        const reviewSummary = filteredReviews.slice(0, 3).join('\n---\n');
        
        return {
            userReviews: reviewSummary || '（ネタバレなしレビューなし）',
            productDescription: productDescription || '（作品紹介なし）',
            sampleImages: [],
            tachiyomiUrl: realTachiyomiUrl 
        };

    } catch (error) {
        if (browser) await browser.close();
        console.error('⚠️ 詳細ページの解析に失敗しました（Puppeteerエラー）:', error.message);
        return { userReviews: '', productDescription: '', sampleImages: [], tachiyomiUrl: '' };
    }
}

/**
 * 📦 DMM Web Service API からデータを取得する関数
 * ===================================================
 */
async function fetchDmmProducts() {
    try {
        const finalAffiliateId = DMM_AFFILIATE_ID.endsWith('-001') 
            ? DMM_AFFILIATE_ID.replace('-001', '-990') 
            : DMM_AFFILIATE_ID;

        console.log('📡 DMM APIへリクエストを送信中（人気順）...');
        const response = await axios.get('https://api.dmm.com/affiliate/v3/ItemList', {
            params: {
                api_id: DMM_API_ID,
                affiliate_id: finalAffiliateId,
                site: 'FANZA',  
                service: 'ebook',
                floor: 'comic',
                keyword: '羞恥', 
                hits: FETCH_COUNT,       
                sort: 'rank'             
            }
        });

        if (!response.data.result || !response.data.result.items) {
            return [];
        }

        return response.data.result.items.map(item => {
            const encodedRawUrl = encodeURIComponent(item.URL);
            const perfectAffiliateUrl = `https://al.fanza.co.jp/?lurl=${encodedRawUrl}&af_id=${DMM_AFFILIATE_ID}&ch=search_link&ch_id=link`;

            return {
                title: item.title,
                url: perfectAffiliateUrl, 
                imageUrl: item.imageURL?.large || item.imageURL?.list,
                description: item.description || ''
            };
        });

    } catch (error) {
        console.error('⚠️ DMM API取得エラー:', error.message);
        return [];
    }
}

/**
 * ===================================================
 * 💡【重要変更】AIが作ったマークダウン形式のテーブル（表）を、
 * 美しいHTMLのテーブルへ全自動で100%完全変換する超軽量関数
 * ===================================================
 */
function parseMarkdownTableToHtml(text) {
    const lines = text.split('\n');
    let inTable = false;
    let htmlOutput = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // パイプ「|」で始まる行を表として認識
        if (line.startsWith('|') && line.endsWith('|')) {
            const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
            
            // 区切り行（|---|---|）は無視する
            if (line.includes('---') || line.includes('===')) {
                continue;
            }

            if (!inTable) {
                inTable = true;
                htmlOutput.push('<div class="overflow-x-auto my-6 shadow-sm border border-rose-100 rounded-xl">');
                htmlOutput.push('<table class="min-w-full divide-y divide-rose-100 text-sm text-left">');
                htmlOutput.push('<thead class="bg-rose-50 text-rose-900 font-bold"><tr>');
                cells.forEach(cell => htmlOutput.push(`<th class="px-4 py-3">${cell}</th>`));
                htmlOutput.push('</tr></thead>');
                htmlOutput.push('<tbody class="divide-y divide-rose-50 bg-white text-slate-700">');
            } else {
                htmlOutput.push('<tr class="hover:bg-slate-50/50 transition-colors">');
                cells.forEach(cell => htmlOutput.push(`<td class="px-4 py-3 font-medium">${cell}</td>`));
                htmlOutput.push('</tr>');
            }
        } else {
            if (inTable) {
                inTable = false;
                htmlOutput.push('</tbody></table></div>');
            }
            htmlOutput.push(line);
        }
    }
    if (inTable) {
        htmlOutput.push('</tbody></table></div>');
    }
    return htmlOutput.join('\n');
}

/**
 * ===================================================
 * 🚀 メイン処理
 * ===================================================
 */
async function main() {
    try {
        if (!fs.existsSync(ARCHIVE_DIR)){
            fs.mkdirSync(ARCHIVE_DIR);
        }

        const products = await fetchDmmProducts();
        if (products.length === 0) {
            console.log('⚠️ 取得できた作品データが0件のため終了します。');
            return;
        }

        const summarizedArticles = [];
        console.log(`🤖 LM Studioによる、生レビューを反映した超濃厚レビュー執筆を開始...`);

        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            console.log(`\n[${i + 1}/${products.length}] ターゲット作品: ${product.title}`);

            const detailData = await scrapeDmmProductDetail(product.url);

            try {
                const response = await openai.chat.completions.create({
                    model: 'loading-model', 
                    messages: [
                        { 
                            role: 'system', 
                            content: `あなたは成人向けマンガ・同人誌の紹介で爆発的な人気を誇る「エロ同人ソムリエ（天才ライター）」です。与えられた作品タイトル、公式の詳細なあらすじ、 tender して【実際に購入したユーザーの生レビュー（口コミ）】を徹底的に分析し、その作品が持つ「羞恥シチュエーション（公開羞恥、言葉責め、モブ視線、尊厳破壊など）」のどこが読者に刺さっているのかを反映した、狂気的なほど熱量の高い紹介記事（日本語）を執筆してください。

以下の【執筆ルール】を限界まで遵守すること：
1. 【タイトルは『一撃で理性を吹き飛ばすフック』にせよ】
   - 機械的なラベル（「分析結果：」など）は絶対に出力禁止。読者が悶絶してクリックしてしまう、強烈にキャッチーな日本語タイトルを1行目で作ること。
2. 【レビューは『実際の読者の興奮ポイント』を突き、HTMLで飾れ】
   - 与えられたユーザーの生口コミの内容（例：「○○のシーンの赤面が最高」「言葉責めが抜ける」など）の要素をレビュー内に自然に溶け込ませ、「実際に読んだ人が絶賛しているポイント」として熱弁してください。
   - 公式あらすじに複数の収録作品やエピソード名（短編集など）が記載されている場合は、単一の作品だけでなく、それら複数のシチュエーション（例：壁尻、性処理課、わからせる等）のバリエーション豊かな魅力についても網羅して熱く語ること。
   - 適切な改行を挟み、以下のHTMLタグを文章中に【必ず積極的かつ効果的に】散りばめること：
     * 最も興奮する属性キーワード： <b>太字</b>
     * 妄想を加速させる最高にエロい一言： <mark class="bg-rose-100 text-rose-900 px-1 rounded">ピンクのハイライト</mark>
     * 作品の「抜きどころ」を整理する際： <ul>と<li>を使ったリスト形式（先頭に🔞, 💦, 💋 などの絵文字を1つ入れる）
3. 【Markdown記号の完全排除】
   - 「#」や「##」、「**」、「---」といったMarkdown記号、および「\`\`\`」のようなコードブロック記号はWebサイトのバグになるため使用一切禁止。`
                        },
                        { 
                            role: 'user', 
                            content: `【作品タイトル】\n${product.title}\n\n【公式あらすじ】\n${detailData.productDescription}\n\n【購入者の生の口コミ・レビュー】\n${detailData.userReviews}` 
                        }
                    ],
                    temperature: 0.75 
                });

                let summary = response.choices[0].message.content;

                // 安全装置：余計な記号を徹底削除
                summary = summary
                    .replace(/```html/g, '').replace(/```/g, '').replace(/##+/g, '').replace(/\*\*/g, '').replace(/---+/g, '').replace(/#/g, '').trim();

                // 💡【重要修正】先にテーブル（表）の自動HTMLパースを行い、その後で通常の改行を<br>に変換する
                const tableParsedSummary = parseMarkdownTableToHtml(summary);
                const formattedSummary = tableParsedSummary.replace(/\n/g, '<br>');

                let perfectSampleReadLink = '';
                if (detailData.tachiyomiUrl) {
                    const encodedSampleUrl = encodeURIComponent(detailData.tachiyomiUrl);
                    perfectSampleReadLink = `https://al.fanza.co.jp/?lurl=${encodedSampleUrl}&af_id=${DMM_AFFILIATE_ID}&ch=search_link&ch_id=link`;
                } else {
                    perfectSampleReadLink = product.url;
                }

                summarizedArticles.push({
                    originalTitle: product.title,
                    link: product.url,
                    imgUrl: product.imageUrl,
                    summary: formattedSummary,
                    sampleImages: detailData.sampleImages,
                    sampleReadLink: perfectSampleReadLink 
                });

                console.log(`✅ [${i + 1}/${products.length}] レビューの執筆が完了しました！`);

            } catch (itemError) {
                console.error(`⚠️ エラーのためスキップ:`, itemError.message);
            }
        }

        const todayObj = new Date();
        const dateStr = todayObj.toISOString().split('T')[0];
        const displayDate = todayObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        const archiveHtml = generateTopPageHTML(summarizedArticles, displayDate, [], true);
        fs.writeFileSync(path.join(ARCHIVE_DIR, `${dateStr}.html`), archiveHtml, 'utf-8');

        const archiveFiles = fs.readdirSync(ARCHIVE_DIR).filter(file => file.endsWith('.html')).map(file => file.replace('.html', '')).sort((a, b) => b.localeCompare(a));

        const indexHtml = generateTopPageHTML(summarizedArticles, displayDate, archiveFiles, false);
        fs.writeFileSync('index.html', indexHtml, 'utf-8');

        console.log('✨ すべての処理が完了しました！');

    } catch (error) {
        console.error('❌ 致命的なエラー:', error);
    }
}

// 共通パーツ：カードレイアウト
function renderArticleCards(articles) {
    return articles.map(article => {
        let samplesHtml = '';
        if (article.sampleImages && article.sampleImages.length > 0) {
            const imgTags = article.sampleImages.map(imgUrl => `
                <div class="aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <img src="${imgUrl}" alt="サンプル" class="w-full h-full object-cover lazy" loading="lazy">
                </div>
            `).join('\n');

            samplesHtml = `
                <div class="mt-6 pt-6 border-t border-rose-50">
                    <h4 class="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3 flex items-center gap-1">
                        <span>👀 本編チラ見せ・サンプル画像一覧（${article.sampleImages.length}枚）</span>
                    </h4>
                    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        ${imgTags}
                    </div>
                </div>
            `;
        }

// ... (renderArticleCards 関数の内側)

// 💡 【修正】左側の追従エリア（イラスト ＋ ボタン）
return `
<article class="bg-white rounded-2xl shadow-sm hover:shadow-xl border border-rose-50 transition-all duration-300 overflow-hidden flex flex-col md:flex-row p-6 sm:p-8 group items-start gap-8">
    
    <div class="md:w-1/3 sticky top-6 self-start space-y-4">
        <div class="bg-slate-50 flex items-center justify-center overflow-hidden relative min-h-[320px] max-h-[400px] rounded-xl border border-slate-100 shadow-inner">
            <img src="${article.imgUrl}" alt="作品サンプル" class="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300">
            <span class="absolute top-3 left-3 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">R-18</span>
        </div>
        
        <div class="flex flex-col gap-2">
            <a href="${article.link}" target="_blank" rel="nofollow" class="w-full text-center py-3 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all text-sm">
                🔞 今すぐ読む
            </a>
            <a href="${article.sampleReadLink}" target="_blank" rel="nofollow" class="w-full text-center py-3 bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-200 transition-all text-sm">
                👀 無料で試し読み
            </a>
        </div>
    </div>

    <div class="md:w-2/3 flex flex-col">
        <div class="flex items-center gap-2 mb-3">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-100">
                羞恥・ランキング上位
            </span>
            <span class="text-xs text-slate-400">口コミ分析レビュー</span>
        </div>
        <h3 class="text-xl font-bold text-slate-900 tracking-tight leading-snug mb-4">${article.originalTitle}</h3>
        <div class="text-slate-600 text-sm leading-relaxed space-y-2 pt-4 border-t border-rose-50">
            ${article.summary}
        </div>
        
        </div>
    
    `;
    }).join('\n');
}

// 📄 テンプレート
function generateTopPageHTML(articles, displayDate, archiveFiles, isArchive) {
    const cards = renderArticleCards(articles);
    const archiveLinks = archiveFiles.map(date => `
        <li>
            <a href="${isArchive ? '../' : '/'}archive/${date}.html" class="flex items-center justify-between p-3 rounded-lg hover:bg-rose-50 text-sm font-medium text-slate-700 hover:text-rose-600 transition-all border border-transparent hover:border-slate-100">
                <span>📅 ${date} の新着まとめ</span>
                <span class="text-xs bg-rose-50 text-rose-500 px-2 py-0.5 rounded-md">LOG</span>
            </a>
        </li>
    `).join('\n');

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${SITE_TITLE} - 最新成人向け羞恥マンガ・同人誌レビューまとめ</title>
    <meta name="description" content="【18禁】言葉責め・公開羞恥・露出系シチュエーションコミックに特化。最新作の抜きどころを徹底レビュー。">
    <meta name="rating" content="adult">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&family=Noto+Sans+JP:wght@400;500;700&display=swap');
        body { font-family: 'Inter', 'Noto Sans JP', sans-serif; }
    </style>
</head>
<body class="bg-[#fffbfb] text-slate-900 antialiased min-h-screen">
    <header class="bg-slate-950 text-white py-14 px-4 border-b border-rose-950 relative overflow-hidden">
        <div class="max-w-6xl mx-auto text-center relative z-10">
            <span class="text-xs font-bold tracking-widest text-rose-400 uppercase bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30">⚠️ AGE VERIFICATION: 18+ ONLY</span>
            <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight mt-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-rose-200 to-pink-300">
                🔞 ${SITE_TITLE}
            </h1>
            <p class="mt-3 text-sm text-rose-300/80 max-w-xl mx-auto font-light">
                言葉責め、公開プレイ、尊厳破壊……。紳士の性癖を深く抉る「羞恥系コミック・同人誌」のみを厳選し、毎晩その魅力を限界まで語り尽くす特化型レビューメディア。
            </p>
            <div class="mt-4 text-xs text-rose-400 font-medium">最終更新: ${displayDate}</div>
        </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-12">
        <div class="bg-rose-50 border border-rose-200 p-4 rounded-xl text-center text-xs text-rose-800 mb-8 font-medium">
            當サイトは成人向け（R-18）の表現を含みます。18歳未満の方の閲覧は固くお断りいたします。
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 space-y-6">
                <h2 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span class="w-2 h-6 bg-rose-600 rounded-full"></span>
                    <span>本日のおすすめ羞恥コミック（最新情報）</span>
                </h2>
                ${cards}
            </div>
            <div class="lg:col-span-1">
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-rose-50 sticky top-6">
                    <h2 class="text-md font-bold text-slate-900 mb-4 pb-3 border-b border-rose-100 flex items-center gap-2">
                        <span>過去のバックナンバー</span>
                    </h2>
                    <ul class="space-y-2">
                        ${archiveLinks.length > 0 ? archiveLinks : '<li class="text-xs text-slate-400 text-center py-4">ログはまだありません。</li>'}
                    </ul>
                </div>
            </div>
        </div>
    </main>
    <footer class="mt-24 bg-slate-950 text-rose-300/40 py-12 px-4 border-t border-rose-950 text-center text-xs">
        <div class="max-w-6xl mx-auto">
            <p>© ${new Date().getFullYear()} ${SITE_TITLE}. All Rights Reserved. 18+ Only.</p>
        </div>
    </footer>
</body>
</html>
    `;
}

main();