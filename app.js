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
 * ===================================================
 * 🚀 メイン処理（全自動蓄積・レコメンド対応エンジン）
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
                    reviews: detailData.userReviews, // reviews という名前で統一
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

        // 💡 4. 【新設】全個別ページへ「関連記事（レコメンド）」を計算して書き出す
        console.log(`💖 全個別レビューの関連記事を最適化中...`);
        dbArticles.forEach(currentArticle => {
            // 自分以外の記事を抽出し、同じタグを多く持っている順番にソート
            const recommends = dbArticles
                .filter(other => other.id !== currentArticle.id)
                .map(other => {
                    const commonTags = currentArticle.tags.filter(t => other.tags.includes(t));
                    return { article: other, score: commonTags.length };
                })
                .filter(item => item.score > 0) // 最低1つは共通タグがあるもの
                .sort((a, b) => b.score - a.score || new Date(b.article.createdAt) - new Date(a.article.createdAt))
                .slice(0, 3) // 最大3件
                .map(item => item.article);

            // 関連記事データを含めてHTMLを書き出す
            const postHtml = generateSinglePostHTML(currentArticle, SITE_TITLE, recommends);
            const postHtmlCrlf = postHtml.replace(/\r?\n/g, '\r\n');
            fs.writeFileSync(path.join('posts', `${currentArticle.id}.html`), postHtmlCrlf, 'utf-8');
        });

        // 過去データを含めた並び替え
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

        console.log('✨ [全自動蓄積完了] 関連記事を含めてすべてのページが最新にアップデートされました！');
    } catch (error) {
        console.error('❌ 致命的なエラー:', error);
    }
}

main();