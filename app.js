/**
 * ===================================================
 * 🔍 DMMの作品個別ページからレビューとサンプル画像を抽出する関数
 * ===================================================
 */
async function scrapeDmmProductDetail(affiliateUrl) {
    try {
        // 💡 魔法の逆算処理：アフィリエイトURLから生のDMM/FANZA商品ページURLを取り出す
        const urlObj = new URL(affiliateUrl);
        let rawUrl = urlObj.searchParams.get('lurl'); // 転送先の生URLを抽出

        if (!rawUrl) {
            console.log('⚠️ 生のURLが抽出できなかったため、アフィURLで直接試みます。');
            rawUrl = affiliateUrl;
        } else {
            rawUrl = decodeURIComponent(rawUrl); // 安全のためにデコード
        }

        console.log(`🔍 生の作品ページを詳細分析中...: ${rawUrl}`);
        
        // DMMの年齢認証（R18クッキー）をエミュレートしてアクセス
        const response = await axios.get(rawUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Cookie': 'age_check_done=1' // 💡 これがないと年齢確認画面に飛ばされて400や404になることがあります
            }
        });
        
        const dom = new JSDOM(response.data);
        const doc = dom.window.document;

        // 1. 購入者のレビュー（口コミ）のテキストを抽出
        const reviewElements = doc.querySelectorAll('.review__text, .commentBox, .comment, .d-review__list__comment'); 
        let userReviews = [];
        reviewElements.forEach(el => {
            const text = el.textContent.trim();
            if (text.length > 10) userReviews.push(text);
        });
        const reviewSummary = userReviews.slice(0, 3).join('\n---\n');

        // 2. サンプル画像（チラ見せ画像）のURLをすべて抽出
        // 同人誌（digital_doujin）のサンプル画像用セレクターに対応
        const sampleImgElements = doc.querySelectorAll('.sample-preview img, img[src*="pr.jpg"], img[src*="-sample"], .d-item-thumb-list img');
        let sampleImages = [];
        sampleImgElements.forEach(img => {
            let src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy');
            if (src) {
                // サムネイルを拡大画像のURLパターンに変換
                if (src.includes('pt.jpg')) src = src.replace('pt.jpg', 'pl.jpg'); 
                if (src.includes('js-')) src = src.replace('js-', ''); // 同人特有の文字置換
                if (!src.startsWith('http')) src = 'https:' + src;
                if (!sampleImages.includes(src)) sampleImages.push(src);
            }
        });

        console.log(` └ 💬 参考レビューを取得: ${userReviews.length}件`);
        console.log(` └ 📸 サンプル画像を検出: ${sampleImages.length}枚`);

        return {
            userReviews: reviewSummary || '（まだ購入者レビューがありません。あらすじから妄想してください）',
            sampleImages: sampleImages
        };

    } catch (error) {
        console.error('⚠️ 詳細ページの解析に失敗しました（スキップします）:', error.message);
        return { userReviews: '（レビュー取得エラー）', sampleImages: [] };
    }
}

/**
 * ===================================================
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
                floor: 'digital_doujin', // 👈 ここは文字列で「digital_doujin」とだけ指定するのが正解です！
                keyword: '羞恥 同人誌',   // 直接代入スタイルを維持
                hits: FETCH_COUNT,       
                sort: 'rank'             
            }
        });

        if (!response.data.result || !response.data.result.items) {
            return [];
        }

        return response.data.result.items.map(item => ({
            title: item.title,
            url: item.affiliateURL, 
            imageUrl: item.imageURL?.large || item.imageURL?.list,
            description: item.description || ''
        }));

    } catch (error) {
        console.error('⚠️ DMM API取得エラー:', error.message);
        return [];
    }
}