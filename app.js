const fs = require('fs');
const path = require('path');

// 分割した自作モジュールの読み込み
const { fetchDmmProducts } = require('./src/dmmApi');
const { scrapeDmmProductDetail } = require('./src/scraper');
const { generateAiReview } = require('./src/aiReviewer');
const { generateSinglePostHTML, generateTagPageHTML, generateTopPageHTML } = require('./src/template');

/**
 * ===================================================
 * ⚙️ 各種設定・定数管理
 * ===================================================
 */
const SITE_TITLE = '羞恥系コミック';
const FETCH_COUNT = 1;       // 1回のリクエストでDMM APIから取得する件数
const ARCHIVE_DIR = 'archive';
const TAGS_DIR = 'tags';
const DB_FILE = 'db.json';   
const SITE_DOMAIN = 'https://yourdomain.com'; // 💡【重要】あなたのサイトの実際のURL(ドメイン)に書き換えてください

const DMM_API_ID = 'w3pxtk1rrTgpNCQ7JzcU'; 
const DMM_AFFILIATE_ID = '132815-001'; 

function generateSafeId(title) {
    return title.replace(/[\/\\:\*\?"<>\|]/g, '').replace(/\s+/g, '_').substring(0, 50);
}

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
 * ✨ [新設] Googleサーチコンソール用の sitemap.xml を全自動で生成する関数
 */
function generateSitemap(articles, tags) {
    const today = new Date().toISOString().split('T')[0];
    
    let xmlUrls = [];
    
    // トップページ
    xmlUrls.push(`  <url>\n    <loc>${SITE_DOMAIN}/index.html</loc>\n    <lastmod>${today}</lastmod>\n    <priority>1.0</priority>\n  </url>`);
    
    // 全個別レビューページ
    articles.forEach(art => {
        xmlUrls.push(`  <url>\n    <loc>${SITE_DOMAIN}/posts/${art.id}.html</loc>\n    <lastmod>${today}</lastmod>\n    <priority>0.8</priority>\n  </url>`);
    });
    
    // 全タグページ
    tags.forEach(tag => {
        xmlUrls.push(`  <url>\n    <loc>${SITE_DOMAIN}/tags/${encodeURIComponent(tag)}.html</loc>\n    <lastmod>${today}</lastmod>\n    <priority>0.6</priority>\n  </url>`);
    });

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlUrls.join('\n')}\n</urlset>`;
    
    fs.writeFileSync('sitemap.xml', sitemapXml.replace(/\r?\n/g, '\r\n'), 'utf-8');
    console.log(`🤖 [SEO対策] 最新の sitemap.xml をルートに自動書き出ししました（合計: ${xmlUrls.length}のURL）`);
}

/**
 * ===================================================
 * 🚀 メイン処理（フルスペック集客自動化エンジン）
 * ===================================================
 */
async function main() {
    try {
        if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR);
        if (!fs.existsSync('posts')) fs.mkdirSync('posts');
        if (!fs.existsSync(TAGS_DIR)) fs.mkdirSync(TAGS_DIR);

        const dbArticles = loadDatabase();
        console.log(`📦 現在のデータベース内の記事数: ${dbArticles.length} 件`);

        const existingIds = new Set(dbArticles.map(a => a.id));

        const products = await fetchDmmProducts(DMM_API_ID, DMM_AFFILIATE_ID, FETCH_COUNT);
        if (products.length === 0) return console.log('⚠️ 作品データが0件のため終了します。');

        let newAddedCount = 0;
        console.log(`🤖 重複スキップ機能付き・自動蓄積エンジンを開始...`);

        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            const articleId = generateSafeId(product.title);

            if (existingIds.has(articleId)) {
                console.log(`\n⏭️ スキップ [${i + 1}/${products.length}]: 「${product.title}」は作成済みです。`);
                continue;
            }

            console.log(`\n🔥 新規作成 [${i + 1}/${products.length}]: ${product.title}`);
            newAddedCount++;
            
            const detailData = await scrapeDmmProductDetail(product.url);

            try {
                const formattedSummary = await generateAiReview(product, detailData);

                let perfectSampleReadLink = detailData.tachiyomiUrl 
                    ? `https://al.fanza.co.jp/?lurl=${encodeURIComponent(detailData.tachiyomiUrl)}&af_id=${DMM_AFFILIATE_ID}&ch=search_link&ch_id=link`
                    : product.url;

                const finalTags = detailData.pageGenres && detailData.pageGenres.length > 0 
                    ? detailData.pageGenres 
                    : ["羞恥系"];

                const articleData = {
                    id: articleId,
                    originalTitle: product.title,
                    link: product.url,
                    imgUrl: product.imageUrl,
                    summary: formattedSummary, 
                    sampleReadLink: perfectSampleReadLink,
                    tags: finalTags,
                    pageGenres: finalTags,
                    reviewRating: detailData.reviewRating,
                    reviewCount: detailData.reviewCount,
                    reviews: detailData.userReviews,
                    createdAt: new Date().toISOString()
                };

                dbArticles.push(articleData);
                existingIds.add(articleId);

                console.log(`✅ データ蓄積完了: ⭐${detailData.reviewRating}`);
            } catch (itemError) {
                console.error(`⚠️ アイテム処理エラー:`, itemError.message);
            }
        }

        console.log(`\n📊 今回新しく追加された記事: ${newAddedCount} 件`);

        if (newAddedCount > 0) {
            saveDatabase(dbArticles);
            console.log(`💾 データベース(db.json)を更新しました。`);
        }

        // 全個別ページへ「関連記事（レコメンド）」を計算して書き出す
        console.log(`💖 全個別レビューの関連記事を最適化中...`);
        dbArticles.forEach(currentArticle => {
            const recommends = dbArticles
                .filter(other => other.id !== currentArticle.id)
                .map(other => {
                    const commonTags = currentArticle.tags.filter(t => other.tags.includes(t));
                    return { article: other, score: commonTags.length };
                })
                .filter(item => item.score > 0) 
                .sort((a, b) => b.score - a.score || new Date(b.article.createdAt) - new Date(a.article.createdAt))
                .slice(0, 3) 
                .map(item => item.article);

            const postHtml = generateSinglePostHTML(currentArticle, SITE_TITLE, recommends);
            const postHtmlCrlf = postHtml.replace(/\r?\n/g, '\r\n');
            fs.writeFileSync(path.join('posts', `${currentArticle.id}.html`), postHtmlCrlf, 'utf-8');
        });

        // 過去データを含めた新着並び替え
        const sortedArticles = [...dbArticles].sort((a, b) => {
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });

        const tagMap = new Map();
        sortedArticles.forEach(article => {
            article.tags.forEach(tag => {
                if (!tagMap.has(tag)) tagMap.set(tag, []);
                tagMap.get(tag).push(article);
            });
        });

        const todayObj = new Date();
        const displayDate = todayObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        // 5. タグ別ページの書き出し
        console.log(`📂 全${tagMap.size}個の公式タグページを再マージ中...`);
        for (const [tagName, articles] of tagMap.entries()) {
            const tagHtml = generateTagPageHTML(tagName, articles);
            const tagHtmlCrlf = tagHtml.replace(/\r?\n/g, '\r\n');
            fs.writeFileSync(path.join(TAGS_DIR, `${tagName}.html`), tagHtmlCrlf, 'utf-8');
        }

        // 6. 総合トップページの書き出し
        const allAvailableTags = Array.from(tagMap.keys());
        const indexHtml = generateTopPageHTML(sortedArticles, displayDate, allAvailableTags, SITE_TITLE);
        const indexHtmlCrlf = indexHtml.replace(/\r?\n/g, '\r\n');
        fs.writeFileSync('index.html', indexHtmlCrlf, 'utf-8');

        // ✨ [新設] 7. サイトマップの自動生成をキック
        generateSitemap(dbArticles, allAvailableTags);

        console.log('✨ [全自動蓄積完了] サイトマップ・高評価順ランキング・OGP対応カード、すべて完了しました！');
    } catch (error) {
        console.error('❌ 致命的なエラー:', error);
    }
}

main();