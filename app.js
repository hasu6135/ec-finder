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
 * ===================================================
 * 🚀 メイン処理（全自動蓄積エンジン）
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
            
			// 💡【追加】取得した口コミが空でないかログに出力して確認する
            console.log(`---------------------------------------------------`);
            console.log(`💬 [口コミ取得チェック]`);
            if (detailData.userReviews && detailData.userReviews !== '（ネタバレなしレビューなし）') {
                const count = detailData.userReviews.split('---').filter(Boolean).length;
                console.log(`   ✅ 口コミの取得に成功しました！（合計: ${count} 件）`);
                // 最初の1件の冒頭部分だけをチラ見せでログに出す
                console.log(`   📝 サンプル: ${detailData.userReviews.substring(0, 100).replace(/\n/g, ' ')}...`);
            } else {
                console.log(`   ⚠️ 口コミが空っぽ、または「なし」のテキストになっています。`);
            }
            console.log(`---------------------------------------------------`);
            
			try {
    			// AIレビュー執筆（aiReviewer.js側で完璧に成形されたHTML文字列が直接返ってきます）
   				const formattedSummary = await generateAiReview(product, detailData);

                let perfectSampleReadLink = detailData.tachiyomiUrl 
                    ? `https://al.fanza.co.jp/?lurl=${encodeURIComponent(detailData.tachiyomiUrl)}&af_id=${DMM_AFFILIATE_ID}&ch=search_link&ch_id=link`
                    : product.url;

                // 画面から取得した本物のタグのみを使用する
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
    reviews: detailData.userReviews,     // 💡 template側が使いやすいように「reviews」で渡す
    createdAt: new Date().toISOString()
};

				// 個別HTMLの保存
                const postHtml = generateSinglePostHTML(articleData, SITE_TITLE);
                // 💡 改行コードをWindowsのCRLFに置換して保存
                const postHtmlCrlf = postHtml.replace(/\r?\n/g, '\r\n');
                fs.writeFileSync(path.join('posts', `${articleId}.html`), postHtmlCrlf, 'utf-8');

                // 💡 データベース（配列）に新しく作った記事データを追加
                dbArticles.push(articleData);
                existingIds.add(articleId); // ループ内での重複防止用

                console.log(`✅ 記事生成完了: ⭐${detailData.reviewRating}`);
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

        // 💡 4. 【最重要】「過去の全データ ＋ 今回のデータ」を元に、フロント画面を再構築する
        // 最新の投稿が上にくるように並び替える（新着順にする場合）
        // ※今回はcreatedAtプロパティを基準にソート。なければそのままの順。
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
            // 💡 改行コードをWindowsのCRLFに置換して保存
            const tagHtmlCrlf = tagHtml.replace(/\r?\n/g, '\r\n');
            fs.writeFileSync(path.join(TAGS_DIR, `${tagName}.html`), tagHtmlCrlf, 'utf-8');
        }

        // 6. 総合トップページの書き出し
        const allAvailableTags = Array.from(tagMap.keys());
        const indexHtml = generateTopPageHTML(sortedArticles, displayDate, allAvailableTags, SITE_TITLE);
        // 💡 改行コードをWindowsのCRLFに置換して保存
        const indexHtmlCrlf = indexHtml.replace(/\r?\n/g, '\r\n');
        fs.writeFileSync('index.html', indexHtmlCrlf, 'utf-8');

        console.log('✨ [全自動蓄積完了] 既存の記事を破壊せず、新しい記事だけが美しく積み上がりました！');
    } catch (error) {
        console.error('❌ 致命的なエラー:', error);
    }
}

main();