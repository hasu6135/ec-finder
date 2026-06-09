const fs = require('fs');
const path = require('path');

// 分割した自作モジュールの読み込み
const { fetchDmmProducts } = require('./src/dmmApi');
const { scrapeDmmProductDetail } = require('./src/scraper');
const { generateAiReview, parseMarkdownTableToHtml } = require('./src/aiReviewer');
const { generateSinglePostHTML, generateTagPageHTML, generateTopPageHTML } = require('./src/template');

/**
 * ===================================================
 * ⚙️ 各種設定・定数管理
 * ===================================================
 */
const SITE_TITLE = '羞恥系コミック';
const FETCH_COUNT = 10;       // 💡 ここで指定した件数分、新着を一気にループ処理します！
const ARCHIVE_DIR = 'archive';
const TAGS_DIR = 'tags';
const DB_FILE = 'db.json';   // 過去データを保存する簡易データベースファイル

// 🌐【SEO・海外対策】
const SITE_DOMAIN = 'ec-finder.pages.dev'; 

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
 * ===================================================
 * 🚀 メイン処理（FETCH_COUNT回数ループ運用モード）
 * ===================================================
 */
async function main() {
    try {
        if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR);
        if (!fs.existsSync('posts')) fs.mkdirSync('posts');
        if (!fs.existsSync(TAGS_DIR)) fs.mkdirSync(TAGS_DIR);

        // 過去データの読み込み
        const dbArticles = loadDatabase();
        console.log(`📦 現在のデータベース内の記事数: ${dbArticles.length} 件`);

        // 1. FANZA（DMM）から最新商品の基本データを取得
        console.log(`\n[STEP 1/3] 🔄 最新情報を取得してAIレビュー執筆中...`);
        // 💡 FETCH_COUNT をそのままAPI関数に渡します（内部の仕様をこれでカバー）
        const products = await fetchDmmProducts(DMM_API_ID, DMM_AFFILIATE_ID, SITE_TITLE);

        if (!products || products.length === 0) {
            console.log('📭 新着商品が見つかりませんでした。');
            return;
        }

        // 💡 設定された FETCH_COUNT の件数だけ切り出してループを回す（安全対策）
        const targetProducts = products.slice(0, FETCH_COUNT);
        console.log(`📡 取得した新着候補の中から、最新の ${targetProducts.length} 件を処理します。`);

        let isDatabaseChanged = false;

        // 2. 取得した新着商品を検証・ループ処理
        for (const product of targetProducts) {
            const articleId = generateSafeId(product.title);

            // 重複チェック（すでに作成済みの記事ならスキップして高速化）
            if (dbArticles.some(art => art.id === articleId)) {
                console.log(`⏭️ スキップ: 「${product.title}」はすでに記事が存在します。`);
                continue;
            }

            console.log(`📝 新着記事を作成中: ${product.title}`);

            try {
                // 商品詳細ページをスクレイピング（作家・出版社・ユーザーレビューを取得）
                const detailData = await scrapeDmmProductDetail(product.url);

                // AIレビューの生成
                const aiReviewMarkdown = await generateAiReview(product.title, product.description);
                const aiReviewHtml = parseMarkdownTableToHtml(aiReviewMarkdown);

                // 公式タグ（ジャンル）の整理
                const officialTags = product.genre ? product.genre.map(g => g.name) : [];

                // データの格納（海外対策キーワード [Manga Raw] を自動付与）
                const articleData = {
                    id: articleId,
                    originalTitle: `${product.title} [Manga Raw]`, 
                    link: product.url,
                    image: product.imagePath?.large || product.imagePath?.list || '',
                    description: product.description || '',
                    reviewRating: detailData.reviewRating || product.review?.rating || '0.0',
                    reviewCount: detailData.reviewCount || product.review?.count || 0,
                    tags: officialTags,
                    aiReview: aiReviewHtml,
                    reviews: detailData.userReviews || [],
                    createdAt: product.date || new Date().toISOString(),
                    // スクレイピングで補完したメタデータ
                    series: detailData.series || '単行本',
                    author: detailData.author || '不明',
                    label: detailData.label || '不明',
                    publisher: detailData.publisher || '不明',
                    category: detailData.category || 'コミック'
                };

                // 💡【修正】第3引数に dbArticles を渡し、関連作品がしっかり表示されるように復活！
                const postHtml = generateSinglePostHTML(articleData, SITE_TITLE, dbArticles);
                const postHtmlCrlf = postHtml.replace(/\r?\n/g, '\r\n');
                fs.writeFileSync(path.join('posts', `${articleId}.html`), postHtmlCrlf, 'utf-8');

                // データベース配列の先頭に追加
                dbArticles.unshift(articleData);
                isDatabaseChanged = true;
                console.log(`   ✅ 記事生成が完了しました！ (作家: ${articleData.author})`);

            } catch (itemError) {
                console.error(`   ❌ この商品の処理中にエラーが発生しました:`, itemError.message);
            }

            // 連続アクセス対策として、複数件処理時は1秒待機
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
        const sortedArticles = [...dbArticles].sort((a, b) => {
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });

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

        // 総合トップページの書き出し
        const allAvailableTags = Array.from(tagMap.keys());
        const indexHtml = generateTopPageHTML(sortedArticles, displayDate, allAvailableTags, SITE_TITLE);
        const indexHtmlCrlf = indexHtml.replace(/\r?\n/g, '\r\n');
        fs.writeFileSync('index.html', indexHtmlCrlf, 'utf-8');

        // [STEP 3/3] サイトマップの強制書き出し
        console.log(`\n[STEP 3/3] 🤖 検索エンジン対策を適用中...`);
        try {
            generateSitemap(dbArticles, allAvailableTags);
        } catch (sitemapErr) {
            console.error('⚠️ サイトマップの書き出しに失敗:', sitemapErr.message);
        }

        console.log('\n✨ [すべての処理が正常終了] 指定件数分のループ処理が完了しました！');
    } catch (error) {
        console.error('❌ 致命的なエラー:', error);
    }
}

main();