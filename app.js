const fs = require('fs');
const path = require('path');

// 分割した自作モジュールの読み込み
const { fetchDmmProducts } = require('./src/dmmApi');
const { scrapeDmmProductDetail } = require('./src/scraper');
const { generateAiReview, parseMarkdownTableToHtml } = require('./src/aiReviewer');
const { generateSinglePostHTML, generateTagPageHTML, generateTopPageHTML, generateSearchPageHTML } = require('./src/template');

/**
 * ===================================================
 * ⚙️ 各種設定・定数管理
 * ===================================================
 */
const SITE_TITLE = '羞恥系コミック専門メディア';
const FETCH_COUNT = 1;       // 💡 ここで指定した件数分、新着を一気にループ処理します！（100以下）
const ARCHIVE_DIR = 'archive';
const TAGS_DIR = 'tags';
const DB_FILE = 'db.json';   // 過去データを保存する簡易データベースファイル

// 🌐【SEO・海外対策】
const SITE_DOMAIN = 'ec-finder-comic.com'; 

const DMM_API_ID = 'w3pxtk1rrTgpNCQ7JzcU'; 
const DMM_AFFILIATE_ID = '132815-001'; 

function generateSafeId(title) {
    return title.replace(/[\/\\:\*\?"<>\|]/g, '').replace(/\s+/g, '_').substring(0, 50);
}

/**
 * 💾 データベース（db.json）を読み書きするヘルパー関数
 */
function loadDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        return [];
    }
    try {
        const rawData = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(rawData);
    } catch (e) {
        console.error('⚠️ DBファイルの読み込みに失敗したため、リセットします:', e.message);
        return [];
    }
}

function saveDatabase(data) {
    const jsonString = JSON.stringify(data, null, 2).replace(/\r?\n/g, '\r\n');
    fs.writeFileSync(DB_FILE, jsonString, 'utf-8');
}

/**
 * ✨ Googleサーチコンソール用の sitemap.xml を作成する関数
 */
function generateSitemap(articles, tags) {
    const today = new Date().toISOString().split('T')[0];
    let xmlUrls = [];
    const baseUrl = `https://${SITE_DOMAIN}`;
    
    // 総合トップ
    xmlUrls.push(`  <url>\n    <loc>${baseUrl}/index.html</loc>\n    <lastmod>${today}</lastmod>\n    <priority>1.0</priority>\n  </url>`);
    
    // 全レビュー詳細
    articles.forEach(art => {
        xmlUrls.push(`  <url>\n    <loc>${baseUrl}/posts/${art.id}.html</loc>\n    <lastmod>${today}</lastmod>\n    <priority>0.8</priority>\n  </url>`);
    });
    
    // 全タグ別一覧
    tags.forEach(tag => {
        xmlUrls.push(`  <url>\n    <loc>${baseUrl}/tags/${encodeURIComponent(tag)}.html</loc>\n    <lastmod>${today}</lastmod>\n    <priority>0.6</priority>\n  </url>`);
    });

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlUrls.join('\n')}\n</urlset>`;
    fs.writeFileSync('sitemap.xml', sitemapXml.replace(/\r?\n/g, '\r\n'), 'utf-8');
    console.log(`🤖 [SEO対策] 最新の sitemap.xml をルートに自動書き出ししました（合計: ${xmlUrls.length} 件のURL）`);
}

/**
 * ✨ Googleサーチコンソール用の sitemap.xml を作成する関数（分割トップ対応版）
 */
function generateSitemapWithPages(articles, tags, totalPages) {
    const today = new Date().toISOString().split('T')[0];
    let xmlUrls = [];
    const baseUrl = `https://${SITE_DOMAIN}`;
    
    // 1. 分割されたすべてのトップページを登録
    for (let i = 1; i <= totalPages; i++) {
        const pageName = i === 1 ? 'index.html' : `index${i}.html`;
        const priority = i === 1 ? '1.0' : '0.9'; // 2ページ目以降も重要なので0.9
        xmlUrls.push(`  <url>\n    <loc>${baseUrl}/${pageName}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority}</priority>\n  </url>`);
    }
    
    // 2. 全レビュー詳細ページを登録
    articles.forEach(art => {
        xmlUrls.push(`  <url>\n    <loc>${baseUrl}/posts/${art.id}.html</loc>\n    <lastmod>${today}</lastmod>\n    <priority>0.8</priority>\n  </url>`);
    });
    
    // 3. 全タグ別一覧ページを登録（URLエンコード適用）
    tags.forEach(tag => {
        xmlUrls.push(`  <url>\n    <loc>${baseUrl}/tags/${encodeURIComponent(tag)}.html</loc>\n    <lastmod>${today}</lastmod>\n    <priority>0.6</priority>\n  </url>`);
    });

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlUrls.join('\n')}\n</urlset>`;
    fs.writeFileSync('sitemap.xml', sitemapXml.replace(/\r?\n/g, '\r\n'), 'utf-8');
    console.log(`🤖 [SEO対策] 最新の sitemap.xml をルートに自動書き出ししました（合計: ${xmlUrls.length} 件のURL）`);
}

/**
 * ===================================================
 * 🚀 メイン処理（FETCH_COUNT回数ループ運用モード）
 * ===================================================
 */
async function main() {
    try {
        if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR);
        if (!fs.existsSync('posts')) fs.mkdirSync('posts');
        if (!fs.existsSync(TAGS_DIR)) fs.mkdirSync(TAGS_DIR);

		// --------------------------------------------------
        // 🖥️ 【追加】LM Studio の起動確認（ヘルスチェック）
        // --------------------------------------------------
        console.log('🤖 [ヘルスチェック] LM Studio が起動しているか確認中...');
        try {
            // LM Studio の標準的なローカルモデル一覧エンドポイントにリクエスト
            const lmCheck = await fetch('http://localhost:1234/v1/models', { method: 'GET' });
            if (!lmCheck.ok) {
                throw new Error(`ステータスコード: ${lmCheck.status}`);
            }
            console.log('✅ LM Studio の起動を確認しました。処理を続行します。');
        } catch (lmError) {
            console.error('\n❌ 【警告】LM Studio が起動していない、またはポート番号(1234)が異なります！');
            console.error('💡 対策: LM Studio を起動し、「Local Server」タブからサーバーを開始（Start Server）してください。');
            console.error(`詳細エラー: ${lmError.message}\n`);
            return; // 🛑 ここで安全にプログラムを終了（DMM APIを無駄に叩かない）
        }
        // --------------------------------------------------

        // 過去データの読み込み
        const dbArticles = loadDatabase();
        console.log(`📦 現在のデータベース内の記事数: ${dbArticles.length} 件`);

        // 1. FANZA（DMM）から最新商品の基本データを取得
        console.log(`\n[STEP 1/3] 🔄 DMMから3つのソート順で新着候補を収穫中...`);
        // 💡 FETCH_COUNT をそのままAPI関数に渡します（内部の仕様をこれでカバー）
        // 💡 3つのソート順でそれぞれAPIを叩く
        const rawDateProducts   = await fetchDmmProducts(DMM_API_ID, DMM_AFFILIATE_ID, SITE_TITLE, FETCH_COUNT, 'date');
        const rawReviewProducts = await fetchDmmProducts(DMM_API_ID, DMM_AFFILIATE_ID, SITE_TITLE, FETCH_COUNT, 'review');
        const rawRankProducts   = await fetchDmmProducts(DMM_API_ID, DMM_AFFILIATE_ID, SITE_TITLE, FETCH_COUNT, 'rank');
        
        // 💡 取得した全リストを一つの配列にマージ
        const allProducts = [...rawDateProducts, ...rawReviewProducts, ...rawRankProducts];
        
        if (allProducts.length === 0) {
            console.log('📭 全てのソート順で新着商品が見つかりませんでした。');
            return;
        }
        
        // タイトルの重複を排除して、ユニークなターゲットリストを作成
        const seenUrls = new Set();
        const targetProducts = [];
        for (const p of allProducts) {
            if (!seenUrls.has(p.rawUrl)) {
                seenUrls.add(p.rawUrl);
                targetProducts.push(p);
            }
        }
		console.log(`📡 重複を排除し、合計 ${targetProducts.length} 件のユニーク作品をAIレビュー処理します。`);

        let isDatabaseChanged = false;
		const totalTargets = targetProducts.length; // 処理する総件数（FETCH_COUNT）
        // 2. 取得した新着商品を検証・ループ処理
		for (let i = 0; i < totalTargets; i++) {
            const product = targetProducts[i];
            const currentCount = i + 1; // 現在何件目か（1スタート）

			// 進捗バー的な見出しをコンソールに出力
            console.log(`\n--------------------------------------------------`);
            console.log(`⏳ [進捗: ${currentCount} / ${totalTargets} 件目]`);
            console.log(`--------------------------------------------------`);

			const articleId = generateSafeId(product.title);

			// --------------------------------------------------
            // 🔄 【DMM API レビュー数基準】変更検知 ＆ 差分自動再更新
            // --------------------------------------------------
            const existingIndex = dbArticles.findIndex(art => art.id === articleId);
            if (existingIndex !== -1) {
                const existingArticle = dbArticles[existingIndex];
                
                // 💡 DMM API側から届いた最新のレビュー件数を取得 (APIの構造に合わせて適宜調整してください)
                const apiReviewCount = product.review && product.review.count !== undefined ? parseInt(product.review.count, 10) : 0;
                // 💡 手元（DB）に保存されている現在のレビュー件数
                const dbReviewCount = parseInt(existingArticle.reviewCount || 0, 10);

                // 💡 APIの値が手元のデータより大きい（レビューが増えた）場合のみ更新フラグをONにする
                // ※ もし減るケースや、評価（rate）の変化も検知したい場合は `apiReviewCount !== dbReviewCount` にしてもOKです
                const isNeedUpdate = apiReviewCount > dbReviewCount;

                if (isNeedUpdate) {
                    console.log(`🔥 【レビュー増加検知】「${product.title}」のレビュー件数が ${dbReviewCount}件 ➔ ${apiReviewCount}件 に増加しました。スクレイピングで中身を再更新します...`);
                    
                    let detailData = {};
                    try {
                        // レビュー数が増えているので、ここで確実にスクレイピングを走らせて最新のレビューテキストや情報を掴みに行く
                        detailData = await scrapeDmmProductDetail(product.rawUrl || product.url) || {};
                    } catch (scrapingError) {
                        console.error(`⚠️ 差分更新用スクレイピングでエラーが発生しました:`, scrapingError.message);
                    }

                    // スクレイピングで取れた最新のレビュー情報を反映（なければAPIの値、それもなければ既存の値を維持）
                    const finalRating = detailData.reviewRating || product.review?.rate || existingArticle.reviewRating || '0.0';
                    const finalCount = detailData.reviewCount !== undefined ? detailData.reviewCount : apiReviewCount;

                    // 💡 DBのデータを最新情報にアップデート
                    dbArticles[existingIndex].reviewRating = finalRating.toString();
                    dbArticles[existingIndex].reviewCount = parseInt(finalCount, 10);
                    
                    // 💡 念のため確認日時も今日の日付にセット
                    dbArticles[existingIndex].lastCheckedAt = new Date().toISOString();
                    
                    // 記事のHTMLを最新の評価・レビュー件数（熱量文字数など）で再生成
                    const recommendedArticles = dbArticles.filter(art => art.id !== articleId).slice(0, 5);
                    const postHtml = generateSinglePostHTML(dbArticles[existingIndex], SITE_TITLE, recommendedArticles);
                    fs.writeFileSync(path.join('posts', `${articleId}.html`), postHtml.replace(/\r?\n/g, '\r\n'), 'utf-8');

                    isDatabaseChanged = true;
                    console.log(`   ✅ レビューが増えたため、記事HTMLを最新の状態に更新しました！`);
                } else {
                    // レビュー数に変化がなければ、1ミリも通信せずに爆速スキップ！
                    console.log(`skip スキップ: 「${product.title}」はレビュー件数に変更がないためスキップします。（現在: ${dbReviewCount}件）`);
                }
                continue; // 🛑 次の商品へ
            }
            // --------------------------------------------------
            
            console.log(`📝 新着記事を作成開始！: ${product.title}`);

            try {
            	console.log(`📝 スクレイピング中・・・`);
            	
                // 商品詳細ページをスクレイピング
                const detailData = await scrapeDmmProductDetail(product.rawUrl || product.url) || {};

                // 🏷️【最重要修正】scraper.jsが取得した pageGenres を最優先で100%確実に抽出する
                let officialTags = [];
                if (detailData.pageGenres && Array.isArray(detailData.pageGenres) && detailData.pageGenres.length > 0) {
                    // scraper.jsが取ってきた極上のハッシュタグを最優先で適用！
                    officialTags = detailData.pageGenres;
                } else if (product.genre && Array.isArray(product.genre)) {
                    officialTags = product.genre.map(g => typeof g === 'object' ? (g.name || g.tagName) : g).filter(Boolean);
                }
                
                // 万が一タグが1つも取れなかった場合のセーフティ
                if (officialTags.length === 0) {
                    officialTags = ['羞恥系', 'おすすめコミック'];
                }

				console.log(`📝 AI生成中・・・`);

                // 🧠【AIバグ修正】AIに「タグを正しく格納したdetailData」を引き渡す
                detailData.pageGenres = officialTags; 

                // AIへオブジェクトごと丸々バトンパス！これでundefined警告が完全に消え去ります
                const aiReviewMarkdown = await generateAiReview(product, detailData);
                const aiReviewHtml = parseMarkdownTableToHtml(aiReviewMarkdown);

                // 💡【完全マッピング】template.jsとdb.jsonの全ての要求プロパティを100%満たす
                const articleData = {
                    id: articleId,
                    title: product.title,
                    originalTitle: `${product.title} [Manga Raw]`, 
                    link: product.url,
                    url: product.url,
                    rawUrl: product.rawUrl || product.url,
                   	sampleReadLink: detailData.tachiyomiUrl || '',  //試し読みリンク
                    description: product.description || '羞恥系おすすめの最新コミックです。',
                    reviewRating: detailData.reviewRating || product.review?.rating || '0.0',
                    reviewCount: detailData.reviewCount || product.review?.count || 0,
                    tags: officialTags,         // db.jsonや内部管理用
                    genre: product.genre || [],
                    reviews: detailData.userReviews || [],
                    createdAt: product.date || new Date().toISOString(),

                    // 🖼️【表紙画像】
                    imgUrl: detailData.imageUrl || product.imageUrl || (product.imagePath ? product.imagePath.large : ''),
                    image: detailData.imageUrl || product.imageUrl || (product.imagePath ? product.imagePath.large : ''),
                    imageUrl: detailData.imageUrl || product.imageUrl || (product.imagePath ? product.imagePath.large : ''),
                    imagePath: {
                        large: detailData.imageUrl || product.imageUrl || (product.imagePath ? product.imagePath.large : ''),
                        list: detailData.imageUrl || product.imageUrl || (product.imagePath ? product.imagePath.large : '')
                    },

                    // ✍️【本文・AIレビュー】template.jsの ${article.summary} 対策
                    summary: aiReviewHtml,
                    aiReview: aiReviewHtml,
                    reviewText: aiReviewHtml,
                    aiReviewText: aiReviewHtml,
                    content: aiReviewHtml,
                    body: aiReviewHtml,

                    // 🏷️【主要属性バッジ】template.jsの ${article.pageGenres} 呼び出しに100%適合
                    pageGenres: officialTags, 
                    series: detailData.series || product.series || '単行本',
                    author: detailData.author || product.author || '不明',
                    maker: detailData.author || product.author || '不明', 
                    label: detailData.label || product.label || '不明',
                    publisher: detailData.publisher || product.publisher || '不明',
                    category: detailData.category || 'コミック'
                };

				// 💡 今読んでいる記事を除外した上で、最新の5件をおすすめに表示する
                const recommendedArticles = dbArticles
                    .filter(art => art.id !== articleId)
                    .slice(0, 5);
                const postHtml = generateSinglePostHTML(articleData, SITE_TITLE, recommendedArticles);
                const postHtmlCrlf = postHtml.replace(/\r?\n/g, '\r\n');
                fs.writeFileSync(path.join('posts', `${articleId}.html`), postHtmlCrlf, 'utf-8');

                dbArticles.unshift(articleData);
                isDatabaseChanged = true;
                console.log(`   ✅ 記事生成が完了しました！ (取得タグ: [${officialTags.join(', ')}])`);

            } catch (itemError) {
                console.error(`   ❌ この商品の処理中にエラーが発生しました:`, itemError.message);
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // 💡 変化があった場合のみ db.json を更新
        if (isDatabaseChanged) {
            saveDatabase(dbArticles);
            console.log(`💾 データベース(db.json)に新着データを保存しました。`);
        } else {
            console.log(`💤 新しい追加データはありませんでした。`);
        }

        // [STEP 2/3] フロント画面の再構築（記事一覧のソート）
        console.log(`\n[STEP 2/3] 🌐 フロント画面（トップ・タグ別ページ）を再マージ中...`);
        /*
        // これは配信日順
        const sortedArticles = [...dbArticles].sort((a, b) => {
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
        */
        // 記事作成日順
		const sortedArticles = [...dbArticles];
		
        // タグマップの作成
        const tagMap = new Map();
        sortedArticles.forEach(article => {
            article.tags.forEach(tag => {
                if (!tagMap.has(tag)) tagMap.set(tag, []);
                tagMap.get(tag).push(article);
            });
        });

        const todayObj = new Date();
        const displayDate = todayObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        // タグ別ページの書き出し
        for (const [tagName, articles] of tagMap.entries()) {
            const tagHtml = generateTagPageHTML(tagName, articles);
            const tagHtmlCrlf = tagHtml.replace(/\r?\n/g, '\r\n');
            fs.writeFileSync(path.join(TAGS_DIR, `${tagName}.html`), tagHtmlCrlf, 'utf-8');
        }

		// ② 【20件ずつ】の総合トップページ量産ロジック
        const COUNT_PER_PAGE = 20; // 1ページあたりの件数
        const totalPages = Math.ceil(sortedArticles.length / COUNT_PER_PAGE) || 1; // 記事0件対策で最低1
        const allAvailableTags = Array.from(tagMap.keys());

        for (let page = 1; page <= totalPages; page++) {
            // そのページに表示する20件を正確にスライス
            const start = (page - 1) * COUNT_PER_PAGE;
            const end = start + COUNT_PER_PAGE;
            const slicedArticles = sortedArticles.slice(start, end);

            // 拡張した template.js の関数を呼び出し（page と totalPages を渡す）
            const indexHtml = generateTopPageHTML(
                slicedArticles, 
                displayDate, 
                allAvailableTags, 
                SITE_TITLE, 
                page, 
                totalPages,
                sortedArticles
            );
            const indexHtmlCrlf = indexHtml.replace(/\r?\n/g, '\r\n');

            // ファイル名の割り当て（1ページ目は index.html、2ページ目以降は index2.html, index3.html...）
            const fileName = page === 1 ? 'index.html' : `index${page}.html`;
            fs.writeFileSync(fileName, indexHtmlCrlf, 'utf-8');
            console.log(` 🏠 トップページ生成完了: ${fileName} (${page}/${totalPages} ページ)`);
        }

		// ===================================================
        // 🔍 【ここを追加！】検索専用ページ (search.html) の自動書き出し
        // ===================================================
        console.log('\n🔍 [STEP 2.5] 検索専用ページ（search.html）を生成中...');
        const searchHtml = generateSearchPageHTML(SITE_TITLE);
        const searchHtmlCrlf = searchHtml.replace(/\r?\n/g, '\r\n');
        // ルート直下（index.html と同じ階層）に書き出します
        fs.writeFileSync('search.html', searchHtmlCrlf, 'utf-8');
        console.log(' ✅ 検索専用ページ（search.html）の生成が完了しました！');
        // ===================================================

        // [STEP 3/3] サイトマップの強制書き出し
        console.log(`\n[STEP 3/3] 🤖 検索エンジン対策を適用中...`);
        try {
			// 元々の関数だと index.html しか登録されないため、分割されたトップページ数（totalPages）も一緒に引き渡します
            generateSitemapWithPages(dbArticles, allAvailableTags, totalPages);
        } catch (sitemapErr) {
            console.error('⚠️ サイトマップの書き出しに失敗:', sitemapErr.message);
        }

        console.log('\n✨ [すべての処理が正常終了] 指定件数分のループ処理が完了しました！');
    } catch (error) {
        console.error('❌ 致命的なエラー:', error);
    }
}

main();