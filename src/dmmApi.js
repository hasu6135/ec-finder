/**
 * ===================================================
 * 📡 DMM API 通信モジュール（Node.js標準 fetch 版）
 * ===================================================
 */
async function fetchDmmProducts(apiId, affiliateId, siteTitle) {
    try {
        // 💡 アフィリエイトIDの末尾を適切に調整するロジックはそのまま維持
        const finalAffiliateId = affiliateId.endsWith('-001') ? affiliateId.replace('-001', '-990') : affiliateId;
        console.log('📡 DMM APIへリクエストを送信中...');
        
        // 💡 検索キーワードはサイトタイトル（siteTitle）をそのまま再利用するか、固定の「羞恥」にするか選べます
        // ここでは、元々のコードにあった「羞恥」で確実に検索できるように固定指定しています
		const searchKeyword = '羞恥'; 
        // 💡 3つ目の引数（siteTitle）の代わりにFETCH_COUNT分の数字が渡ってくる挙動に対応
        const fetchCount = typeof siteTitle === 'number' ? siteTitle : 10;

        // URLとクエリパラメータの組み立て
        const url = new URL('https://api.dmm.com/affiliate/v3/ItemList');
        url.searchParams.append('api_id', apiId);
        url.searchParams.append('affiliate_id', finalAffiliateId);
        url.searchParams.append('site', 'FANZA');
        url.searchParams.append('service', 'ebook');
        url.searchParams.append('floor', 'comic');
        url.searchParams.append('keyword', searchKeyword);
        url.searchParams.append('hits', fetchCount.toString());
        url.searchParams.append('sort', 'rank');
        url.searchParams.append('output', 'json');

        // 💡 Node.js標準の fetch を使用（axiosは不要）
        const response = await fetch(url.toString());
        
        if (!response.ok) {
            throw new Error(`HTTPエラー! ステータス: ${response.status}`);
        }

        const data = await response.json();

        if (!data.result || !data.result.items) {
            return [];
        }

        // 💡 app.js が期待するデータ構造（オブジェクトのキー名）に変換して返却
        return data.result.items.map(item => {
            const encodedRawUrl = encodeURIComponent(item.URL);
            // 成果発生用の完璧なアフィリエイトURLを生成
            const perfectAffiliateUrl = `https://al.fanza.co.jp/?lurl=${encodedRawUrl}&af_id=${affiliateId}&ch=search_link&ch_id=link`;
            
            // ジャンル（タグ）の配列を抽出
            const officialKeywords = item.iteminfo?.keyword ? item.iteminfo.keyword.map(k => k.name) : [];

            return {
                title: item.title,
                url: perfectAffiliateUrl, 
                // 💡 app.js の「product.imagePath?.large」に合わせるため、構造をシミュレート
                imagePath: {
                    large: item.imageURL?.large || item.imageURL?.list || ''
                },
                // 💡 app.js の「product.genre」に合わせるため、構造をシミュレート
                genre: officialKeywords.map(name => ({ name })),
                description: item.review?.comment || '' // 💡説明文のフォールバック
            };
        });
    } catch (error) {
        console.error('⚠️ DMM API取得エラー:', error.message);
        return [];
    }
}

module.exports = { fetchDmmProducts };