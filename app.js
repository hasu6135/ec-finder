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
const FETCH_COUNT = 1;       // 1回のリクエストでDMM APIから取得する件数
const ARCHIVE_DIR = 'archive';
const TAGS_DIR = 'tags';
const DB_FILE = 'db.json';   // 💡 過去データを保存する簡易データベースファイル

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
        return []; // まだファイルがない場合は空の配列を返す
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
    // JSON文字列にした後、改行コード(\n)をWindows標準(\r\n)に強制置換して保存する
    const jsonString = JSON.stringify(data, null, 2).replace(/\r?\n/g, '\r\n');
    fs.writeFileSync(DB_FILE, jsonString, 'utf-8');
}

/**
 * ✨ [修正版] Googleサーチコンソール用の sitemap.xml を作成する関数
 */
function generateSitemap(articles, tags) {
    const today = new Date().toISOString().split('T')[0];
    let xmlUrls = [];
    
    // 💡【原因解決】先頭に https:// を強制的に追加して、Googleが認識できる絶対URLにします
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
 * 🚀 メイン処理（過去データ復旧＆海外SEOハイブリッド版）
 * ===================================================
 */
async function main() {
    try {
        // 必要なフォルダの自動作成
        if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR);
        if (!fs.existsSync('posts')) fs.mkdirSync('posts');
        if (!fs.existsSync(TAGS_DIR)) fs.mkdirSync(TAGS_DIR);

        // 💡 1. 過去の記事データを読み込む
        const dbArticles = loadDatabase();
        console.log(`📦 データベース内の記事数: ${dbArticles.length} 件 のアップデートを開始します...`);

        let updatedCount = 0;

        // 💡 既存の全データをループして、不足しているメタデータを補完する
        for (let i = 0; i < dbArticles.length; i++) {
            const article = dbArticles[i];
            
            // 💡【海外ユーザー対策】過去の記事タイトルに [Manga Raw] がついていなければ自動で追加
            if (article.originalTitle && !article.originalTitle.includes('[Manga Raw]')) {
                article.originalTitle = `${article.originalTitle} [Manga Raw]`;
                updatedCount++; // タイトル更新も変更対象とする
            }

            // すでに作家や出版社が取得できているデータはスキップ（効率化）
            if (article.author && article.publisher && article.author !== '不明' && article.publisher !== '不明') {
                // タイトルだけが更新された場合を考慮してHTMLは毎回上書き
                const postHtml = generateSinglePostHTML(article, SITE_TITLE, []);
                const postHtmlCrlf = postHtml.replace(/\r?\n/g, '\r\n');
                fs.writeFileSync(path.join('posts', `${article.id}.html`), postHtmlCrlf, 'utf-8');
                continue;
            }

            console.log(`🔄 アップデート中 [${i + 1}/${dbArticles.length}]: ${article.originalTitle}`);
            
            try {
                // 💡 過去のURLから最新の詳細データをスクレイピングし直す
                const detailData = await scrapeDmmProductDetail(article.link);
                
                // 💡 不足していたメタデータを既存のオブジェクトに上書き追加
                article.series = detailData.series;
                article.author = detailData.author;
                article.label = detailData.label;
                article.publisher = detailData.publisher;
                article.category = detailData.category;
                
                // レビュー評価なども最新のものがあれば更新
                article.reviewRating = detailData.reviewRating;
                article.reviewCount = detailData.reviewCount;
                article.reviews = detailData.userReviews;

                // 個別HTMLを再生成・上書き保存
                const postHtml = generateSinglePostHTML(article, SITE_TITLE, []);
                const postHtmlCrlf = postHtml.replace(/\r?\n/g, '\r\n');
                fs.writeFileSync(path.join('posts', `${article.id}.html`), postHtmlCrlf, 'utf-8');

                updatedCount++;
                console.log(`   ✅ 補完完了: 作家=${detailData.author} / 出版社=${detailData.publisher}`);
            } catch (itemError) {
                console.error(`   ⚠️ データの再取得に失敗しました:`, itemError.message);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`\n📊 今回アップデートされた記事: ${updatedCount} 件`);

        // 💡 1件でも更新があれば、db.json を上書き保存
        if (updatedCount > 0) {
            saveDatabase(dbArticles);
            console.log(`💾 データベース(db.json)を正常に更新しました。`);
        }

        // 💡 4. 新しくなった全データを元に、フロント画面（トップとタグ）を再構築
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

        // ✨ [新設] 7. サイトマップの自動書き出し
        try {
            generateSitemap(dbArticles, allAvailableTags);
        } catch (sitemapErr) {
            console.error('⚠️ サイトマップの書き出しに失敗:', sitemapErr.message);
        }

        console.log('✨ [データ復旧・海外対策完了] 正しい形式の sitemap.xml と海外ワードつきHTMLの出力が完了しました！');
    } catch (error) {
        console.error('❌ 致命的なエラー:', error);
    }
}

main();