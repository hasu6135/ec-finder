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
const SITE_DOMAIN = 'https://yourdomain.com'; // 💡【SEO対策】あなたのサイトの実際のURL(ドメイン)に書き換えてください

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
    // 💡JSON文字列にした後、改行コード(\n)をWindows標準(\r\n)に強制置換して保存する
    const jsonString = JSON.stringify(data, null, 2).replace(/\r?\n/g, '\r\n');
    fs.writeFileSync(DB_FILE, jsonString, 'utf-8');
}

/**
 * ✨ [新設] Googleサーチコンソール用の sitemap.xml を全自動で作成する関数
 */
function generateSitemap(articles, tags) {
    const today = new Date().toISOString().split('T')[0];
    let xmlUrls = [];
    
    // 総合トップ
    xmlUrls.push(`  <url>\n    <loc>${SITE_DOMAIN}/index.html</loc>\n    <lastmod>${today}</lastmod>\n    <priority>1.0</priority>\n  </url>`);
    
    // 全レビュー詳細
    articles.forEach(art => {
        xmlUrls.push(`  <url>\n    <loc>${SITE_DOMAIN}/posts/${art.id}.html</loc>\n    <lastmod>${today}</lastmod>\n    <priority>0.8</priority>\n  </url>`);
    });
    
    // 全タグ別一覧
    tags.forEach(tag => {
        xmlUrls.push(`  <url>\n    <loc>${SITE_DOMAIN}/tags/${encodeURIComponent(tag)}.html</loc>\n    <lastmod>${today}</lastmod>\n    <priority>0.6</priority>\n  </url>`);
    });

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlUrls.join('\n')}\n</urlset>`;
    fs.writeFileSync('sitemap.xml', sitemapXml.replace(/\r?\n/g, '\r\n'), 'utf-8');
    console.log(`🤖 [SEO対策] 最新の sitemap.xml をルートに自動書き出ししました（合計: ${xmlUrls.length} 件のURL）`);
}

/**
 * ===================================================
 * 🚀 メイン処理（フルスペック集客自動化エンジン）
 * ===================================================
 */
async function main() {
    try {
        // 必要なフォルダの自動作成
        if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR);
        if (!fs.existsSync('posts')) fs.mkdirSync('posts');
        if (!fs.existsSync(TAGS_DIR)) fs.mkdirSync(TAGS_DIR);

        // 💡 1. 過去に作成した全記事データをデータベースから読み込む
        const dbArticles = loadDatabase();
        console.log(`📦 現在のデータベース内の記事数: ${dbArticles.length} 件`);

        // すでに存在する記事のIDをセット化（高速チェック用）
        const existingIds = new Set(dbArticles.map(a => a.id));

        // 2. DMMから最新の作品を取得
        const products = await fetchDmmProducts(DMM_API_ID, DMM_AFFILIATE_ID, FETCH_COUNT);
        if (products.length === 0) return console.log('⚠️ 作品データが0件のため終了します。');

        let newAddedCount = 0;

        console.log(`🤖 重複スキップ機能付き・自動蓄積エンジンを開始...`);

        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            const articleId = generateSafeId(product.title);

            // 💡 3. 重複チェック：すでに作ったことがある作品ならスキップ！
            if (existingIds.has(articleId)) {
                console.log(`\n⏭️ スキップ [${i + 1}/${products.length}]: 「${product.title}」は作成済みです。`);
                continue;
            }

            console.log(`\n🔥 新規作成 [${i + 1}/${products.length}]: ${product.title}`);
            newAddedCount++;
            
            // 詳細ページから実際の「生タグ」や「評価」を取得
            const detailData = await scrapeDmmProductDetail(product.url);
            
            // 💡 取得した口コミが空でないかログに出力して確認する
            console.log(`---------------------------------------------------`);
            console.log(`💬 [口コミ取得チェック]`);
            if (detailData.userReviews && detailData.userReviews !== '（ネタバレなしレビューなし）') {
                const count = detailData.userReviews.split('---').filter(Boolean).length;
                console.log(`   ✅ 口コミの取得に成功しました！（合計: ${count} 件）`);
                console.log(`   📝 サンプル: ${detailData.userReviews.substring(0, 100).replace(/\n/g, ' ')}...`);
            } else {
                console.log(`   ⚠️ 口コミが空っぽ、または「なし」のテキストになっています。`);
            }
            console.log(`---------------------------------------------------`);
            
            try {
                // AIレビュー執筆
                const formattedSummary = await generateAiReview(product, detailData);

                let perfectSampleReadLink = detailData.tachiyomiUrl 
                    ? `https://al.fanza.co.jp/?lurl=${encodeURIComponent(detailData.tachiyomiUrl)}&af_id=${DMM_AFFILIATE_ID}&ch=search_link&ch_id=link`
                    : product.url;

                // 画面から取得した本物のタグのみを使用する
                const finalTags = detailData.pageGenres && detailData.pageGenres.length > 0 
                    ? detailData.pageGenres 
                    : ["羞恥系"];

                // 💡【復活・最重要】元のメタ情報（作家・出版社・シリーズ等）を漏れなく格納
const articleData = {
    id: articleId,
    originalTitle: product.title,
    link: product.url,
    imgUrl: product.imageUrl,
    summary: formattedSummary,
    sampleReadLink: perfectSampleReadLink,
    tags: finalTags,
    pageGenres: finalTags,
    
    // 👇【対策】スクレイピングした作家・出版社などのメタデータをここに追加して保持する
    series: detailData.series,
    author: detailData.author,
    label: detailData.label,
    publisher: detailData.publisher,
    category: detailData.category,
    
    reviewRating: detailData.reviewRating,
    reviewCount: detailData.reviewCount,
    reviews: detailData.userReviews,     // 💡 template側が使いやすいように「reviews」で渡す
    createdAt: new Date().toISOString()
};

                // 💡 データベース（配列）に新しく作った記事データを追加
                dbArticles.push(articleData);
                existingIds.add(articleId); // ループ内での重複防止用

                console.log(`✅ データ追加完了: ⭐${detailData.reviewRating}`);
            } catch (itemError) {
                console.error(`⚠️ アイテム処理エラー:`, itemError.message);
            }
        }

        console.log(`\n📊 今回新しく追加された記事: ${newAddedCount} 件`);

        // 💡 新しい記事が1件でも増えていたら、データベースファイルを更新
        if (newAddedCount > 0) {
            saveDatabase(dbArticles);
            console.log(`💾 データベース(db.json)を更新しました。`);
        }

        // 💡 4. 【新設・レコメンド】「過去の全データ ＋ 今回のデータ」を元に、関連記事を計算して全個別ページをビルド・再書き出し
        console.log(`💖 全個別レビューの関連記事（レコメンド）を再計算して最適化中...`);
        dbArticles.forEach(currentArticle => {
            const recommends = dbArticles
                .filter(other => other.id !== currentArticle.id)
                .map(other => {
                    const commonTags = (currentArticle.tags || []).filter(t => (other.tags || []).includes(t));
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

        // 最新の投稿が上にくるように並び替える（新着順にする場合）
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
        generateSitemap(dbArticles, allAvailableTags);

        console.log('✨ [全自動蓄積完了] 作家・出版社データを1つも失うことなく、すべての集客機能が最新にアップデートされました！');
    } catch (error) {
        console.error('❌ 致命的なエラー:', error);
    }
}

main();