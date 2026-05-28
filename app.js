const fs = require('fs');
const path = require('path');

const { fetchDmmProducts } = require('./src/dmmApi');
const { scrapeDmmProductDetail } = require('./src/scraper');
const { generateAiReview, parseMarkdownTableToHtml } = require('./src/aiReviewer');
const { generateSinglePostHTML, generateTagPageHTML, generateTopPageHTML } = require('./src/template');

const SITE_TITLE = '羞恥系コミック';
const FETCH_COUNT = 2; 
const ARCHIVE_DIR = 'archive';
const TAGS_DIR = 'tags';

const DMM_API_ID = 'w3pxtk1rrTgpNCQ7JzcU'; 
const DMM_AFFILIATE_ID = '132815-001'; 

function generateSafeId(title) {
    return title.replace(/[\/\\:\*\?"<>\|]/g, '').replace(/\s+/g, '_').substring(0, 50);
}

async function main() {
    try {
        if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR);
        if (!fs.existsSync('posts')) fs.mkdirSync('posts');
        if (!fs.existsSync(TAGS_DIR)) fs.mkdirSync(TAGS_DIR);

        const products = await fetchDmmProducts(DMM_API_ID, DMM_AFFILIATE_ID, FETCH_COUNT);
        if (products.length === 0) return console.log('⚠️ 作品データが0件のため終了します。');

        const summarizedArticles = [];
        const tagMap = new Map();

        console.log(`🤖 拡張エンジンによる、レビュー執筆・詳細タグ取得を開始...`);

        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            console.log(`\n[${i + 1}/${products.length}] ターゲット: ${product.title}`);
            
            const detailData = await scrapeDmmProductDetail(product.url);

            try {
                const { rawContent, tags } = await generateAiReview(product, detailData);

                let summary = rawContent.replace(/```html/g, '').replace(/```/g, '').replace(/##+/g, '').replace(/\*\*/g, '').replace(/---+/g, '').replace(/#/g, '').trim();
                const tableParsedSummary = parseMarkdownTableToHtml(summary);
                const formattedSummary = tableParsedSummary.replace(/\n/g, '<br>');

                let perfectSampleReadLink = detailData.tachiyomiUrl 
                    ? `https://al.fanza.co.jp/?lurl=${encodeURIComponent(detailData.tachiyomiUrl)}&af_id=${DMM_AFFILIATE_ID}&ch=search_link&ch_id=link`
                    : product.url;

                const articleId = generateSafeId(product.title);
                
                // 💡詳細ページから抜いたタグと評価をオブジェクトに統合
                const articleData = {
                    id: articleId,
                    originalTitle: product.title,
                    link: product.url,
                    imgUrl: product.imageUrl,
                    summary: formattedSummary,
                    sampleReadLink: perfectSampleReadLink,
                    tags: tags,
                    pageGenres: detailData.pageGenres,       // 💡追加
                    reviewRating: detailData.reviewRating,   // 💡追加
                    reviewCount: detailData.reviewCount      // 💡追加
                };

                const postHtml = generateSinglePostHTML(articleData, SITE_TITLE);
                fs.writeFileSync(path.join('posts', `${articleId}.html`), postHtml, 'utf-8');

                summarizedArticles.push(articleData);
                tags.forEach(tag => {
                    if (!tagMap.has(tag)) tagMap.set(tag, []);
                    tagMap.get(tag).push(articleData);
                });

                console.log(`✅ 完了: ⭐${detailData.reviewRating} [公式タグ: ${detailData.pageGenres.length}個]`);
            } catch (itemError) {
                console.error(`⚠️ アイテム処理エラー:`, itemError.message);
            }
        }

        const todayObj = new Date();
        const displayDate = todayObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        for (const [tagName, articles] of tagMap.entries()) {
            const tagHtml = generateTagPageHTML(tagName, articles);
            fs.writeFileSync(path.join(TAGS_DIR, `${tagName}.html`), tagHtml, 'utf-8');
        }

        const allAvailableTags = Array.from(tagMap.keys());
        const indexHtml = generateTopPageHTML(summarizedArticles, displayDate, allAvailableTags, SITE_TITLE);
        fs.writeFileSync('index.html', indexHtml, 'utf-8');

        console.log('✨ すべての更新が完了しました！星評価と公式全タグが個別ページに搭載されました。');
    } catch (error) {
        console.error('❌ 致命的なエラー:', error);
    }
}

main();